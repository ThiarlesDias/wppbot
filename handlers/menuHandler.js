const sessoes = require('../services/sessions');

const menuSuporte = require('../menus/suporte');

module.exports = async function menuHandler(
    client,
    numero,
    texto
) {

    if (texto === '1') {

        sessoes[numero] = 'suporte';

        await menuSuporte(client, numero);

        return;
    }

    if (texto === '2') {

        sessoes[numero] = 'comercial';

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

        return;
    }

    if (texto === '3') {

        sessoes[numero] = 'financeiro';

        await client.sendText(
            numero,

`💰 FINANCEIRO

1️⃣ Informações de Pagamento

2️⃣ Segunda Via

3️⃣ Comprovante de Pagamento

4️⃣ Negociar Débito

5️⃣ Falar com Financeiro

0️⃣ Voltar`
        );

        return;
    }

    if (texto === '4') {

        sessoes[numero] = 'humano';

        await client.sendText(
            numero,

`👨‍💼 Seu atendimento foi encaminhado.

Aguarde nosso retorno.`
        );

        return;
    }

};