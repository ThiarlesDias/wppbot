async function pacotePagamento(client, numero, plano, valor) {

    await client.sendText(
        numero,

`📦 PACOTE SELECIONADO

${plano}

Valor: ${valor}

Escolha pagamento:

1️⃣ PIX
2️⃣ Cartão
3️⃣ Boleto
0️⃣ Voltar`
    );

}

module.exports = pacotePagamento;