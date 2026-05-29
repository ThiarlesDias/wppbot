const sessoes = require('../services/sessions');

module.exports = async function financeiroHandler(
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

`💰 FINANCEIRO

1️⃣ Informações de Pagamento

2️⃣ Segunda Via

3️⃣ Comprovante de Pagamento

4️⃣ Negociar Débito

5️⃣ Falar com Financeiro

0️⃣ Voltar`
    );

};