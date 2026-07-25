const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PAUSAS_PATH = path.join(DATA_DIR, 'atendimentos-pausados.json');
const pausas = carregarPausas();
const automaticas = [];
const destinosResolvidos = new Map();

const DURACAO_MS = Number(process.env.ATENDIMENTO_MANUAL_PAUSA_MS || 12 * 60 * 60 * 1000);
const JANELA_AUTOMATICA_MS = Number(process.env.ATENDIMENTO_AUTO_MATCH_MS || 15000);
const USAR_DESTINO_RESOLVIDO = process.env.WHATSAPP_SEND_RESOLVED !== '0';
const DEBUG_ENVIO = process.env.WHATSAPP_SEND_DEBUG === '1';

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

function registrarDestinoResolvido(origem, destino) {

    if (!origem || !destino || origem === destino) return;

    destinosResolvidos.set(
        origem,
        destino
    );

}

function resolverDestinoEnvio(numero) {

    if (!USAR_DESTINO_RESOLVIDO || !numero) return numero;

    return destinosResolvidos.get(numero) || numero;

}

function resumirTexto(texto) {

    return normalizarTexto(texto).slice(0, 80);

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

    if (indice === -1) {

        indice = automaticas.findIndex(item =>
            item.numero === numero
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

        const destino = resolverDestinoEnvio(numero);

        registrarMensagemAutomatica(
            numero,
            texto
        );

        if (destino !== numero) {

            registrarMensagemAutomatica(
                destino,
                texto
            );

            if (DEBUG_ENVIO) {

                console.log(
                    'ENVIO WHATSAPP DESTINO RESOLVIDO',
                    numero,
                    '=>',
                    destino,
                    resumirTexto(texto)
                );

            }

        }

        try {

            return await sendTextOriginal(
                destino,
                texto,
                ...args
            );

        } catch (erro) {

            console.log(
                'ERRO ENVIO WHATSAPP',
                destino,
                erro.message || erro,
                resumirTexto(texto)
            );

            if (destino !== numero) {

                console.log(
                    'ENVIO WHATSAPP FALLBACK',
                    destino,
                    '=>',
                    numero
                );

                return await sendTextOriginal(
                    numero,
                    texto,
                    ...args
                );

            }

            throw erro;

        }

    };

    client.__registroAutomaticoInstalado = true;

}

function instalarDebugAck(client) {

    if (process.env.WHATSAPP_ACK_DEBUG !== '1') return;
    if (!client || typeof client.onAck !== 'function') return;
    if (client.__debugAckInstalado) return;

    client.onAck((ack) => {

        try {

            const id = ack?.id?._serialized || ack?.id || '';
            const para = ack?.to || ack?.chatId || ack?.from || '';

            console.log(
                'ACK WHATSAPP',
                ack?.ack,
                para,
                id
            );

        } catch (_) {}

    });

    client.__debugAckInstalado = true;

}

function instalarRegistroEnvio(client) {

    instalarRegistroAutomatico(client);
    instalarDebugAck(client);

}

module.exports = {
    atendimentoPausado,
    ehMensagemAutomatica,
    instalarDebugAck,
    instalarRegistroAutomatico,
    instalarRegistroEnvio,
    liberarAtendimento,
    limparPausasAtendimento,
    pausarAtendimento,
    registrarDestinoResolvido,
    registrarMensagemAutomatica
};
