const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RESOLVIDOS_PATH = path.join(DATA_DIR, 'whatsapp-resolvidos.json');
const resolvidos = carregarResolvidos();

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

function garantirDiretorio() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

}

function carregarResolvidos() {

    try {

        if (!fs.existsSync(RESOLVIDOS_PATH)) return {};

        const dados = JSON.parse(fs.readFileSync(RESOLVIDOS_PATH, 'utf8'));

        return dados.resolvidos || {};

    } catch (_) {

        return {};

    }

}

function salvarResolvidos() {

    garantirDiretorio();

    fs.writeFileSync(
        RESOLVIDOS_PATH,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                resolvidos
            },
            null,
            2
        )
    );

}

function registrarNumeroResolvido(origem, destino) {

    const origemTexto = String(origem || '').trim();
    const destinoWid = extrairWidTelefone(destino);

    if (!origemTexto || !destinoWid || origemTexto === destinoWid) return destinoWid;
    if (resolvidos[origemTexto] === destinoWid) return destinoWid;

    resolvidos[origemTexto] = destinoWid;
    salvarResolvidos();

    return destinoWid;

}

function removerNumeroResolvido(origem) {

    const origemTexto = String(origem || '').trim();

    if (!origemTexto) return null;

    const anterior = resolvidos[origemTexto];

    delete resolvidos[origemTexto];
    salvarResolvidos();

    return extrairWidTelefone(anterior);

}

function buscarNumeroResolvido(origem, destinoIgnorado = '') {

    const origemTexto = String(origem || '').trim();

    if (!origemTexto) return null;

    const resolvido = extrairWidTelefone(resolvidos[origemTexto]);
    const ignorado = extrairWidTelefone(destinoIgnorado);

    if (resolvido && ignorado && resolvido === ignorado) {
        removerNumeroResolvido(origemTexto);
        return null;
    }

    return resolvido;

}

function timeoutResolucaoLidMs() {

    const valor = Number(process.env.WHATSAPP_LID_RESOLVE_TIMEOUT_MS || 2500);

    return Number.isFinite(valor) && valor > 0 ? valor : 2500;

}

function comTimeout(promise, ms) {

    let timer;

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`timeout ao resolver LID depois de ${ms}ms`)),
            ms
        );
    });

    return Promise.race([promise, timeout]).finally(() => {
        clearTimeout(timer);
    });

}

async function resolverNumeroMensagem(client, message) {

    if (!message?.from) return null;

    if (message.from.endsWith('@c.us')) return message.from;

    if (!message.from.endsWith('@lid')) return null;

    const destinoMensagem = extrairWidTelefone(message.to);

    const candidatos = [
        message.sender,
        message.sender?.id,
        message.sender?.phoneNumber,
        message.sender?.phone,
        message.sender?.pn,
        message.author,
        message.chatId,
        message.id?.remote,
        message.contact
    ];

    for (const candidato of candidatos) {

        const wid = extrairWidTelefone(candidato);

        if (wid && destinoMensagem && wid === destinoMensagem) continue;

        if (wid) return registrarNumeroResolvido(
            message.from,
            wid
        );

    }

    const resolvidoAnterior = buscarNumeroResolvido(
        message.from,
        message.to
    );

    if (resolvidoAnterior) return resolvidoAnterior;

    try {

        if (typeof client.getPnLidEntry !== 'function') return null;

        const info = await comTimeout(
            client.getPnLidEntry(message.from),
            timeoutResolucaoLidMs()
        );

        const wid = extrairWidTelefone(info);

        if (wid) return registrarNumeroResolvido(
            message.from,
            wid
        );

        return null;

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
    buscarNumeroResolvido,
    limparTelefone,
    montarWidTelefone,
    registrarNumeroResolvido,
    resolverNumeroMensagem
};
