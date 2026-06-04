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

function listaIdsTelefone(valor) {

    if (Array.isArray(valor)) {

        return valor
            .map(item => String(item || '').trim())
            .filter(Boolean);

    }

    if (valor) return [String(valor).trim()].filter(Boolean);

    return [];

}

function vincularTelefone(store, telefone, id) {

    if (!telefone || !id) return;

    const ids = listaIdsTelefone(store.telefones[telefone]);

    if (!ids.includes(id)) ids.push(id);

    store.telefones[telefone] = ids;

}

function desvincularTelefone(store, telefone, id) {

    if (!telefone || !id) return;

    const ids = listaIdsTelefone(store.telefones[telefone])
        .filter(item => item !== id);

    if (ids.length) {

        store.telefones[telefone] = ids;

    } else {

        delete store.telefones[telefone];

    }

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

    if (atual.telefone && atual.telefone !== telefone) {

        desvincularTelefone(
            store,
            limparNumero(atual.telefone),
            id
        );

    }

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

    vincularTelefone(
        store,
        telefone,
        id
    );

    salvarStore(store);

    return store.assinaturas[id];

}

function registrarAssinatura({
    numero,
    telefone,
    nome,
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
        nome: nome || '',
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

    return buscarAssinaturasPorNumero(
        numero,
        telefone
    )[0] || null;

}

function buscarAssinaturasPorNumero(numero, telefone) {

    const store = lerStore();
    const candidatos = [
        limparNumero(telefone),
        limparNumero(numero)
    ].filter(Boolean);

    for (const candidato of candidatos) {

        const ids = listaIdsTelefone(store.telefones[candidato]);
        const assinaturas = ids
            .map(id => store.assinaturas[id])
            .filter(Boolean);

        if (assinaturas.length) return assinaturas;

    }

    return Object.values(store.assinaturas || {}).filter(assinatura => {
        const numeros = [
            limparNumero(assinatura.telefone),
            limparNumero(assinatura.numero)
        ];

        return candidatos.some(candidato => numeros.includes(candidato));
    });

}

function renovarAssinatura(id, {
    plano,
    nome,
    email,
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
        nome: nome || assinatura.nome || '',
        email: email || assinatura.email || '',
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

function chaveDiaSaoPaulo(valor) {

    const data = normalizarData(valor);

    if (!data) return '';

    const partes = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.year}-${partes.month}-${partes.day}`;

}

function listarVencendoNoDia(dia) {

    const chaveDia = chaveDiaSaoPaulo(dia);
    const store = lerStore();

    return Object.values(store.assinaturas || {}).filter(assinatura => {
        if (assinatura.status !== 'ativa') return false;
        if (assinatura.origem === 'teste_gratis') return false;

        const vencimento = normalizarData(assinatura.expiresAt);
        if (!vencimento) return false;
        if (chaveDiaSaoPaulo(vencimento) !== chaveDia) return false;

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
    buscarAssinaturasPorNumero,
    cancelarAssinaturaPorNumero,
    diasDoPlano,
    formatarData,
    listarVencendoEmAteHoras,
    listarVencendoNoDia,
    marcarAvisoVencimento,
    registrarAssinatura,
    renovarAssinatura
};
