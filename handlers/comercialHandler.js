const sessoes = require('../services/sessions');

module.exports = async function comercialHandler(
    client,
    numero,
    texto
) {

    if (texto === '0') {

        sessoes[numero] = 'menu';

        return;
    }

    await client.sendText(
        numero,

`💼 COMERCIAL

1️⃣ Desenvolvimento de Sites

2️⃣ Desenvolvimento de Aplicativos

3️⃣ Automação WhatsApp

4️⃣ Marketing Digital

5️⃣ Infraestrutura de TI

0️⃣ Voltar`
    );

};