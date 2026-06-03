const sessoes = require('../services/sessions');
const menuPrincipal = require('../menus/menuPrincipal');
const menuHumano = require('../menus/humano');

module.exports = async function humanoHandler(
    client,
    numero,
    texto
) {

    if (texto === '0') {

        sessoes[numero] = 'menu';

        return await menuPrincipal(
            client,
            numero
        );

    }

    return await menuHumano(
        client,
        numero
    );

};
