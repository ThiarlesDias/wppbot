module.exports = async function meuChamado(client, numero) {

    return await client.sendText(
        numero,
        [
            '*Meu chamado*',
            '',
            'Informe o numero do chamado para consultar o andamento.',
            'A consulta so libera dados quando este WhatsApp estiver cadastrado na OS.',
            '',
            'Exemplo: OS359',
            '',
            '0 - Voltar ao menu'
        ].join('\n')
    );

};
