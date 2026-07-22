const fs = require('fs');
const path = require('path');
const {
    CABECALHOS,
    lerServicosCsv,
    normalizarChamado,
    salvarServicosCsv
} = require('../services/servicosCsv');

function caminhoPadraoEstado(arquivoLocal) {

    return path.join(
        path.dirname(arquivoLocal),
        'servicos-sync-state.json'
    );

}

function limparLinha(linha) {

    const limpa = {};

    for (const campo of CABECALHOS) {
        limpa[campo] = String(linha?.[campo] || '').trim();
    }

    limpa.chamado = normalizarChamado(limpa.chamado);

    return limpa;

}

function mapaPorChave(linhas) {

    const mapa = {};

    for (const linha of linhas) {
        const limpa = limparLinha(linha);
        const chave = normalizarChamado(limpa.chamado);

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
        servicos: {}
    };

    try {
        const estado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

        return {
            servicos: estado.servicos || {}
        };
    } catch (_) {
        return {
            servicos: {}
        };
    }

}

function salvarEstado(arquivo, linhas) {

    const servicos = {};

    for (const linha of linhas) {
        const chave = normalizarChamado(linha.chamado);
        if (chave) servicos[chave] = limparLinha(linha);
    }

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                servicos
            },
            null,
            2
        )
    );

}

function assinatura(linha) {

    if (!linha) return '';

    return CABECALHOS
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

    for (const campo of CABECALHOS) {
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
            linha[campo] = valorRemoto || valorLocal;
        }
    }

    return limparLinha(linha);

}

function mesclar(localLinhas, remotoLinhas, estado) {

    const local = mapaPorChave(localLinhas);
    const remoto = mapaPorChave(remotoLinhas);
    const base = estado.servicos || {};
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
        String(a.chamado || '').localeCompare(String(b.chamado || ''), 'pt-BR')
    );

    return resultado;

}

function main() {

    const local = process.argv[2] || path.join(__dirname, '..', 'data', 'servicos.csv');
    const remoto = process.argv[3] || local;
    const saida = process.argv[4] || local;
    const estadoPath = process.argv[5] || caminhoPadraoEstado(saida);
    const estado = lerEstado(estadoPath);
    const localLinhas = lerServicosCsv(local);
    const remotoLinhas = lerServicosCsv(remoto);
    const resultado = mesclar(
        localLinhas,
        remotoLinhas,
        estado
    );

    salvarServicosCsv(
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
