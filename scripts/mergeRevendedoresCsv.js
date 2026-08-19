const fs = require('fs');
const path = require('path');

const TIPOS = {
    revendedores: {
        headers: [
            'telefone',
            'nome',
            'status',
            'observacao',
            'creditos',
            'data_fechamento',
            'aviso_fechamento'
        ],
        key: linha => normalizarTelefoneBrasil(linha.telefone)
    },
    clientes: {
        headers: [
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
        ],
        key: linha => [
            normalizarTelefoneBrasil(linha.revendedor_telefone),
            String(linha.usuario || '').trim().toLowerCase()
        ].filter(Boolean).join('|')
    },
    remarketing: {
        headers: [
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
            'criado_em',
            'origem',
            'observacao'
        ],
        key: linha => [
            normalizarTelefoneBrasil(linha.revendedor_telefone),
            String(linha.usuario || '').trim().toLowerCase() ||
                normalizarTelefoneBrasil(linha.cliente_telefone)
        ].filter(Boolean).join('|')
    },
    chamados: {
        headers: [
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
        ],
        key: linha => String(linha.codigo || '').trim().toUpperCase()
    }
};

function limparNumero(valor) {

    return String(valor || '').replace(/\D+/g, '');

}

function normalizarTelefoneBrasil(valor) {

    const limpo = limparNumero(valor);
    let local = limpo;

    if (
        limpo.startsWith('55') &&
        (limpo.length === 12 || limpo.length === 13)
    ) {
        local = limpo.slice(2);
    }

    if (local.length === 11 && local[2] === '9') {
        local = `${local.slice(0, 2)}${local.slice(3)}`;
    }

    if (
        (local.length === 10 || local.length === 11) &&
        !local.startsWith('55')
    ) {
        return `55${local}`;
    }

    return limpo;

}

function parseCsvLinha(linha) {

    const campos = [];
    let atual = '';
    let aspas = false;

    for (let i = 0; i < linha.length; i += 1) {
        const char = linha[i];
        const proximo = linha[i + 1];

        if (char === '"' && aspas && proximo === '"') {
            atual += '"';
            i += 1;
        } else if (char === '"') {
            aspas = !aspas;
        } else if (char === ';' && !aspas) {
            campos.push(atual);
            atual = '';
        } else {
            atual += char;
        }
    }

    campos.push(atual);
    return campos;

}

function escaparCsv(valor) {

    const texto = String(valor || '');

    if (!/[;"\r\n]/.test(texto)) return texto;

    return `"${texto.replace(/"/g, '""')}"`;

}

function lerCsv(arquivo, headers) {

    if (!fs.existsSync(arquivo)) return [];

    const conteudo = fs.readFileSync(arquivo, 'utf8')
        .replace(/^\uFEFF/, '')
        .trim();

    if (!conteudo) return [];

    const linhas = conteudo.split(/\r?\n/);
    const cabecalho = parseCsvLinha(linhas.shift() || '')
        .map(campo => String(campo || '').trim());
    const campos = cabecalho.length ? cabecalho : headers;

    return linhas
        .filter(linha => linha.trim())
        .map(linha => {
            const valores = parseCsvLinha(linha);
            const item = {};

            campos.forEach((campo, indice) => {
                item[campo] = String(valores[indice] || '').trim();
            });

            return normalizarLinha(item, headers);
        });

}

function salvarCsv(arquivo, headers, linhas) {

    fs.mkdirSync(path.dirname(arquivo), { recursive: true });

    const conteudo = [
        headers.join(';'),
        ...linhas.map(linha =>
            headers.map(campo => escaparCsv(linha[campo])).join(';')
        )
    ].join('\n');

    fs.writeFileSync(arquivo, `${conteudo}\n`);

}

function normalizarLinha(linha, headers) {

    const normalizada = {};

    for (const campo of headers) {
        normalizada[campo] = String(linha?.[campo] || '').trim();
    }

    return normalizada;

}

function assinatura(linha, headers) {

    return headers.map(campo =>
        `${campo}=${String(linha?.[campo] || '').trim()}`
    ).join('|');

}

function iguais(a, b, headers) {

    return assinatura(a, headers) === assinatura(b, headers);

}

function mesclarCampo(campo, base, local, remoto) {

    const valorBase = String(base?.[campo] || '').trim();
    const valorLocal = String(local?.[campo] || '').trim();
    const valorRemoto = String(remoto?.[campo] || '').trim();

    if (valorLocal === valorRemoto) return valorLocal;
    if (valorLocal === valorBase) return valorRemoto;
    if (valorRemoto === valorBase) return valorLocal;
    if (!valorLocal) return valorRemoto;
    if (!valorRemoto) return valorLocal;

    return valorRemoto;

}

function mapaPorChave(linhas, config) {

    const mapa = {};

    for (const linha of linhas) {
        const limpa = normalizarLinha(linha, config.headers);
        const chave = config.key(limpa);

        if (!chave) continue;

        mapa[chave] = {
            ...(mapa[chave] || {}),
            ...limpa
        };
    }

    return mapa;

}

function lerEstado(arquivo) {

    if (!fs.existsSync(arquivo)) return {};

    try {
        return JSON.parse(fs.readFileSync(arquivo, 'utf8')) || {};
    } catch (_) {
        return {};
    }

}

function salvarEstado(arquivo, tipo, linhas, config) {

    const estado = {};

    for (const linha of linhas) {
        const chave = config.key(linha);
        if (chave) estado[chave] = normalizarLinha(linha, config.headers);
    }

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                tipo,
                linhas: estado
            },
            null,
            2
        )
    );

}

function mesclarLinha(config, base, local, remoto) {

    if (!local) return remoto;
    if (!remoto) return local;
    if (iguais(local, remoto, config.headers)) return local;

    const linha = {};

    for (const campo of config.headers) {
        linha[campo] = mesclarCampo(
            campo,
            base,
            local,
            remoto
        );
    }

    return normalizarLinha(linha, config.headers);

}

function mesclar(tipo, localLinhas, remotoLinhas, estado) {

    const config = TIPOS[tipo];
    const local = mapaPorChave(localLinhas, config);
    const remoto = mapaPorChave(remotoLinhas, config);
    const base = estado.linhas || {};
    const chaves = Array.from(new Set([
        ...Object.keys(base),
        ...Object.keys(local),
        ...Object.keys(remoto)
    ])).filter(Boolean);
    const resultado = [];

    for (const chave of chaves) {
        const linhaBase = normalizarLinha(base[chave], config.headers);
        const linhaLocal = local[chave];
        const linhaRemoto = remoto[chave];

        if (!linhaLocal && !linhaRemoto) continue;
        if (!linhaLocal) {
            if (!iguais(linhaRemoto, linhaBase, config.headers)) {
                resultado.push(linhaRemoto);
            }
            continue;
        }
        if (!linhaRemoto) {
            if (!iguais(linhaLocal, linhaBase, config.headers)) {
                resultado.push(linhaLocal);
            }
            continue;
        }

        resultado.push(mesclarLinha(
            config,
            linhaBase,
            linhaLocal,
            linhaRemoto
        ));
    }

    resultado.sort((a, b) =>
        assinatura(a, config.headers).localeCompare(
            assinatura(b, config.headers),
            'pt-BR'
        )
    );

    return resultado;

}

function main() {

    const tipo = process.argv[2];
    const local = process.argv[3];
    const remoto = process.argv[4];
    const saida = process.argv[5] || local;
    const estadoArquivo = process.argv[6] ||
        path.join(path.dirname(saida), `${tipo}-sync-state.json`);
    const config = TIPOS[tipo];

    if (!config) {
        throw new Error('Tipo invalido. Use revendedores, clientes, remarketing ou chamados.');
    }

    if (!local || !remoto) {
        throw new Error('Uso: node scripts/mergeRevendedoresCsv.js tipo local.csv remoto.csv saida.csv estado.json');
    }

    const estado = lerEstado(estadoArquivo);
    const linhas = mesclar(
        tipo,
        lerCsv(local, config.headers),
        lerCsv(remoto, config.headers),
        estado
    );

    salvarCsv(
        saida,
        config.headers,
        linhas
    );
    salvarEstado(
        estadoArquivo,
        tipo,
        linhas,
        config
    );

    console.log(`Tipo: ${tipo}`);
    console.log(`Local: ${local}`);
    console.log(`Remoto: ${remoto}`);
    console.log(`Mesclados: ${linhas.length}`);
    console.log(`Arquivo: ${saida}`);
    console.log(`Estado: ${estadoArquivo}`);

}

main();
