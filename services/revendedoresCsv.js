const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REVENDEDORES_HEADERS = [
    'telefone',
    'nome',
    'status',
    'observacao'
];
const CLIENTES_HEADERS = [
    'revendedor_telefone',
    'revendedor_nome',
    'cliente_nome',
    'cliente_telefone',
    'usuario',
    'senha',
    'dns',
    'm3u',
    'vencimento',
    'status',
    'observacao',
    'aviso_vencimento'
];
const CHAMADOS_HEADERS = [
    'codigo',
    'revendedor_telefone',
    'revendedor_nome',
    'cliente_nome',
    'usuario',
    'descricao',
    'status',
    'criado_em',
    'atualizado_em',
    'observacao'
];

function caminhoRevendedoresCsv() {

    return process.env.REVENDEDORES_CSV_PATH ||
        path.join(DATA_DIR, 'revendedores.csv');

}

function caminhoRevendedoresClientesCsv() {

    return process.env.REVENDEDORES_CLIENTES_CSV_PATH ||
        path.join(DATA_DIR, 'revendedores-clientes.csv');

}

function caminhoRevendedoresChamadosCsv() {

    return process.env.REVENDEDORES_CHAMADOS_CSV_PATH ||
        path.join(DATA_DIR, 'revendedores-chamados.csv');

}

function garantirDiretorio(arquivo) {

    fs.mkdirSync(
        path.dirname(arquivo),
        {
            recursive: true
        }
    );

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
            total: String(linha || '').split(separador).length
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

function garantirCsv(arquivo, cabecalhos) {

    garantirDiretorio(arquivo);

    if (fs.existsSync(arquivo)) return;

    fs.writeFileSync(
        arquivo,
        `${cabecalhos.join(';')}\n`
    );

}

function lerCsv(arquivo, cabecalhos) {

    garantirCsv(
        arquivo,
        cabecalhos
    );

    const conteudo = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
    const linhas = conteudo
        .split(/\r?\n/)
        .filter(linha => linha.trim() !== '');

    if (linhas.length <= 1) return [];

    const separador = detectarSeparador(linhas[0]);
    const cabecalho = parseCsvLinha(linhas[0], separador)
        .map(normalizarCabecalho);

    return linhas.slice(1).map(linhaTexto => {
        const campos = parseCsvLinha(linhaTexto, separador);
        const item = {};

        cabecalho.forEach((campo, indice) => {
            item[campo] = campos[indice] || '';
        });

        return item;
    });

}

function salvarCsv(arquivo, cabecalhos, linhas) {

    garantirDiretorio(arquivo);

    const conteudo = [
        cabecalhos.join(';'),
        ...linhas.map(linha => cabecalhos
            .map(campo => escaparCsv(linha[campo]))
            .join(';'))
    ].join('\n') + '\n';

    fs.writeFileSync(
        arquivo,
        conteudo
    );

}

function limparNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

}

function statusAtivo(status) {

    const texto = normalizarCabecalho(status || 'ativo');

    return ![
        'inativo',
        'cancelado',
        'bloqueado'
    ].includes(texto);

}

function lerRevendedoresCsv(arquivo = caminhoRevendedoresCsv()) {

    return lerCsv(
        arquivo,
        REVENDEDORES_HEADERS
    ).filter(item => limparNumero(item.telefone));

}

function lerRevendedoresClientesCsv(arquivo = caminhoRevendedoresClientesCsv()) {

    return lerCsv(
        arquivo,
        CLIENTES_HEADERS
    ).filter(item => item.usuario || limparNumero(item.cliente_telefone));

}

function salvarRevendedoresClientesCsv(linhas, arquivo = caminhoRevendedoresClientesCsv()) {

    salvarCsv(
        arquivo,
        CLIENTES_HEADERS,
        linhas
    );

}

function lerRevendedoresChamadosCsv(arquivo = caminhoRevendedoresChamadosCsv()) {

    return lerCsv(
        arquivo,
        CHAMADOS_HEADERS
    ).filter(item => item.codigo);

}

function salvarRevendedoresChamadosCsv(linhas, arquivo = caminhoRevendedoresChamadosCsv()) {

    salvarCsv(
        arquivo,
        CHAMADOS_HEADERS,
        linhas
    );

}

function buscarRevendedorPorNumero(numero, numeroWhatsapp) {

    const alvos = new Set([
        limparNumero(numero),
        limparNumero(numeroWhatsapp)
    ].filter(Boolean));

    if (!alvos.size) return null;

    return lerRevendedoresCsv().find(revendedor =>
        statusAtivo(revendedor.status) &&
        alvos.has(limparNumero(revendedor.telefone))
    ) || null;

}

function listarClientesRevendedor(revendedor) {

    const telefone = limparNumero(revendedor?.telefone);

    if (!telefone) return [];

    return lerRevendedoresClientesCsv().filter(cliente =>
        limparNumero(cliente.revendedor_telefone) === telefone &&
        statusAtivo(cliente.status)
    );

}

function marcarAvisoVencimentoRevendedorCliente(clienteAlvo) {

    const linhas = lerRevendedoresClientesCsv();
    const revendedorTelefone = limparNumero(clienteAlvo?.revendedor_telefone);
    const usuario = String(clienteAlvo?.usuario || '').trim().toLowerCase();
    const indice = linhas.findIndex(cliente =>
        limparNumero(cliente.revendedor_telefone) === revendedorTelefone &&
        String(cliente.usuario || '').trim().toLowerCase() === usuario
    );

    if (indice < 0) return false;

    linhas[indice] = {
        ...linhas[indice],
        aviso_vencimento: clienteAlvo.vencimento || ''
    };

    salvarRevendedoresClientesCsv(linhas);

    return true;

}

function buscarClienteRevendedorPorUsuario(revendedor, usuario) {

    const alvo = String(usuario || '').trim().toLowerCase();

    if (!alvo) return null;

    return listarClientesRevendedor(revendedor).find(cliente =>
        String(cliente.usuario || '').trim().toLowerCase() === alvo
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

function proximoCodigoChamado(linhas) {

    const maior = linhas.reduce(
        (atual, linha) => {
            const match = String(linha.codigo || '').match(/^RV(\d+)$/i);
            const numero = match ? Number(match[1]) : 0;

            return Math.max(
                atual,
                numero
            );
        },
        1000
    );

    return `RV${maior + 1}`;

}

function registrarChamadoRevendedor({
    revendedor,
    clienteNome,
    usuario,
    descricao,
    observacao = '',
    arquivo = caminhoRevendedoresChamadosCsv()
}) {

    const linhas = lerRevendedoresChamadosCsv(arquivo);
    const agora = formatarData(new Date());
    const linha = {
        codigo: proximoCodigoChamado(linhas),
        revendedor_telefone: limparNumero(revendedor?.telefone),
        revendedor_nome: revendedor?.nome || '',
        cliente_nome: clienteNome || '',
        usuario: usuario || '',
        descricao,
        status: 'aguardando atendimento',
        criado_em: agora,
        atualizado_em: agora,
        observacao
    };

    linhas.push(linha);
    salvarRevendedoresChamadosCsv(
        linhas,
        arquivo
    );

    return linha;

}

function listarChamadosAbertosRevendedor(revendedor) {

    const telefone = limparNumero(revendedor?.telefone);

    if (!telefone) return [];

    return lerRevendedoresChamadosCsv().filter(chamado =>
        limparNumero(chamado.revendedor_telefone) === telefone &&
        ![
            'concluido',
            'concluido',
            'fechado',
            'cancelado'
        ].includes(normalizarCabecalho(chamado.status))
    );

}

module.exports = {
    buscarClienteRevendedorPorUsuario,
    buscarRevendedorPorNumero,
    caminhoRevendedoresChamadosCsv,
    caminhoRevendedoresClientesCsv,
    caminhoRevendedoresCsv,
    formatarData,
    lerRevendedoresChamadosCsv,
    lerRevendedoresClientesCsv,
    lerRevendedoresCsv,
    listarChamadosAbertosRevendedor,
    listarClientesRevendedor,
    marcarAvisoVencimentoRevendedorCliente,
    registrarChamadoRevendedor
};
