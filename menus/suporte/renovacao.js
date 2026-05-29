async function renovacao(client, numero) {

    await client.sendText(
        numero,

`🔄 RENOVAÇÃO

Escolha a forma de pagamento:

1️⃣ PIX
2️⃣ Cartão
3️⃣ Boleto
0️⃣ Voltar`
    );

}

module.exports = renovacao;