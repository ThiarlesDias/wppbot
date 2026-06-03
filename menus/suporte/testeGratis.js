const {
    enviarMenu
} = require('../../services/menuInterativo');

async function testeGratis(client, numero, numeroWhatsapp) {

    const descricao = numeroWhatsapp ?
        `Vamos criar um teste usando este numero: ${numeroWhatsapp.replace('@c.us', '')}` :
        'Confirme para informar o WhatsApp com DDD e liberar o teste.';

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Teste gratis',
            descricao,
            botao: 'Confirmar',
            secao: 'Teste gratis',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Confirmar teste gratis',
                    descricao: 'Criar o acesso de teste.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Retornar ao menu Sistema de TV.'
                }
            ]
        }
    );

}

module.exports = testeGratis;
