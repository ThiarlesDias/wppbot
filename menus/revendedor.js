const {
    enviarMenu
} = require('../services/menuInterativo');
const {
    obterCreditosRevendedor
} = require('../services/revendedoresCsv');

async function menuRevendedor(client, numero, revendedor = {}) {

    const detalhes = [
        revendedor.nome ? `Ola, ${revendedor.nome}.` : 'Ola.',
        `Creditos disponiveis: ${obterCreditosRevendedor(revendedor)}`,
        revendedor.data_fechamento ? `Fechamento: ${revendedor.data_fechamento}` : ''
    ].filter(Boolean).join('\n');

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Bem vindo revendedor',
            descricao: `${detalhes}\n\nO que voce precisa fazer agora?`,
            opcoes: [
                {
                    id: '1',
                    titulo: 'Criar teste',
                    descricao: 'Solicitar teste com ou sem adultos.'
                },
                {
                    id: '2',
                    titulo: 'Renovar cliente',
                    descricao: 'Informar usuario do sistema para renovacao.'
                },
                {
                    id: '3',
                    titulo: 'Listar clientes',
                    descricao: 'Ver somente os clientes vinculados a voce.'
                },
                {
                    id: '4',
                    titulo: 'Chamados',
                    descricao: 'Consultar ou abrir chamado.'
                },
                {
                    id: '5',
                    titulo: 'Falar com a TOPTEC',
                    descricao: 'Encaminhar atendimento para nossa equipe.'
                }
            ]
        }
    );

}

module.exports = menuRevendedor;
