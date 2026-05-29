async function renovacao(client, numero) {

    await client.sendText(
        numero,

`🔄 *RENOVAÇÃO*

Informe seu usuário IPTV para consulta.`
    );

}

module.exports = renovacao;