
const ADMIN =
'55SEUNUMERO@c.us';

async function notificar(
    client,
    titulo,
    mensagem
) {

    try {

        await client.sendText(
            ADMIN,

`🚨 ${titulo}

${mensagem}`
        );

    } catch (erro) {

        console.log(
            'ERRO NOTIFICADOR',
            erro
        );

    }

}

module.exports = notificar;
