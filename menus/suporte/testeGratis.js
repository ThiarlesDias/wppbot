const {
    enviarMenu
} = require('../../services/menuInterativo');

async function testeGratis(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Teste gratis',
            descricao: `Vamos criar um teste usando este atendimento: ${numero}`,
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
