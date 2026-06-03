async function menuSuporte(client, numero) {

    await client.sendText(
        numero,

`*SISTEMA DE TV*

1 - Renovacao
2 - Sem sinal
3 - Adquirir pacote
5 - Criar teste gratis
4 - Voltar`
    );

}

module.exports = menuSuporte;
