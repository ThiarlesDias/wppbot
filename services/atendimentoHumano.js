const sessoes = require('./sessions');
const menuHumano = require('../menus/humano');
const notificar = require('./notificador');
const {
    pausarAtendimento
} = require('./pausaAtendimento');

function limparNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

}

async function encaminharAtendente(client, numero, numeroWhatsapp, origem, opcoes = {}) {

    const contato = limparNumero(numeroWhatsapp) || limparNumero(numero);

    sessoes[numero] = 'humano';
    pausarAtendimento(
        numero,
        `atendimento humano: ${origem || 'Menu'}`
    );

    if (numeroWhatsapp) {

        pausarAtendimento(
            numeroWhatsapp,
            `atendimento humano: ${origem || 'Menu'}`
        );

        pausarAtendimento(
            `${limparNumero(numeroWhatsapp)}@c.us`,
            `atendimento humano: ${origem || 'Menu'}`
        );

    }

    await notificar(
        client,
        'CLIENTE AGUARDANDO ATENDENTE',

`Cliente aguardando atendimento.

WhatsApp:
${contato || 'Nao identificado'}

Atendimento:
${numero}

Origem:
${origem || 'Menu'}`
    );

    if (opcoes.mensagem) {

        return await client.sendText(
            numero,
            opcoes.mensagem
        );

    }

    return await menuHumano(
        client,
        numero
    );

}

module.exports = encaminharAtendente;
