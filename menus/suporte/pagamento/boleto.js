async function boleto(client, numero) {

    await client.sendText(
        numero,

`📄 BOLETO

Link Mercado Pago:

(EM CONFIGURAÇÃO)

0️⃣ Voltar`
    );

}

module.exports = boleto;