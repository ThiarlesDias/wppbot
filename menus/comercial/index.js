module.exports = async function comercial(
    client,
    numero
) {

    await client.sendText(
        numero,

`💼 COMERCIAL

1️⃣ Desenvolvimento de Sites

2️⃣ Desenvolvimento de Aplicativos

3️⃣ Automação WhatsApp

4️⃣ Marketing Digital

5️⃣ Infraestrutura de TI

6️⃣ Consultoria em TI

0️⃣ Voltar`
    );

};