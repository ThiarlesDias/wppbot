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

function montarMensagemTeste(dados) {

    const payload = dados?.data || dados || {};
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
    tipo
}) {

    const telefoneLimpo = normalizarTelefoneBrasil(telefone);
    const url = urlPorTipo(tipo);

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
            body: JSON.stringify({
                name: nome || `WhatsApp ${telefoneLimpo}`,
                whatsapp: telefoneLimpo,
                phone: telefoneLimpo,
                number: telefoneLimpo,
                message: telefoneLimpo
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

    const payload = dados?.data || dados || {};
    const mensagem = montarMensagemTeste(payload);
    const usuario = payload.username || payload.usuario || payload.user || '';

    if (!mensagem && !usuario) {
        throw new Error('Chatbot revenda nao retornou dados do teste.');
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
