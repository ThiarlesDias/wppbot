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

function formatarServico(servico) {

    return [
        `*Chamado ${servico.chamado}*`,
        '',
        `Tipo: ${servico.tipo_chamado || 'Nao informado'}`,
        `Cliente: ${servico.cliente_nome || servico.whatsapp_nome || 'Nao informado'}`,
        `WhatsApp: ${servico.telefone || 'Nao informado'}`,
        `Inicio: ${servico.inicio || 'Nao informado'}`,
        `Termino: ${servico.termino || 'Em aberto'}`,
        `Servico: ${servico.servico || 'Nao informado'}`,
        `Valor combinado: ${servico.valor_combinado || 'Nao informado'}`,
        `Tecnico: ${servico.tecnico_responsavel || 'Nao definido'}`,
        `Pagamento previsto: ${servico.data_prevista_pagamento || 'Nao informado'}`,
        `Status: ${servico.status || 'Nao informado'}`,
        servico.obs ? `Obs: ${servico.obs}` : '',
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
    lerServicosCsv,
    normalizarChamado,
    salvarServicosCsv
};
