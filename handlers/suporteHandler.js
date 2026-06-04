const sessoes = require('../services/sessions');
const menuSuporte = require('../menus/suporte');
const renovacao = require('../menus/suporte/renovacao');
const semSinal = require('../menus/suporte/semSinal');
const pacote = require('../menus/suporte/pacote');
const pacotePagamento = require('../menus/suporte/pacotePagamento');
const emAnalise = require('../menus/suporte/emAnalise');
const testeGratis = require('../menus/suporte/testeGratis');
const testeJaUsado = require('../menus/suporte/testeJaUsado');
const ajudaPosTeste = require('../menus/suporte/ajudaPosTeste');
const ajudaConfiguracao = require('../menus/suporte/ajudaConfiguracao');
const passosConfiguracao = require('../menus/suporte/passosConfiguracao');
const pix = require('../menus/suporte/pagamento/pix');
const cartao = require('../menus/suporte/pagamento/cartao');
const boleto = require('../menus/suporte/pagamento/boleto');
const menuPrincipal = require('../menus/menuPrincipal');
const {
    criarTesteGratis
} = require('../services/sigma');
const {
    montarWidTelefone
} = require('../services/whatsappNumero');
const {
    iniciarTeste,
    concluirTeste,
    registrarSolicitacaoManual,
    falharTeste
} = require('../services/testeGratisStore');
const {
    criarCheckoutVenda
} = require('../services/mercadopago');
const {
    buscarAssinaturasPorNumero,
    cancelarAssinaturaPorNumero,
    registrarAssinatura
} = require('../services/assinaturasStore');
const notificar =
require('../services/notificador');

module.exports = async function suporteHandler(
    client,
    numero,
    texto,
    numeroWhatsapp
) {

    const etapa = sessoes[numero];
    const chaveTelefoneTeste = `${numero}_telefone_teste`;
    const chaveAguardandoTelefone = `${numero}_aguardando_telefone_teste`;
    const chaveCheckout = `${numero}_checkout`;
    const chaveForcarRenovacao = `${numero}_forcar_renovacao`;

    async function criarTeste(numeroParaTeste) {

        const controle = iniciarTeste(numeroParaTeste);

        if (!controle.permitido) {

            const testeExistente = controle.teste;

            if (testeExistente.status === 'processando') {

                return await client.sendText(
                    numero,
                    'Ja existe uma solicitacao de teste em andamento para este numero. Aguarde os dados de acesso aqui.'
                );

            }

            sessoes[numero] = 'teste_ja_usado';

            return await testeJaUsado(
                client,
                numero
            );

        }

        try {

            const teste = await criarTesteGratis(numeroParaTeste);

            if (teste.automatico === false) {

                registrarSolicitacaoManual(numeroParaTeste);

                await notificar(
                    client,
                    'NOVO TESTE GRATIS',

`Cliente:
${numero}

Numero teste:
${teste.telefone}

Status:
Credenciais do Sigma ainda nao configuradas.`
                );

                sessoes[numero] = 'em_analise';

                return await client.sendText(
                    numero,
                    'Solicitacao de teste recebida. Nossa equipe vai liberar e enviar os dados aqui.'
                );

            }

            sessoes[numero] = 'em_analise';

            concluirTeste(
                numeroParaTeste,
                {
                    customer_id: teste.cliente?.id,
                    username: teste.cliente?.username
                }
            );

            const credenciaisTeste = extrairCredenciaisTeste(teste);

            if (credenciaisTeste.username && credenciaisTeste.password) {

                const dataCriacao = new Date(credenciaisTeste.createdAt || Date.now());
                const criadoEm = Number.isNaN(dataCriacao.getTime()) ?
                    new Date() :
                    dataCriacao;
                const vencimentoTeste = credenciaisTeste.expiresAt ||
                    new Date(
                        criadoEm.getTime() +
                        Number(process.env.SIGMA_TRIAL_HOURS || 6) * 60 * 60 * 1000
                    ).toISOString();

                registrarAssinatura({
                    numero,
                    telefone: numeroParaTeste,
                    plano: 'Teste gratis',
                    origem: 'teste_gratis',
                    credenciais: credenciaisTeste,
                    expiresAt: vencimentoTeste
                });

            }

            if (teste.mensagem) {

                await client.sendText(
                    numero,
                    teste.mensagem
                );

                sessoes[numero] = 'pos_teste';

                return await ajudaPosTeste(
                    client,
                    numero
                );

            }

            await client.sendText(
                numero,
                'Teste gratis solicitado com sucesso. Em instantes enviaremos os dados de acesso aqui.'
            );

            sessoes[numero] = 'pos_teste';

            return await ajudaPosTeste(
                client,
                numero
            );

        } catch (erro) {

            falharTeste(numeroParaTeste);

            console.log('ERRO TESTE GRATIS', erro);

            await notificar(
                client,
                'ERRO TESTE GRATIS',

`Cliente:
${numero}

Numero teste:
${numeroParaTeste}

Erro:
${erro.message}`
            );

            return await client.sendText(
                numero,
                'Nao consegui criar o teste automaticamente agora. Nossa equipe foi avisada e vai continuar seu atendimento.'
            );

        }

    }

    async function oferecerAjudaConfiguracao() {

        sessoes[numero] = 'pos_teste';

        return await ajudaPosTeste(
            client,
            numero
        );

    }

    function nomeMetodo(metodo) {

        if (metodo === 'pix') return 'PIX';
        if (metodo === 'cartao') return 'Cartao';
        if (metodo === 'boleto') return 'Boleto';

        return metodo;

    }

    function formatarDataAssinatura(valor) {

        if (!valor) return 'Nao informado';

        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) return String(valor);

        return new Intl.DateTimeFormat(
            'pt-BR',
            {
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }
        ).format(data);

    }

    function montarMensagemConsultaAssinaturas(assinaturas) {

        const acessos = assinaturas.filter(assinatura =>
            assinatura.status !== 'cancelada'
        );

        if (!acessos.length) {

            return 'Nao encontrei usuario ativo vinculado a este WhatsApp. Se voce usa outro numero no cadastro, fale com um atendente.';

        }

        const blocos = acessos.map((assinatura, indice) => [
            acessos.length > 1 ? `*Acesso ${indice + 1}*` : '*Seu acesso*',
            assinatura.nome ? `Cliente: ${assinatura.nome}` : '',
            `✅ *Usuario:* ${assinatura.username || 'Nao informado'}`,
            `✅ *Senha:* ${assinatura.password || 'Nao informado'}`,
            `🗓️ *Vencimento:* ${formatarDataAssinatura(assinatura.expiresAt)}`,
            assinatura.dns ? `🟠 *DNS:* ${assinatura.dns}` : '',
            assinatura.linkM3u ? `🟢 *M3U:* ${assinatura.linkM3u}` : ''
        ].filter(Boolean).join('\n'));

        return [
            '*Dados de acesso vinculados ao seu WhatsApp*',
            '',
            ...blocos
        ].join('\n\n');

    }

    async function consultarUsuarios() {

        if (!numeroWhatsapp) {

            return await client.sendText(
                numero,
                'Nao consegui confirmar o telefone deste WhatsApp automaticamente. Para proteger seus dados de acesso, fale com um atendente.'
            );

        }

        const assinaturas = buscarAssinaturasPorNumero(
            numero,
            numeroWhatsapp
        );

        return await client.sendText(
            numero,
            montarMensagemConsultaAssinaturas(assinaturas)
        );

    }

    function extrairCredenciaisTeste(teste) {

        const username = teste?.cliente?.username || teste?.playlist?.username || '';
        const password = teste?.cliente?.password || teste?.playlist?.password || '';
        const dns = String(teste?.playlist?.dns || '').replace(/\/$/, '');
        const dnsComBarra = dns ? `${dns}/` : '';
        const linkM3u = dns && username && password ?
            `${dns}/get.php?username=${username}&password=${password}&type=m3u_plus&output=mpegts` :
            '';

        return {
            username,
            password,
            dns: dnsComBarra,
            linkM3u,
            createdAt: teste?.cliente?.createdAt || teste?.playlist?.createdAt || new Date().toISOString(),
            expiresAt: teste?.cliente?.expiresAt || teste?.playlist?.expiresAt || ''
        };

    }

    function emailValido(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

    }

    function nomeValido(nome) {

        return String(nome || '').trim().length >= 2;

    }

    async function solicitarEmailCheckout(plano, valor, metodo) {

        sessoes[chaveCheckout] = {
            plano,
            valor,
            metodo
        };
        sessoes[numero] = 'checkout_nome';

        return await client.sendText(
            numero,

`👤 *Nome do cliente*

Informe seu nome para continuar com o pagamento.

Depois eu pergunto o email, que sera opcional.`
        );

    }

    async function solicitarEmailOpcionalCheckout() {

        sessoes[numero] = 'checkout_email';

        return await client.sendText(
            numero,

`📧 *Email para comprovante*

Informe seu email para receber a confirmacao e os dados de acesso.

Se nao quiser informar agora, digite *0* para pular.`
        );

    }

    async function enviarCheckoutPacote(plano, valor, metodo, nome, email) {

        try {

            const assinaturasRenovaveis = buscarAssinaturasPorNumero(
                numero,
                numeroWhatsapp
            ).filter(assinatura =>
                assinatura.status !== 'cancelada' &&
                assinatura.username
            );
            const assinaturaRenovavel = assinaturasRenovaveis.length === 1 ?
                assinaturasRenovaveis[0] :
                null;
            const tipoVenda = assinaturaRenovavel ? 'renovacao' : 'nova';

            const venda = await criarCheckoutVenda({
                numero,
                telefone: numeroWhatsapp,
                nome,
                email,
                plano,
                valor,
                metodo,
                tipo: tipoVenda,
                assinatura: assinaturaRenovavel ? assinatura : null
            });

            delete sessoes[chaveForcarRenovacao];

            if (metodo === 'pix') {

                const pixTexto =
                venda.pix_qr_code ||
                venda.pix_ticket_url ||
                venda.init_point;

                await client.sendText(
                    numero,

`💠 *PIX copia e cola*

Abra o aplicativo do seu banco, escolha *PIX Copia e Cola* e cole o codigo da proxima mensagem.`
                );

                await client.sendText(
                    numero,
                    pixTexto
                );

                await notificar(
                    client,
                    'LEAD DE VENDA GERADO',

`Cliente:
${numero}

Nome:
${nome || 'Nao informado'}

Plano:
${plano}

Valor:
${valor}

Forma:
${nomeMetodo(metodo)}

Tipo:
${tipoVenda === 'renovacao' ? 'Renovacao' : 'Nova assinatura'}

WhatsApp:
${venda.telefone || 'Nao informado'}

Referencia:
${venda.reference}

Checkout:
${venda.init_point}`
                );

                return;

            }

            await client.sendText(
                numero,

`💳 *Pagamento Mercado Pago*

Plano: ${plano}
Valor: ${valor}
Forma: ${nomeMetodo(metodo)}

Pague pelo link abaixo:
${venda.init_point}

Assim que o pagamento for aprovado, vou avisar aqui e nossa equipe ativa manualmente seu acesso.`
            );

            await notificar(
                client,
                'LEAD DE VENDA GERADO',

`Cliente:
${numero}

Nome:
${nome || 'Nao informado'}

Plano:
${plano}

Valor:
${valor}

Forma:
${nomeMetodo(metodo)}

Tipo:
${tipoVenda === 'renovacao' ? 'Renovacao' : 'Nova assinatura'}

WhatsApp:
${venda.telefone || 'Nao informado'}

Referencia:
${venda.reference}

Checkout:
${venda.init_point}`
            );

            return await oferecerAjudaConfiguracao();

        } catch (erro) {

            console.log('ERRO CHECKOUT MP', erro);

            await notificar(
                client,
                'ERRO CHECKOUT MP',

`Cliente:
${numero}

Plano:
${plano}

Valor:
${valor}

Forma:
${nomeMetodo(metodo)}

Erro:
${erro.message}`
            );

            return await client.sendText(
                numero,
                'Nao consegui gerar o checkout agora. Nossa equipe foi avisada e vai continuar seu atendimento.'
            );

        }


    }

    // MENU SUPORTE

    if (etapa === 'suporte') {

        if (texto === '1') {

            sessoes[numero] = 'renovacao';

            return await renovacao(client, numero);

        }

        if (texto === '2') {

            sessoes[numero] = 'sem_sinal';

            return await semSinal(client, numero);

        }

        if (texto === '3') {

            sessoes[numero] = 'pacote';

            return await pacote(client, numero);

        }

        if (texto === '5') {

            sessoes[numero] = 'teste_gratis';

            return await testeGratis(
                client,
                numero,
                numeroWhatsapp
            );

        }

        if (texto === '6') {

            return await consultarUsuarios();

        }

        
        if (texto === '4' || texto === '0') {

            sessoes[numero] = 'menu';

            return await menuPrincipal(
                client,
                numero
            );

}


        return await menuSuporte(client, numero);

    }

    // RENOVAÇÃO

    // TESTE GRATIS

    if (etapa === 'teste_ja_usado') {

        if (texto === '1') {

            sessoes[numero] = 'pacote';

            return await pacote(
                client,
                numero
            );

        }

        if (texto === '9') {

            sessoes[numero] = 'humano';

            return await client.sendText(
                numero,
                'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'menu';

            return await menuPrincipal(
                client,
                numero
            );

        }

        return await testeJaUsado(
            client,
            numero
        );

    }

    if (etapa === 'pos_teste') {

        if (texto === '6' || texto.includes('ajuda')) {

            sessoes[numero] = 'ajuda_config';

            return await ajudaConfiguracao(
                client,
                numero
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'menu';

            return await menuPrincipal(
                client,
                numero
            );

        }

        return await ajudaPosTeste(
            client,
            numero
        );

    }

    if (etapa === 'ajuda_config') {

        if (texto === '1') {

            return await passosConfiguracao.smartTv(
                client,
                numero
            );

        }

        if (texto === '2') {

            return await passosConfiguracao.computador(
                client,
                numero
            );

        }

        if (texto === '3') {

            return await passosConfiguracao.celular(
                client,
                numero
            );

        }

        if (texto === '4') {

            return await passosConfiguracao.outro(
                client,
                numero
            );

        }

        if (texto === '9') {

            sessoes[numero] = 'humano';

            return await client.sendText(
                numero,
                'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'pos_teste';

            return await ajudaPosTeste(
                client,
                numero
            );

        }

        return await ajudaConfiguracao(
            client,
            numero
        );

    }

    if (etapa === 'checkout_nome') {

        const checkout = sessoes[chaveCheckout];

        if (!checkout) {

            sessoes[numero] = 'pacote';

            return await pacote(
                client,
                numero
            );

        }

        if (!nomeValido(texto)) {

            return await client.sendText(
                numero,
                'Digite o nome do cliente para continuar.'
            );

        }

        sessoes[chaveCheckout] = {
            ...checkout,
            nome: texto.trim()
        };

        return await solicitarEmailOpcionalCheckout();

    }

    if (etapa === 'checkout_email') {

        const checkout = sessoes[chaveCheckout];

        if (!checkout) {

            sessoes[numero] = 'pacote';

            return await pacote(
                client,
                numero
            );

        }

        let email = '';

        if (
            texto !== '0' &&
            texto !== 'pular' &&
            texto !== 'nao' &&
            texto !== 'não'
        ) {

            if (!emailValido(texto)) {

                return await client.sendText(
                    numero,
                    'Email invalido. Digite um email valido ou envie *0* para pular.'
                );

            }

            email = texto;

        }

        delete sessoes[chaveCheckout];

        return await enviarCheckoutPacote(
            checkout.plano,
            checkout.valor,
            checkout.metodo,
            checkout.nome,
            email
        );

    }

    if (etapa === 'vencimento_aviso') {

        if (texto === '1') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'renovacao';

            await client.sendText(
                numero,
                'Perfeito. Como voce ja tem usuario ativo, a renovacao vai somar dias no seu vencimento atual apos a confirmacao do pagamento.'
            );

            return await renovacao(client, numero);

        }

        if (texto === '2') {

            sessoes[numero] = 'cancelamento_feedback';

            return await client.sendText(
                numero,

`Tudo bem. Antes de cancelar, se puder, conte rapidamente o motivo.

Se nao quiser responder, envie *0* para pular.`
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'menu';

            return await menuPrincipal(
                client,
                numero
            );

        }

        return await client.sendText(
            numero,

`Seu acesso esta perto do vencimento.

1️⃣ Renovar agora
2️⃣ Cancelar minha assinatura
0️⃣ Voltar ao menu`
        );

    }

    if (etapa === 'cancelamento_feedback') {

        sessoes[`${numero}_motivo_cancelamento`] = texto === '0' ? '' : texto;
        sessoes[numero] = 'cancelamento_repescagem';

        return await client.sendText(
            numero,

`Antes de cancelar de vez, posso te ajudar a manter o acesso sem trocar usuario.

1️⃣ Renovar agora
2️⃣ Cancelar assim mesmo
0️⃣ Voltar ao menu`
        );

    }

    if (etapa === 'cancelamento_repescagem') {

        if (texto === '1') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'renovacao';

            return await renovacao(client, numero);

        }

        if (texto === '2') {

            const motivo = sessoes[`${numero}_motivo_cancelamento`] || '';

            cancelarAssinaturaPorNumero(
                numero,
                motivo
            );

            delete sessoes[`${numero}_motivo_cancelamento`];
            sessoes[numero] = 'menu';

            return await client.sendText(
                numero,
                'Assinatura cancelada. Obrigado por ter ficado com a gente, esperamos ter voce de novo em breve.'
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'menu';

            return await menuPrincipal(
                client,
                numero
            );

        }

        return await client.sendText(
            numero,
            'Digite *1* para renovar agora ou *2* para cancelar assim mesmo.'
        );

    }

    if (etapa === 'teste_gratis') {

        if (sessoes[chaveAguardandoTelefone]) {

            const telefoneDigitado = montarWidTelefone(texto);

            if (!telefoneDigitado) {

                return await client.sendText(
                    numero,
                    'Nao consegui entender o numero. Digite seu WhatsApp com DDD, exemplo: 5599999999999.'
                );

            }

            sessoes[chaveTelefoneTeste] = telefoneDigitado;
            delete sessoes[chaveAguardandoTelefone];

            return await criarTeste(telefoneDigitado);

        }

        if (texto === '1') {

            const numeroParaTeste =
            numeroWhatsapp ||
            sessoes[chaveTelefoneTeste];

            if (!numeroParaTeste) {

                sessoes[chaveAguardandoTelefone] = true;

                return await client.sendText(
                    numero,
                    'Para liberar o teste, digite seu WhatsApp com DDD. Exemplo: 5599999999999.'
                );

            }

            return await criarTeste(numeroParaTeste);

        }

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        return await testeGratis(
            client,
            numero,
            numeroWhatsapp
        );

    }

    if (etapa === 'renovacao') {

        if (texto === '1') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_1';

            return await pacotePagamento(
                client,
                numero,
                '1 Mes',
                'R$ 25,00'
            );

        }

        if (texto === '2') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_3';

            return await pacotePagamento(
                client,
                numero,
                '3 Meses',
                'R$ 60,00'
            );

        }

        if (texto === '3') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_6';

            return await pacotePagamento(
                client,
                numero,
                '6 Meses',
                'R$ 110,00'
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        return await renovacao(client, numero);

    }

    // SEM SINAL

    if (etapa === 'sem_sinal') {

  
        await client.sendText(
            numero,
            '📡 Vamos verificar seu problema.'
        );

        await notificar(

            client,

            'NOVO CHAMADO SEM SINAL',

        `Cliente:
        ${numero}

        Informado:
        ${texto}`
        );

        sessoes[numero] = 'em_analise';

        return;



    }

    // EM ANALISE

    if (etapa === 'em_analise') {

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        if (texto === '9') {

            sessoes[numero] = 'humano';

            await client.sendText(
                numero,
                '👨‍💼 Atendimento encaminhado para nossa equipe.'
            );

            return;

        }

        return await emAnalise(client, numero);

    }

    // PACOTES

    if (etapa === 'pacote') {

        if (texto === '1') {

            sessoes[numero] = 'pacote_1';

            return await pacotePagamento(
                client,
                numero,
                '1 Mês',
                'R$ 25,00'
            );

        }

        if (texto === '2') {

            sessoes[numero] = 'pacote_3';

            return await pacotePagamento(
                client,
                numero,
                '3 Meses',
                'R$ 60,00'
            );

        }

        if (texto === '3') {

            sessoes[numero] = 'pacote_6';

            return await pacotePagamento(
                client,
                numero,
                '6 Meses',
                'R$ 110,00'
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        return await pacote(client, numero);

    }

    // PACOTE 1 MES

    if (etapa === 'pacote_1') {

        if (texto === '1') {

            return await solicitarEmailCheckout(
                '1 Mes',
                'R$ 25,00',
                'pix'
            );

        }

        if (texto === '2') {

            return await solicitarEmailCheckout(
                '1 Mes',
                'R$ 25,00',
                'cartao'
            );

        }

        if (texto === '3') {

            return await solicitarEmailCheckout(
                '1 Mes',
                'R$ 25,00',
                'boleto'
            );

        }

    }

    // PACOTE 3 MESES
    if (etapa === 'pacote_3') {

        if (texto === '1') {

            return await solicitarEmailCheckout(
                '3 Meses',
                'R$ 60,00',
                'pix'
            );

        }

        if (texto === '2') {

            return await solicitarEmailCheckout(
                '3 Meses',
                'R$ 60,00',
                'cartao'
            );

        }

        if (texto === '3') {

            return await solicitarEmailCheckout(
                '3 Meses',
                'R$ 60,00',
                'boleto'
            );

        }

    }

    // PACOTE 6 MESES
    if (etapa === 'pacote_6') {

        if (texto === '1') {

            return await solicitarEmailCheckout(
                '6 Meses',
                'R$ 110,00',
                'pix'
            );

        }

        if (texto === '2') {

            return await solicitarEmailCheckout(
                '6 Meses',
                'R$ 110,00',
                'cartao'
            );

        }

        if (texto === '3') {

            return await solicitarEmailCheckout(
                '6 Meses',
                'R$ 110,00',
                'boleto'
            );

        }

    }

};
