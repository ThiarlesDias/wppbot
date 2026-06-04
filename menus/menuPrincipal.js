const {
    enviarMenu
} = require('../services/menuInterativo');

async function menuPrincipal(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'TopTec Digital',
            descricao: 'Como podemos te ajudar hoje?',
            botao: 'Abrir menu',
            secao: 'Atendimento',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Sistema de TV',
                    descricao: 'Renovacao, teste gratis, pacotes e suporte.'
                },
                {
                    id: '2',
                    titulo: 'Produtos e servicos',
                    descricao: 'Sites, aplicativos, automacao e marketing.'
                },
                {
                    id: '3',
                    titulo: 'Financeiro',
                    descricao: 'Pagamentos, segunda via e contratos.'
                },
                {
                    id: '4',
                    titulo: 'Atendimento Humano',
                    descricao: 'Falar com nossa equipe.'
                }
            ]
        }
    );

}

module.exports = menuPrincipal;
