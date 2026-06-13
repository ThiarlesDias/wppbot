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
            descricao: 'Escolha o plano para renovar.',
            botao: 'Ver planos',
            secao: 'Planos',
            opcoes: [
                {
                    id: '1',
                    titulo: '1 Mes - R$ 25,00',
                    descricao: 'Plano mensal.'
                },
                {
                    id: '2',
                    titulo: '3 Meses - R$ 60,00',
                    descricao: 'Economia no trimestre.'
                },
                {
                    id: '3',
                    titulo: '6 Meses - R$ 110,00',
                    descricao: 'Melhor custo por mes.'
                },
                {
                    id: '4',
                    titulo: 'Outro valor',
                    descricao: 'Gerar pagamento em valor combinado.'
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
