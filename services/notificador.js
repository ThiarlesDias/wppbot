
function obterAdmin() {

    const admin = process.env.ADMIN_WHATSAPP;

    if (!admin || admin.includes('SEUNUMERO')) return null;

    if (admin.endsWith('@c.us')) return admin;

    return `${admin.replace(/\D/g, '')}@c.us`;

}

async function notificar(
    client,
    titulo,
    mensagem
) {

    try {

        const admin = obterAdmin();

        if (!admin) {

            console.log('ADMIN_WHATSAPP nao configurado; notificacao ignorada.');

            return;

        }

        await client.sendText(
            admin,

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
