function textoFallback(titulo, descricao, opcoes) {

    const linhas = [
        `*${titulo}*`
    ];

    if (descricao) {

        linhas.push('', descricao);

    }

    linhas.push('', 'Escolha uma opcao:');

    for (const opcao of opcoes) {

        linhas.push(`${opcao.id} - ${opcao.titulo}`);

        if (opcao.descricao) {

            linhas.push(`    ${opcao.descricao}`);

        }

    }

    return linhas.join('\n');

}

async function enviarMenu(client, numero, config) {

    const opcoes = config.opcoes || [];
    const texto = textoFallback(
        config.titulo,
        config.descricao,
        opcoes
    );

    if (
        typeof client.sendListMessage !== 'function' ||
        opcoes.length === 0
    ) {

        return await client.sendText(
            numero,
            texto
        );

    }

    try {

        return await client.sendListMessage(
            numero,
            {
                buttonText: config.botao || 'Ver opcoes',
                description: texto,
                sections: [
                    {
                        title: config.secao || config.titulo,
                        rows: opcoes.map(opcao => ({
                            rowId: String(opcao.id),
                            title: opcao.titulo,
                            description: opcao.descricao || ''
                        }))
                    }
                ]
            }
        );

    } catch (erro) {

        console.log(
            'MENU INTERATIVO INDISPONIVEL; enviando texto.',
            erro.message
        );

        return await client.sendText(
            numero,
            texto
        );

    }

}

function obterTextoMensagem(message) {

    const possiveis = [
        message?.selectedId,
        message?.rowId,
        message?.selectedButtonId,
        message?.listResponse?.singleSelectReply?.selectedRowId,
        message?.listResponse?.rowId,
        message?.body,
        message?.caption
    ];

    const texto = possiveis.find(valor => typeof valor === 'string' && valor.trim());

    return String(texto || '').trim().toLowerCase();

}

module.exports = {
    enviarMenu,
    obterTextoMensagem
};
