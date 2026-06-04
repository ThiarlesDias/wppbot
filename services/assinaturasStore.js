const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ASSINATURAS_PATH = path.join(DATA_DIR, 'assinaturas.json');

function garantirStore() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

    if (!fs.existsSync(ASSINATURAS_PATH)) {

        fs.writeFileSync(
            ASSINATURAS_PATH,
            JSON.stringify(
                {
                    assinaturas: {},
                    telefones: {}
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

        const store = JSON.parse(fs.readFileSync(ASSINATURAS_PATH, 'utf8'));

        return {
            assinaturas: store.assinaturas || {},
            telefones: store.telefones || {}
        };

    } catch (_) {

        return {
            assinaturas: {},
            telefones: {}
        };

    }

}

function salvarStore(store) {

    garantirStore();

    fs.writeFileSync(
        ASSINATURAS_PATH,
        JSON.stringify(store, null, 2)
    );

}

function limparNumero(numero) {

    return String(numero || '')
        .replace('@c.us', '')
        .replace(/\D/g, '');

}

function normalizarData(valor) {

    if (!valor) return null;

    if (valor instanceof Date) return valor;

    if (typeof valor === 'number') {

        return new Date(valor < 10000000000 ? valor * 1000 : valor);

    }

    const texto = String(valor).trim();

    if (/^\d+$/.test(texto)) {

        const numero = Number(texto);
        return new Date(numero < 10000000000 ? numero * 1000 : numero);

    }

    const data = new Date(texto);

    if (Number.isNaN(data.getTime())) return null;

    return data;

}

function adicionarDias(data, dias) {

    return new Date(data.getTime() + Number(dias || 0) * 24 * 60 * 60 * 1000);

}

function diasDoPlano(plano) {

    const texto = String(plano || '').toLowerCase();

    if (texto.includes('6')) return 180;
    if (texto.includes('3')) return 90;

    return 30;

}

function formatarData(valor) {

    const data = normalizarData(valor);

    if (!data) return '';

    const partes = new Intl.DateTimeFormat(
        'pt-BR',
        {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}:${partes.second}`;

}

function idAssinatura(dados) {

    return String(
        dados?.username ||
        dados?.credenciais?.username ||
        limparNumero(dados?.telefone || dados?.numero)
    );

}

function salvarAssinatura(assinatura) {

    const store = lerStore();
    const id = assinatura.id || idAssinatura(assinatura);
    const telefone = limparNumero(assinatura.telefone || assinatura.numero);
    const agora = new Date().toISOString();

    const atual = store.assinaturas[id] || {};

    store.assinaturas[id] = {
        ...atual,
        ...assinatura,
        id,
        telefone,
        updatedAt: agora
    };

    if (!store.assinaturas[id].createdAt) {

        store.assinaturas[id].createdAt = agora;

    }

    if (telefone) store.telefones[telefone] = id;

    salvarStore(store);

    return store.assinaturas[id];

}

function registrarAssinatura({
    numero,
    telefone,
    email,
    plano,
    origem,
    credenciais,
    expiresAt
}) {

    const id = idAssinatura(credenciais);
    const criadoEm =
        normalizarData(credenciais?.createdAt) ||
        new Date();
    const vencimento =
        normalizarData(expiresAt) ||
        normalizarData(credenciais?.expiresAt) ||
        adicionarDias(criadoEm, diasDoPlano(plano));

    return salvarAssinatura({
        id,
        numero,
        telefone: limparNumero(telefone || numero),
        email: email || '',
        plano: plano || '',
        origem: origem || 'pagamento',
        status: 'ativa',
        username: credenciais?.username || '',
        password: credenciais?.password || '',
        dns: credenciais?.dns || '',
        linkM3u: credenciais?.linkM3u || '',
        createdAt: criadoEm.toISOString(),
        expiresAt: vencimento.toISOString(),
        avisoVencimento: ''
    });

}

function buscarAssinaturaPorId(id) {

    const store = lerStore();

    return store.assinaturas[String(id || '')] || null;

}

function buscarAssinaturaPorNumero(numero, telefone) {

    const store = lerStore();
    const candidatos = [
        limparNumero(telefone),
        limparNumero(numero)
    ].filter(Boolean);

    for (const candidato of candidatos) {

        const id = store.telefones[candidato];

        if (id && store.assinaturas[id]) return store.assinaturas[id];

    }

    return Object.values(store.assinaturas || {}).find(assinatura => {
        const numeros = [
            limparNumero(assinatura.telefone),
            limparNumero(assinatura.numero)
        ];

        return candidatos.some(candidato => numeros.includes(candidato));
    }) || null;

}

function renovarAssinatura(id, {
    plano,
    vendaReference,
    paymentId
} = {}) {

    const assinatura = buscarAssinaturaPorId(id);

    if (!assinatura) return null;

    const agora = new Date();
    const vencimentoAtual = normalizarData(assinatura.expiresAt) || agora;
    const base = vencimentoAtual > agora ? vencimentoAtual : agora;
    const novoVencimento = adicionarDias(base, diasDoPlano(plano));

    return salvarAssinatura({
        ...assinatura,
        plano: plano || assinatura.plano,
        status: 'ativa',
        expiresAt: novoVencimento.toISOString(),
        avisoVencimento: '',
        cancelamento: null,
        ultimaRenovacao: {
            vendaReference,
            paymentId,
            renovadoEm: agora.toISOString(),
            vencimentoAnterior: vencimentoAtual.toISOString(),
            novoVencimento: novoVencimento.toISOString()
        }
    });

}

function listarVencendoEmAteHoras(horas = 24) {

    const agora = new Date();
    const limite = new Date(agora.getTime() + Number(horas) * 60 * 60 * 1000);
    const store = lerStore();

    return Object.values(store.assinaturas || {}).filter(assinatura => {
        if (assinatura.status !== 'ativa') return false;
        if (assinatura.origem === 'teste_gratis') return false;

        const vencimento = normalizarData(assinatura.expiresAt);
        if (!vencimento) return false;
        if (vencimento <= agora || vencimento > limite) return false;

        return assinatura.avisoVencimento !== vencimento.toISOString();
    });

}

function marcarAvisoVencimento(id, expiresAt) {

    const assinatura = buscarAssinaturaPorId(id);

    if (!assinatura) return null;

    return salvarAssinatura({
        ...assinatura,
        avisoVencimento: normalizarData(expiresAt)?.toISOString() || String(expiresAt || '')
    });

}

function cancelarAssinaturaPorNumero(numero, motivo = '') {

    const assinatura = buscarAssinaturaPorNumero(numero);

    if (!assinatura) return null;

    return salvarAssinatura({
        ...assinatura,
        status: 'cancelada',
        cancelamento: {
            motivo,
            canceladoEm: new Date().toISOString()
        }
    });

}

module.exports = {
    adicionarDias,
    buscarAssinaturaPorId,
    buscarAssinaturaPorNumero,
    cancelarAssinaturaPorNumero,
    diasDoPlano,
    formatarData,
    listarVencendoEmAteHoras,
    marcarAvisoVencimento,
    registrarAssinatura,
    renovarAssinatura
};
