module.exports = async function whatsapp(client, numero) {

    return await client.sendText(
        numero,

`*Automacao WhatsApp*

Automatizamos atendimento, respostas, vendas, notificacoes e integracoes para reduzir trabalho manual e responder mais rapido.

Veja detalhes e solicite atendimento:
https://toptecdigital.com/servicos/automacao-whatsapp/

9 - Atendimento Humano
0 - Voltar`
    );

};
