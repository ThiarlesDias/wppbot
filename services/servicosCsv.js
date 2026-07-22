const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_CSV_PATH = path.join(DATA_DIR, 'servicos.csv');
const CABECALHOS = [
    'tipo_chamado',
    'chamado',
    'cliente_nome',
    'telefone',
    'whatsapp_nome',
    'email',
    'inicio',
    'termino',
    'servico',
    'valor_combinado',
    'tecnico_responsavel',
    'data_prevista_pagamento',
    'status',
    'obs'
];

function caminhoServicosCsv() {

    return process.env.SERVICOS_CSV_PATH || DEFAULT_CSV_PATH;

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

function normalizarChamado(valor) {

    const texto = String(valor || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    if (!texto) return '';
    if (/^\d+$/.test(texto)) return `OS${texto}`;

    return texto;

}

function limparLinha(linha) {

    const limpa = {};

    for (const campo of CABECALHOS) {
        limpa[campo] = String(linha?.[campo] || '').trim();
    }

    limpa.chamado = normalizarChamado(limpa.chamado);

    return limpa;

}

function lerServicosCsv(arquivo = caminhoServicosCsv()) {

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

        return limparLinha(item);
    }).filter(item => item.chamado);

}

function salvarServicosCsv(linhas, arquivo = caminhoServicosCsv()) {

    garantirDiretorio(arquivo);

    const conteudo = [
        CABECALHOS.join(';'),
        ...linhas.map(linha => {
            const limpa = limparLinha(linha);

            return CABECALHOS
                .map(campo => escaparCsv(limpa[campo]))
                .join(';');
        })
    ].join('\n') + '\n';

    fs.writeFileSync(
        arquivo,
        conteudo
    );

}

function buscarServicoPorChamado(chamado, arquivo = caminhoServicosCsv()) {

    const alvo = normalizarChamado(chamado);

    if (!alvo) return null;

    return lerServicosCsv(arquivo).find(item =>
        normalizarChamado(item.chamado) === alvo
    ) || null;

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

function proximoChamado(linhas) {

    const maior = linhas.reduce(
        (atual, linha) => {
            const match = normalizarChamado(linha.chamado).match(/^OS(\d+)$/);
            const numero = match ? Number(match[1]) : 0;

            return Math.max(
                atual,
                numero
            );
        },
        358
    );

    return `OS${maior + 1}`;

}

function registrarChamadoExterno({
    telefone,
    whatsappNome,
    servico,
    email,
    arquivo = caminhoServicosCsv()
}) {

    const linhas = lerServicosCsv(arquivo);
    const chamado = proximoChamado(linhas);
    const linha = limparLinha({
        tipo_chamado: 'externo',
        chamado,
        cliente_nome: whatsappNome || '',
        telefone,
        whatsapp_nome: whatsappNome || '',
        email,
        inicio: formatarData(new Date()),
        termino: '',
        servico,
        valor_combinado: '',
        tecnico_responsavel: '',
        data_prevista_pagamento: '',
        status: 'aguardando atendimento',
        obs: 'Aberto pelo WhatsApp'
    });

    linhas.push(linha);
    salvarServicosCsv(
        linhas,
        arquivo
    );

    return linha;

}

function linkPortalChamados() {

    return process.env.CHAMADOS_PORTAL_URL ||
        process.env.TOPTEC_CHAMADOS_URL ||
        'https://toptecdigital.com/chamados/';

}

function formatarServico(servico) {

    return [
        `*Chamado ${servico.chamado}*`,
        '',
        `Tipo: ${servico.tipo_chamado || 'Nao informado'}`,
        `Cliente: ${servico.cliente_nome || servico.whatsapp_nome || 'Nao informado'}`,
        `WhatsApp: ${servico.telefone || 'Nao informado'}`,
        servico.email ? `Email: ${servico.email}` : '',
        `Inicio: ${servico.inicio || 'Nao informado'}`,
        `Termino: ${servico.termino || 'Em aberto'}`,
        `Servico: ${servico.servico || 'Nao informado'}`,
        `Valor combinado: ${servico.valor_combinado || 'Nao informado'}`,
        `Tecnico: ${servico.tecnico_responsavel || 'Nao definido'}`,
        `Pagamento previsto: ${servico.data_prevista_pagamento || 'Nao informado'}`,
        `Status: ${servico.status || 'Nao informado'}`,
        servico.obs ? `Obs: ${servico.obs}` : '',
        '',
        'Voce tambem pode acompanhar pelo site usando o usuario e senha do cadastro da empresa:',
        linkPortalChamados(),
        '',
        '9 - Falar com atendente',
        '0 - Voltar ao menu'
    ].filter(Boolean).join('\n');

}

module.exports = {
    CABECALHOS,
    buscarServicoPorChamado,
    caminhoServicosCsv,
    formatarServico,
    linkPortalChamados,
    lerServicosCsv,
    normalizarChamado,
    registrarChamadoExterno,
    salvarServicosCsv
};
