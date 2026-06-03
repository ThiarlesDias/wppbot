const fs = require('fs');
const path = require('path');

function carregarEnvLocal() {

    const envPath = path.join(__dirname, '..', '.env');

    if (!fs.existsSync(envPath)) return;

    const linhas = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

    for (const linha of linhas) {

        const conteudo = linha.trim();

        if (!conteudo || conteudo.startsWith('#')) continue;

        const posicao = conteudo.indexOf('=');

        if (posicao === -1) continue;

        const chave = conteudo.slice(0, posicao).trim();
        const valor = conteudo.slice(posicao + 1).trim();

        if (chave && process.env[chave] === undefined) {

            process.env[chave] = valor;

        }

    }

}

carregarEnvLocal();

const SIGMA_BASE_URL = (
    process.env.SIGMA_BASE_URL ||
    'https://azonixplay.sigmab.pro/api'
).replace(/\/$/, '');

const SIGMA_APP_URL =
process.env.SIGMA_APP_URL ||
'https://azonixplay.sigmab.pro/Sss';

const SIGMA_APP_VERSION =
process.env.SIGMA_APP_VERSION ||
'3.81';

const TESTE_PADRAO = {
    server_id: process.env.SIGMA_SERVER_ID || 'we6Wnw1K8N',
    package_id: process.env.SIGMA_PACKAGE_ID || 'VpKDaw21RA',
    trial_hours: Number(process.env.SIGMA_TRIAL_HOURS || 6),
    connections: Number(process.env.SIGMA_CONNECTIONS || 1)
};

let tokenCache = null;

function limparNumero(numero) {

    return String(numero || '')
        .replace('@c.us', '')
        .replace(/\D/g, '');

}

function headers(token) {

    return {
        accept: 'application/json',
        'content-type': 'application/json',
        locale: 'pt-BR',
        origin: 'https://azonixplay.sigmab.pro',
        referer: SIGMA_APP_URL,
        'x-app-version': SIGMA_APP_VERSION,
        'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        ...(token ? {
            authorization: `Bearer ${token}`
        } : {})
    };

}

async function chamarSigma(caminho, opcoes = {}) {

    const resposta = await fetch(
        `${SIGMA_BASE_URL}/${caminho.replace(/^\//, '')}`,
        {
            ...opcoes,
            headers: {
                ...headers(opcoes.token),
                ...(opcoes.headers || {})
            }
        }
    );

    const texto = await resposta.text();
    const contentType = resposta.headers.get('content-type') || '';
    let dados;

    try {

        dados = JSON.parse(texto);

    } catch (_) {

        dados = texto;

    }

    if (
        typeof dados === 'string' &&
        (
            contentType.includes('text/html') ||
            dados.trim().startsWith('<!DOCTYPE') ||
            dados.includes('Cloudflare')
        )
    ) {

        throw new Error(
            'A API do Sigma retornou HTML/Cloudflare em vez de JSON. ' +
            'A VM provavelmente foi bloqueada pelo Cloudflare do painel.'
        );

    }

    if (!resposta.ok) {

        const mensagem =
        dados?.message ||
        dados?.errors?.[0] ||
        texto.slice(0, 200) ||
        `Erro Sigma: ${resposta.status}`;

        throw new Error(mensagem);

    }

    return dados;

}

async function loginSigma() {

    if (tokenCache) return tokenCache;

    const username = process.env.SIGMA_USERNAME;
    const password = process.env.SIGMA_PASSWORD;

    if (!username || !password) {

        return null;

    }

    const dados = await chamarSigma(
        'auth/login',
        {
            method: 'POST',
            body: JSON.stringify({
                captcha: 'not-a-robot',
                captchaChecked: true,
                username,
                password,
                twofactor_code: '',
                twofactor_recovery_code: '',
                twofactor_trusted_device_id: ''
            })
        }
    );

    tokenCache = dados.token;

    if (!tokenCache) {

        throw new Error('Login Sigma nao retornou token.');

    }

    return tokenCache;

}

function escolherTemplatePlaylist(playlist) {

    if (!playlist) return '';

    if (typeof playlist.template === 'string') {

        return playlist.template;

    }

    if (
        Array.isArray(playlist.key) &&
        Array.isArray(playlist.template)
    ) {

        const indicePt = playlist.key.indexOf('pt');

        if (indicePt >= 0) return playlist.template[indicePt] || '';

        return playlist.template.find(Boolean) || '';

    }

    return '';

}

async function criarTesteGratis(numero) {

    const telefone = limparNumero(numero);
    const token = await loginSigma();

    if (!token) {

        return {
            automatico: false,
            telefone
        };

    }

    const criado = await chamarSigma(
        'customers',
        {
            method: 'POST',
            token,
            body: JSON.stringify({
                ...TESTE_PADRAO,
                name: `WhatsApp ${telefone}`,
                whatsapp: telefone,
                note: `Teste gratis solicitado pelo WhatsApp ${telefone}`
            })
        }
    );

    const cliente = criado.data || criado;
    const customerId = cliente.id;

    if (!customerId) {

        throw new Error('Sigma criou o teste, mas nao retornou ID do cliente.');

    }

    let playlist = null;
    let mensagem = '';

    try {

        playlist = await chamarSigma(
            `customers/${customerId}/playlist`,
            {
                token
            }
        );

        mensagem = escolherTemplatePlaylist(playlist);

    } catch (erro) {

        console.log('ERRO PLAYLIST SIGMA', erro);

    }

    return {
        automatico: true,
        telefone,
        cliente,
        playlist,
        mensagem
    };

}

module.exports = {
    criarTesteGratis,
    limparNumero
};
