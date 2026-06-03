async function testeGratis(client, numero) {

    await client.sendText(
        numero,

`*TESTE GRATIS*

Vamos criar um teste usando este numero:
${numero}

Digite:

1 - Confirmar teste gratis
0 - Voltar`
    );

}

module.exports = testeGratis;
