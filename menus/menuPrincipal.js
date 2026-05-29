async function menuPrincipal(client, numero) {

    await client.sendText(
        numero,

`🤖 *TopTec Digital*

Escolha uma opção:

1️⃣ Sistema de TV
2️⃣ Comercial / Vendas
3️⃣ Financeiro
4️⃣ Atendimento Humano`
    );

}

module.exports = menuPrincipal;