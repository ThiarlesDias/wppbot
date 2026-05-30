const sessoes = require('../services/sessions');

const menuPrincipal = require('../menus/menuPrincipal');

const sites = require('../menus/comercial/sites');
const aplicativos = require('../menus/comercial/aplicativos');
const whatsapp = require('../menus/comercial/whatsapp');
const marketing = require('../menus/comercial/marketing');
const infraestrutura = require('../menus/comercial/infraestrutura');
const consultoria = require('../menus/comercial/consultoria');

module.exports = async function comercialHandler(
client,
numero,
texto
) {


if (texto === '1') {
    return await sites(client, numero);
}

if (texto === '2') {
    return await aplicativos(client, numero);
}

if (texto === '3') {
    return await whatsapp(client, numero);
}

if (texto === '4') {
    return await marketing(client, numero);
}

if (texto === '5') {
    return await infraestrutura(client, numero);
}

if (texto === '6') {
    return await consultoria(client, numero);
}

if (texto === '0') {

    sessoes[numero] = 'menu';

    return await menuPrincipal(
        client,
        numero
    );

}


};
