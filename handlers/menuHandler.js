
const sessoes = require('../services/sessions');

const menuSuporte = require('../menus/suporte');

module.exports = async function menuHandler(
    client,
    numero,
    texto
) {

    // SISTEMA TV

    if (texto === '1') {

        sessoes[numero] = 'suporte';

        return await menuSuporte(
            client,
            numero
        );

    }

    // COMERCIAL

    if (texto === '2') {

        sessoes[numero] = 'comercial';

        return await client.sendText(
            numero,

`💼 COMERCIAL

1️⃣ Desenvolvimento de Sites

2️⃣ Desenvolvimento de Aplicativos

3️⃣ Automação WhatsApp

4️⃣ Marketing Digital

5️⃣ Infraestrutura de TI

6️⃣ Consultoria em TI

0️⃣ Voltar`
        );

    }

    // FINANCEIRO

    if (texto === '3') {

        sessoes[numero] = 'financeiro';

        return await client.sendText(
            numero,

`💰 FINANCEIRO

1️⃣ Informações de Pagamento

2️⃣ Segunda Via

3️⃣ Comprovante de Pagamento

4️⃣ Negociar Débito

5️⃣ Falar com Financeiro

0️⃣ Voltar`
        );

    }

    // ATENDIMENTO HUMANO

    if (texto === '4') {

        sessoes[numero] = 'humano';

        return await client.sendText(
            numero,

`👨‍💼 Seu atendimento foi encaminhado.

Aguarde nosso retorno.

Digite:

0️⃣ Voltar ao menu`
        );

    }

    // OPÇÃO INVÁLIDA

    return await client.sendText(
        numero,

`🤖 TopTec Digital

Escolha uma opção:

1️⃣ Sistema de TV
2️⃣ Comercial / Vendas
3️⃣ Financeiro
4️⃣ Atendimento Humano`
    );

};
