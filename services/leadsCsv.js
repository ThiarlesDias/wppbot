const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_CSV_PATH = path.join(DATA_DIR, 'leads.csv');
const CABECALHOS = [
    'telefone',
    'numero',
    'nome',
    'fluxo',
    'status',
    'criado_em',
    'ultima_interacao',
    'tentativas_retomada',
    'ultimo_remarketing',
    'observacao'
];

function caminhoLeadsCsv() {

    return process.env.LEADS_CSV_PATH || DEFAULT_CSV_PATH;

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

function formatarData(valor = new Date()) {

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

function diaSaoPaulo(valor = new Date()) {

    const data = valor instanceof Date ? valor : new Date(valor);
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

function lerLeadsCsv(arquivo = caminhoLeadsCsv()) {

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
    }).filter(item => item.telefone || item.numero);

}

function salvarLeadsCsv(linhas, arquivo = caminhoLeadsCsv()) {

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

function chaveLead(dados) {

    return limparTelefone(dados.telefone || dados.numero) ||
        String(dados.numero || '').trim();

}

function registrarLead({
    numero,
    telefone,
    nome,
    fluxo,
    observacao = ''
}, arquivo = caminhoLeadsCsv()) {

    const chave = chaveLead({
        numero,
        telefone
    });

    if (!chave) return null;

    const agora = formatarData();
    const linhas = lerLeadsCsv(arquivo);
    const indice = linhas.findIndex(linha => chaveLead(linha) === chave);
    const base = indice >= 0 ? linhas[indice] : {};
    const statusAtual = String(base.status || '').trim().toLowerCase();

    if (['teste', 'cliente', 'encerrado'].includes(statusAtual)) {
        return base;
    }

    const linha = {
        telefone: limparTelefone(telefone || numero),
        numero: String(numero || base.numero || '').trim(),
        nome: String(nome || base.nome || '').trim(),
        fluxo: String(fluxo || base.fluxo || 'entrada').trim(),
        status: 'lead',
        criado_em: base.criado_em || agora,
        ultima_interacao: agora,
        tentativas_retomada: base.tentativas_retomada || '0',
        ultimo_remarketing: base.ultimo_remarketing || '',
        observacao: String(observacao || base.observacao || '').trim()
    };

    if (indice >= 0) {
        linhas[indice] = {
            ...base,
            ...linha
        };
    } else {
        linhas.push(linha);
    }

    salvarLeadsCsv(
        linhas,
        arquivo
    );

    return linha;

}

function atualizarTentativaLead(valor, arquivo = caminhoLeadsCsv()) {

    const chave = chaveLead({
        telefone: valor,
        numero: valor
    });
    const linhas = lerLeadsCsv(arquivo);
    const indice = linhas.findIndex(linha => chaveLead(linha) === chave);

    if (indice === -1) return null;

    const total = Number(linhas[indice].tentativas_retomada || 0) + 1;

    linhas[indice] = {
        ...linhas[indice],
        tentativas_retomada: String(total),
        ultima_interacao: formatarData()
    };

    salvarLeadsCsv(
        linhas,
        arquivo
    );

    return linhas[indice];

}

function marcarLead(valor, status, observacao = '', arquivo = caminhoLeadsCsv()) {

    const chave = chaveLead({
        telefone: valor,
        numero: valor
    });
    const linhas = lerLeadsCsv(arquivo);
    const indice = linhas.findIndex(linha => chaveLead(linha) === chave);

    if (indice === -1) return null;

    linhas[indice] = {
        ...linhas[indice],
        status,
        observacao: observacao || linhas[indice].observacao || '',
        ultima_interacao: formatarData()
    };

    salvarLeadsCsv(
        linhas,
        arquivo
    );

    return linhas[indice];

}

function marcarLeadConvertido(valor, tipo = 'cliente') {

    return marcarLead(
        valor,
        tipo,
        tipo === 'teste' ? 'Virou teste gratis.' : 'Virou cliente.'
    );

}

function leadsParaRemarketing(agora = new Date(), arquivo = caminhoLeadsCsv()) {

    const hoje = diaSaoPaulo(agora);

    return lerLeadsCsv(arquivo).filter(lead => {
        if (String(lead.status || '').toLowerCase() !== 'lead') return false;
        if (String(lead.ultimo_remarketing || '').trim() === hoje) return false;
        return true;
    });

}

function marcarRemarketingEnviado(valor, arquivo = caminhoLeadsCsv()) {

    const chave = chaveLead({
        telefone: valor,
        numero: valor
    });
    const linhas = lerLeadsCsv(arquivo);
    const indice = linhas.findIndex(linha => chaveLead(linha) === chave);

    if (indice === -1) return null;

    linhas[indice] = {
        ...linhas[indice],
        ultimo_remarketing: diaSaoPaulo(),
        ultima_interacao: formatarData()
    };

    salvarLeadsCsv(
        linhas,
        arquivo
    );

    return linhas[indice];

}

module.exports = {
    atualizarTentativaLead,
    caminhoLeadsCsv,
    chaveLead,
    formatarData,
    leadsParaRemarketing,
    lerLeadsCsv,
    marcarLead,
    marcarLeadConvertido,
    marcarRemarketingEnviado,
    registrarLead,
    salvarLeadsCsv
};
