module.exports = async function humanoHandler(
    client,
    numero,
    texto
) {

    await client.sendText(
        numero,

`👨‍💼 Seu atendimento já foi encaminhado.

Aguarde nosso retorno.`
    );

};