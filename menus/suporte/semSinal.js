async function semSinal(client, numero) {

    await client.sendText(
        numero,

`📡 *SEM SINAL*

Informe:

• Usuário IPTV
ou
• CPF do titular`
    );

}

module.exports = semSinal;