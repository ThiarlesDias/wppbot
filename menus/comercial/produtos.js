module.exports = async function produtos(client, numero) {

    return await client.sendText(
        numero,

`🛒 *Produtos TopTec Digital*

Temos eletronicos e acessorios em geral para o dia a dia: relogios inteligentes, caixas de som, fones de ouvido, carregadores, cabos e outros itens.

Confira os produtos disponiveis no site:
https://toptecdigital.com/

Se quiser ajuda para escolher, responda *9* para falar com um atendente ou *0* para voltar.`
    );

};
