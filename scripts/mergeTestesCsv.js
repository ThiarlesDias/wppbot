const fs = require('fs');
const path = require('path');
const {
    caminhoTestesCsv,
    lerTestesCsv,
    salvarTestesCsv
} = require('../services/testesCsv');

const CAMPOS = [
    'telefone',
    'usuario',
    'senha',
    'dns',
    'm3u',
    'criado_em',
    'vencimento',
    'vencimento_iso',
    'horas',
    'status',
    'avisado_em',
    'ultimo_aviso_contratacao',
    'saiu_em'
];

function caminhoPadraoEstado(arquivoLocal) {

    return path.join(
        path.dirname(arquivoLocal),
        'testes-sync-state.json'
    );

}

function limparLinha(linha) {

    const limpa = {};

    for (const campo of CAMPOS) {
        limpa[campo] = String(linha?.[campo] || '').trim();
    }

    return limpa;

}

function chave(linha) {

    return String(linha?.usuario || '').trim();

}

function mapaPorUsuario(linhas) {

    const mapa = {};

    for (const linha of linhas) {
        const limpa = limparLinha(linha);
        const usuario = chave(limpa);

        if (!usuario) continue;

        mapa[usuario] = limpa;
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

function lerEstado(arquivo) {

    if (!fs.existsSync(arquivo)) {
        return {
            testes: {}
        };
    }

    try {
        const estado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

        return {
            testes: estado.testes || {}
        };
    } catch (_) {
        return {
            testes: {}
        };
    }

}

function salvarEstado(arquivo, linhas) {

    const testes = {};

    for (const linha of linhas) {
        const usuario = chave(linha);
        if (usuario) testes[usuario] = limparLinha(linha);
    }

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                testes
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

        const usarLocal = [
            'status',
            'avisado_em',
            'ultimo_aviso_contratacao',
            'saiu_em'
        ].includes(campo);

        linha[campo] = usarLocal ? valorLocal : valorRemoto;

        conflitos.push({
            usuario,
            campo,
            usado: usarLocal ? 'local' : 'onedrive'
        });
    }

    linha.usuario = usuario;

    return limparLinha(linha);

}

function escolherSemBase(usuario, local, remoto, conflitos) {

    if (!local) return remoto;
    if (!remoto) return local;
    if (linhasIguais(local, remoto)) return local;

    return mesclarCampos(
        usuario,
        {},
        local,
        remoto,
        conflitos
    );

}

function mesclar(localLinhas, remotoLinhas, estado) {

    const local = mapaPorUsuario(localLinhas);
    const remoto = mapaPorUsuario(remotoLinhas);
    const base = estado.testes || {};
    const usuarios = Array.from(new Set([
        ...Object.keys(base),
        ...Object.keys(local),
        ...Object.keys(remoto)
    ])).filter(Boolean);
    const conflitos = [];
    const linhas = [];

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

            if (escolhida) linhas.push(escolhida);
            continue;
        }

        if (!linhaLocal && !linhaRemoto) continue;
        if (!linhaLocal) {
            linhas.push(linhaRemoto);
            continue;
        }
        if (!linhaRemoto) {
            linhas.push(linhaLocal);
            continue;
        }

        const localMudou = !linhasIguais(linhaLocal, linhaBase);
        const remotoMudou = !linhasIguais(linhaRemoto, linhaBase);

        if (localMudou && !remotoMudou) {
            linhas.push(linhaLocal);
            continue;
        }

        if (remotoMudou && !localMudou) {
            linhas.push(linhaRemoto);
            continue;
        }

        if (!localMudou && !remotoMudou) {
            linhas.push(linhaLocal);
            continue;
        }

        linhas.push(mesclarCampos(
            usuario,
            linhaBase,
            linhaLocal,
            linhaRemoto,
            conflitos
        ));
    }

    linhas.sort((a, b) =>
        String(a.vencimento_iso || '').localeCompare(String(b.vencimento_iso || '')) ||
        String(a.usuario || '').localeCompare(String(b.usuario || ''), 'pt-BR')
    );

    return {
        linhas,
        conflitos
    };

}

function main() {

    const local = process.argv[2] || caminhoTestesCsv();
    const remoto = process.argv[3] || local;
    const saida = process.argv[4] || local;
    const estadoPath = process.argv[5] || caminhoPadraoEstado(saida);
    const estado = lerEstado(estadoPath);
    const localLinhas = lerTestesCsv(local);
    const remotoLinhas = lerTestesCsv(remoto);
    const resultado = mesclar(
        localLinhas,
        remotoLinhas,
        estado
    );

    salvarTestesCsv(
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
