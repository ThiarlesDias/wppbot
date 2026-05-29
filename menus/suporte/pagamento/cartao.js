async function cartao(client, numero) {

    await client.sendText(
        numero,

`💳 PAGAMENTO CARTÃO

Link Mercado Pago:

(EM CONFIGURAÇÃO)

0️⃣ Voltar`
    );

}

module.exports = cartao;