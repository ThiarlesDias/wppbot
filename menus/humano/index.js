async function humano(client, numero) {

    await client.sendText(
        numero,

`👨‍💼 Seu atendimento foi encaminhado.

Aguarde nosso retorno.`
    );

}

module.exports = humano;