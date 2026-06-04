module.exports = async function servicos(client, numero) {

    return await client.sendText(
        numero,

`🧰 *Servicos TopTec Digital*

Criamos sites, automacoes, aplicativos, integrações e solucoes sob medida para empresas que querem vender e atender melhor.

Conheca os servicos:
https://toptecdigital.com/

Se quiser, responda *9* para falar com um atendente ou *0* para voltar.`
    );

};
