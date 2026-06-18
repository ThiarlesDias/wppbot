const fs = require('fs');
const path = require('path');
const {
    caminhoCsv,
    lerClientesCsv,
    salvarClientesCsv
} = require('../services/clientesCsv');

const CAMPOS = [
    'nome',
    'telefone',
    'usuario',
    'senha',
    'dns',
    'm3u',
    'vencimento'
];

function caminhoPadraoEstado(arquivoLocal) {

    return path.join(
        path.dirname(arquivoLocal),
        'clientes-sync-state.json'
    );

}

function limparLinha(linha) {

    const limpa = {};

    for (const campo of CAMPOS) {

        limpa[campo] = String(linha?.[campo] || '').trim();

    }

    return limpa;

}

function normalizarUsuario(usuario) {

    return String(usuario || '')
        .trim()
        .replace(/\s+/g, '');

}

function normalizarTelefone(telefone) {

    return String(telefone || '').replace(/\D/g, '');

}

function chaveUsuario(linha) {

    return normalizarUsuario(linha?.usuario);

}

function chaveTelefone(linha) {

    return normalizarTelefone(linha?.telefone);

}

function escolherLinhaDuplicada(atual, nova) {

    if (!atual) return nova;
    if (!nova) return atual;

    const atualCampos = camposPreenchidos(atual);
    const novaCampos = camposPreenchidos(nova);

    if (novaCampos > atualCampos) return nova;
    if (atualCampos > novaCampos) return atual;

    return nova;

}

function mapaPorUsuario(linhas, origem = 'csv') {

    const mapa = {};
    const porTelefone = {};

    for (const linha of linhas) {

        const limpa = limparLinha(linha);
        const usuario = chaveUsuario(limpa);
        const telefone = chaveTelefone(limpa);

        if (usuario) {

            if (mapa[usuario]) {

                console.log(`DUPLICADO ${origem} usuario=${usuario}; mantendo linha mais completa/recente.`);

            }

            mapa[usuario] = escolherLinhaDuplicada(
                mapa[usuario],
                limpa
            );
            continue;

        }

        if (telefone) {

            if (porTelefone[telefone]) {

                console.log(`DUPLICADO ${origem} telefone=${telefone}; mantendo linha mais completa/recente.`);

            }

            porTelefone[telefone] = escolherLinhaDuplicada(
                porTelefone[telefone],
                limpa
            );

        }

    }

    for (const [telefone, linha] of Object.entries(porTelefone)) {

        const chave = `telefone:${telefone}`;

        if (!mapa[chave]) mapa[chave] = linha;

    }

    return mapa;

}

function assinatura(linha) {

    if (!linha) return '';

    return CAMPOS
        .map(campo => `${campo}=${String(linha[campo] || '').trim()}`)
        .join('|');

}

function linhasIguais(a, b) {

    return assinatura(a) === assinatura(b);

}

function camposPreenchidos(linha) {

    return CAMPOS.reduce(
        (total, campo) => total + (String(linha?.[campo] || '').trim() ? 1 : 0),
        0
    );

}

function lerEstado(arquivo) {

    if (!fs.existsSync(arquivo)) {

        return {
            clientes: {}
        };

    }

    try {

        const estado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

        return {
            clientes: estado.clientes || {}
        };

    } catch (_) {

        return {
            clientes: {}
        };

    }

}

function salvarEstado(arquivo, linhas) {

    const clientes = {};

    for (const linha of linhas) {

        const chave = chaveUsuario(linha) || `telefone:${chaveTelefone(linha)}`;

        if (!chave) continue;

        clientes[chave] = limparLinha(linha);

    }

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                clientes
            },
            null,
            2
        )
    );

}

function mesclarCampos(usuario, base, local, remoto, conflitos) {

    const linha = {
        usuario
    };

    for (const campo of CAMPOS) {

        const valorBase = String(base?.[campo] || '').trim();
        const valorLocal = String(local?.[campo] || '').trim();
        const valorRemoto = String(remoto?.[campo] || '').trim();

        if (valorLocal === valorRemoto) {

            linha[campo] = valorLocal;
            continue;

        }

        if (valorLocal === valorBase) {

            linha[campo] = valorRemoto;
            continue;

        }

        if (valorRemoto === valorBase) {

            linha[campo] = valorLocal;
            continue;

        }

        const usarRemoto = [
            'nome',
            'telefone',
            'vencimento'
        ].includes(campo);

        linha[campo] = usarRemoto ? valorRemoto : valorLocal;

        conflitos.push({
            usuario,
            campo,
            local: valorLocal,
            onedrive: valorRemoto,
            usado: usarRemoto ? 'onedrive' : 'local'
        });

    }

    linha.usuario = usuario;

    return limparLinha(linha);

}

function escolherSemBase(usuario, local, remoto, conflitos) {

    if (!local) return remoto;
    if (!remoto) return local;
    if (linhasIguais(local, remoto)) return local;

    if (camposPreenchidos(local) === 0) return remoto;
    if (camposPreenchidos(remoto) === 0) return local;

    return mesclarCampos(
        usuario,
        {},
        local,
        remoto,
        conflitos
    );

}

function mesclar(localLinhas, remotoLinhas, estado) {

    const local = mapaPorUsuario(localLinhas, 'local');
    const remoto = mapaPorUsuario(remotoLinhas, 'onedrive');
    const base = estado.clientes || {};
    const usuarios = Array.from(new Set([
        ...Object.keys(base),
        ...Object.keys(local),
        ...Object.keys(remoto)
    ])).filter(Boolean);
    const conflitos = [];
    const resultado = [];

    for (const usuario of usuarios) {

        const linhaBase = limparLinha(base[usuario]);
        const linhaLocal = local[usuario];
        const linhaRemoto = remoto[usuario];
        const temBase = Boolean(base[usuario]);

        if (!temBase) {

            const escolhida = escolherSemBase(
                usuario,
                linhaLocal,
                linhaRemoto,
                conflitos
            );

            if (escolhida) resultado.push(escolhida);
            continue;

        }

        if (!linhaLocal && !linhaRemoto) continue;
        if (!linhaLocal) {

            resultado.push(linhaRemoto);
            continue;

        }
        if (!linhaRemoto) {

            resultado.push(linhaLocal);
            continue;

        }

        const localMudou = !linhasIguais(linhaLocal, linhaBase);
        const remotoMudou = !linhasIguais(linhaRemoto, linhaBase);

        if (localMudou && !remotoMudou) {

            resultado.push(linhaLocal);
            continue;

        }

        if (remotoMudou && !localMudou) {

            resultado.push(linhaRemoto);
            continue;

        }

        if (!localMudou && !remotoMudou) {

            resultado.push(linhaLocal);
            continue;

        }

        resultado.push(mesclarCampos(
            usuario,
            linhaBase,
            linhaLocal,
            linhaRemoto,
            conflitos
        ));

    }

    resultado.sort((a, b) =>
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') ||
        String(a.usuario || '').localeCompare(String(b.usuario || ''), 'pt-BR')
    );

    return {
        linhas: resultado,
        conflitos
    };

}

function main() {

    const local = process.argv[2] || caminhoCsv();
    const remoto = process.argv[3] || local;
    const saida = process.argv[4] || local;
    const estadoPath = process.argv[5] || caminhoPadraoEstado(saida);
    const estado = lerEstado(estadoPath);
    const localLinhas = lerClientesCsv(local);
    const remotoLinhas = lerClientesCsv(remoto);
    const resultado = mesclar(
        localLinhas,
        remotoLinhas,
        estado
    );

    salvarClientesCsv(
        resultado.linhas,
        saida
    );

    salvarEstado(
        estadoPath,
        resultado.linhas
    );

    console.log(`Local: ${localLinhas.length}`);
    console.log(`OneDrive: ${remotoLinhas.length}`);
    console.log(`Mesclados: ${resultado.linhas.length}`);
    console.log(`Conflitos: ${resultado.conflitos.length}`);
    console.log(`Arquivo: ${saida}`);
    console.log(`Estado: ${estadoPath}`);

    for (const conflito of resultado.conflitos) {

        console.log(
            `CONFLITO usuario=${conflito.usuario} campo=${conflito.campo} usado=${conflito.usado}`
        );

    }

}

main();
