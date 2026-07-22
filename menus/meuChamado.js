module.exports = async function meuChamado(client, numero) {

    return await client.sendText(
        numero,
        [
            '*Meu chamado*',
            '',
            'Informe o numero do chamado para consultar o andamento.',
            '',
            'Exemplo: OS359',
            '',
            '0 - Voltar ao menu'
        ].join('\n')
    );

};
