const {
    enviarMenu
} = require('../../services/menuInterativo');
const {
    avisoAtendenteForaHorario
} = require('../../services/horarioAtendimento');

module.exports = async function humano(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Atendimento humano',
            descricao: [
                'Seu atendimento foi encaminhado. Aguarde nosso retorno.',
                avisoAtendenteForaHorario()
            ].filter(Boolean).join('\n\n'),
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
