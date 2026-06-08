module.exports = async function marketing(client, numero) {

    return await client.sendText(
        numero,

`*Marketing Digital*

Ajudamos sua empresa a aparecer melhor, atrair clientes e organizar campanhas com mais clareza.

Veja detalhes e solicite atendimento:
https://toptecdigital.com/servicos/marketing-digital/

9 - Atendimento Humano
0 - Voltar`
    );

};
