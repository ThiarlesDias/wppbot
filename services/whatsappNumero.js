function limparTelefone(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function montarWidTelefone(telefone) {

    let limpo = limparTelefone(telefone);

    if (!limpo || limpo.length < 10) return null;

    if (
        (limpo.length === 10 || limpo.length === 11) &&
        !limpo.startsWith('55')
    ) {

        limpo = `55${limpo}`;

    }

    if (!limpo.startsWith('55')) return null;
    if (limpo.length < 12 || limpo.length > 13) return null;

    return `${limpo}@c.us`;

}

function extrairWidTelefone(valor) {

    if (!valor) return null;

    if (typeof valor === 'string') {

        if (valor.includes('@c.us')) return valor;
        if (valor.includes('@lid')) return null;
        if (valor.includes('@g.us')) return null;
        if (valor.includes('@newsletter')) return null;

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
