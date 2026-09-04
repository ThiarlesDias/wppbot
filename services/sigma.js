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

const SIGMA_CHATBOT_URL = process.env.SIGMA_CHATBOT_URL || '';

const TESTE_PADRAO = {
    server_id: process.env.SIGMA_SERVER_ID || 'we6Wnw1K8N',
    package_id: process.env.SIGMA_PACKAGE_ID || 'VpKDaw21RA',
    trial_hours: Number(process.env.SIGMA_TRIAL_HOURS || 6),
    connections: Number(process.env.SIGMA_CONNECTIONS || 1)
};

const SIGMA_PROXY_SERVER = process.env.SIGMA_PROXY_SERVER || '';
const SIGMA_PROXY_USERNAME = process.env.SIGMA_PROXY_USERNAME || '';
const SIGMA_PROXY_PASSWORD = process.env.SIGMA_PROXY_PASSWORD || '';

let tokenCache = null;

function erroCloudflare(mensagem) {

    return String(mensagem || '').includes('HTML/Cloudflare');

}

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

function montarMensagemChatbot(dados) {

    const usuario = dados.username;
    const senha = dados.password;
    const dns = String(dados.dns || '').replace(/\/$/, '');
    const dnsComBarra = dns ? `${dns}/` : '';

    if (!usuario || !senha) return '';

    const linkM3u = dns ?
        `${dns}/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=mpegts` :
        '';

    return [
        '*Segue os Dados De Acesso*',
        `✅ *Usuário:* ${usuario}`,
        `✅ *Senha:* ${senha}`,
        '',
        dnsComBarra ? `🟠 *DNS XCIPTV:* ${dnsComBarra}` : '',
        dnsComBarra ? `🟠 *DNS SMARTERS:* ${dnsComBarra}` : '',
        '',
        linkM3u ? `🟢 *Link (M3U):* ${linkM3u}` : ''
    ].filter(linha => linha !== '').join('\n');

}

async function criarTesteGratisNoNavegador(telefone) {

    let puppeteer;

    try {

        puppeteer = require('puppeteer-extra');

        try {

            const stealth = require('puppeteer-extra-plugin-stealth');
            puppeteer.use(stealth());

        } catch (_) {}

    } catch (_) {

        puppeteer = require('puppeteer');

    }

    const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    '/usr/bin/google-chrome';

    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
    ];

    if (SIGMA_PROXY_SERVER) {

        args.push(`--proxy-server=${SIGMA_PROXY_SERVER}`);

    }

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        userDataDir: path.join(__dirname, '..', 'data', 'sigma-browser'),
        args
    });

    try {

        const page = await browser.newPage();

        if (SIGMA_PROXY_USERNAME || SIGMA_PROXY_PASSWORD) {

            await page.authenticate({
                username: SIGMA_PROXY_USERNAME,
                password: SIGMA_PROXY_PASSWORD
            });

        }

        await page.setViewport({
            width: 1365,
            height: 900
        });

        await page.goto(
            `${SIGMA_APP_URL}#/dashboard`,
            {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            }
        );

        await new Promise(resolve => setTimeout(resolve, 2500));

        let tokenNavegador = await page.evaluate(() => localStorage.getItem('token'));

        if (!tokenNavegador) {

            const loginFeito = await page.evaluate(
                async (username, password) => {

                    const inputs = Array.from(document.querySelectorAll('input'));
                    const passwordInput =
                    inputs.find(input => input.type === 'password');
                    const userInput =
                    inputs.find(input => input.type === 'text') ||
                    inputs.find(input => input.type === 'email') ||
                    inputs.find(input => input !== passwordInput);

                    if (!userInput || !passwordInput) return false;

                    function preencher(input, valor) {

                        input.focus();
                        input.value = valor;
                        input.dispatchEvent(
                            new Event(
                                'input',
                                {
                                    bubbles: true
                                }
                            )
                        );
                        input.dispatchEvent(
                            new Event(
                                'change',
                                {
                                    bubbles: true
                                }
                            )
                        );

                    }

                    preencher(
                        userInput,
                        username
                    );
                    preencher(
                        passwordInput,
                        password
                    );

                    const botao =
                    document.querySelector('button[type="submit"]') ||
                    Array.from(document.querySelectorAll('button'))
                        .find(item => !item.disabled);

                    if (!botao) return false;

                    botao.click();

                    return true;

                },
                process.env.SIGMA_USERNAME || '',
                process.env.SIGMA_PASSWORD || ''
            );

            if (loginFeito) {

                try {

                    await page.waitForFunction(
                        () => Boolean(localStorage.getItem('token')),
                        {
                            timeout: 20000
                        }
                    );

                } catch (_) {}

                tokenNavegador = await page.evaluate(() => localStorage.getItem('token'));

            }

        }

        const resultado = await page.evaluate(
            async (testePadrao, telefone, appVersion, username, password) => {

                async function login() {

                    const tokenAtual = localStorage.getItem('token');

                    if (tokenAtual) return tokenAtual;

                    const response = await fetch(
                        '/api/auth/login',
                        {
                            method: 'POST',
                            headers: {
                                accept: 'application/json',
                                'content-type': 'application/json',
                                locale: 'pt-BR',
                                'x-app-version': appVersion
                            },
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

                    const text = await response.text();
                    let data;

                    try {

                        data = JSON.parse(text);

                    } catch (_) {

                        data = text;

                    }

                    if (!response.ok || !data?.token) {

                        if (
                            typeof data === 'string' &&
                            (
                                data.trim().startsWith('<!DOCTYPE') ||
                                data.includes('Cloudflare')
                            )
                        ) {

                            throw new Error(
                                'Cloudflare bloqueou o login do Sigma tambem no navegador.'
                            );

                        }

                        throw new Error(
                            data?.message ||
                            data?.errors?.[0] ||
                            text.slice(0, 180) ||
                            'Login no Sigma nao retornou token no navegador.'
                        );

                    }

                    localStorage.setItem('token', data.token);

                    return data.token;

                }

                const token = await login();

                if (!token) {

                    throw new Error('Login no Sigma nao retornou token no navegador.');

                }

                const headers = {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    locale: 'pt-BR',
                    'x-app-version': appVersion,
                    authorization: `Bearer ${token}`
                };

                async function request(caminho, options = {}) {

                    const response = await fetch(
                        `/api/${caminho.replace(/^\/+/, '')}`,
                        {
                            ...options,
                            headers: {
                                ...headers,
                                ...(options.headers || {})
                            }
                        }
                    );

                    const text = await response.text();
                    let data;

                    try {

                        data = JSON.parse(text);

                    } catch (_) {

                        data = text;

                    }

                    if (!response.ok) {

                        if (
                            typeof data === 'string' &&
                            (
                                data.trim().startsWith('<!DOCTYPE') ||
                                data.includes('Cloudflare')
                            )
                        ) {

                            throw new Error(
                                'Cloudflare bloqueou a requisicao do Sigma no navegador.'
                            );

                        }

                        throw new Error(
                            data?.message ||
                            data?.errors?.[0] ||
                            text.slice(0, 200) ||
                            `Erro Sigma: ${response.status}`
                        );

                    }

                    return data;

                }

                const criado = await request(
                    'customers',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            ...testePadrao,
                            name: `WhatsApp ${telefone}`,
                            whatsapp: telefone,
                            note: `Teste gratis solicitado pelo WhatsApp ${telefone}`
                        })
                    }
                );

                const cliente = criado.data || criado;

                if (!cliente.id) {

                    throw new Error('Sigma criou o teste, mas nao retornou ID do cliente.');

                }

                const playlist = await request(
                    `customers/${cliente.id}/playlist`
                );

                return {
                    cliente,
                    playlist
                };

            },
            TESTE_PADRAO,
            telefone,
            SIGMA_APP_VERSION,
            process.env.SIGMA_USERNAME || '',
            process.env.SIGMA_PASSWORD || ''
        );

        return {
            automatico: true,
            telefone,
            cliente: resultado.cliente,
            playlist: resultado.playlist,
            mensagem: escolherTemplatePlaylist(resultado.playlist)
        };

    } finally {

        await browser.close();

    }

}

function montarOrigemClienteDireto(telefone) {

    const texto = [
        'Origem: Cliente direto pelo robo',
        `WhatsApp cliente: ${telefone}`,
        'Fluxo: teste gratis WhatsApp TOPTEC'
    ].join(' | ');

    return {
        texto,
        origem: 'Cliente direto pelo robo',
        clienteNome: `WhatsApp ${telefone}`
    };

}

async function criarTesteGratisViaChatbot(telefone) {

    const origem = montarOrigemClienteDireto(telefone);

    const resposta = await fetch(
        SIGMA_CHATBOT_URL,
        {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                name: origem.clienteNome,
                whatsapp: telefone,
                phone: telefone,
                number: telefone,
                message: origem.texto,
                note: origem.texto,
                notes: origem.texto,
                observacao: origem.texto,
                observation: origem.texto,
                description: origem.texto,
                descricao: origem.texto,
                source: origem.origem,
                origin: origem.origem,
                origem: origem.origem,
                created_by: origem.origem,
                created_from: origem.origem,
                chatbot_origin: origem.origem,
                customer_name: origem.clienteNome,
                cliente_nome: origem.clienteNome,
                cliente_telefone: telefone
            })
        }
    );

    const texto = await resposta.text();
    let dados;

    try {

        dados = JSON.parse(texto);

    } catch (_) {

        dados = texto;

    }

    if (
        typeof dados === 'string' &&
        (
            dados.trim().startsWith('<!DOCTYPE') ||
            dados.includes('Cloudflare')
        )
    ) {

        throw new Error('O chatbot do Sigma retornou HTML/Cloudflare em vez de JSON.');

    }

    if (!resposta.ok) {

        throw new Error(
            dados?.message ||
            dados?.errors?.[0] ||
            texto.slice(0, 200) ||
            `Erro chatbot Sigma: ${resposta.status}`
        );

    }

    const mensagem = montarMensagemChatbot(dados);

    if (!mensagem && !dados.username) {

        throw new Error('Chatbot Sigma nao retornou dados do teste.');

    }

    return {
        automatico: true,
        telefone,
        cliente: {
            username: dados.username,
            password: dados.password,
            package: dados.package,
            expiresAt: dados.expiresAt
        },
        playlist: dados,
        mensagem
    };

}

async function validarLinkCriacaoTeste() {

    if (!SIGMA_CHATBOT_URL) {

        return {
            ok: false,
            status: 0,
            detalhe: 'SIGMA_CHATBOT_URL nao configurado.'
        };

    }

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        Number(process.env.SIGMA_HEALTH_TIMEOUT_MS || 20000)
    );

    try {

        const resposta = await fetch(
            SIGMA_CHATBOT_URL,
            {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
                },
                signal: controller.signal
            }
        );
        const texto = await resposta.text();

        if (
            texto.includes('Cloudflare')
        ) {

            return {
                ok: false,
                status: resposta.status,
                detalhe: 'Link retornou HTML/Cloudflare.'
            };

        }

        if (resposta.status === 404) {

            return {
                ok: false,
                status: resposta.status,
                detalhe: 'Link nao encontrado no Sigma.'
            };

        }

        if (resposta.status >= 500) {

            return {
                ok: false,
                status: resposta.status,
                detalhe: `Sigma retornou erro ${resposta.status}.`
            };

        }

        return {
            ok: true,
            status: resposta.status,
            detalhe: resposta.ok ?
                'Link respondeu normalmente.' :
                `Link ativo; GET retornou ${resposta.status}.`
        };

    } catch (erro) {

        return {
            ok: false,
            status: 0,
            detalhe: erro.name === 'AbortError' ?
                'Timeout ao validar link do Sigma.' :
                erro.message
        };

    } finally {

        clearTimeout(timeout);

    }

}

async function criarTesteGratis(numero) {

    const telefone = limparNumero(numero);

    if (SIGMA_CHATBOT_URL) {

        return await criarTesteGratisViaChatbot(telefone);

    }

    let token;

    try {

        token = await loginSigma();

    } catch (erro) {

        if (
            process.env.SIGMA_BROWSER_FALLBACK !== '0' &&
            erroCloudflare(erro.message)
        ) {

            console.log('SIGMA API BLOQUEADA; tentando fallback por navegador.');

            return await criarTesteGratisNoNavegador(telefone);

        }

        throw erro;

    }

    if (!token) {

        return {
            automatico: false,
            telefone
        };

    }

    let criado;

    try {

        criado = await chamarSigma(
            'customers',
            {
                method: 'POST',
                token,
                body: JSON.stringify({
                    ...TESTE_PADRAO,
                    name: `WhatsApp ${telefone}`,
                    whatsapp: telefone,
                    note: montarOrigemClienteDireto(telefone).texto
                })
            }
        );

    } catch (erro) {

        if (
            process.env.SIGMA_BROWSER_FALLBACK !== '0' &&
            erroCloudflare(erro.message)
        ) {

            console.log('SIGMA API BLOQUEADA; tentando fallback por navegador.');

            return await criarTesteGratisNoNavegador(telefone);

        }

        throw erro;

    }

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
    validarLinkCriacaoTeste,
    limparNumero
};
