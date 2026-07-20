module.exports = async function crm(client, numero) {

    const link = process.env.TOPTEC_CRM_URL || 'https://toptecdigital.com/';

    return await client.sendText(
        numero,

`*CRM TopTec Digital*

Tenha mais controle dos seus atendimentos, leads e vendas em um so lugar.

Com o CRM voce consegue:
1. Organizar contatos e oportunidades.
2. Acompanhar em qual etapa cada cliente esta.
3. Registrar historico de conversas e negociacoes.
4. Ter mais clareza sobre vendas, retornos e proximos passos.

Veja mais detalhes:
${link}

10 - Atendimento Humano
0 - Voltar`
    );

};
