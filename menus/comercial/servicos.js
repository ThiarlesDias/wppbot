module.exports = async function servicos(client, numero) {

    return await client.sendText(
        numero,

`*Servicos TopTec Digital*

Veja nossas principais solucoes:

1. Desenvolvimento de Sites
https://toptecdigital.com/servicos/desenvolvimento-sites/

2. Desenvolvimento de Aplicativos
https://toptecdigital.com/servicos/desenvolvimento-aplicativos/

3. Automacao WhatsApp
https://toptecdigital.com/servicos/automacao-whatsapp/

4. Marketing Digital
https://toptecdigital.com/servicos/marketing-digital/

5. Infraestrutura de TI
https://toptecdigital.com/servicos/infraestrutura-ti/

6. Consultoria em TI
https://toptecdigital.com/servicos/consultoria-ti/

7. CRM
${process.env.TOPTEC_CRM_URL || 'https://toptecdigital.com/'}

# - Atendimento Humano
0 - Voltar`
    );

};
