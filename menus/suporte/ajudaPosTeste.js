const {
    enviarMenu
} = require('../../services/menuInterativo');

async function ajudaPosTeste(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Ajuda com configuracao',
            descricao: 'Precisa de ajuda para configurar no seu aparelho?',
            opcoes: [
                {
                    id: '6',
                    titulo: 'Ajuda com configuracao'
                },
                {
                    id: '0',
                    titulo: 'Voltar ao menu'
                }
            ]
        }
    );

}

module.exports = ajudaPosTeste;
