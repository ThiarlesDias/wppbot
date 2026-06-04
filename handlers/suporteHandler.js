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

            return await pix(client, numero);

        }

        if (texto === '2') {

            return await cartao(client, numero);

        }

        if (texto === '3') {

            return await boleto(client, numero);

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

    // PACOTE 1 MÊS

    if (etapa === 'pacote_1') {

        if (texto === '1') {

            return await client.sendText(
                numero,

`💳 PIX

Valor: R$ 25,00

Chave PIX:
financeiro@toptecdigital.com

Favorecido:
Thiarles R Dias

Envie o comprovante após o pagamento.`
            );

        }

        if (texto === '2') {

            return await cartao(client, numero);

        }

        if (texto === '3') {

            return await boleto(client, numero);

        }

    }

    // PACOTE 3 MESES

    if (etapa === 'pacote_3') {

        if (texto === '1') {

            return await client.sendText(
                numero,

`💳 PIX

Valor: R$ 60,00

Chave PIX:
financeiro@toptecdigital.com

Favorecido:
Thiarles R Dias

Envie o comprovante após o pagamento.`
            );

        }

        if (texto === '2') {

            return await cartao(client, numero);

        }

        if (texto === '3') {

            return await boleto(client, numero);

        }

    }

    // PACOTE 6 MESES

    if (etapa === 'pacote_6') {

        if (texto === '1') {

            return await client.sendText(
                numero,

`💳 PIX

Valor: R$ 110,00

Chave PIX:
financeiro@toptecdigital.com

Favorecido:
Thiarles R Dias

Envie o comprovante após o pagamento.`
            );

        }

        if (texto === '2') {

            return await cartao(client, numero);

        }

        if (texto === '3') {

            return await boleto(client, numero);

        }

    }

};
