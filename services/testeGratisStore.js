const fs = require('fs');
const path = require('path');
const {
    limparNumero
} = require('./sigma');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'testes-gratis.json');

function garantirStore() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(DATA_DIR, {
            recursive: true
        });

    }

    if (!fs.existsSync(STORE_PATH)) {

        fs.writeFileSync(
            STORE_PATH,
            JSON.stringify({
                telefones: {}
            }, null, 2)
        );

    }

}

function lerStore() {

    garantirStore();

    try {

        return JSON.parse(
            fs.readFileSync(STORE_PATH, 'utf8')
        );

    } catch (_) {

        return {
            telefones: {}
        };

    }

}

function salvarStore(store) {

    garantirStore();

    fs.writeFileSync(
        STORE_PATH,
        JSON.stringify(store, null, 2)
    );

}

function obterTeste(numero) {

    const telefone = limparNumero(numero);
    const store = lerStore();

    return store.telefones[telefone] || null;

}

function iniciarTeste(numero) {

    const telefone = limparNumero(numero);
    const store = lerStore();
    const existente = store.telefones[telefone];

    if (existente) {

        return {
            permitido: false,
            telefone,
            teste: existente
        };

    }

    const teste = {
        telefone,
        status: 'processando',
        criado_em: new Date().toISOString()
    };

    store.telefones[telefone] = teste;
    salvarStore(store);

    return {
        permitido: true,
        telefone,
        teste
    };

}

function concluirTeste(numero, dados = {}) {

    const telefone = limparNumero(numero);
    const store = lerStore();

    store.telefones[telefone] = {
        ...(store.telefones[telefone] || {}),
        telefone,
        status: 'criado',
        customer_id: dados.customer_id,
        username: dados.username,
        criado_em: store.telefones[telefone]?.criado_em || new Date().toISOString(),
        concluido_em: new Date().toISOString()
    };

    salvarStore(store);

    return store.telefones[telefone];

}

function registrarSolicitacaoManual(numero) {

    const telefone = limparNumero(numero);
    const store = lerStore();

    store.telefones[telefone] = {
        ...(store.telefones[telefone] || {}),
        telefone,
        status: 'solicitado',
        criado_em: store.telefones[telefone]?.criado_em || new Date().toISOString(),
        atualizado_em: new Date().toISOString()
    };

    salvarStore(store);

    return store.telefones[telefone];

}

function falharTeste(numero) {

    const telefone = limparNumero(numero);
    const store = lerStore();

    if (store.telefones[telefone]?.status === 'processando') {

        delete store.telefones[telefone];
        salvarStore(store);

    }

}

module.exports = {
    obterTeste,
    iniciarTeste,
    concluirTeste,
    registrarSolicitacaoManual,
    falharTeste
};
