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

const DATA_DIR = path.join(__dirname, '..', 'data');
const VENDAS_PATH = path.join(DATA_DIR, 'vendas.json');

function garantirStore() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

    if (!fs.existsSync(VENDAS_PATH)) {

        fs.writeFileSync(
            VENDAS_PATH,
            JSON.stringify(
                {
                    vendas: {}
                },
                null,
                2
            )
        );

    }

}

function lerStore() {

    garantirStore();

    try {

        return JSON.parse(fs.readFileSync(VENDAS_PATH, 'utf8'));

    } catch (_) {

        return {
            vendas: {}
        };

    }

}

function salvarStore(store) {

    garantirStore();

    fs.writeFileSync(
        VENDAS_PATH,
        JSON.stringify(store, null, 2)
    );

}

function accessToken() {

    const token = process.env.MP_ACCESS_TOKEN;

    if (!token) {

        throw new Error('MP_ACCESS_TOKEN nao configurado.');

    }

    return token;

}

function limparNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

}

function normalizarValor(valor) {

    return Number(
        String(valor)
            .replace('R$', '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim()
    );

}

function referenciaVenda() {

    return `wppbot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

}

function paymentMethods(metodo) {

    if (metodo === 'pix') {

        return {
            excluded_payment_types: [
                {
                    id: 'credit_card'
                },
                {
                    id: 'debit_card'
                },
                {
                    id: 'ticket'
                },
                {
                    id: 'atm'
                }
            ]
        };

    }

    if (metodo === 'boleto') {

        return {
            excluded_payment_types: [
                {
                    id: 'credit_card'
                },
                {
                    id: 'debit_card'
                },
                {
                    id: 'bank_transfer'
                },
                {
                    id: 'atm'
                }
            ]
        };

    }

    if (metodo === 'cartao') {

        return {
            excluded_payment_types: [
                {
                    id: 'ticket'
                },
                {
                    id: 'bank_transfer'
                },
                {
                    id: 'atm'
                }
            ]
        };

    }

    return {};

}

async function chamarMercadoPago(caminho, opcoes = {}) {

    const headers = {
        authorization: `Bearer ${accessToken()}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(opcoes.headers || {})
    };

    for (const chave of Object.keys(headers)) {

        if (headers[chave] === undefined) delete headers[chave];

    }

    const resposta = await fetch(
        `https://api.mercadopago.com${caminho}`,
        {
            ...opcoes,
            headers
        }
    );

    const texto = await resposta.text();
    let dados;

    try {

        dados = JSON.parse(texto);

    } catch (_) {

        dados = texto;

    }

    if (!resposta.ok) {

        throw new Error(
            dados?.message ||
            dados?.error ||
            texto.slice(0, 200) ||
            `Erro Mercado Pago: ${resposta.status}`
        );

    }

    return dados;

}

async function criarPreferencia(body) {

    return await chamarMercadoPago(
        '/checkout/preferences',
        {
            method: 'POST',
            body: JSON.stringify(body)
        }
    );

}

async function criarCheckoutVenda({
    numero,
    plano,
    valor,
    metodo
}) {

    const reference = referenciaVenda();
    const valorNumero = normalizarValor(valor);
    const telefone = limparNumero(numero);
    const titulo = `TopTec TV - ${plano}`;
    const baseBody = {
        items: [
            {
                title: titulo,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: valorNumero
            }
        ],
        external_reference: reference,
        metadata: {
            whatsapp: telefone,
            plano,
            metodo
        },
        statement_descriptor: 'TOPTEC TV'
    };

    if (process.env.MP_NOTIFICATION_URL) {

        baseBody.notification_url = process.env.MP_NOTIFICATION_URL;

    }

    if (
        process.env.MP_SUCCESS_URL ||
        process.env.MP_FAILURE_URL ||
        process.env.MP_PENDING_URL
    ) {

        baseBody.back_urls = {
            success: process.env.MP_SUCCESS_URL || process.env.MP_PENDING_URL,
            failure: process.env.MP_FAILURE_URL || process.env.MP_PENDING_URL,
            pending: process.env.MP_PENDING_URL || process.env.MP_SUCCESS_URL
        };

    }

    let preferencia;

    try {

        preferencia = await criarPreferencia(
            {
                ...baseBody,
                payment_methods: paymentMethods(metodo)
            }
        );

    } catch (erro) {

        console.log(
            'ERRO PREFERENCIA MP COM FILTRO; tentando sem filtro.',
            erro.message
        );

        preferencia = await criarPreferencia(baseBody);

    }

    const venda = {
        reference,
        numero,
        telefone,
        plano,
        valor: valorNumero,
        metodo,
        status: 'pending',
        preference_id: preferencia.id,
        init_point: preferencia.init_point,
        sandbox_init_point: preferencia.sandbox_init_point,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const store = lerStore();
    store.vendas[reference] = venda;
    salvarStore(store);

    return venda;

}

function listarVendasPendentes() {

    const store = lerStore();

    return Object.values(store.vendas || {})
        .filter(venda => venda.status === 'pending' || venda.status === 'in_process');

}

function atualizarVenda(reference, dados) {

    const store = lerStore();
    const venda = store.vendas?.[reference];

    if (!venda) return null;

    store.vendas[reference] = {
        ...venda,
        ...dados,
        updated_at: new Date().toISOString()
    };

    salvarStore(store);

    return store.vendas[reference];

}

async function buscarPagamentoPorReferencia(reference) {

    const params = new URLSearchParams({
        external_reference: reference,
        sort: 'date_created',
        criteria: 'desc'
    });

    const dados = await chamarMercadoPago(
        `/v1/payments/search?${params.toString()}`,
        {
            method: 'GET',
            headers: {
                'content-type': undefined
            }
        }
    );

    return dados.results?.[0] || null;

}

module.exports = {
    criarCheckoutVenda,
    listarVendasPendentes,
    atualizarVenda,
    buscarPagamentoPorReferencia
};
