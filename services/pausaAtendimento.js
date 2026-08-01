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
const USAR_ENVIO_DIRETO = process.env.WHATSAPP_DIRECT_SEND === '1';
const TIMEOUT_ENVIO_MS = Number(process.env.WHATSAPP_SEND_TIMEOUT_MS || 12000);

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

function erroPermiteDestinoAlternativo(erro) {

    const mensagem = String(erro?.message || erro || '');

    return mensagem.includes('No LID') ||
        mensagem.includes('InvalidWid') ||
        mensagem.includes('wid error') ||
        mensagem.includes('invalid wid');

}

function extrairSerializado(valor) {

    if (!valor) return null;
    if (typeof valor === 'string') return valor;
    if (typeof valor !== 'object') return null;

    return valor._serialized ||
        valor.serialized ||
        (
            valor.user && valor.server
                ? `${valor.user}@${valor.server}`
                : null
        );

}

async function resolverDestinoAlternativo(client, destino) {

    if (!client || typeof client.getPnLidEntry !== 'function') return null;
    if (!destino || (!destino.endsWith('@c.us') && !destino.endsWith('@lid'))) return null;

    try {

        const info = await client.getPnLidEntry(destino);

        if (destino.endsWith('@c.us')) {

            return extrairSerializado(info?.lid);

        }

        return extrairSerializado(info?.phoneNumber);

    } catch (erro) {

        console.log(
            'ERRO RESOLVER DESTINO WHATSAPP',
            destino,
            erro.message || erro
        );

        return null;

    }

}

function resumirTexto(texto) {

    return normalizarTexto(texto).slice(0, 80);

}

function criarErroTimeoutEnvio(destino) {

    const erro = new Error(`Timeout aguardando envio WhatsApp para ${destino}.`);
    erro.code = 'WHATSAPP_SEND_TIMEOUT';

    return erro;

}

async function aguardarComTimeout(promise, destino) {

    let timeout;
    promise.catch(() => {});

    try {

        return await Promise.race([
            promise,
            new Promise((_, reject) => {

                timeout = setTimeout(
                    () => reject(criarErroTimeoutEnvio(destino)),
                    TIMEOUT_ENVIO_MS
                );

            })
        ]);

    } finally {

        clearTimeout(timeout);

    }

}

function prepararOpcoesEnvio(args) {

    const opcoes = args?.[0];

    if (!opcoes || typeof opcoes !== 'object') return undefined;

    try {

        return JSON.parse(JSON.stringify(opcoes));

    } catch (_) {

        return undefined;

    }

}

async function enviarViaWppDireto(client, destino, texto, args) {

    if (!client?.page?.evaluate) {

        throw new Error('Pagina do WhatsApp indisponivel para envio direto.');

    }

    const opcoes = prepararOpcoesEnvio(args);

    return await client.page.evaluate(
        async ({ to, content, options }) => {

            const enviar = globalThis.WPP?.chat?.sendTextMessage;

            if (!enviar) {

                throw new Error('WPP.chat.sendTextMessage indisponivel.');

            }

            const resultado = await enviar(
                to,
                content,
                {
                    ...(options || {}),
                    waitForAck: false
                }
            );

            const id = resultado?.id?._serialized ||
                resultado?.id ||
                resultado?.message?.id?._serialized ||
                null;

            return {
                ok: true,
                id: typeof id === 'string' ? id : null
            };

        },
        {
            to: destino,
            content: texto,
            options: opcoes
        }
    );

}

async function enviarViaOriginal(sendTextOriginal, destino, texto, args) {

    return await aguardarComTimeout(
        sendTextOriginal(
            destino,
            texto,
            ...args
        ),
        destino
    );

}

async function enviarTextoNoDestino(client, sendTextOriginal, destino, texto, args) {

    if (USAR_ENVIO_DIRETO) {

        try {

            const resultado = await enviarViaWppDireto(
                client,
                destino,
                texto,
                args
            );

            if (DEBUG_ENVIO) {

                console.log(
                    'ENVIO WHATSAPP DIRETO OK',
                    destino,
                    resultado?.id || '',
                    resumirTexto(texto)
                );

            }

            return resultado;

        } catch (erro) {

            console.log(
                'ERRO ENVIO WHATSAPP DIRETO',
                destino,
                erro.message || erro,
                resumirTexto(texto)
            );

            if (erroPermiteDestinoAlternativo(erro)) throw erro;

        }

    }

    return await enviarViaOriginal(
        sendTextOriginal,
        destino,
        texto,
        args
    );

}

function consumirMensagemAutomatica(numero, texto) {

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

    const [item] = automaticas.splice(
        indice,
        1
    );

    return item || null;

}

function ehMensagemAutomatica(numero, texto) {

    return Boolean(consumirMensagemAutomatica(
        numero,
        texto
    ));

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

            return await enviarTextoNoDestino(
                client,
                sendTextOriginal,
                destino,
                texto,
                args
            );

        } catch (erro) {

            console.log(
                'ERRO ENVIO WHATSAPP',
                destino,
                erro.message || erro,
                resumirTexto(texto)
            );

            if (erroPermiteDestinoAlternativo(erro)) {

                const alternativo = await resolverDestinoAlternativo(
                    client,
                    destino
                );

                if (
                    alternativo &&
                    alternativo !== destino &&
                    alternativo !== numero
                ) {

                    registrarDestinoResolvido(
                        destino,
                        alternativo
                    );
                    registrarMensagemAutomatica(
                        alternativo,
                        texto
                    );

                    console.log(
                        'ENVIO WHATSAPP DESTINO ALTERNATIVO',
                        destino,
                        '=>',
                        alternativo
                    );

                    return await enviarTextoNoDestino(
                        client,
                        sendTextOriginal,
                        alternativo,
                        texto,
                        args
                    );

                }

            }

            if (destino !== numero) {

                console.log(
                    'ENVIO WHATSAPP FALLBACK',
                    destino,
                    '=>',
                    numero
                );

                return await enviarTextoNoDestino(
                    client,
                    sendTextOriginal,
                    numero,
                    texto,
                    args
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
    consumirMensagemAutomatica,
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
