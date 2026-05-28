module.exports = async (client, message) => {

    await client.sendText(

        message.from,

`👋 Olá, seja bem-vindo à TopTec Digital.

Escolha uma opção:

1️⃣ - Suporte Técnico

2️⃣ - Comercial / Vendas

3️⃣ - Financeiro

Digite o número da opção desejada.`

    );

};