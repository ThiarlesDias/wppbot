const {
    enviarMenu
} = require('../../services/menuInterativo');

module.exports = async function humano(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Atendimento humano',
            descricao: 'Seu atendimento foi encaminhado. Aguarde nosso retorno.',
            botao: 'Opcoes',
            secao: 'Atendimento',
            opcoes: [
                {
                    id: '0',
                    titulo: 'Voltar ao menu',
                    descricao: 'Retornar ao menu principal.'
                }
            ]
        }
    );

};
