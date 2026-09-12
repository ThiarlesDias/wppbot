const fs = require('fs');
const path = require('path');
const {
    caminhoCsv,
    lerClientesCsv
} = require('../services/clientesCsv');
const {
    caminhoLeadsCsv,
    lerLeadsCsv
} = require('../services/leadsCsv');
const {
    caminhoTestesCsv,
    lerTestesCsv,
    testesParaAvisar,
    testesParaAvisoContratacao
} = require('../services/testesCsv');
const statusDiario = require('../services/statusDiario');

const DATA_DIR = path.join(__dirname, '..', 'data');

function infoArquivo(arquivo) {

    try {
        const stat = fs.statSync(arquivo);
        const linhas = fs.readFileSync(arquivo, 'utf8')
            .split(/\r?\n/)
            .filter(linha => linha.trim()).length;

        return {
            existe: true,
            tamanho: stat.size,
            atualizado: stat.mtime.toISOString(),
            linhas
        };
    } catch (_) {
        return {
            existe: false,
            tamanho: 0,
            atualizado: '',
            linhas: 0
        };
    }

}

function contarPausas() {

    const arquivo = path.join(DATA_DIR, 'atendimentos-pausados.json');

    try {
        const json = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        return Object.keys(json.pausas || {}).length;
    } catch (_) {
        return 0;
    }

}

function envResumo(nome) {

    const valor = process.env[nome];

    if (!valor) return `${nome}=`;
    if (/TOKEN|KEY|PASSWORD|SECRET/i.test(nome)) return `${nome}=***`;

    return `${nome}=${valor}`;

}

function main() {

    const clientesPath = caminhoCsv();
    const leadsPath = caminhoLeadsCsv();
    const testesPath = caminhoTestesCsv();
    const leads = lerLeadsCsv(leadsPath);
    const testes = lerTestesCsv(testesPath);

    console.log('=== DIAGNOSTICO WPPBOT ===');
    console.log(`Data: ${new Date().toISOString()}`);
    console.log(`Node: ${process.version}`);
    console.log(`CWD: ${process.cwd()}`);
    console.log('');

    console.log('=== ENV ===');
    [
        'BOT_RECOVERY_MODE',
        'BOT_FLOW_DEBUG',
        'WHATSAPP_WRAP_SEND',
        'WHATSAPP_SEND_RESOLVED',
        'WHATSAPP_DIRECT_SEND',
        'WHATSAPP_FORCE_ORIGINAL_SEND',
        'WHATSAPP_LID_REPLY_ORIGINAL',
        'WHATSAPP_DIRECT_FALLBACK',
        'WHATSAPP_WAIT_FOR_ACK',
        'WHATSAPP_SEND_TIMEOUT_MS',
        'WHATSAPP_MANUAL_PAUSE_ENABLED',
        'ADMIN_WHATSAPP',
        'ADMIN_NOTIFY_WHATSAPP',
        'ADMIN_WHATSAPP_ID',
        'CLIENTES_CSV_PATH',
        'TESTES_CSV_PATH',
        'LEADS_CSV_PATH',
        'STATUS_DIARIO_ENABLED',
        'STATUS_IMAGENS_DIR',
        'STATUS_ENVIO_HORA',
        'STATUS_ENVIO_MINUTO',
        'STATUS_POST_STARTUP',
        'GOOGLE_SHEETS_SPREADSHEET_ID'
    ].forEach(nome => console.log(envResumo(nome)));
    console.log('');

    console.log('=== ARQUIVOS ===');
    for (const [nome, arquivo] of [
        ['clientes', clientesPath],
        ['testes', testesPath],
        ['leads', leadsPath],
        ['pausas', path.join(DATA_DIR, 'atendimentos-pausados.json')]
    ]) {
        const info = infoArquivo(arquivo);
        console.log(`${nome}: ${arquivo}`);
        console.log(`  existe=${info.existe} tamanho=${info.tamanho} linhas=${info.linhas} atualizado=${info.atualizado}`);
    }
    console.log('');

    console.log('=== CONTADORES ===');
    console.log(`clientes=${lerClientesCsv(clientesPath).length}`);
    console.log(`leads_total=${leads.length}`);
    console.log(`leads_ativos=${leads.filter(lead => String(lead.status || '').toLowerCase() === 'lead').length}`);
    console.log(`testes_total=${testes.length}`);
    console.log(`testes_para_avisar=${testesParaAvisar().length}`);
    console.log(`testes_convite=${testesParaAvisoContratacao().length}`);
    console.log(`pausas=${contarPausas()}`);
    console.log('');

    const status = statusDiario.resumo();
    console.log('=== STATUS DIARIO ===');
    console.log(`ativo=${status.habilitado}`);
    console.log(`pasta_principal=${status.pasta}`);
    for (const item of status.pastas || []) {
        console.log(`pasta=${item.pasta} imagens=${item.totalImagens}`);
    }
    console.log(`imagens_total=${status.totalImagens}`);
    console.log(`ultimo_dia=${status.ultimoDia || ''}`);
    console.log(`ultimo_arquivo=${status.ultimoArquivo || ''}`);
    console.log(`postado_em=${status.postadoEm || ''}`);
    console.log(`proxima_execucao=${status.proximaExecucao || ''}`);
}

main();
