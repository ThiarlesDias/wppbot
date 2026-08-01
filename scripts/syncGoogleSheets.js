const fs = require('fs');
const path = require('path');
const {
    spawnSync
} = require('child_process');
const {
    escreverValores,
    lerValores,
    nomeAba
} = require('../services/googleSheetsClient');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFINICOES = [
    {
        chave: 'clientes',
        arquivo: 'clientes.csv',
        remoto: 'clientes-google.csv',
        estado: 'clientes-sync-state.json',
        merge: 'merge:clientes',
        cabecalho: 'nome;telefone;usuario;senha;dns;m3u;vencimento;valor;telas;meses;aviso_vencimento'
    },
    {
        chave: 'testes',
        arquivo: 'testes.csv',
        remoto: 'testes-google.csv',
        estado: 'testes-sync-state.json',
        merge: 'merge:testes',
        cabecalho: 'telefone;usuario;senha;dns;m3u;criado_em;vencimento;vencimento_iso;horas;status;avisado_em;ultimo_aviso_contratacao;saiu_em'
    },
    {
        chave: 'leads',
        arquivo: 'leads.csv',
        remoto: 'leads-google.csv',
        estado: 'leads-sync-state.json',
        merge: 'merge:leads',
        cabecalho: 'telefone;numero;nome;fluxo;status;criado_em;ultima_interacao;tentativas_retomada;ultimo_remarketing;remarketing_envios;observacao'
    },
    {
        chave: 'servicos',
        arquivo: 'servicos.csv',
        remoto: 'servicos-google.csv',
        estado: 'servicos-sync-state.json',
        merge: 'merge:servicos',
        cabecalho: 'chamado_interno;chamado_externo;cliente_nome;telefone;whatsapp_nome;email;inicio;termino;servico;valor_combinado;tecnico_responsavel;data_prevista_pagamento;status;obs',
        primeiraLinha: 'OS359;;;;;;;;;;;;aguardando atendimento;'
    },
    {
        chave: 'marketing',
        arquivo: 'marketing.csv',
        remoto: 'marketing-google.csv',
        estado: '',
        merge: '',
        cabecalho: 'telefone'
    }
];

function garantirDataDir() {

    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );

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

function valoresParaCsv(valores, cabecalho) {

    if (!valores.length) return `${cabecalho}\n`;

    return valores
        .map(linha => linha
            .map(escaparCsv)
            .join(';'))
        .join('\n') + '\n';

}

function csvParaValores(arquivo, cabecalho) {

    if (!fs.existsSync(arquivo)) return [cabecalho.split(';')];

    const texto = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
    const linhas = texto
        .split(/\r?\n/)
        .filter(linha => linha.trim() !== '');

    if (!linhas.length) return [cabecalho.split(';')];

    const separador = detectarSeparador(linhas[0]);

    return linhas.map(linha => parseCsvLinha(linha, separador));

}

function arquivoPadrao(def) {

    return path.join(
        DATA_DIR,
        def.arquivo
    );

}

function garantirLocal(def) {

    const arquivo = arquivoPadrao(def);

    if (fs.existsSync(arquivo)) return;

    const linhas = [
        def.cabecalho,
        def.primeiraLinha || ''
    ].filter(Boolean);

    fs.writeFileSync(
        arquivo,
        `${linhas.join('\n')}\n`
    );

}

function mesclarMarketing(localPath, remotoPath, saidaPath) {

    const telefones = new Set();

    for (const arquivo of [localPath, remotoPath]) {
        if (!fs.existsSync(arquivo)) continue;

        const valores = csvParaValores(arquivo, 'telefone').slice(1);

        for (const linha of valores) {
            const telefone = String(linha.join(' ') || '').replace(/\D/g, '');
            if (telefone.length >= 10) telefones.add(telefone);
        }
    }

    const linhas = [
        'telefone',
        ...Array.from(telefones).sort()
    ];

    fs.writeFileSync(
        saidaPath,
        `${linhas.join('\n')}\n`
    );

}

function executarMerge(def, localPath, remotoPath) {

    if (!def.merge) {
        mesclarMarketing(
            localPath,
            remotoPath,
            localPath
        );
        return;
    }

    const estadoPath = path.join(
        DATA_DIR,
        def.estado
    );
    const resultado = spawnSync(
        'npm',
        [
            'run',
            def.merge,
            '--',
            localPath,
            remotoPath,
            localPath,
            estadoPath
        ],
        {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit',
            shell: process.platform === 'win32'
        }
    );

    if (resultado.status !== 0) {
        throw new Error(`Falha ao executar ${def.merge}`);
    }

}

async function sincronizar(def) {

    const localPath = arquivoPadrao(def);
    const remotoPath = path.join(
        DATA_DIR,
        def.remoto
    );

    garantirLocal(def);

    const valoresRemotos = await lerValores(def.chave);

    fs.writeFileSync(
        remotoPath,
        valoresParaCsv(
            valoresRemotos,
            def.cabecalho
        )
    );

    executarMerge(
        def,
        localPath,
        remotoPath
    );

    await escreverValores(
        def.chave,
        csvParaValores(
            localPath,
            def.cabecalho
        )
    );

    console.log(`Google Sheets sincronizado: ${def.chave} -> aba ${nomeAba(def.chave)}`);

}

async function main() {

    garantirDataDir();

    const alvos = process.argv.slice(2);
    const definicoes = alvos.length ?
        DEFINICOES.filter(def => alvos.includes(def.chave)) :
        DEFINICOES;

    for (const def of definicoes) {
        await sincronizar(def);
    }

}

main().catch(erro => {
    console.error('ERRO SYNC GOOGLE SHEETS', erro.message);
    process.exit(1);
});
