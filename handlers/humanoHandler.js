module.exports = async function humanoHandler(
client,
numero,
texto
) {

const sessoes = require('../services/sessions');
const menuPrincipal = require('../menus/menuPrincipal');


if (texto === '0') {

    sessoes[numero] = 'menu';

    return await menuPrincipal(
        client,
        numero
    );


}

await client.sendText(
    numero,

`👨‍💼 Seu atendimento já foi encaminhado.

Aguarde nosso retorno.

Digite:

0️⃣ Voltar ao menu`
);

};