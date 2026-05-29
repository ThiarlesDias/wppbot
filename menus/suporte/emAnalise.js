async function emAnalise(client, numero) {

    await client.sendText(
        numero,

`🔎 Seu atendimento está em análise.

Digite:

0️⃣ Voltar ao menu
9️⃣ Falar com atendente`
    );

}

module.exports = emAnalise;