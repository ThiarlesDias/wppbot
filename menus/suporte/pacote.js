const {
    enviarMenu
} = require('../../services/menuInterativo');

async function pacote(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Pacotes IPTV',
            descricao: 'Escolha o pacote desejado.',
            botao: 'Ver pacotes',
            secao: 'Pacotes',
            opcoes: [
                {
                    id: '1',
                    titulo: '1 Mes - R$ 25,00',
                    descricao: 'Acesso por 30 dias.'
                },
                {
                    id: '2',
                    titulo: '3 Meses - R$ 60,00',
                    descricao: 'Acesso por 90 dias.'
                },
                {
                    id: '3',
                    titulo: '6 Meses - R$ 110,00',
                    descricao: 'Acesso por 180 dias.'
                },
                {
                    id: '8',
                    titulo: 'Encerrar atendimento',
                    descricao: 'Finalizar sem contratar agora.'
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

module.exports = pacote;
