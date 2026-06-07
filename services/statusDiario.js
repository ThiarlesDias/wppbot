const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_PATH = path.join(DATA_DIR, 'status-diario.json');
const EXTENSOES_IMAGEM = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let timer = null;
let ultimaProximaExecucao = null;

function habilitado() {

    return String(process.env.STATUS_DIARIO_ENABLED || '1') !== '0';

}

function imagensDir() {

    return process.env.STATUS_IMAGENS_DIR || path.join(DATA_DIR, 'status');

}

function horaEnvio() {

    const hora = Number(process.env.STATUS_ENVIO_HORA || 9);

    if (!Number.isFinite(hora) || hora < 0 || hora > 23) return 9;

    return hora;

}

function minutoEnvio() {

    const minuto = Number(process.env.STATUS_ENVIO_MINUTO || 0);

    if (!Number.isFinite(minuto) || minuto < 0 || minuto > 59) return 0;

    return minuto;

}

function diaSaoPaulo(data = new Date()) {

    const partes = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.year}-${partes.month}-${partes.day}`;

}

function partesSaoPaulo(data = new Date()) {

    return new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = Number(parte.value);
            return acc;
        },
        {}
    );

}

function dataSaoPauloParaUtc({
    year,
    month,
    day,
    hour,
    minute
}) {

    return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0, 0));

}

function proximaExecucao() {

    const agora = new Date();
    const partes = partesSaoPaulo(agora);
    let alvo = dataSaoPauloParaUtc({
        year: partes.year,
        month: partes.month,
        day: partes.day,
        hour: horaEnvio(),
        minute: minutoEnvio()
    });

    if (alvo <= agora) {
        alvo = new Date(alvo.getTime() + 24 * 60 * 60 * 1000);
    }

    return alvo;

}

function garantirDataDir() {

    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });

}

function lerEstado() {

    try {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch (_) {
        return {};
    }

}

function salvarEstado(estado) {

    garantirDataDir();
    fs.writeFileSync(
        STATE_PATH,
        JSON.stringify(estado, null, 2)
    );

}

function listarImagens() {

    const pasta = imagensDir();

    try {
        return fs.readdirSync(pasta)
            .filter(arquivo => EXTENSOES_IMAGEM.has(path.extname(arquivo).toLowerCase()))
            .map(arquivo => path.join(pasta, arquivo))
            .filter(arquivo => fs.statSync(arquivo).isFile())
            .sort();
    } catch (_) {
        return [];
    }

}

function escolherImagem(imagens, ultimoArquivo) {

    if (!imagens.length) return null;

    const disponiveis = imagens.length > 1 ?
        imagens.filter(imagem => imagem !== ultimoArquivo) :
        imagens;

    return disponiveis[Math.floor(Math.random() * disponiveis.length)];

}

async function postarAgora(client, opcoes = {}) {

    if (!habilitado() && !opcoes.forcar) {
        return {
            ok: false,
            detalhe: 'Status diario desativado.'
        };
    }

    if (!client || typeof client.sendImageStatus !== 'function') {
        throw new Error('WPPConnect nao disponibilizou sendImageStatus.');
    }

    const estado = lerEstado();
    const hoje = diaSaoPaulo();

    if (!opcoes.forcar && estado.ultimoDia === hoje) {
        return {
            ok: true,
            pulado: true,
            detalhe: 'Status de hoje ja foi postado.',
            arquivo: estado.ultimoArquivo || ''
        };
    }

    const imagens = listarImagens();
    const imagem = escolherImagem(imagens, estado.ultimoArquivo);

    if (!imagem) {
        throw new Error(`Nenhuma imagem encontrada em ${imagensDir()}.`);
    }

    const legenda = process.env.STATUS_LEGENDA || '';
    const options = legenda ? {
        caption: legenda
    } : undefined;

    await client.sendImageStatus(imagem, options);

    const novoEstado = {
        ...estado,
        ultimoDia: hoje,
        ultimoArquivo: imagem,
        postadoEm: new Date().toISOString()
    };

    salvarEstado(novoEstado);

    console.log('STATUS DIARIO POSTADO', path.basename(imagem));

    return {
        ok: true,
        arquivo: imagem,
        detalhe: 'Status postado.'
    };

}

async function executarAgendado(client) {

    try {
        const resultado = await postarAgora(client);

        if (resultado.pulado) {
            console.log('STATUS DIARIO IGNORADO', resultado.detalhe);
        }
    } catch (erro) {
        console.log('ERRO STATUS DIARIO', erro.message);
    } finally {
        agendar(client);
    }

}

function agendar(client) {

    if (timer) clearTimeout(timer);

    if (!habilitado()) {
        console.log('STATUS DIARIO DESATIVADO');
        return;
    }

    const proxima = proximaExecucao();
    ultimaProximaExecucao = proxima;
    const delay = Math.max(1000, proxima.getTime() - Date.now());

    console.log('STATUS DIARIO AGENDADO PARA', proxima.toISOString());

    timer = setTimeout(
        () => executarAgendado(client),
        delay
    );

}

function resumo() {

    const estado = lerEstado();
    const imagens = listarImagens();

    return {
        habilitado: habilitado(),
        pasta: imagensDir(),
        totalImagens: imagens.length,
        ultimoArquivo: estado.ultimoArquivo || '',
        ultimoDia: estado.ultimoDia || '',
        postadoEm: estado.postadoEm || '',
        proximaExecucao: ultimaProximaExecucao ? ultimaProximaExecucao.toISOString() : ''
    };

}

function iniciarStatusDiario(client) {

    agendar(client);

    if (process.env.STATUS_POST_STARTUP === '1') {
        setTimeout(
            () => postarAgora(client, {
                forcar: true
            }).catch(erro => console.log('ERRO STATUS DIARIO STARTUP', erro.message)),
            20000
        );
    }

}

iniciarStatusDiario.postarAgora = postarAgora;
iniciarStatusDiario.resumo = resumo;

module.exports = iniciarStatusDiario;
