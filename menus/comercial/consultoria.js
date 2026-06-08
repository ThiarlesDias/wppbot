module.exports = async function consultoria(client, numero) {

    return await client.sendText(
        numero,

`*Consultoria em TI*

Analisamos seu cenario, indicamos melhorias e ajudamos a escolher solucoes mais seguras, simples e eficientes.

Veja detalhes e solicite atendimento:
https://toptecdigital.com/servicos/consultoria-ti/

9 - Atendimento Humano
0 - Voltar`
    );

};
