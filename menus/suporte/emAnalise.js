const {
    enviarMenu
} = require('../../services/menuInterativo');

async function emAnalise(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Atendimento em analise',
            descricao: 'Estamos acompanhando sua solicitacao.',
            botao: 'Opcoes',
            secao: 'Atendimento',
            opcoes: [
                {
                    id: '0',
                    titulo: 'Voltar ao menu',
                    descricao: 'Retornar ao menu Sistema de TV.'
                },
                {
                    id: '9',
                    titulo: 'Falar com atendente',
                    descricao: 'Encaminhar para atendimento humano.'
                }
            ]
        }
    );

}

module.exports = emAnalise;
