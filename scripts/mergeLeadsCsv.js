const fs = require('fs');
const path = require('path');
const {
    chaveLead,
    lerLeadsCsv,
    salvarLeadsCsv
} = require('../services/leadsCsv');

const CAMPOS = [
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

function caminhoPadraoEstado(arquivoLocal) {

    return path.join(
        path.dirname(arquivoLocal),
        'leads-sync-state.json'
    );

}

function limparLinha(linha) {

    const limpa = {};

    for (const campo of CAMPOS) {
        limpa[campo] = String(linha?.[campo] || '').trim();
    }

    return limpa;

}

function mapaPorChave(linhas) {

    const mapa = {};

    for (const linha of linhas) {

        const limpa = limparLinha(linha);
        const chave = chaveLead(limpa);

        if (!chave) continue;

        mapa[chave] = {
            ...mapa[chave],
            ...limpa
        };

    }

    return mapa;

}

function lerEstado(arquivo) {

    if (!fs.existsSync(arquivo)) return {
        leads: {}
    };

    try {
        const estado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

        return {
            leads: estado.leads || {}
        };
    } catch (_) {
        return {
            leads: {}
        };
    }

}

function salvarEstado(arquivo, linhas) {

    const leads = {};

    for (const linha of linhas) {
        const chave = chaveLead(linha);
        if (chave) leads[chave] = limparLinha(linha);
    }

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                leads
            },
            null,
            2
        )
    );

}

function assinatura(linha) {

    if (!linha) return '';

    return CAMPOS
        .map(campo => `${campo}=${String(linha[campo] || '').trim()}`)
        .join('|');

}

function iguais(a, b) {

    return assinatura(a) === assinatura(b);

}

function mesclarLinha(base, local, remoto) {

    if (!local) return remoto;
    if (!remoto) return local;
    if (iguais(local, remoto)) return local;

    const linha = {};

    for (const campo of CAMPOS) {

        const valorBase = String(base?.[campo] || '').trim();
        const valorLocal = String(local?.[campo] || '').trim();
        const valorRemoto = String(remoto?.[campo] || '').trim();

        if (valorLocal === valorRemoto) {
            linha[campo] = valorLocal;
        } else if (valorLocal === valorBase) {
            linha[campo] = valorRemoto;
        } else if (valorRemoto === valorBase) {
            linha[campo] = valorLocal;
        } else {
            linha[campo] = [
                'nome',
                'status',
                'observacao'
            ].includes(campo) ? valorRemoto : valorLocal;
        }

    }

    return limparLinha(linha);

}

function mesclar(localLinhas, remotoLinhas, estado) {

    const local = mapaPorChave(localLinhas);
    const remoto = mapaPorChave(remotoLinhas);
    const base = estado.leads || {};
    const chaves = Array.from(new Set([
        ...Object.keys(base),
        ...Object.keys(local),
        ...Object.keys(remoto)
    ])).filter(Boolean);
    const resultado = [];

    for (const chave of chaves) {

        const linhaBase = limparLinha(base[chave]);
        const linhaLocal = local[chave];
        const linhaRemoto = remoto[chave];
        const temBase = Boolean(base[chave]);

        if (!temBase) {
            const escolhida = mesclarLinha(
                {},
                linhaLocal,
                linhaRemoto
            );

            if (escolhida) resultado.push(escolhida);
            continue;
        }

        if (!linhaLocal && !linhaRemoto) continue;
        if (!linhaLocal) {
            if (!iguais(linhaRemoto, linhaBase)) resultado.push(linhaRemoto);
            continue;
        }
        if (!linhaRemoto) {
            if (!iguais(linhaLocal, linhaBase)) resultado.push(linhaLocal);
            continue;
        }

        resultado.push(mesclarLinha(
            linhaBase,
            linhaLocal,
            linhaRemoto
        ));

    }

    resultado.sort((a, b) =>
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') ||
        String(a.telefone || '').localeCompare(String(b.telefone || ''), 'pt-BR')
    );

    return resultado;

}

function main() {

    const local = process.argv[2] || path.join(__dirname, '..', 'data', 'leads.csv');
    const remoto = process.argv[3] || local;
    const saida = process.argv[4] || local;
    const estadoPath = process.argv[5] || caminhoPadraoEstado(saida);
    const estado = lerEstado(estadoPath);
    const localLinhas = lerLeadsCsv(local);
    const remotoLinhas = lerLeadsCsv(remoto);
    const resultado = mesclar(
        localLinhas,
        remotoLinhas,
        estado
    );

    salvarLeadsCsv(
        resultado,
        saida
    );
    salvarEstado(
        estadoPath,
        resultado
    );

    console.log(`Local: ${localLinhas.length}`);
    console.log(`OneDrive: ${remotoLinhas.length}`);
    console.log(`Mesclados: ${resultado.length}`);
    console.log(`Arquivo: ${saida}`);
    console.log(`Estado: ${estadoPath}`);

}

main();
