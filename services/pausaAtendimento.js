const pausas = {};
const automaticas = [];

const DURACAO_MS = Number(process.env.ATENDIMENTO_MANUAL_PAUSA_MS || 12 * 60 * 60 * 1000);
const JANELA_AUTOMATICA_MS = Number(process.env.ATENDIMENTO_AUTO_MATCH_MS || 15000);

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

    for (const [numero, pausa] of Object.entries(pausas)) {

        if (pausa.ate <= agora) delete pausas[numero];

    }

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
    const indice = automaticas.findIndex(item =>
        item.numero === numero &&
        item.texto === textoNormalizado
    );

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

    return pausas[numero];

}

function liberarAtendimento(numero) {

    delete pausas[numero];

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
    pausarAtendimento,
    registrarMensagemAutomatica
};
