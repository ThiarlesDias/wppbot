const sessoes = require('../services/sessions');

const menuPrincipal = require('../menus/menuPrincipal');

const pagamentos = require('../menus/financeiro/pagamentos');
const segundaVia = require('../menus/financeiro/segundaVia');
const contratos = require('../menus/financeiro/contratos');

module.exports = async function financeiroHandler(
client,
numero,
texto
) {


if (texto === '1') {
    return await pagamentos(client, numero);
}

if (texto === '2') {
    return await segundaVia(client, numero);
}

if (texto === '3') {
    return await contratos(client, numero);
}

if (texto === '4') {

    sessoes[numero] = 'humano';

    return await client.sendText(
        numero,


`👨‍💼 Seu atendimento foi encaminhado ao setor financeiro.

Aguarde nosso retorno.

Digite:

0️⃣ Voltar ao menu`
);


}

if (texto === '0') {

    sessoes[numero] = 'menu';

    return await menuPrincipal(
        client,
        numero
    );

}


};
