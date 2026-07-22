const fs = require('fs');
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64url(valor) {

    return Buffer.from(valor)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

}

function carregarCredenciais() {

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {

        return JSON.parse(fs.readFileSync(
            process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            'utf8'
        ));

    }

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {

        return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    }

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '')
        .replace(/\\n/g, '\n');

    if (email && privateKey) {

        return {
            client_email: email,
            private_key: privateKey
        };

    }

    throw new Error('Credenciais do Google Sheets nao configuradas.');

}

async function obterAccessToken() {

    const credenciais = carregarCredenciais();
    const agora = Math.floor(Date.now() / 1000);
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };
    const payload = {
        iss: credenciais.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        exp: agora + 3600,
        iat: agora
    };
    const unsigned = [
        base64url(JSON.stringify(header)),
        base64url(JSON.stringify(payload))
    ].join('.');
    const assinatura = crypto
        .createSign('RSA-SHA256')
        .update(unsigned)
        .sign(credenciais.private_key, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const jwt = `${unsigned}.${assinatura}`;
    const resposta = await fetch(
        TOKEN_URL,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        }
    );

    if (!resposta.ok) {
        throw new Error(`Google token erro ${resposta.status}: ${await resposta.text()}`);
    }

    const dados = await resposta.json();

    return dados.access_token;

}

function spreadsheetId() {

    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID nao configurado.');

    return id;

}

function nomeAba(chave) {

    return process.env[`GOOGLE_SHEETS_TAB_${chave.toUpperCase()}`] ||
        chave.toLowerCase();

}

function rangeAba(aba) {

    return `'${String(aba).replace(/'/g, "''")}'`;

}

async function requestGoogle(method, url, body) {

    const token = await obterAccessToken();
    const resposta = await fetch(
        url,
        {
            method,
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        }
    );

    if (!resposta.ok) {
        throw new Error(`Google Sheets erro ${resposta.status}: ${await resposta.text()}`);
    }

    return await resposta.json();

}

async function garantirAba(chave) {

    const aba = nomeAba(chave);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}?fields=sheets.properties.title`;
    const dados = await requestGoogle('GET', url);
    const existe = (dados.sheets || []).some(sheet =>
        sheet.properties?.title === aba
    );

    if (existe) return;

    await requestGoogle(
        'POST',
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}:batchUpdate`,
        {
            requests: [
                {
                    addSheet: {
                        properties: {
                            title: aba
                        }
                    }
                }
            ]
        }
    );

}

async function lerValores(chave) {

    const aba = nomeAba(chave);

    await garantirAba(chave);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}/values/${encodeURIComponent(rangeAba(aba))}`;
    const dados = await requestGoogle('GET', url);

    return dados.values || [];

}

async function escreverValores(chave, valores) {

    const aba = nomeAba(chave);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}/values`;

    await garantirAba(chave);

    await requestGoogle(
        'POST',
        `${base}/${encodeURIComponent(rangeAba(aba))}:clear`,
        {}
    );

    if (!valores.length) return;

    await requestGoogle(
        'PUT',
        `${base}/${encodeURIComponent(rangeAba(aba))}?valueInputOption=USER_ENTERED`,
        {
            range: aba,
            majorDimension: 'ROWS',
            values: valores
        }
    );

}

module.exports = {
    escreverValores,
    lerValores,
    nomeAba
};
