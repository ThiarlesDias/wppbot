const fs = require('fs');
const path = require('path');
const {
    montarWidTelefone,
    limparTelefone
} = require('./whatsappNumero');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MARKETING_PATH = process.env.MARKETING_CSV_PATH ||
    (
        fs.existsSync(path.join(DATA_DIR, 'marketing.csv')) ?
            path.join(DATA_DIR, 'marketing.csv') :
            path.join(ROOT_DIR, 'marketing.csv')
    );
const STORE_PATH = path.join(DATA_DIR, 'marketing-cupons.json');
const DESCONTO_PADRAO = Number(process.env.MARKETING_CUPOM_DESCONTO || 10);
const INTERVALO_ENVIO_MS = Number(process.env.MARKETING_ENVIO_INTERVALO_MS || 12000);

let campanhaRodando = false;

function garantirDataDir() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

}

function lerStore() {

    garantirDataDir();

    if (!fs.existsSync(STORE_PATH)) {

        return {
            cupons: {},
            telefones: {}
        };

    }

    try {

        const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

        return {
            cupons: store.cupons || {},
            telefones: store.telefones || {}
        };

    } catch (_) {

        return {
            cupons: {},
            telefones: {}
        };

    }

}

function salvarStore(store) {

    garantirDataDir();

    fs.writeFileSync(
        STORE_PATH,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                cupons: store.cupons || {},
                telefones: store.telefones || {}
            },
            null,
            2
        )
    );

}

function hashCupom(texto) {

    let hash = 0;

    for (const char of String(texto || '')) {

        hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;

    }

    return hash
        .toString(36)
        .toUpperCase()
        .padStart(5, '0')
        .slice(-5);

}

function gerarCodigoCupom(telefone) {

    return `TOP10-${hashCupom(telefone)}`;

}

function obterOuCriarCupom(telefone) {

    const limpo = limparTelefone(telefone);
    const store = lerStore();
    let codigo = store.telefones[limpo]?.codigo;

    if (!codigo) {

        codigo = gerarCodigoCupom(limpo);

    }

    const cupom = {
        codigo,
        telefone: limpo,
        desconto: DESCONTO_PADRAO,
        status: store.cupons[codigo]?.status || 'ativo',
        criadoEm: store.cupons[codigo]?.criadoEm || new Date().toISOString(),
        enviadoEm: store.cupons[codigo]?.enviadoEm || '',
        usadoEm: store.cupons[codigo]?.usadoEm || '',
        vendaReference: store.cupons[codigo]?.vendaReference || ''
    };

    store.telefones[limpo] = {
        codigo
    };
    store.cupons[codigo] = cupom;
    salvarStore(store);

    return cupom;

}

function validarCupom(codigo, telefone) {

    const normalizado = String(codigo || '').trim().toUpperCase();
    const limpo = limparTelefone(telefone);
    const telefoneConfiavel = limpo.startsWith('55') &&
        limpo.length >= 12 &&
        limpo.length <= 13;
    const store = lerStore();
    const cupom = store.cupons[normalizado];

    if (!cupom) {

        return {
            valido: false,
            motivo: 'Cupom nao encontrado.'
        };

    }

    if (cupom.status === 'usado') {

        return {
            valido: false,
            motivo: 'Este cupom ja foi usado.'
        };

    }

    if (cupom.telefone && telefoneConfiavel && cupom.telefone !== limpo) {

        return {
            valido: false,
            motivo: 'Este cupom pertence a outro WhatsApp.'
        };

    }

    return {
        valido: true,
        cupom
    };

}

function marcarCupomAplicado(codigo, vendaReference) {

    const normalizado = String(codigo || '').trim().toUpperCase();
    const store = lerStore();
    const cupom = store.cupons[normalizado];

    if (!cupom) return null;

    store.cupons[normalizado] = {
        ...cupom,
        status: 'usado',
        usadoEm: new Date().toISOString(),
        vendaReference: vendaReference || cupom.vendaReference || ''
    };

    salvarStore(store);

    return store.cupons[normalizado];

}

function esperar(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}

function extrairNumeroLinha(linha) {

    const texto = String(linha || '').trim();

    if (!texto) return '';

    const partes = texto.split(/[;,\t]/).map(item => item.trim());
    const candidato = partes.find(item => limparTelefone(item).length >= 10);

    return limparTelefone(candidato || texto);

}

function listarNumerosMarketing() {

    if (!fs.existsSync(MARKETING_PATH)) return [];

    const vistos = new Set();
    const linhas = fs.readFileSync(MARKETING_PATH, 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/);
    const numeros = [];

    for (const linha of linhas) {

        const numero = extrairNumeroLinha(linha);
        const wid = montarWidTelefone(numero);

        if (!wid) continue;

        const telefone = limparTelefone(wid);

        if (vistos.has(telefone)) continue;

        vistos.add(telefone);
        numeros.push({
            telefone,
            wid
        });

    }

    return numeros;

}

function montarMensagem(cupom) {

    return [
        '📺 *Oferta especial TopTec Digital*',
        '',
        'Oi! Temos uma condição especial para voce conhecer nosso sistema de TV.',
        '',
        `🎟️ *Cupom:* ${cupom.codigo}`,
        `💰 *Desconto:* R$ ${Number(cupom.desconto).toFixed(2).replace('.', ',')}`,
        '',
        'Para contratar, responda esta mensagem ou acesse o menu do atendimento e informe o cupom quando solicitado.',
        '',
        'Se nao quiser receber este tipo de mensagem, responda *SAIR*.'
    ].join('\n');

}

async function enviarCampanha(client) {

    if (campanhaRodando) {

        return {
            rodando: true,
            total: 0,
            enviados: 0,
            ignorados: 0,
            erros: 0
        };

    }

    campanhaRodando = true;

    const numeros = listarNumerosMarketing();
    const store = lerStore();
    const resultado = {
        rodando: false,
        total: numeros.length,
        enviados: 0,
        ignorados: 0,
        erros: 0
    };

    try {

        for (const item of numeros) {

            const existente = store.telefones[item.telefone]?.codigo;
            const cupomExistente = existente ? store.cupons[existente] : null;

            if (cupomExistente?.enviadoEm) {

                resultado.ignorados += 1;
                continue;

            }

            const cupom = obterOuCriarCupom(item.telefone);

            try {

                await client.sendText(
                    item.wid,
                    montarMensagem(cupom)
                );

                const storeAtual = lerStore();
                storeAtual.cupons[cupom.codigo] = {
                    ...storeAtual.cupons[cupom.codigo],
                    enviadoEm: new Date().toISOString()
                };
                salvarStore(storeAtual);
                resultado.enviados += 1;

                await esperar(INTERVALO_ENVIO_MS);

            } catch (erro) {

                console.log(
                    'ERRO MARKETING',
                    item.telefone,
                    erro.message
                );

                resultado.erros += 1;

            }

        }

        return resultado;

    } finally {

        campanhaRodando = false;

    }

}

function statusMarketing() {

    const numeros = listarNumerosMarketing();
    const store = lerStore();
    const cupons = Object.values(store.cupons || {});

    return {
        arquivo: MARKETING_PATH,
        totalPlanilha: numeros.length,
        cupons: cupons.length,
        enviados: cupons.filter(cupom => cupom.enviadoEm).length,
        usados: cupons.filter(cupom => cupom.status === 'usado').length,
        rodando: campanhaRodando
    };

}

module.exports = {
    enviarCampanha,
    listarNumerosMarketing,
    marcarCupomAplicado,
    obterOuCriarCupom,
    statusMarketing,
    validarCupom
};
