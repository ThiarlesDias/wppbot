module.exports = async function humano(
    client,
    numero
) {

    await client.sendText(
        numero,

`👨‍💼 Seu atendimento foi encaminhado.

Aguarde nosso retorno.

Digite:

0️⃣ Voltar ao menu`
    );

};