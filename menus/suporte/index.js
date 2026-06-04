const {
    enviarMenu
} = require('../../services/menuInterativo');

async function menuSuporte(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Sistema de TV',
            descricao: 'Escolha o que voce precisa.',
            botao: 'Opcoes de TV',
            secao: 'Sistema de TV',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Renovar plano',
                    descricao: 'Ver valores e formas de pagamento.'
                },
                {
                    id: '2',
                    titulo: 'Estou sem sinal',
                    descricao: 'Abrir atendimento para suporte tecnico.'
                },
                {
                    id: '3',
                    titulo: 'Adquirir pacote',
                    descricao: 'Escolher plano IPTV.'
                },
                {
                    id: '5',
                    titulo: 'Criar teste gratis',
                    descricao: 'Liberar um teste para seu WhatsApp.'
                },
                {
                    id: '6',
                    titulo: 'Consultar usuario',
                    descricao: 'Receber seus dados de acesso cadastrados.'
                },
                {
                    id: '4',
                    titulo: 'Voltar',
                    descricao: 'Retornar ao menu principal.'
                }
            ]
        }
    );

}

module.exports = menuSuporte;
