module.exports = async function infraestrutura(client, numero) {

    return await client.sendText(
        numero,

`*Infraestrutura de TI*

Montamos, organizamos e damos suporte para redes, computadores, sistemas, equipamentos e ambientes de trabalho.

Veja detalhes e solicite atendimento:
https://toptecdigital.com/servicos/infraestrutura-ti/

9 - Atendimento Humano
0 - Voltar`
    );

};
