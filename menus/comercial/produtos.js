module.exports = async function produtos(client, numero) {

    return await client.sendText(
        numero,

`🛒 *Produtos TopTec Digital*

Temos solucoes digitais prontas para facilitar sua rotina, melhorar seu atendimento e fortalecer sua presenca online.

Veja nossas opcoes no site:
https://toptecdigital.com/

Se quiser, responda *9* para falar com um atendente ou *0* para voltar.`
    );

};
