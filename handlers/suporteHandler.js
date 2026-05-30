const sessoes = require('../services/sessions');
const menuPrincipal = require('../menus/menuPrincipal');
const menuSuporte = require('../menus/suporte');
const renovacao = require('../menus/suporte/renovacao');
const semSinal = require('../menus/suporte/semSinal');
const pacote = require('../menus/suporte/pacote');
const pacotePagamento = require('../menus/suporte/pacotePagamento');
const emAnalise = require('../menus/suporte/emAnalise');
const pix = require('../menus/suporte/pagamento/pix');
const cartao = require('../menus/suporte/pagamento/cartao');
const boleto = require('../menus/suporte/pagamento/boleto');

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