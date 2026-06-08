module.exports = async function sites(client, numero) {

    return await client.sendText(
        numero,

`*Desenvolvimento de Sites*

Criamos sites profissionais para empresas que precisam vender melhor, apresentar seus servicos e passar mais confianca para o cliente.

Veja detalhes e solicite atendimento:
https://toptecdigital.com/servicos/desenvolvimento-sites/

9 - Atendimento Humano
0 - Voltar`
    );

};
