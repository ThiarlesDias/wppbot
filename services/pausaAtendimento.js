const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PAUSAS_PATH = path.join(DATA_DIR, 'atendimentos-pausados.json');
const pausas = carregarPausas();
const automaticas = [];

const DURACAO_MS = Number(process.env.ATENDIMENTO_MANUAL_PAUSA_MS || 12 * 60 * 60 * 1000);
const JANELA_AUTOMATICA_MS = Number(process.env.ATENDIMENTO_AUTO_MATCH_MS || 15000);

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

function carregarPausas() {

    try {

        if (!fs.existsSync(PAUSAS_PATH)) return {};

        const dados = JSON.parse(fs.readFileSync(PAUSAS_PATH, 'utf8'));

        return dados.pausas || {};

    } catch (_) {

        return {};

    }

}

function salvarPausas() {

    garantirDiretorio();

    fs.writeFileSync(
        PAUSAS_PATH,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                pausas
            },
            null,
            2
        )
    );

}

function normalizarTexto(texto) {

    return String(texto || '').trim().toLowerCase();

}

function limparAntigas() {

    const agora = Date.now();

    while (
        automaticas.length &&
        agora - automaticas[0].criadoEm > JANELA_AUTOMATICA_MS
    ) {

        automaticas.shift();

    }

    let alterou = false;

    for (const [numero, pausa] of Object.entries(pausas)) {

        if (pausa.ate <= agora) {

            delete pausas[numero];
            alterou = true;

        }

    }

    if (alterou) salvarPausas();

}

function registrarMensagemAutomatica(numero, texto) {

    if (!numero) return;

    limparAntigas();

    automaticas.push({
        numero,
        texto: normalizarTexto(texto),
        criadoEm: Date.now()
    });

}

function ehMensagemAutomatica(numero, texto) {

    limparAntigas();

    const textoNormalizado = normalizarTexto(texto);
    let indice = automaticas.findIndex(item =>
        item.numero === numero &&
        item.texto === textoNormalizado
    );

    if (indice === -1) {

        indice = automaticas.findIndex(item =>
            item.texto === textoNormalizado
        );

    }

    if (indice === -1) return false;

    automaticas.splice(
        indice,
        1
    );

    return true;

}

function pausarAtendimento(numero, motivo = 'mensagem manual') {

    if (!numero) return null;

    const ate = Date.now() + DURACAO_MS;

    pausas[numero] = {
        motivo,
        ate
    };

    salvarPausas();

    return pausas[numero];

}

function liberarAtendimento(numero) {

    if (!numero || !pausas[numero]) return;

    delete pausas[numero];
    salvarPausas();

}

function limparPausasAtendimento() {

    for (const numero of Object.keys(pausas)) {

        delete pausas[numero];

    }

    salvarPausas();

}

function atendimentoPausado(numero) {

    limparAntigas();

    return pausas[numero] || null;

}

function instalarRegistroAutomatico(client) {

    if (client.__registroAutomaticoInstalado) return;

    const sendTextOriginal = client.sendText.bind(client);

    client.sendText = async (numero, texto, ...args) => {

        registrarMensagemAutomatica(
            numero,
            texto
        );

        return await sendTextOriginal(
            numero,
            texto,
            ...args
        );

    };

    client.__registroAutomaticoInstalado = true;

}

module.exports = {
    atendimentoPausado,
    ehMensagemAutomatica,
    instalarRegistroAutomatico,
    liberarAtendimento,
    limparPausasAtendimento,
    pausarAtendimento,
    registrarMensagemAutomatica
};
