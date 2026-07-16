const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DEFAULT_CSV_PATH = path.join(DATA_DIR, 'clientes.csv');
const CABECALHOS = [
    'nome',
    'telefone',
    'usuario',
    'senha',
    'dns',
    'm3u',
    'vencimento',
    'valor',
    'telas',
    'meses',
    'aviso_vencimento'
];

function caminhoCsv() {

    return process.env.CLIENTES_CSV_PATH || DEFAULT_CSV_PATH;

}

function garantirDiretorio(arquivo) {

    const diretorio = path.dirname(arquivo);

    if (!fs.existsSync(diretorio)) {

        fs.mkdirSync(
            diretorio,
            {
                recursive: true
            }
        );

    }

}

function normalizarCabecalho(campo) {

    return String(campo || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

}

function detectarSeparador(linha) {

    const separadores = [';', ',', '\t'];

    return separadores
        .map(separador => ({
            separador,
            total: linha.split(separador).length
        }))
        .sort((a, b) => b.total - a.total)[0].separador;

}

function parseCsvLinha(linha, separador) {

    const campos = [];
    let atual = '';
    let aspas = false;

    for (let i = 0; i < linha.length; i += 1) {

        const char = linha[i];
        const proximo = linha[i + 1];

        if (char === '"' && proximo === '"') {

            atual += '"';
            i += 1;
            continue;

        }

        if (char === '"') {

            aspas = !aspas;
            continue;

        }

        if (char === separador && !aspas) {

            campos.push(atual.trim());
            atual = '';
            continue;

        }

        atual += char;

    }

    campos.push(atual.trim());

    return campos;

}

function lerClientesCsv(arquivo = caminhoCsv()) {

    if (!fs.existsSync(arquivo)) return [];

    const conteudo = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
    const linhasTexto = conteudo
        .split(/\r?\n/)
        .filter(linha => linha.trim() !== '');

    if (!linhasTexto.length) return [];

    const separador = detectarSeparador(linhasTexto[0]);
    const cabecalho = parseCsvLinha(linhasTexto[0], separador)
        .map(normalizarCabecalho);

    return linhasTexto.slice(1).map(linhaTexto => {
        const campos = parseCsvLinha(linhaTexto, separador);
        const item = {};

        cabecalho.forEach((campo, indice) => {
            item[campo] = campos[indice] || '';
        });

        return item;
    }).filter(item => item.usuario || item.telefone);

}

function escaparCsv(valor) {

    const texto = String(valor ?? '').trim();

    if (
        texto.includes(';') ||
        texto.includes('"') ||
        texto.includes('\n') ||
        texto.includes('\r')
    ) {

        return `"${texto.replace(/"/g, '""')}"`;

    }

    return texto;

}

function salvarClientesCsv(linhas, arquivo = caminhoCsv()) {

    garantirDiretorio(arquivo);

    const conteudo = [
        CABECALHOS.join(';'),
        ...linhas.map(linha => CABECALHOS
            .map(campo => escaparCsv(linha[campo]))
            .join(';'))
    ].join('\n') + '\n';

    fs.writeFileSync(
        arquivo,
        conteudo
    );

}

function normalizarNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

}

function normalizarDns(dns) {

    const texto = String(dns || '').trim();

    if (!texto) return '';

    return texto.replace(/\/$/, '') + '/';

}

function formatarData(valor) {

    const data = valor instanceof Date ? valor : new Date(valor);

    if (Number.isNaN(data.getTime())) return String(valor || '');

    const partes = new Intl.DateTimeFormat(
        'pt-BR',
        {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}:${partes.second}`;

}

function linhaDaAssinatura(assinatura) {

    const usuario = String(assinatura.username || assinatura.usuario || '').trim();
    const senha = String(assinatura.password || assinatura.senha || '').trim();
    const dns = normalizarDns(assinatura.dns);
    const m3u = assinatura.linkM3u ||
        assinatura.m3u ||
        (
            dns && usuario && senha ?
                `${dns.replace(/\/$/, '')}/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=mpegts` :
                ''
        );

    return {
        nome: assinatura.nome || '',
        telefone: normalizarNumero(assinatura.telefone || assinatura.numero),
        usuario,
        senha,
        dns,
        m3u,
        vencimento: formatarData(assinatura.expiresAt || assinatura.vencimento),
        valor: assinatura.valor || '',
        telas: assinatura.telas || '',
        meses: assinatura.meses || '',
        aviso_vencimento: assinatura.avisoVencimento ||
            assinatura.aviso_vencimento ||
            ''
    };

}

function atualizarClienteCsv(assinatura, arquivo = caminhoCsv()) {

    const linha = linhaDaAssinatura(assinatura);

    if (!linha.usuario) {

        throw new Error('Nao foi possivel atualizar clientes.csv sem usuario.');

    }

    const linhas = lerClientesCsv(arquivo);
    const indice = linhas.findIndex(item =>
        String(item.usuario || '').trim() === linha.usuario
    );

    if (indice >= 0) {

        linhas[indice] = {
            ...linhas[indice],
            ...linha,
            valor: linha.valor || linhas[indice].valor || '',
            telas: linha.telas || linhas[indice].telas || '',
            meses: linha.meses || linhas[indice].meses || '',
            aviso_vencimento: linha.aviso_vencimento ||
                linhas[indice].aviso_vencimento ||
                ''
        };

    } else {

        linhas.push(linha);

    }

    linhas.sort((a, b) =>
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') ||
        String(a.usuario || '').localeCompare(String(b.usuario || ''), 'pt-BR')
    );

    salvarClientesCsv(
        linhas,
        arquivo
    );

    return linha;

}

module.exports = {
    atualizarClienteCsv,
    caminhoCsv,
    linhaDaAssinatura,
    lerClientesCsv,
    salvarClientesCsv
};
