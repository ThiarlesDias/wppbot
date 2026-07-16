const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const {
    registrarAssinatura,
    formatarData
} = require('../services/assinaturasStore');
const {
    caminhoCsv
} = require('../services/clientesCsv');

function uso() {

    console.log([
        'Uso:',
        '  node scripts/importarAssinaturas.js caminho/clientes.csv',
        '  node scripts/importarAssinaturas.js',
        '',
        'Sem caminho, usa CLIENTES_CSV_PATH ou data/clientes.csv.',
        '',
        'Colunas aceitas:',
        '  nome, telefone, usuario, senha, dns, m3u, vencimento, valor, telas, meses, aviso_vencimento',
        '',
        'Colunas opcionais:',
        '  email, plano',
        '',
        'Exemplo CSV/TSV:',
        '  nome;telefone;usuario;senha;dns;m3u;vencimento;valor;telas;meses;aviso_vencimento',
        '  Joao Silva;5543999999999;123456;abc123;http://aznxplay1.sbs/;http://aznxplay1.sbs/get.php?...;30/06/2026 23:59:00;25,00;1;1;'
    ].join('\n'));

}

function textoValor(valorCampo) {

    if (valorCampo === undefined || valorCampo === null) return '';

    if (valorCampo instanceof Date) return valorCampo.toISOString();

    if (typeof valorCampo === 'number') {

        if (Number.isInteger(valorCampo)) return String(valorCampo);

        return String(valorCampo).replace(/\.0$/, '');

    }

    return String(valorCampo).trim();

}

function limparNumero(numero) {

    return textoValor(numero).replace(/\D/g, '');

}

function detectarSeparador(linha) {

    const separadores = [';', ',', '\t'];

    return separadores
        .map(separador => ({
            separador,
            total: linha.split(separador).length
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

function normalizarCabecalho(campo) {

    return String(campo || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

}

function valor(linha, ...nomes) {

    for (const nome of nomes) {

        const chave = normalizarCabecalho(nome);

        if (
            Object.prototype.hasOwnProperty.call(linha, chave) &&
            linha[chave] !== undefined &&
            linha[chave] !== null &&
            textoValor(linha[chave]) !== ''
        ) {

            return linha[chave];

        }

    }

    return '';

}

function normalizarData(valorData) {

    if (valorData instanceof Date) return valorData;

    const texto = textoValor(valorData);

    if (!texto) return null;

    const br = texto.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (br) {

        const [, dia, mes, ano, hora = '0', minuto = '0', segundo = '0'] = br;
        const anoCompleto = ano.length === 2 ?
            2000 + Number(ano) :
            Number(ano);

        return new Date(Date.UTC(
            anoCompleto,
            Number(mes) - 1,
            Number(dia),
            Number(hora) + 3,
            Number(minuto),
            Number(segundo)
        ));

    }

    const data = new Date(texto);

    if (Number.isNaN(data.getTime())) return null;

    return data;

}

function linhasParaObjetos(linhas) {

    if (linhas.length < 2) {

        throw new Error('Arquivo precisa ter cabecalho e pelo menos um cliente.');

    }

    const cabecalho = linhas[0]
        .map(normalizarCabecalho);

    return linhas.slice(1).map(linha => {
        const item = {};

        cabecalho.forEach((campo, indice) => {
            item[campo] = linha[indice] ?? '';
        });

        return item;
    });

}

function lerCsv(arquivo) {

    const conteudo = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
    const linhasTexto = conteudo
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    if (linhasTexto.length < 2) {

        throw new Error('CSV precisa ter cabecalho e pelo menos um cliente.');

    }

    const separador = detectarSeparador(linhasTexto[0]);
    const linhas = linhasTexto.map(linha => parseCsvLinha(linha, separador));

    return linhasParaObjetos(linhas);

}

function lerXlsx(arquivo) {

    const workbook = XLSX.readFile(
        arquivo,
        {
            cellDates: false
        }
    );
    const nomePlanilha = workbook.SheetNames[0];
    const planilha = workbook.Sheets[nomePlanilha];
    const range = XLSX.utils.decode_range(planilha['!ref']);
    const linhas = [];

    for (let row = range.s.r; row <= range.e.r; row += 1) {

        const linha = [];

        for (let col = range.s.c; col <= range.e.c; col += 1) {

            const endereco = XLSX.utils.encode_cell({
                r: row,
                c: col
            });
            const celula = planilha[endereco];
            const cabecalho = row === range.s.r ?
                '' :
                normalizarCabecalho(linhas[0]?.[col - range.s.c] || '');

            linha.push(
                cabecalho.includes('venc') ||
                cabecalho.includes('validade') ||
                cabecalho.includes('expires') ?
                    (celula?.w ?? celula?.v ?? '') :
                    (celula?.v ?? '')
            );

        }

        if (linha.some(campo => textoValor(campo) !== '')) linhas.push(linha);

    }

    return linhasParaObjetos(linhas);

}

function lerArquivo(arquivo) {

    const ext = path.extname(arquivo).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') return lerXlsx(arquivo);

    return lerCsv(arquivo);

}

function extrairDnsDoM3u(linkM3u) {

    try {

        const url = new URL(linkM3u);

        return `${url.origin}/`;

    } catch (_) {

        return '';

    }

}

function extrairSenhaDoM3u(linkM3u) {

    try {

        const url = new URL(linkM3u);

        return url.searchParams.get('password') || '';

    } catch (_) {

        return '';

    }

}

function importarCliente(linha, indice) {

    const nome = textoValor(valor(linha, 'nome', 'cliente', 'nome_cliente'));
    const telefone = limparNumero(
        valor(linha, 'telefonePK', 'telefone_pk', 'column_14', 'telefone', 'whatsapp', 'numero', 'celular')
    );
    const username = textoValor(valor(linha, 'usuario', 'username', 'user', 'login'));
    let password = textoValor(valor(linha, 'senha', 'password', 'pass'));
    const email = textoValor(valor(linha, 'email', 'e_mail'));
    const plano = textoValor(valor(linha, 'plano', 'pacote')) || 'Importado';
    const valorPlano = textoValor(valor(linha, 'valor', 'preco', 'mensalidade'));
    const telas = textoValor(valor(linha, 'telas', 'conexoes', 'conexoes_simultaneas'));
    const meses = textoValor(valor(linha, 'meses', 'mes', 'duracao_meses', 'duracao'));
    const avisoVencimento = normalizarData(
        valor(linha, 'aviso_vencimento', 'aviso_enviado', 'enviado_ok', 'vencimento_avisado')
    );
    const linkM3uInformado = textoValor(valor(linha, 'm3u', 'link_m3u', 'link'));
    const senhaM3u = extrairSenhaDoM3u(linkM3uInformado);

    if (senhaM3u) password = senhaM3u;

    const dnsBruto = textoValor(valor(linha, 'dns', 'dns_xciptv', 'dns_smarters')) ||
        extrairDnsDoM3u(linkM3uInformado);
    const dns = dnsBruto ? dnsBruto.replace(/\/$/, '') + '/' : '';
    const expiresAt = normalizarData(
        valor(linha, 'vencimento', 'validade', 'vence_em', 'expires_at')
    );

    if (!nome) {

        throw new Error(`Linha ${indice}: nome vazio.`);

    }

    if (!telefone) {

        throw new Error(`Linha ${indice}: telefone vazio.`);

    }

    if (!username) {

        throw new Error(`Linha ${indice}: usuario vazio.`);

    }

    if (!password) {

        throw new Error(`Linha ${indice}: senha vazia.`);

    }

    if (!dns) {

        throw new Error(`Linha ${indice}: dns vazio.`);

    }

    if (!expiresAt) {

        throw new Error(`Linha ${indice}: vencimento invalido.`);

    }

    const linkM3u = linkM3uInformado ||
        (
            dns && username && password ?
                `${dns.replace(/\/$/, '')}/get.php?username=${username}&password=${password}&type=m3u_plus&output=mpegts` :
                ''
        );

    if (!linkM3u) {

        throw new Error(`Linha ${indice}: m3u vazio.`);

    }

    return registrarAssinatura({
        numero: `${telefone}@c.us`,
        telefone,
        nome,
        email,
        plano,
        valor: valorPlano,
        telas,
        meses,
        origem: 'importado',
        credenciais: {
            username,
            password,
            dns,
            linkM3u,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        },
        expiresAt: expiresAt.toISOString(),
        avisoVencimento: avisoVencimento ? avisoVencimento.toISOString() : ''
    });

}

function importarArquivo(arquivo = caminhoCsv(), opcoes = {}) {

    const log = opcoes.log !== false ?
        (...args) => console.log(...args) :
        () => {};

    if (!arquivo) {

        throw new Error('Caminho do arquivo de clientes nao informado.');

    }

    const caminho = path.resolve(arquivo);

    if (!fs.existsSync(caminho)) {

        throw new Error(`Arquivo nao encontrado: ${caminho}`);

    }

    const linhas = lerArquivo(caminho);
    let importados = 0;
    const erros = [];

    linhas.forEach((linha, indice) => {
        try {

            const assinatura = importarCliente(linha, indice + 2);
            importados += 1;

            log(
                `OK ${assinatura.nome} ${assinatura.telefone} usuario=${assinatura.username} vencimento=${formatarData(assinatura.expiresAt)}`
            );

        } catch (erro) {

            erros.push(erro.message);
            log(`ERRO ${erro.message}`);

        }
    });

    log('');
    log(`Importados: ${importados}`);
    log(`Erros: ${erros.length}`);

    return {
        caminho,
        importados,
        erros
    };

}

function main() {

    try {

        const resultado = importarArquivo(process.argv[2] || caminhoCsv());

        if (resultado.erros.length) process.exitCode = 1;

    } catch (erro) {

        uso();
        throw erro;

    }

}

if (require.main === module) {

    main();

}

module.exports = {
    importarArquivo
};
