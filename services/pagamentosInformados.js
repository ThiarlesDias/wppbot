const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'pagamentos-informados.json');

function garantirStore() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

}

function lerStore() {

    garantirStore();

    if (!fs.existsSync(STORE_PATH)) {

        return {
            pagamentos: {}
        };

    }

    try {

        const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

        return {
            pagamentos: store.pagamentos || {}
        };

    } catch (_) {

        return {
            pagamentos: {}
        };

    }

}

function salvarStore(store) {

    garantirStore();

    fs.writeFileSync(
        STORE_PATH,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                pagamentos: store.pagamentos || {}
            },
            null,
            2
        )
    );

}

function gerarCodigo() {

    return Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

}

function registrarPagamentoInformado(dados) {

    const store = lerStore();
    let codigo = gerarCodigo();

    while (store.pagamentos[codigo]) {
        codigo = gerarCodigo();
    }

    store.pagamentos[codigo] = {
        codigo,
        numero: dados.numero || '',
        telefone: dados.telefone || '',
        resumo: dados.resumo || '',
        status: 'pendente',
        criadoEm: new Date().toISOString(),
        respondidoEm: '',
        respostaAdmin: ''
    };

    salvarStore(store);

    return store.pagamentos[codigo];

}

function buscarPagamentoInformado(codigo) {

    const store = lerStore();

    return store.pagamentos[String(codigo || '').trim().toUpperCase()] || null;

}

function responderPagamentoInformado(codigo, aprovado) {

    const chave = String(codigo || '').trim().toUpperCase();
    const store = lerStore();
    const pagamento = store.pagamentos[chave];

    if (!pagamento) return null;

    store.pagamentos[chave] = {
        ...pagamento,
        status: aprovado ? 'confirmado' : 'nao_encontrado',
        respondidoEm: new Date().toISOString(),
        respostaAdmin: aprovado ? 'sim' : 'nao'
    };

    salvarStore(store);

    return store.pagamentos[chave];

}

module.exports = {
    buscarPagamentoInformado,
    registrarPagamentoInformado,
    responderPagamentoInformado
};
