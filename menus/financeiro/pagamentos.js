module.exports = async function pagamentos(
client,
numero
) {


await client.sendText(
    numero,


`💳 PAGAMENTOS

✔️ PIX
✔️ Cartão de Crédito
✔️ Boleto Bancário

Para suporte financeiro:

9️⃣ Atendimento Humano

0️⃣ Voltar`
);

};
