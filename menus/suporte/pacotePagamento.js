const {
    enviarMenu
} = require('../../services/menuInterativo');

async function pacotePagamento(client, numero, plano, valor) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Pacote selecionado',
            descricao: `${plano}\nValor: ${valor}`,
            botao: 'Pagar com',
            secao: 'Pagamento',
            opcoes: [
                {
                    id: '1',
                    titulo: 'PIX',
                    descricao: 'Receber chave PIX para pagamento.'
                },
                {
                    id: '2',
                    titulo: 'Cartao',
                    descricao: 'Pagar com cartao.'
                },
                {
                    id: '3',
                    titulo: 'Boleto',
                    descricao: 'Receber boleto.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Escolher outro pacote.'
                }
            ]
        }
    );

}

module.exports = pacotePagamento;
