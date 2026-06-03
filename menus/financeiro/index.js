const {
    enviarMenu
} = require('../../services/menuInterativo');

module.exports = async function financeiro(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Financeiro',
            descricao: 'Escolha o assunto financeiro.',
            botao: 'Opcoes financeiras',
            secao: 'Financeiro',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Informacoes de pagamento',
                    descricao: 'Ver dados e orientacoes.'
                },
                {
                    id: '2',
                    titulo: 'Segunda via',
                    descricao: 'Solicitar nova via.'
                },
                {
                    id: '3',
                    titulo: 'Contratos',
                    descricao: 'Informacoes sobre contrato.'
                },
                {
                    id: '4',
                    titulo: 'Falar com financeiro',
                    descricao: 'Encaminhar para atendimento.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Retornar ao menu principal.'
                }
            ]
        }
    );

};
