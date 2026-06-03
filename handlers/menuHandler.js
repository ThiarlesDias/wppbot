const sessoes = require('../services/sessions');

const menuPrincipal = require('../menus/menuPrincipal');
const menuSuporte = require('../menus/suporte');
const menuComercial = require('../menus/comercial');
const menuFinanceiro = require('../menus/financeiro');
const menuHumano = require('../menus/humano');

module.exports = async function menuHandler(
    client,
    numero,
    texto
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

        sessoes[numero] = 'humano';

        return await menuHumano(
            client,
            numero
        );

    }

    return await menuPrincipal(
        client,
        numero
    );

};
