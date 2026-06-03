const sessoes = require('../services/sessions');
const menuSuporte = require('../menus/suporte');
const renovacao = require('../menus/suporte/renovacao');
const semSinal = require('../menus/suporte/semSinal');
const pacote = require('../menus/suporte/pacote');
const pacotePagamento = require('../menus/suporte/pacotePagamento');
const emAnalise = require('../menus/suporte/emAnalise');
const testeGratis = require('../menus/suporte/testeGratis');
const pix = require('../menus/suporte/pagamento/pix');
const cartao = require('../menus/suporte/pagamento/cartao');
const boleto = require('../menus/suporte/pagamento/boleto');
const menuPrincipal = require('../menus/menuPrincipal');
const {
    criarTesteGratis
} = require('../services/sigma');
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
    texto
) {

    const etapa = sessoes[numero];

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

            return await testeGratis(client, numero);

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

    if (etapa === 'teste_gratis') {

        if (texto === '1') {

            const controle = iniciarTeste(numero);

            if (!controle.permitido) {

                const testeExistente = controle.teste;

                if (testeExistente.status === 'processando') {

                    return await client.sendText(
                        numero,
                        'Ja existe uma solicitacao de teste em andamento para este numero. Aguarde os dados de acesso aqui.'
                    );

                }

                return await client.sendText(
                    numero,
                    'Este numero ja recebeu um teste gratis. Para continuar, escolha um pacote ou fale com um atendente.'
                );

            }

            try {

                const teste = await criarTesteGratis(numero);

                if (teste.automatico === false) {

                    registrarSolicitacaoManual(numero);

                    await notificar(
                        client,
                        'NOVO TESTE GRATIS',

`Cliente:
${numero}

Numero limpo:
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
                    numero,
                    {
                        customer_id: teste.cliente?.id,
                        username: teste.cliente?.username
                    }
                );

                if (teste.mensagem) {

                    return await client.sendText(
                        numero,
                        teste.mensagem
                    );

                }

                return await client.sendText(
                    numero,
                    'Teste gratis solicitado com sucesso. Em instantes enviaremos os dados de acesso aqui.'
                );

            } catch (erro) {

                falharTeste(numero);

                console.log('ERRO TESTE GRATIS', erro);

                await notificar(
                    client,
                    'ERRO TESTE GRATIS',

`Cliente:
${numero}

Erro:
${erro.message}`
                );

                return await client.sendText(
                    numero,
                    'Nao consegui criar o teste automaticamente agora. Nossa equipe foi avisada e vai continuar seu atendimento.'
                );

            }

        }

        if (texto === '0') {

            sessoes[numero] = 'suporte';

            return await menuSuporte(client, numero);

        }

        return await testeGratis(client, numero);

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
