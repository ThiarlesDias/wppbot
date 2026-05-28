module.exports = async (client, message) => {

    await client.sendText(

        message.from,

`💳 FINANCEIRO

Envie sua solicitação:

• boleto
• comprovante
• segunda via

Nossa equipe responderá em breve.`

    );

};