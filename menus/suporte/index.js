async function menuSuporte(client, numero) {

    await client.sendText(
        numero,

`🛠️ *SISTEMA DE TV*

1️⃣ Renovação
2️⃣ Sem sinal
3️⃣ Adquirir pacote
4️⃣ Voltar`
    );

}

module.exports = menuSuporte;