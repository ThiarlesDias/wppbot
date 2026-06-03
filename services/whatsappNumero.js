function limparTelefone(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function montarWidTelefone(telefone) {

    const limpo = limparTelefone(telefone);

    if (!limpo || limpo.length < 10) return null;

    return `${limpo}@c.us`;

}

function extrairWidTelefone(valor) {

    if (!valor) return null;

    if (typeof valor === 'string') {

        if (valor.includes('@c.us')) return valor;

        return montarWidTelefone(valor);

    }

    if (typeof valor !== 'object') return null;

    const candidatos = [
        valor._serialized,
        valor.serialized,
        valor.user,
        valor.phoneNumber,
        valor.phone,
        valor.pn,
        valor.id
    ];

    for (const candidato of candidatos) {

        const wid = extrairWidTelefone(candidato);

        if (wid) return wid;

    }

    return null;

}

async function resolverNumeroMensagem(client, message) {

    if (!message?.from) return null;

    if (message.from.endsWith('@c.us')) return message.from;

    if (!message.from.endsWith('@lid')) return null;

    try {

        const info = await client.getPnLidEntry(message.from);

        return extrairWidTelefone(info);

    } catch (erro) {

        console.log(
            'NAO FOI POSSIVEL RESOLVER LID',
            message.from,
            erro.message
        );

        return null;

    }

}

module.exports = {
    limparTelefone,
    montarWidTelefone,
    resolverNumeroMensagem
};
