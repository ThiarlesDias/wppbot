const {
    enviarMenu
} = require('../../services/menuInterativo');

module.exports = async function renovacaoPersonalizada(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Renovacao personalizada',
            descricao: 'Escolha uma opcao com 2 telas. Para outras opcoes, chame o atendente.',
            botao: 'Ver opcoes',
            secao: '2 telas',
            opcoes: [
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
                    id: '8',
                    titulo: 'Outro valor',
                    descricao: 'Digite um valor combinado para renovar.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Retornar aos planos de renovacao.'
                }
            ]
        }
    );

};
