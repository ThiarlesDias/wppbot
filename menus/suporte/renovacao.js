const {
    enviarMenu
} = require('../../services/menuInterativo');

module.exports = async function renovacao(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Renovacao IPTV',
            descricao: 'Escolha o plano para renovar. Para mais opcoes, chame o atendente.',
            botao: 'Ver planos',
            secao: 'Planos',
            opcoes: [
                {
                    id: '1',
                    titulo: '1 Mes - 1 tela - R$ 25,00',
                    descricao: 'Plano mensal com uma tela.'
                },
                {
                    id: '2',
                    titulo: '3 Meses - 1 tela - R$ 60,00',
                    descricao: 'Economia no trimestre com uma tela.'
                },
                {
                    id: '3',
                    titulo: '6 Meses - 1 tela - R$ 110,00',
                    descricao: 'Melhor custo por mes com uma tela.'
                },
                {
                    id: '4',
                    titulo: 'Personalizado',
                    descricao: 'Para mais opcoes, chame o atendente.'
                },
                {
                    id: '5',
                    titulo: '1 Mes - 2 telas - R$ 50,00',
                    descricao: 'Plano mensal com duas telas.'
                },
                {
                    id: '6',
                    titulo: '3 Meses - 2 telas - R$ 120,00',
                    descricao: 'Trimestre com duas telas.'
                },
                {
                    id: '7',
                    titulo: '6 Meses - 2 telas - R$ 220,00',
                    descricao: 'Semestre com duas telas.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Retornar ao menu Sistema de TV.'
                }
            ]
        }
    );

};
