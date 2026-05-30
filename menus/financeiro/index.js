module.exports = async function financeiro(
    client,
    numero
) {

    await client.sendText(
        numero,

`💰 FINANCEIRO

1️⃣ Informações de Pagamento

2️⃣ Segunda Via

3️⃣ Contratos

4️⃣ Falar com Financeiro

0️⃣ Voltar`
    );

};