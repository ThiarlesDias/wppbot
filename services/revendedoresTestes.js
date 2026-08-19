const URL_COM_ADULTOS =
    process.env.REVENDA_TESTE_COM_ADULTOS_URL ||
    'https://painelblackbr.com/api/chatbot/loL7vZl1XM/ayb1B3ELPR';
const URL_SEM_ADULTOS =
    process.env.REVENDA_TESTE_SEM_ADULTOS_URL ||
    'https://painelblackbr.com/api/chatbot/loL7vZl1XM/Kr6LJXEWv9';

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function normalizarTelefoneBrasil(valor) {

    const limpo = limparNumero(valor);
    let local = limpo;

    if (
        limpo.startsWith('55') &&
        (limpo.length === 12 || limpo.length === 13)
    ) {
        local = limpo.slice(2);
    }

    if (local.length === 10) {
        local = `${local.slice(0, 2)}9${local.slice(2)}`;
    }

    if (
        (local.length === 10 || local.length === 11) &&
        !local.startsWith('55')
    ) {
        return `55${local}`;
    }

    return limpo;

}

function urlPorTipo(tipo) {

    return String(tipo || '').includes('sem') ?
        URL_SEM_ADULTOS :
        URL_COM_ADULTOS;

}

function limparTexto(valor) {

    return String(valor || '').trim();

}

function removerVazios(objeto) {

    return Object.fromEntries(
        Object.entries(objeto).filter(([, valor]) =>
            valor !== undefined &&
            valor !== null &&
            String(valor).trim() !== ''
        )
    );

}

function montarOrigemRevendedor({ nome, telefone, revendedor }) {

    const revendedorNome = limparTexto(revendedor?.nome);
    const revendedorTelefone = normalizarTelefoneBrasil(revendedor?.telefone);
    const linhas = [
        revendedorNome ? `Revendedor: ${revendedorNome}` : '',
        revendedorTelefone ? `WhatsApp revendedor: ${revendedorTelefone}` : '',
        nome ? `Cliente: ${nome}` : '',
        telefone ? `WhatsApp cliente: ${telefone}` : ''
    ].filter(Boolean);

    return {
        texto: linhas.join(' | '),
        revendedorNome,
        revendedorTelefone
    };

}

function textoComDadosAcesso(texto) {

    const valor = String(texto || '').trim();

    if (!valor) return '';

    return /usuario|usu[aá]rio|senha|m3u|xciptv|smarters|get\.php|dns/i.test(valor) ?
        valor :
        '';

}

function primeiroValor(objeto, campos) {

    for (const campo of campos) {
        const valor = objeto?.[campo];

        if (valor !== undefined && valor !== null && String(valor).trim()) {
            return String(valor).trim();
        }
    }

    return '';

}

function extrairPayloadTeste(dados, visitados = new Set()) {

    if (!dados) return null;

    if (typeof dados === 'string') {
        const template = textoComDadosAcesso(dados);

        return template ? { template } : null;
    }

    if (typeof dados !== 'object') return null;

    if (visitados.has(dados)) return null;
    visitados.add(dados);

    if (Array.isArray(dados)) {
        for (const item of dados) {
            const payload = extrairPayloadTeste(
                item,
                visitados
            );

            if (payload) return payload;
        }

        return null;
    }

    const template = textoComDadosAcesso(
        dados.template ||
        dados.message ||
        dados.mensagem ||
        dados.text ||
        dados.body
    );
    const usuario = primeiroValor(
        dados,
        [
            'username',
            'usuario',
            'user',
            'login',
            'name'
        ]
    );
    const senha = primeiroValor(
        dados,
        [
            'password',
            'senha',
            'pass'
        ]
    );

    if (template || (usuario && senha)) {
        return {
            ...dados,
            ...(template ? { template } : {}),
            username: usuario || dados.username,
            password: senha || dados.password
        };
    }

    const chavesPrioritarias = [
        'data',
        'result',
        'resultado',
        'teste',
        'trial',
        'customer',
        'cliente',
        'playlist',
        'account',
        'credentials',
        'response'
    ];

    for (const chave of chavesPrioritarias) {
        const payload = extrairPayloadTeste(
            dados[chave],
            visitados
        );

        if (payload) return payload;
    }

    for (const valor of Object.values(dados)) {
        const payload = extrairPayloadTeste(
            valor,
            visitados
        );

        if (payload) return payload;
    }

    return null;

}

function resumirResposta(dados) {

    if (typeof dados === 'string') return dados.slice(0, 500);

    try {
        return JSON.stringify(dados).slice(0, 500);
    } catch (_) {
        return String(dados || '').slice(0, 500);
    }

}

function montarMensagemTeste(dados) {

    const payload = extrairPayloadTeste(dados) || dados?.data || dados || {};
    const usuario = payload.username || payload.usuario || payload.user || '';
    const senha = payload.password || payload.senha || payload.pass || '';
    const dns = String(payload.dns || payload.server || payload.host || '').replace(/\/$/, '');
    const dnsComBarra = dns ? `${dns}/` : '';
    const linkM3u = payload.m3u ||
        payload.linkM3u ||
        payload.link_m3u ||
        (
            dns && usuario && senha ?
                `${dns}/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=mpegts` :
                ''
        );

    if (payload.template && typeof payload.template === 'string') return payload.template;

    if (!usuario || !senha) return '';

    return [
        '*Segue os Dados De Acesso*',
        `✅ *Usuario:* ${usuario}`,
        `✅ *Senha:* ${senha}`,
        '',
        dnsComBarra ? `🟠 *DNS XCIPTV:* ${dnsComBarra}` : '',
        dnsComBarra ? `🟠 *DNS SMARTERS:* ${dnsComBarra}` : '',
        '',
        linkM3u ? `🟢 *Link (M3U):* ${linkM3u}` : ''
    ].filter(Boolean).join('\n');

}

async function criarTesteRevendedor({
    nome,
    telefone,
    tipo,
    revendedor
}) {

    const telefoneLimpo = normalizarTelefoneBrasil(telefone);
    const url = urlPorTipo(tipo);
    const origem = montarOrigemRevendedor({
        nome,
        telefone: telefoneLimpo,
        revendedor
    });

    if (!url) {
        throw new Error('Link de criacao de teste da revenda nao configurado.');
    }

    const resposta = await fetch(
        url,
        {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
            },
            body: JSON.stringify(removerVazios({
                name: nome || `WhatsApp ${telefoneLimpo}`,
                whatsapp: telefoneLimpo,
                phone: telefoneLimpo,
                number: telefoneLimpo,
                message: origem.texto || telefoneLimpo,
                note: origem.texto,
                notes: origem.texto,
                observacao: origem.texto,
                observation: origem.texto,
                description: origem.texto,
                descricao: origem.texto,
                source: 'Revendedor TOPTEC',
                origin: 'Revendedor TOPTEC',
                reseller: origem.revendedorNome,
                reseller_name: origem.revendedorNome,
                revendedor: origem.revendedorNome,
                revendedor_nome: origem.revendedorNome,
                reseller_phone: origem.revendedorTelefone,
                revendedor_telefone: origem.revendedorTelefone
            }))
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
        throw new Error('O link da revenda retornou HTML/Cloudflare em vez de JSON.');
    }

    if (!resposta.ok) {
        const detalheErro =
            dados?.message ||
            dados?.errors?.[0] ||
            texto.slice(0, 200) ||
            `Erro chatbot revenda: ${resposta.status}`;

        throw new Error(
            `URL: ${url} | Status: ${resposta.status} | ${detalheErro}`
        );
    }

    const payload = extrairPayloadTeste(dados);

    if (!payload) {
        throw new Error(
            `Chatbot revenda nao retornou dados do teste. Resposta: ${resumirResposta(dados)}`
        );
    }

    const mensagem = montarMensagemTeste(payload);
    const usuario = payload.username || payload.usuario || payload.user || '';

    if (!mensagem && !usuario) {
        throw new Error(
            `Chatbot revenda nao retornou usuario/senha. Resposta: ${resumirResposta(dados)}`
        );
    }

    return {
        dados,
        mensagem,
        usuario,
        senha: payload.password || payload.senha || payload.pass || '',
        url
    };

}

module.exports = {
    criarTesteRevendedor,
    montarMensagemTeste
};
