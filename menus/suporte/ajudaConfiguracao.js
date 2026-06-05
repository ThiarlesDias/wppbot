const {
    enviarMenu
} = require('../../services/menuInterativo');

async function ajudaConfiguracao(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Configuracao do aplicativo',
            descricao: 'Qual dispositivo ira usar?',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Smart TV'
                },
                {
                    id: '2',
                    titulo: 'Computador / notebook'
                },
                {
                    id: '3',
                    titulo: 'Celular'
                },
                {
                    id: '4',
                    titulo: 'Outro dispositivo'
                },
                {
                    id: '8',
                    titulo: 'Encerrar atendimento'
                },
                {
                    id: '0',
                    titulo: 'Voltar'
                }
            ]
        }
    );

}

module.exports = ajudaConfiguracao;
