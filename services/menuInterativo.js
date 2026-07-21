const NUMEROS = {
    0: '0️⃣',
    1: '1️⃣',
    2: '2️⃣',
    3: '3️⃣',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣'
};

function numeroBonito(id) {

    if (id === '#') return '#';

    return NUMEROS[id] || `${id}️⃣`;

}

function textoFallback(titulo, descricao, opcoes) {

    const linhas = [
        `🤖 *${titulo}*`
    ];

    if (descricao) {

        linhas.push('', descricao);

    }

    linhas.push('', '━━━━━━━━━━━━━━');
    linhas.push('Escolha uma opção:');

    for (const opcao of opcoes) {

        linhas.push(`${numeroBonito(opcao.id)} ${opcao.titulo}`);

    }

    linhas.push('━━━━━━━━━━━━━━');

    return linhas.join('\n');

}

async function enviarMenu(client, numero, config) {

    const opcoes = config.opcoes || [];
    const texto = textoFallback(
        config.titulo,
        config.descricao,
        opcoes
    );

    return await client.sendText(
        numero,
        texto
    );

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
