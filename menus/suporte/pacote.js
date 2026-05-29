async function pacote(client, numero) {

    await client.sendText(
        numero,

`📦 PACOTES IPTV

1️⃣ 1 Mês - R$ 25,00

2️⃣ 3 Meses - R$ 60,00

3️⃣ 6 Meses - R$ 110,00

0️⃣ Voltar`
    );

}

module.exports = pacote;