module.exports = async function segundaVia(
client,
numero
) {


await client.sendText(
    numero,


`📄 SEGUNDA VIA

Informe:

✔️ CPF do titular

ou

✔️ Usuário IPTV

Nossa equipe localizará seu cadastro.

0️⃣ Voltar`
);

};
