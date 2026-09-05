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

function limparNumero(valor) {

    return String(valor || '')
        .replace('@c.us', '')
        .replace(/\D/g, '');

}

function lista(valor) {

    if (Array.isArray(valor)) {

        return valor
            .map(item => String(item || '').trim())
            .filter(Boolean);

    }

    return String(valor || '')
        .split(/[;,]/)
        .map(item => item.trim())
        .filter(Boolean);

}

function contatosPagamento(pagamento) {

    const contatos = [];

    for (const valor of [
        pagamento?.numero,
        pagamento?.telefone
    ]) {

        const texto = String(valor || '').trim();
        const telefone = limparNumero(texto);

        if (texto) contatos.push(texto);
        if (telefone) {
            contatos.push(telefone);
            contatos.push(`${telefone}@c.us`);
        }

    }

    return [...new Set(contatos)];

}

function pertenceAoContato(pagamento, ...contatos) {

    const contatosPagamentoAtual = contatosPagamento(pagamento);
    const candidatos = contatos
        .flatMap(contato => {
            const texto = String(contato || '').trim();
            const telefone = limparNumero(texto);

            return [
                texto,
                telefone,
                telefone ? `${telefone}@c.us` : ''
            ].filter(Boolean);
        });

    return candidatos.some(candidato =>
        contatosPagamentoAtual.includes(candidato)
    );

}

function ordenarMaisRecentes(pagamentos) {

    return pagamentos.sort((a, b) =>
        new Date(b.atualizadoEm || b.criadoEm || 0).getTime() -
        new Date(a.atualizadoEm || a.criadoEm || 0).getTime()
    );

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
        nome: dados.nome || '',
        usuario: dados.usuario || '',
        assinaturaId: dados.assinaturaId || '',
        assinaturaIds: lista(dados.assinaturaIds || dados.assinaturaId),
        resumo: dados.resumo || '',
        status: 'pendente',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        respondidoEm: '',
        respostaAdmin: '',
        comprovantes: []
    };

    salvarStore(store);

    return store.pagamentos[codigo];

}

function buscarPagamentoInformado(codigo) {

    const store = lerStore();

    return store.pagamentos[String(codigo || '').trim().toUpperCase()] || null;

}

function atualizarPagamentoInformado(codigo, campos = {}) {

    const chave = String(codigo || '').trim().toUpperCase();
    const store = lerStore();
    const pagamento = store.pagamentos[chave];

    if (!pagamento) return null;

    store.pagamentos[chave] = {
        ...pagamento,
        ...campos,
        atualizadoEm: new Date().toISOString()
    };

    salvarStore(store);

    return store.pagamentos[chave];

}

function responderPagamentoInformado(codigo, aprovado, extras = {}) {

    return atualizarPagamentoInformado(
        codigo,
        {
            ...extras,
            status: aprovado ? 'confirmado' : 'nao_encontrado',
            respondidoEm: new Date().toISOString(),
            respostaAdmin: aprovado ? 'sim' : 'nao'
        }
    );

}

function marcarPagamentoAguardandoComprovante(codigo) {

    return atualizarPagamentoInformado(
        codigo,
        {
            status: 'aguardando_comprovante',
            respostaAdmin: 'nao',
            respondidoEm: new Date().toISOString()
        }
    );

}

function marcarComprovantePagamento(codigo, dados = {}) {

    const pagamento = buscarPagamentoInformado(codigo);

    if (!pagamento) return null;

    const comprovantes = Array.isArray(pagamento.comprovantes) ?
        pagamento.comprovantes :
        [];

    return atualizarPagamentoInformado(
        codigo,
        {
            status: 'comprovante_enviado',
            comprovantes: [
                ...comprovantes,
                {
                    recebidoEm: new Date().toISOString(),
                    tipo: dados.tipo || '',
                    id: dados.id || '',
                    texto: dados.texto || ''
                }
            ]
        }
    );

}

function buscarPagamentoAguardandoComprovante(numero, telefone) {

    const store = lerStore();

    return ordenarMaisRecentes(
        Object.values(store.pagamentos || {}).filter(pagamento =>
            pagamento.status === 'aguardando_comprovante' &&
            pertenceAoContato(
                pagamento,
                numero,
                telefone
            )
        )
    )[0] || null;

}

function buscarPagamentoPendenteValidacao() {

    const store = lerStore();
    const pendentes = new Set([
        'pendente',
        'comprovante_enviado'
    ]);

    return ordenarMaisRecentes(
        Object.values(store.pagamentos || {}).filter(pagamento =>
            pendentes.has(pagamento.status)
        )
    )[0] || null;

}

module.exports = {
    buscarPagamentoAguardandoComprovante,
    buscarPagamentoInformado,
    buscarPagamentoPendenteValidacao,
    marcarComprovantePagamento,
    marcarPagamentoAguardandoComprovante,
    registrarPagamentoInformado,
    responderPagamentoInformado
};
