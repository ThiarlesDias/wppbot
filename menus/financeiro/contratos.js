module.exports = async function contratos(
client,
numero
) {


await client.sendText(
    numero,


`📑 CONTRATOS

Solicitações disponíveis:

✔️ Consulta Contratual
✔️ Alteração Cadastral
✔️ Cancelamento
✔️ Transferência

9️⃣ Atendimento Humano

0️⃣ Voltar`
);

};
