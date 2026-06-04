const {
    enviarMenu
} = require('../../services/menuInterativo');

async function testeJaUsado(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Teste gratis ja utilizado',
            descricao: 'Este numero ja recebeu um teste gratis. Para continuar, escolha uma opcao:',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Adquirir agora'
                },
                {
                    id: '9',
                    titulo: 'Falar com atendente'
                },
                {
                    id: '0',
                    titulo: 'Voltar ao menu'
                }
            ]
        }
    );

}

module.exports = testeJaUsado;
