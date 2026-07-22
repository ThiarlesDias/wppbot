const sessoes = require('../services/sessions');

const menuPrincipal = require('../menus/menuPrincipal');
const menuSuporte = require('../menus/suporte');
const menuComercial = require('../menus/comercial');
const menuFinanceiro = require('../menus/financeiro');
const encaminharAtendente = require('../services/atendimentoHumano');
const meuChamado = require('../menus/meuChamado');

module.exports = async function menuHandler(
    client,
    numero,
    texto,
    numeroWhatsapp
) {

    if (texto === '1') {

        sessoes[numero] = 'suporte';

        return await menuSuporte(
            client,
            numero
        );

    }

    if (texto === '2') {

        sessoes[numero] = 'comercial';

        return await menuComercial(
            client,
            numero
        );

    }

    if (texto === '3') {

        sessoes[numero] = 'financeiro';

        return await menuFinanceiro(
            client,
            numero
        );

    }

    if (texto === '4') {

        return await encaminharAtendente(
            client,
            numero,
            numeroWhatsapp,
            'Menu principal'
        );

    }

    if (texto === '5') {

        sessoes[numero] = 'meu_chamado';

        return await meuChamado(
            client,
            numero
        );

    }

    return await menuPrincipal(
        client,
        numero
    );

};
