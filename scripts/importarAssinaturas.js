const fs = require('fs');
const path = require('path');
const {
    registrarAssinatura,
    formatarData
} = require('../services/assinaturasStore');

function uso() {

    console.log([
        'Uso:',
        '  node scripts/importarAssinaturas.js caminho/clientes.csv',
        '',
        'Colunas aceitas:',
        '  telefonePK, usuario, vencimento',
        '',
        'Colunas opcionais:',
        '  senha, email, dns, link_m3u, plano',
        '',
        'Exemplo CSV com ;',
        '  telefonePK;usuario;vencimento',
        '  5543999999999;123456;30/06/2026 23:59:00'
    ].join('\n'));

}

function limparNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

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

        if (linha[chave]) return linha[chave];

    }

    return '';

}

function normalizarData(valorData) {

    const texto = String(valorData || '').trim();

    if (!texto) return null;

    const br = texto.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (br) {

        const [, dia, mes, ano, hora = '0', minuto = '0', segundo = '0'] = br;

        return new Date(
            Number(ano),
            Number(mes) - 1,
            Number(dia),
            Number(hora),
            Number(minuto),
            Number(segundo)
        );

    }

    const data = new Date(texto);

    if (Number.isNaN(data.getTime())) return null;

    return data;

}

function lerCsv(arquivo) {

    const conteudo = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
    const linhas = conteudo
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    if (linhas.length < 2) {

        throw new Error('CSV precisa ter cabecalho e pelo menos um cliente.');

    }

    const separador = detectarSeparador(linhas[0]);
    const cabecalho = parseCsvLinha(linhas[0], separador)
        .map(normalizarCabecalho);

    return linhas.slice(1).map(linha => {
        const campos = parseCsvLinha(linha, separador);
        const item = {};

        cabecalho.forEach((campo, indice) => {
            item[campo] = campos[indice] || '';
        });

        return item;
    });

}

function importarCliente(linha, indice) {

    const telefone = limparNumero(
        valor(linha, 'telefonePK', 'telefone_pk', 'telefone', 'whatsapp', 'numero', 'celular')
    );
    const username = valor(linha, 'usuario', 'username', 'user', 'login');
    const password = valor(linha, 'senha', 'password', 'pass');
    const email = valor(linha, 'email', 'e_mail');
    const plano = valor(linha, 'plano', 'pacote') || 'Importado';
    const dnsBruto = valor(linha, 'dns', 'dns_xciptv', 'dns_smarters');
    const dns = dnsBruto ? dnsBruto.replace(/\/$/, '') + '/' : '';
    const linkM3uInformado = valor(linha, 'link_m3u', 'm3u', 'link');
    const expiresAt = normalizarData(
        valor(linha, 'vencimento', 'validade', 'vence_em', 'expires_at')
    );

    if (!telefone) {

        throw new Error(`Linha ${indice}: telefone vazio.`);

    }

    if (!username) {

        throw new Error(`Linha ${indice}: usuario vazio.`);

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

    return registrarAssinatura({
        numero: `${telefone}@c.us`,
        telefone,
        email,
        plano,
        origem: 'importado',
        credenciais: {
            username,
            password,
            dns,
            linkM3u,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        },
        expiresAt: expiresAt.toISOString()
    });

}

function main() {

    const arquivo = process.argv[2];

    if (!arquivo) {

        uso();
        process.exitCode = 1;
        return;

    }

    const caminho = path.resolve(arquivo);

    if (!fs.existsSync(caminho)) {

        throw new Error(`Arquivo nao encontrado: ${caminho}`);

    }

    const linhas = lerCsv(caminho);
    let importados = 0;
    const erros = [];

    linhas.forEach((linha, indice) => {
        try {

            const assinatura = importarCliente(linha, indice + 2);
            importados += 1;

            console.log(
                `OK ${assinatura.telefone} usuario=${assinatura.username} vencimento=${formatarData(assinatura.expiresAt)}`
            );

        } catch (erro) {

            erros.push(erro.message);
            console.log(`ERRO ${erro.message}`);

        }
    });

    console.log('');
    console.log(`Importados: ${importados}`);
    console.log(`Erros: ${erros.length}`);

    if (erros.length) process.exitCode = 1;

}

main();
