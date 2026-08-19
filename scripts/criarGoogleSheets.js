const fs = require('fs');
const path = require('path');
const {
    compartilharPlanilha,
    criarPlanilha,
    escreverValores,
    nomeAba
} = require('../services/googleSheetsClient');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFINICOES = [
    {
        chave: 'clientes',
        arquivo: 'clientes.csv',
        cabecalho: 'nome;telefone;usuario;senha;dns;m3u;vencimento;valor;telas;meses;aviso_vencimento'
    },
    {
        chave: 'testes',
        arquivo: 'testes.csv',
        cabecalho: 'telefone;usuario;senha;dns;m3u;criado_em;vencimento;vencimento_iso;horas;status;avisado_em;ultimo_aviso_contratacao;saiu_em'
    },
    {
        chave: 'leads',
        arquivo: 'leads.csv',
        cabecalho: 'telefone;numero;nome;fluxo;status;criado_em;ultima_interacao;tentativas_retomada;ultimo_remarketing;remarketing_envios;observacao'
    },
    {
        chave: 'servicos',
        arquivo: 'servicos.csv',
        cabecalho: 'chamado_interno;chamado_externo;cliente_nome;telefone;whatsapp_nome;email;inicio;termino;servico;valor_combinado;tecnico_responsavel;data_prevista_pagamento;status;obs',
        primeiraLinha: 'OS359;;;;;;;;;;;;aguardando atendimento;'
    },
    {
        chave: 'marketing',
        arquivo: 'marketing.csv',
        cabecalho: 'telefone'
    },
    {
        chave: 'revendedores',
        arquivo: 'revendedores.csv',
        cabecalho: 'telefone;nome;status;observacao;creditos;data_fechamento;aviso_fechamento'
    },
    {
        chave: 'revendedores_clientes',
        arquivo: 'revendedores-clientes.csv',
        cabecalho: 'revendedor_telefone;revendedor_nome;cliente_nome;cliente_telefone;usuario;senha;dns;m3u;vencimento;status;observacao;aviso_vencimento'
    },
    {
        chave: 'revendedores_chamados',
        arquivo: 'revendedores-chamados.csv',
        cabecalho: 'codigo;revendedor_telefone;revendedor_nome;cliente_nome;usuario;descricao;status;criado_em;atualizado_em;observacao'
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

function caminhoArquivo(def) {

    return path.join(
        DATA_DIR,
        def.arquivo
    );

}

function garantirLocal(def) {

    const arquivo = caminhoArquivo(def);

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

function emailsCompartilhamento() {

    const porEnv = String(process.env.GOOGLE_SHEETS_SHARE_EMAILS || '')
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
    const porArgs = process.argv
        .slice(2)
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));

    return [...new Set([...porEnv, ...porArgs])];

}

async function compartilharComEmails(planilhaId, emails) {

    const resultados = [];

    for (const email of emails) {
        try {
            await compartilharPlanilha(
                planilhaId,
                email
            );
            resultados.push({
                email,
                ok: true
            });
            console.log(`Compartilhado como editor: ${email}`);
        } catch (erro) {
            resultados.push({
                email,
                ok: false,
                erro: erro.message
            });
            console.log(`ERRO COMPARTILHAR ${email}: ${erro.message}`);
        }
    }

    return resultados;

}

async function main() {

    garantirDataDir();

    const titulo = process.env.GOOGLE_SHEETS_TITLE || 'wppbot';
    const abas = DEFINICOES.map(def => nomeAba(def.chave));
    const planilha = await criarPlanilha(
        titulo,
        abas
    );

    console.log(`Planilha criada: ${planilha.spreadsheetUrl}`);

    for (const def of DEFINICOES) {
        garantirLocal(def);

        const valores = csvParaValores(
            caminhoArquivo(def),
            def.cabecalho
        );

        await escreverValores(
            def.chave,
            valores,
            planilha.spreadsheetId
        );

        console.log(`Aba atualizada: ${nomeAba(def.chave)} (${valores.length} linhas)`);
    }

    const compartilhamentos = await compartilharComEmails(
        planilha.spreadsheetId,
        emailsCompartilhamento()
    );
    const saidaJson = path.join(DATA_DIR, 'google-sheets-created.json');
    const saidaEnv = path.join(DATA_DIR, 'google-sheets.env');

    fs.writeFileSync(
        saidaJson,
        JSON.stringify(
            {
                criadoEm: new Date().toISOString(),
                titulo,
                spreadsheetId: planilha.spreadsheetId,
                spreadsheetUrl: planilha.spreadsheetUrl,
                abas,
                compartilhamentos
            },
            null,
            2
        )
    );
    fs.writeFileSync(
        saidaEnv,
        `GOOGLE_SHEETS_SPREADSHEET_ID=${planilha.spreadsheetId}\n`
    );

    console.log('');
    console.log('Concluido.');
    console.log(`ID: ${planilha.spreadsheetId}`);
    console.log(`URL: ${planilha.spreadsheetUrl}`);
    console.log(`Arquivo com ID: ${saidaEnv}`);
    console.log('');
    console.log('Adicione no .env:');
    console.log(`GOOGLE_SHEETS_SPREADSHEET_ID=${planilha.spreadsheetId}`);

}

main().catch(erro => {
    console.error('ERRO CRIAR GOOGLE SHEETS', erro.message);
    process.exit(1);
});
