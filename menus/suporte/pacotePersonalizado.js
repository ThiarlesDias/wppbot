const {
    enviarMenu
} = require('../../services/menuInterativo');

module.exports = async function pacotePersonalizado(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Pacote personalizado',
            descricao: 'Escolha uma opcao com 2 telas. Para outras opcoes, chame o atendente.',
            botao: 'Ver opcoes',
            secao: '2 telas',
            opcoes: [
                {
                    id: '5',
                    titulo: '1 Mes - 2 telas - R$ 50,00',
                    descricao: 'Acesso por 30 dias com duas telas.'
                },
                {
                    id: '6',
                    titulo: '3 Meses - 2 telas - R$ 120,00',
                    descricao: 'Acesso por 90 dias com duas telas.'
                },
                {
                    id: '7',
                    titulo: '6 Meses - 2 telas - R$ 220,00',
                    descricao: 'Acesso por 180 dias com duas telas.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Retornar aos pacotes.'
                }
            ]
        }
    );

};
