async function financeiro(client, numero) {

    await client.sendText(
        numero,

`💰 FINANCEIRO

1️⃣ Informações de Pagamento
2️⃣ Segunda Via
3️⃣ Comprovante de Pagamento
4️⃣ Negociar Débito
5️⃣ Falar com Financeiro

0️⃣ Voltar`
    );

}

module.exports = financeiro;