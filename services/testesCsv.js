const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_CSV_PATH = path.join(DATA_DIR, 'testes.csv');
const CABECALHOS = [
    'telefone',
    'usuario',
    'senha',
    'dns',
    'm3u',
    'criado_em',
    'vencimento',
    'vencimento_iso',
    'horas',
    'status',
    'avisado_em'
];

function caminhoTestesCsv() {

    return process.env.TESTES_CSV_PATH || DEFAULT_CSV_PATH;

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

function detectarSeparador(linha) {

    const separadores = [';', ',', '\t'];

    return separadores
        .map(separador => ({
            separador,
            total: linha.split(separador).length
        }))
        .sort((a, b) => b.total - a.total)[0].separador;

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

function limparTelefone(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function normalizarDns(dns) {

    const texto = String(dns || '').trim();

    if (!texto) return '';

    return texto.replace(/\/$/, '') + '/';

}

function dataValida(valor) {

    const data = valor instanceof Date ? valor : new Date(valor);

    return Number.isNaN(data.getTime()) ? null : data;

}

function formatarData(valor) {

    const data = dataValida(valor);

    if (!data) return String(valor || '');

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

function lerTestesCsv(arquivo = caminhoTestesCsv()) {

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

function salvarTestesCsv(linhas, arquivo = caminhoTestesCsv()) {

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

function linhaDoTeste({
    telefone,
    credenciais,
    criadoEm,
    vencimento,
    horas
}) {

    const usuario = String(credenciais?.username || credenciais?.usuario || '').trim();
    const senha = String(credenciais?.password || credenciais?.senha || '').trim();
    const dns = normalizarDns(credenciais?.dns);
    const m3u = credenciais?.linkM3u ||
        credenciais?.m3u ||
        (
            dns && usuario && senha ?
                `${dns.replace(/\/$/, '')}/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=mpegts` :
                ''
        );
    const dataCriacao = dataValida(criadoEm) || new Date();
    const dataVencimento = dataValida(vencimento) ||
        new Date(dataCriacao.getTime() + Number(horas || 6) * 60 * 60 * 1000);

    return {
        telefone: limparTelefone(telefone),
        usuario,
        senha,
        dns,
        m3u,
        criado_em: formatarData(dataCriacao),
        vencimento: formatarData(dataVencimento),
        vencimento_iso: dataVencimento.toISOString(),
        horas: String(horas || 6),
        status: 'ativo',
        avisado_em: ''
    };

}

function registrarTesteCsv(dados, arquivo = caminhoTestesCsv()) {

    const linha = linhaDoTeste(dados);

    if (!linha.usuario) {
        throw new Error('Nao foi possivel registrar teste sem usuario.');
    }

    const linhas = lerTestesCsv(arquivo);
    const indice = linhas.findIndex(item =>
        String(item.usuario || '').trim() === linha.usuario
    );

    if (indice >= 0) {
        linhas[indice] = {
            ...linhas[indice],
            ...linha
        };
    } else {
        linhas.push(linha);
    }

    salvarTestesCsv(
        linhas,
        arquivo
    );

    return linha;

}

function testesParaAvisar(agora = new Date(), arquivo = caminhoTestesCsv()) {

    return lerTestesCsv(arquivo).filter(teste => {
        if (String(teste.status || '').toLowerCase() !== 'ativo') return false;
        if (String(teste.avisado_em || '').trim()) return false;

        const vencimento = dataValida(teste.vencimento_iso || teste.vencimento);

        return vencimento && vencimento <= agora;
    });

}

function marcarTesteEncerrado(usuario, arquivo = caminhoTestesCsv()) {

    const linhas = lerTestesCsv(arquivo);
    const indice = linhas.findIndex(item =>
        String(item.usuario || '').trim() === String(usuario || '').trim()
    );

    if (indice === -1) return null;

    linhas[indice] = {
        ...linhas[indice],
        status: 'encerrado',
        avisado_em: formatarData(new Date())
    };

    salvarTestesCsv(
        linhas,
        arquivo
    );

    return linhas[indice];

}

module.exports = {
    caminhoTestesCsv,
    lerTestesCsv,
    marcarTesteEncerrado,
    registrarTesteCsv,
    salvarTestesCsv,
    testesParaAvisar
};
