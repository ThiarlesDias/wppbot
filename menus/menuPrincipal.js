const {
    enviarMenu
} = require('../services/menuInterativo');
const {
    avisoForaHorario
} = require('../services/horarioAtendimento');
const {
    agendarRetomadaMenu
} = require('../services/retomadaMenu');

async function menuPrincipal(client, numero) {

    const resultado = await enviarMenu(
        client,
        numero,
        {
            titulo: 'TopTec Digital',
            descricao: [
                avisoForaHorario(),
                'Como podemos te ajudar hoje?'
            ].filter(Boolean).join('\n\n'),
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
                },
                {
                    id: '5',
                    titulo: 'Meu chamado',
                    descricao: 'Consultar andamento por numero da OS.'
                }
            ]
        }
    );

    agendarRetomadaMenu(
        client,
        numero
    );

    return resultado;

}

module.exports = menuPrincipal;
