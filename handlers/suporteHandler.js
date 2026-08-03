const sessoes = require('../services/sessions');
const menuSuporte = require('../menus/suporte');
const renovacao = require('../menus/suporte/renovacao');
const renovacaoPersonalizada = require('../menus/suporte/renovacaoPersonalizada');
const semSinal = require('../menus/suporte/semSinal');
const pacote = require('../menus/suporte/pacote');
const pacotePersonalizado = require('../menus/suporte/pacotePersonalizado');
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
const encaminharAtendente = require('../services/atendimentoHumano');
const {
    agendarFollowUp
} = require('../services/followUpFunil');
const {
    registrarTesteCsv,
    marcarSaidaContratacao,
    telefoneSaiuContratacao
} = require('../services/testesCsv');
const {
    marcarLead,
    marcarLeadPorContatos,
    marcarLeadConvertido
} = require('../services/leadsCsv');
const {
    registrarPagamentoInformado
} = require('../services/pagamentosInformados');
const {
    validarCupom,
    marcarSaidaMarketing
} = require('../services/marketingCampanha');

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
    const chaveUltimoCheckout = `${numero}_ultimo_checkout`;
    const chaveForcarRenovacao = `${numero}_forcar_renovacao`;
    const chaveRenovacaoAtual = `${numero}_renovacao_atual`;
    const chaveTesteUsuario = `${numero}_teste_usuario`;
    const chavePacoteOutro = `${numero}_pacote_outro`;

    async function criarTeste(numeroParaTeste) {

        if (telefoneSaiuContratacao(numeroParaTeste)) {

            sessoes[numero] = 'teste_ja_usado';

            return await testeJaUsado(
                client,
                numero
            );

        }

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

                try {
                    registrarTesteCsv({
                        telefone: numeroParaTeste,
                        credenciais: credenciaisTeste,
                        criadoEm,
                        vencimento: vencimentoTeste,
                        horas: Number(process.env.SIGMA_TRIAL_HOURS || 6)
                    });
                    marcarLeadConvertido(
                        numeroParaTeste,
                        'teste'
                    );
                } catch (erroCsv) {
                    console.log(
                        'ERRO REGISTRAR TESTE CSV',
                        erroCsv.message
                    );
                }

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

    async function enviarMenuPacoteComFollowUp() {

        await pacote(
            client,
            numero
        );

        agendarFollowUp(
            client,
            numero,
            'compra'
        );

    }

    async function enviarPagamentoComFollowUp(plano, valor) {

        await pacotePagamento(
            client,
            numero,
            plano,
            valor
        );

        agendarFollowUp(
            client,
            numero,
            'compra'
        );

    }

    async function enviarPesquisaSatisfacao() {

        sessoes[numero] = 'satisfacao';

        return await client.sendText(
            numero,

`Antes de encerrar, sua opiniao ajuda muito.

De *1* a *5*, qual nota voce da para este atendimento?

0 - Nao opinar`
        );

    }

    function mensagemMarketingInfo() {

        return [
            '*Mais informacoes*',
            '',
            'Nosso sistema de TV entrega uma experiencia completa para assistir conteudos em casa ou no celular.',
            '',
            'Voce encontra filmes, series, conteudos das principais plataformas, canais ao vivo, esportes, novelas, desenhos e muito mais em um unico acesso.',
            '',
            'Voce pode testar antes de contratar ou usar seu cupom de desconto para ativar um pacote.',
            '',
            '1 - Adquirir agora',
            '2 - Testar gratis',
            '0 - Ir ao menu principal',
            '8 - Sair da lista'
        ].join('\n');

    }

    async function sairMarketing() {

        marcarSaidaMarketing(numeroWhatsapp || numero);
        marcarSaidaMarketing(numero);
        sessoes[numero] = 'menu';
        delete sessoes[`${numero}_marketing_detalhes`];

        return await client.sendText(
            numero,
            'Tudo bem. Removi este contato da lista de ofertas. Quando precisar, envie uma mensagem por aqui.'
        );

    }

    async function encerrarComPesquisa() {

        marcarLeadPorContatos(
            [
                numeroWhatsapp,
                numero
            ],
            'encerrado',
            'Cliente encerrou o atendimento.'
        ) || marcarLead(
            numeroWhatsapp || numero,
            'encerrado',
            'Cliente encerrou o atendimento.'
        );

        await client.sendText(
            numero,
            'Tudo bem, atendimento encerrado por aqui.'
        );

        return await enviarPesquisaSatisfacao();

    }

    function nomeMetodo(metodo) {

        if (metodo === 'pix') return 'PIX';
        if (metodo === 'cartao') return 'Cartao';
        if (metodo === 'boleto') return 'Boleto';

        return metodo;

    }

    function textoEhOpcao(numeroOpcao, ...palavras) {

        const resposta = String(texto || '').trim().toLowerCase();

        if (resposta === String(numeroOpcao)) return true;

        return palavras.some(palavra =>
            resposta.includes(String(palavra || '').toLowerCase())
        );

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

            return [
                '*Nao encontrei usuario ativo neste WhatsApp*',
                '',
                'Por seguranca, nao consigo mostrar dados de acesso usando outro numero.',
                '',
                'Se o cadastro foi feito em outro WhatsApp ou voce precisa de ajuda, fale com um atendente.',
                '',
                '━━━━━━━━━━━━━━',
                'Escolha uma opcao:',
                '9️⃣ Falar com atendente',
                '0️⃣ Voltar ao menu',
                '━━━━━━━━━━━━━━'
            ].join('\n');

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
        const acessos = assinaturas.filter(assinatura =>
            assinatura.status !== 'cancelada'
        );

        await client.sendText(
            numero,
            montarMensagemConsultaAssinaturas(acessos)
        );

        if (!acessos.length) {

            sessoes[numero] = 'usuario_nao_encontrado';
            return;

        }

        sessoes[numero] = 'pos_teste';

        return await ajudaPosTeste(
            client,
            numero
        );

    }

    function resumoAssinaturas(assinaturas) {

        const acessos = assinaturas.filter(assinatura =>
            assinatura.status !== 'cancelada' &&
            assinatura.username
        );

        if (!acessos.length) return 'Nenhum usuario ativo encontrado para este WhatsApp.';

        return acessos.map((assinatura, indice) => [
            `Acesso ${indice + 1}:`,
            `Nome: ${assinatura.nome || 'Nao informado'}`,
            `Usuario: ${assinatura.username || 'Nao informado'}`,
            `Vencimento: ${formatarDataAssinatura(assinatura.expiresAt)}`
        ].join('\n')).join('\n\n');

    }

    async function abrirChamadoSemSinal() {

        if (!numeroWhatsapp) {

            sessoes[numero] = 'humano';

            await notificar(
                client,
                'NOVO CHAMADO SEM SINAL',

`Cliente:
${numero}

Status:
Nao consegui confirmar o telefone do WhatsApp automaticamente.`
            );

            return await client.sendText(
                numero,
                'Recebi sua solicitacao, mas nao consegui confirmar seu telefone automaticamente. Para proteger seus dados, encaminhei para um atendente.'
            );

        }

        const assinaturas = buscarAssinaturasPorNumero(
            numero,
            numeroWhatsapp
        );

        await semSinal(
            client,
            numero,
            assinaturas
        );

        await notificar(
            client,
            'NOVO CHAMADO SEM SINAL',

`Cliente:
${numero}

WhatsApp:
${numeroWhatsapp}

${resumoAssinaturas(assinaturas)}`
        );

        sessoes[numero] = 'em_analise';

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

    function primeiroNome(nome) {

        return String(nome || '').trim().split(/\s+/)[0] || '';

    }

    function dadosPacoteEtapa(etapaAtual) {

        if (etapaAtual === 'pacote_1') {

            return {
                plano: '1 Mes - 1 tela',
                valor: 'R$ 25,00'
            };

        }

        if (etapaAtual === 'pacote_3') {

            return {
                plano: '3 Meses - 1 tela',
                valor: 'R$ 60,00'
            };

        }

        if (etapaAtual === 'pacote_6') {

            return {
                plano: '6 Meses - 1 tela',
                valor: 'R$ 110,00'
            };

        }

        if (etapaAtual === 'pacote_1_2telas') {

            return {
                plano: '1 Mes - 2 telas',
                valor: 'R$ 50,00'
            };

        }

        if (etapaAtual === 'pacote_3_2telas') {

            return {
                plano: '3 Meses - 2 telas',
                valor: 'R$ 120,00'
            };

        }

        if (etapaAtual === 'pacote_6_2telas') {

            return {
                plano: '6 Meses - 2 telas',
                valor: 'R$ 220,00'
            };

        }

        return null;

    }

    function valorNumero(valor) {

        return Number(
            String(valor || '')
                .replace('R$', '')
                .replace(/\./g, '')
                .replace(',', '.')
                .trim()
        );

    }

    function valorValidoPersonalizado(valor) {

        const numeroValor = valorNumero(valor);

        return Number.isFinite(numeroValor) && numeroValor >= 1;

    }

    function formatarValorMoeda(valor) {

        return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

    }

    function telasDoPlano(plano, telas = '') {

        const informado = String(telas || '').replace(/\D/g, '');

        if (informado) return informado;

        return String(plano || '').toLowerCase().includes('2 telas') ? '2' : '1';

    }

    function mesesDoPlano(plano, meses = '') {

        const informado = String(meses || '').replace(/[^\d]/g, '');

        if (informado) return informado;

        const textoPlano = String(plano || '').toLowerCase();

        if (textoPlano.includes('6')) return '6';
        if (textoPlano.includes('3')) return '3';

        return '1';

    }

    function valorTextoPlano(valor) {

        if (!valor) return '';

        const numeroValor = valorNumero(valor);

        if (Number.isFinite(numeroValor)) return formatarValorMoeda(numeroValor);

        return String(valor || '').trim();

    }

    function dadosPlanoAtual(assinatura) {

        const valorAtual = valorTextoPlano(assinatura?.valor);

        if (!assinatura || !valorAtual) return null;

        const telas = telasDoPlano(
            assinatura.plano,
            assinatura.telas
        );
        const meses = mesesDoPlano(
            assinatura.plano,
            assinatura.meses
        );
        const planoBaseOriginal = String(assinatura.plano || '').trim();
        const planoBase = !planoBaseOriginal ||
            planoBaseOriginal.toLowerCase() === 'importado' ?
                `${meses} ${meses === '1' ? 'Mes' : 'Meses'}` :
                planoBaseOriginal;
        const plano = planoBase.toLowerCase().includes('tela') ?
            planoBase :
            `${planoBase} - ${telas} ${telas === '1' ? 'tela' : 'telas'}`;

        return {
            assinaturaId: assinatura.id,
            plano,
            valor: valorAtual,
            telas,
            meses
        };

    }

    async function mostrarRenovacaoAtual() {

        const assinaturas = buscarAssinaturasPorNumero(
            numero,
            numeroWhatsapp
        ).filter(assinatura =>
            assinatura.status !== 'cancelada' &&
            assinatura.username
        );
        const assinatura = assinaturas.length === 1 ? assinaturas[0] : null;
        const atual = dadosPlanoAtual(assinatura);

        if (!atual) {

            sessoes[numero] = 'renovacao';

            return await renovacao(client, numero);

        }

        sessoes[numero] = 'renovacao_atual';
        sessoes[chaveRenovacaoAtual] = atual;

        return await client.sendText(
            numero,

`📺 *Renovacao do seu plano*

Seu plano atual:
${atual.telas === '1' ? '1 tela' : `${atual.telas} telas`} - ${atual.valor}
Periodo: ${atual.meses} ${atual.meses === '1' ? 'mes' : 'meses'}

Renovando igual, voce mantem o mesmo usuario e a validade e somada ao vencimento atual.

1 - Renovar este plano
2 - Alterar plano
9 - Falar com atendente
0 - Voltar`
        );

    }

    async function solicitarEmailCheckout(plano, valor, metodo) {

        sessoes[chaveCheckout] = {
            plano,
            valor,
            metodo
        };
        sessoes[numero] = 'checkout_nome';
        agendarFollowUp(
            client,
            numero,
            'pagamento'
        );

        return await client.sendText(
            numero,

`👤 *Nome do cliente*

Informe apenas seu primeiro nome para continuar com o pagamento.

Depois eu pergunto o email, que sera opcional.`
        );

    }

    async function solicitarEmailOpcionalCheckout() {

        sessoes[numero] = 'checkout_email';
        agendarFollowUp(
            client,
            numero,
            'pagamento'
        );

        return await client.sendText(
            numero,

`📧 *Email para comprovante*

Informe seu email para receber a confirmacao e os dados de acesso.

Se nao quiser informar agora, digite *0* para pular.`
        );

    }

    async function solicitarValorPersonalizado() {

        sessoes[numero] = 'pacote_outro_valor';
        agendarFollowUp(
            client,
            numero,
            'compra'
        );

        return await client.sendText(
            numero,

`*Personalizado*

Digite o valor combinado para gerar o pagamento.

Exemplos:
35
35,00
R$ 35,00

8 - Encerrar atendimento
0 - Voltar`
        );

    }

    async function solicitarCupomOpcionalCheckout() {

        sessoes[numero] = 'checkout_cupom';
        agendarFollowUp(
            client,
            numero,
            'pagamento'
        );

        return await client.sendText(
            numero,

`🎟️ *Cupom de desconto*

Se voce recebeu um cupom, envie agora para aplicar no pagamento.

Se nao tiver cupom, digite *0* para continuar.`
        );

    }

    async function enviarCheckoutPacote(plano, valor, metodo, nome, email, cupomInfo = null) {

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
            const vendaPersonalizada = String(plano || '').toLowerCase().includes('outro valor');
            const tipoVenda = vendaPersonalizada ?
                (assinaturaRenovavel ? 'renovacao_manual' : 'solicitacao_manual') :
                (assinaturaRenovavel ? 'renovacao_manual' : 'nova');
            const valorOriginal = valorNumero(valor);
            const desconto = cupomInfo?.desconto ? Number(cupomInfo.desconto) : 0;
            const valorFinal = Math.max(
                1,
                valorOriginal - desconto
            );
            const valorCheckout = desconto > 0 ?
                formatarValorMoeda(valorFinal) :
                valor;
            const dadosUltimoCheckout = {
                plano,
                valor,
                meses: mesesDoPlano(plano),
                metodo,
                nome,
                email,
                cupomInfo
            };

            const venda = await criarCheckoutVenda({
                numero,
                telefone: numeroWhatsapp,
                nome,
                email,
                plano,
                valor: valorCheckout,
                telas: telasDoPlano(plano),
                meses: dadosUltimoCheckout.meses,
                metodo,
                tipo: tipoVenda,
                assinatura: assinaturaRenovavel || null,
                cupom: cupomInfo?.codigo || '',
                desconto,
                valorOriginal
            });

            delete sessoes[chaveForcarRenovacao];
            sessoes[chaveUltimoCheckout] = dadosUltimoCheckout;

            if (metodo === 'pix') {

                const pixTexto =
                venda.pix_qr_code ||
                venda.pix_ticket_url ||
                venda.init_point;

                await client.sendText(
                    numero,

`💠 *PIX copia e cola*

Abra o aplicativo do seu banco, escolha *PIX Copia e Cola* e cole o codigo da proxima mensagem.

${tipoVenda === 'renovacao_manual' ?
    'Assim que o pagamento for aprovado, vamos avisar aqui e nossa equipe vai renovar seu acesso no painel.' :
    'Assim que o pagamento for aprovado, vamos enviar aqui a confirmacao do pagamento e, em seguida, os dados do usuario.'}`
                );

                await client.sendText(
                    numero,
                    pixTexto
                );

                sessoes[numero] = 'followup_pagamento';
                agendarFollowUp(
                    client,
                    numero,
                    'pagamento'
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
${valorCheckout}

${desconto > 0 ? `Cupom aplicado: ${cupomInfo.codigo}\nDesconto: ${formatarValorMoeda(desconto)}\nValor original: ${formatarValorMoeda(valorOriginal)}\n` : ''}

Forma:
${nomeMetodo(metodo)}

Tipo:
${tipoVenda === 'renovacao_manual' ? 'Renovacao manual' : (tipoVenda === 'solicitacao_manual' ? 'Solicitacao manual' : 'Nova assinatura')}

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
Valor: ${valorCheckout}
Forma: ${nomeMetodo(metodo)}
${desconto > 0 ? `Cupom: ${cupomInfo.codigo}\nDesconto: ${formatarValorMoeda(desconto)}\nValor original: ${formatarValorMoeda(valorOriginal)}\n` : ''}

Pague pelo link abaixo:
${venda.init_point}

${tipoVenda === 'renovacao_manual' ?
    'Assim que o pagamento for aprovado, vou avisar aqui e nossa equipe renova manualmente seu acesso.' :
    'Assim que o pagamento for aprovado, vou avisar aqui e nossa equipe ativa manualmente seu acesso.'}`
            );

            sessoes[numero] = 'followup_pagamento';
            agendarFollowUp(
                client,
                numero,
                'pagamento'
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
${valorCheckout}

${desconto > 0 ? `Cupom aplicado: ${cupomInfo.codigo}\nDesconto: ${formatarValorMoeda(desconto)}\nValor original: ${formatarValorMoeda(valorOriginal)}\n` : ''}

Forma:
${nomeMetodo(metodo)}

Tipo:
${tipoVenda === 'renovacao_manual' ? 'Renovacao manual' : (tipoVenda === 'solicitacao_manual' ? 'Solicitacao manual' : 'Nova assinatura')}

WhatsApp:
${venda.telefone || 'Nao informado'}

Referencia:
${venda.reference}

Checkout:
${venda.init_point}`
            );

            return;

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

    if (etapa === 'marketing_info') {

        const resposta = String(texto || '').trim().toLowerCase();
        const detalhesEnviados = Boolean(sessoes[`${numero}_marketing_detalhes`]);

        if (resposta === 'sair' || resposta === '8') {

            return await sairMarketing();

        }

        if (texto === '0') {

            sessoes[numero] = 'menu';
            delete sessoes[`${numero}_marketing_detalhes`];

            return await menuPrincipal(
                client,
                numero
            );

        }

        if (texto === '2') {

            sessoes[numero] = 'teste_gratis';
            delete sessoes[`${numero}_marketing_detalhes`];

            return await testeGratis(
                client,
                numero,
                numeroWhatsapp
            );

        }

        if (texto === '1' && detalhesEnviados) {

            sessoes[numero] = 'pacote';
            delete sessoes[`${numero}_marketing_detalhes`];

            return await enviarMenuPacoteComFollowUp();

        }

        sessoes[`${numero}_marketing_detalhes`] = true;

        return await client.sendText(
            numero,
            mensagemMarketingInfo()
        );

    }

    // MENU SUPORTE

    if (etapa === 'suporte') {

        if (texto === '1') {

            return await consultarUsuarios();

        }

        if (texto === '2') {

            return await mostrarRenovacaoAtual();

        }

        if (texto === '3') {

            return await abrirChamadoSemSinal();

        }

        if (texto === '4') {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (texto === '5') {

            sessoes[numero] = 'teste_gratis';

            return await testeGratis(
                client,
                numero,
                numeroWhatsapp
            );

        }

        
        if (texto === '0') {

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

    if (etapa === 'usuario_nao_encontrado') {

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Usuario nao encontrado',
                {
                    mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                }
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

`Nao encontrei usuario ativo neste WhatsApp.

9️⃣ Falar com atendente
0️⃣ Voltar ao menu`
        );

    }

    if (etapa === 'teste_ja_usado') {

        if (texto === '1') {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Teste gratis ja usado',
                {
                    mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                }
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

        if (textoEhOpcao('1', 'smart')) {

            await passosConfiguracao.smartTv(
                client,
                numero
            );

            return agendarFollowUp(
                client,
                numero,
                'configuracao'
            );

        }

        if (textoEhOpcao('2', 'computador', 'notebook')) {

            await passosConfiguracao.computador(
                client,
                numero
            );

            return agendarFollowUp(
                client,
                numero,
                'configuracao'
            );

        }

        if (textoEhOpcao('3', 'celular')) {

            await passosConfiguracao.celular(
                client,
                numero
            );

            return agendarFollowUp(
                client,
                numero,
                'configuracao'
            );

        }

        if (textoEhOpcao('4', 'outro')) {

            await passosConfiguracao.outro(
                client,
                numero
            );

            return agendarFollowUp(
                client,
                numero,
                'configuracao'
            );

        }

        if (textoEhOpcao('9', 'atendente')) {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Ajuda de configuracao',
                {
                    mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                }
            );

        }

        if (textoEhOpcao('0', 'voltar')) {

            sessoes[numero] = 'pos_teste';

            return await ajudaPosTeste(
                client,
                numero
            );

        }

        if (textoEhOpcao('8', 'encerrar')) {

            return await encerrarComPesquisa();

        }

        return await ajudaConfiguracao(
            client,
            numero
        );

    }

    if (etapa === 'followup_compra') {

        if (textoEhOpcao('1', 'adquirir', 'pacote')) {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (textoEhOpcao('9', 'atendente')) {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Retomada de compra',
                {
                    mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                }
            );

        }

        if (textoEhOpcao('8', 'encerrar')) {

            return await encerrarComPesquisa();

        }

        if (textoEhOpcao('4', 'personalizado')) {

            sessoes[numero] = 'pacote_personalizado';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePersonalizado(client, numero);

        }

        if (textoEhOpcao('0', 'voltar')) {

            sessoes[numero] = 'menu';

            return await menuPrincipal(
                client,
                numero
            );

        }

        return await client.sendText(
            numero,
            'Digite *1* para adquirir agora, *9* para falar com atendente, *8* para encerrar ou *0* para voltar.'
        );

    }

    if (etapa === 'followup_pagamento') {

        if (texto === '1') {

            const ultimoCheckout = sessoes[chaveUltimoCheckout];

            if (ultimoCheckout?.plano && ultimoCheckout?.valor && ultimoCheckout?.metodo) {

                await client.sendText(
                    numero,
                    `Vou gerar um novo ${ultimoCheckout.metodo === 'pix' ? 'PIX' : 'link de pagamento'} para voce.`
                );

                return await enviarCheckoutPacote(
                    ultimoCheckout.plano,
                    ultimoCheckout.valor,
                    ultimoCheckout.metodo,
                    ultimoCheckout.nome || '',
                    ultimoCheckout.email || '',
                    ultimoCheckout.cupomInfo || null
                );

            }

            return await enviarMenuPacoteComFollowUp();

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Retomada de pagamento',
                {
                    mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                }
            );

        }

        if (texto === '8') {

            return await encerrarComPesquisa();

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
            'Digite *1* para continuar, *9* para falar com atendente, *8* para encerrar ou *0* para voltar.'
        );

    }

    if (etapa === 'followup_configuracao') {

        if (texto === '1') {

            return await enviarPesquisaSatisfacao();

        }

        if (texto === '2') {

            sessoes[numero] = 'ajuda_config';

            return await ajudaConfiguracao(
                client,
                numero
            );

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Retomada de configuracao',
                {
                    mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                }
            );

        }

        if (texto === '8') {

            return await encerrarComPesquisa();

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
            'Digite *1* se funcionou, *2* para ajuda, *9* para atendente, *8* para encerrar ou *0* para voltar.'
        );

    }

    if (etapa === 'satisfacao') {

        if (texto === '0') {

            sessoes[numero] = 'menu';

            return await client.sendText(
                numero,
                'Obrigado. Atendimento encerrado.'
            );

        }

        if (!/^[1-5]$/.test(texto)) {

            return await client.sendText(
                numero,
                'Envie uma nota de *1* a *5* ou *0* para nao opinar.'
            );

        }

        await notificar(
            client,
            'PESQUISA DE SATISFACAO',

`Cliente:
${numero}

WhatsApp:
${numeroWhatsapp || 'Nao informado'}

Nota:
${texto}`
        );

        sessoes[numero] = 'menu';

        return await client.sendText(
            numero,
            'Obrigado pela resposta. Atendimento encerrado.'
        );

    }

    if (etapa === 'checkout_nome') {

        const checkout = sessoes[chaveCheckout];

        if (!checkout) {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (texto === '8') {

            return await encerrarComPesquisa();

        }

        if (!nomeValido(texto)) {

            return await client.sendText(
                numero,
                'Digite apenas o primeiro nome para continuar.'
            );

        }

        sessoes[chaveCheckout] = {
            ...checkout,
            nome: primeiroNome(texto)
        };

        return await solicitarEmailOpcionalCheckout();

    }

    if (etapa === 'checkout_email') {

        const checkout = sessoes[chaveCheckout];

        if (!checkout) {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (texto === '8') {

            return await encerrarComPesquisa();

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

        sessoes[chaveCheckout] = {
            ...checkout,
            email
        };

        return await solicitarCupomOpcionalCheckout();

    }

    if (etapa === 'checkout_cupom') {

        const checkout = sessoes[chaveCheckout];

        if (!checkout) {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (texto === '8') {

            return await encerrarComPesquisa();

        }

        let cupomInfo = null;

        if (
            texto !== '0' &&
            texto !== 'pular' &&
            texto !== 'nao' &&
            texto !== 'não'
        ) {

            const resultadoCupom = validarCupom(
                texto,
                numeroWhatsapp || numero
            );

            if (!resultadoCupom.valido) {

                return await client.sendText(
                    numero,
                    `${resultadoCupom.motivo} Envie outro cupom ou digite *0* para continuar sem desconto.`
                );

            }

            cupomInfo = resultadoCupom.cupom;

            await client.sendText(
                numero,
                `Cupom *${cupomInfo.codigo}* aplicado. Desconto de R$ ${Number(cupomInfo.desconto).toFixed(2).replace('.', ',')}.`
            );

        }

        delete sessoes[chaveCheckout];

        return await enviarCheckoutPacote(
            checkout.plano,
            checkout.valor,
            checkout.metodo,
            checkout.nome,
            checkout.email || '',
            cupomInfo
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

            return await mostrarRenovacaoAtual();

        }

        if (texto === '2') {

            sessoes[numero] = 'cancelamento_feedback';

            return await client.sendText(
                numero,

`Tudo bem. Antes de cancelar, se puder, conte rapidamente o motivo.

Se nao quiser responder, envie *0* para pular.`
            );

        }

        if (texto === '3') {

            const assinaturas = buscarAssinaturasPorNumero(
                numero,
                numeroWhatsapp
            ).filter(assinatura =>
                assinatura.status !== 'cancelada'
            );
            const resumo = assinaturas.length ?
                resumoAssinaturas(assinaturas) :
                'Nenhum usuario ativo encontrado automaticamente para este WhatsApp.';

            sessoes[numero] = 'menu';

            const pagamentoInformado = registrarPagamentoInformado({
                numero,
                telefone: numeroWhatsapp,
                resumo
            });

            await notificar(
                client,
                'CLIENTE INFORMOU PAGAMENTO',

`Cliente informou que ja realizou o pagamento.

Codigo:
${pagamentoInformado.codigo}

WhatsApp:
${numeroWhatsapp || 'Nao confirmado'}

Atendimento:
${numero}

Acessos encontrados:
${resumo}

Responda para o bot:
#pgsim ${pagamentoInformado.codigo}
ou
#pgnao ${pagamentoInformado.codigo}`
            );

            return await client.sendText(
                numero,
                'Recebi seu aviso de pagamento. Nossa equipe vai conferir e, assim que confirmar, voce recebe a confirmacao por aqui.'
            );

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Aviso de vencimento',
                {
                    mensagem: 'Encaminhei seu atendimento para nossa equipe. Aguarde nosso retorno.'
                }
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
3️⃣ Ja realizei o pagamento
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

            return await mostrarRenovacaoAtual();

        }

        if (texto === '2') {

            const motivo = sessoes[`${numero}_motivo_cancelamento`] || '';

            cancelarAssinaturaPorNumero(
                numeroWhatsapp || numero,
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

    async function sairDosAvisosTeste() {

        const usuarioTeste = sessoes[chaveTesteUsuario];
        const telefoneReferencia = numeroWhatsapp || numero;

        marcarSaidaContratacao(usuarioTeste || telefoneReferencia);
        marcarSaidaContratacao(telefoneReferencia);

        sessoes[numero] = 'teste_ja_usado';

        return await client.sendText(
            numero,
            [
                'Tudo bem, parei os avisos sobre esse teste.',
                '',
                'O teste gratis continua registrado como ja utilizado. Se quiser voltar, voce pode contratar um pacote ou falar com um atendente.',
                '',
                '1 - Contratar agora',
                '9 - Falar com atendente',
                '0 - Voltar ao menu'
            ].join('\n')
        );

    }

    if (etapa === 'teste_encerrado' || etapa === 'teste_convite') {

        if (texto === '1') {

            sessoes[numero] = 'pacote';

            return await pacote(
                client,
                numero
            );

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Teste gratis encerrado',
                {
                    mensagem: 'Encaminhei seu atendimento para nossa equipe. Aguarde nosso retorno.'
                }
            );

        }

        if (texto === '8') {

            return await sairDosAvisosTeste();

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
            [
                'Seu teste ja foi encerrado.',
                '',
                '1 - Contratar agora',
                '9 - Falar com atendente',
                '8 - Nao quero receber avisos',
                '0 - Voltar ao menu'
            ].join('\n')
        );

    }

    if (etapa === 'renovacao_atual') {

        const atual = sessoes[chaveRenovacaoAtual];

        if (texto === '1' && atual?.plano && atual?.valor) {

            sessoes[chaveForcarRenovacao] = true;

            return await enviarPagamentoComFollowUp(
                atual.plano,
                atual.valor
            );

        }

        if (texto === '2') {

            sessoes[numero] = 'renovacao';

            return await renovacao(client, numero);

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Alteracao de plano na renovacao'
            );

        }

        if (texto === '0') {

            delete sessoes[chaveRenovacaoAtual];
            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        return await mostrarRenovacaoAtual();

    }

    if (etapa === 'renovacao') {

        if (texto === '1') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_1';

            return await enviarPagamentoComFollowUp('1 Mes - 1 tela', 'R$ 25,00');

        }

        if (texto === '2') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_3';

            return await enviarPagamentoComFollowUp('3 Meses - 1 tela', 'R$ 60,00');

        }

        if (texto === '3') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_6';

            return await enviarPagamentoComFollowUp('6 Meses - 1 tela', 'R$ 110,00');

        }

        if (texto === '4') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'renovacao_personalizada';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await renovacaoPersonalizada(client, numero);

        }

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        return await renovacao(client, numero);

    }

    if (etapa === 'renovacao_personalizada') {

        if (texto === '5') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_1_2telas';

            return await enviarPagamentoComFollowUp('1 Mes - 2 telas', 'R$ 50,00');

        }

        if (texto === '6') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_3_2telas';

            return await enviarPagamentoComFollowUp('3 Meses - 2 telas', 'R$ 120,00');

        }

        if (texto === '7') {

            sessoes[chaveForcarRenovacao] = true;
            sessoes[numero] = 'pacote_6_2telas';

            return await enviarPagamentoComFollowUp('6 Meses - 2 telas', 'R$ 220,00');

        }

        if (texto === '8') {

            sessoes[chaveForcarRenovacao] = true;

            return await solicitarValorPersonalizado();

        }

        if (texto === '0') {

            sessoes[numero] = 'renovacao';

            return await renovacao(client, numero);

        }

        return await renovacaoPersonalizada(client, numero);

    }

    // SEM SINAL

    if (etapa === 'sem_sinal') {

        return await abrirChamadoSemSinal();

    }


    // EM ANALISE

    if (etapa === 'em_analise') {

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        if (texto === '9') {

            return await encaminharAtendente(
                client,
                numero,
                numeroWhatsapp,
                'Em analise',
                {
                    mensagem: '👨‍💼 Atendimento encaminhado para nossa equipe.'
                }
            );

        }

        return await emAnalise(client, numero);

    }

    // PACOTES

    if (etapa === 'pacote') {

        if (textoEhOpcao('1', '1 mes', '1 mês')) {

            sessoes[numero] = 'pacote_1';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePagamento(
                client,
                numero,
                '1 Mês',
                'R$ 25,00'
            );

        }

        if (textoEhOpcao('2', '3 meses')) {

            sessoes[numero] = 'pacote_3';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePagamento(
                client,
                numero,
                '3 Meses',
                'R$ 60,00'
            );

        }

        if (textoEhOpcao('3', '6 meses')) {

            sessoes[numero] = 'pacote_6';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePagamento(
                client,
                numero,
                '6 Meses',
                'R$ 110,00'
            );

        }

        if (textoEhOpcao('4', 'personalizado')) {

            sessoes[numero] = 'pacote_personalizado';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePersonalizado(client, numero);

        }

        if (textoEhOpcao('0', 'voltar')) {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        if (textoEhOpcao('8', 'encerrar')) {

            return await encerrarComPesquisa();

        }

        return await enviarMenuPacoteComFollowUp();

    }

    if (etapa === 'pacote_personalizado') {

        if (texto === '5') {

            sessoes[numero] = 'pacote_1_2telas';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePagamento(
                client,
                numero,
                '1 Mes - 2 telas',
                'R$ 50,00'
            );

        }

        if (texto === '6') {

            sessoes[numero] = 'pacote_3_2telas';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePagamento(
                client,
                numero,
                '3 Meses - 2 telas',
                'R$ 120,00'
            );

        }

        if (texto === '7') {

            sessoes[numero] = 'pacote_6_2telas';
            agendarFollowUp(
                client,
                numero,
                'compra'
            );

            return await pacotePagamento(
                client,
                numero,
                '6 Meses - 2 telas',
                'R$ 220,00'
            );

        }

        if (texto === '0') {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        return await pacotePersonalizado(client, numero);

    }

    if (etapa === 'pacote_outro_valor') {

        if (texto === '8') {

            return await encerrarComPesquisa();

        }

        if (texto === '0') {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        if (!valorValidoPersonalizado(texto)) {

            return await client.sendText(
                numero,
                'Digite um valor valido a partir de R$ 1,00. Exemplo: *35,00*.'
            );

        }

        const valorPersonalizado = formatarValorMoeda(valorNumero(texto));

        sessoes[chavePacoteOutro] = {
            plano: 'Personalizado',
            valor: valorPersonalizado
        };
        sessoes[numero] = 'pacote_outro_pagamento';
        agendarFollowUp(
            client,
            numero,
            'compra'
        );

        return await pacotePagamento(
            client,
            numero,
            'Personalizado',
            valorPersonalizado
        );

    }

    const pacoteSelecionado = dadosPacoteEtapa(etapa);
    const pacoteOutroSelecionado = etapa === 'pacote_outro_pagamento' ?
        sessoes[chavePacoteOutro] :
        null;
    const pacoteParaPagamento = pacoteSelecionado || pacoteOutroSelecionado;

    if (pacoteParaPagamento) {

        if (texto === '1') {

            return await solicitarEmailCheckout(
                pacoteParaPagamento.plano,
                pacoteParaPagamento.valor,
                'pix'
            );

        }

        if (texto === '2') {

            return await solicitarEmailCheckout(
                pacoteParaPagamento.plano,
                pacoteParaPagamento.valor,
                'cartao'
            );

        }

        if (texto === '3') {

            return await solicitarEmailCheckout(
                pacoteParaPagamento.plano,
                pacoteParaPagamento.valor,
                'boleto'
            );

        }

        if (texto === '8') {

            return await encerrarComPesquisa();

        }

        if (texto === '0') {

            sessoes[numero] = 'pacote';

            return await enviarMenuPacoteComFollowUp();

        }

        return await pacotePagamento(
            client,
            numero,
            pacoteParaPagamento.plano,
            pacoteParaPagamento.valor
        );

    }

};
