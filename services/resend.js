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

function resendKey() {

    return process.env.RESEND_API_KEY || '';

}

function emailClienteFrom() {

    return process.env.RESEND_CLIENT_FROM ||
    'TopTec Oficial <toptecoficial@toptecdigital.com>';

}

function emailVendasFrom() {

    return process.env.RESEND_SALES_FROM ||
    'TopTec Vendas <vendas@toptecdigital.com>';

}

function emailVendasTo() {

    return process.env.SALES_NOTIFY_EMAIL ||
    'vendas@toptecdigital.com';

}

async function enviarEmail({
    from,
    to,
    subject,
    html,
    text
}) {

    if (!resendKey()) {

        console.log('RESEND_API_KEY nao configurado; email ignorado.');
        return null;

    }

    if (!to) {

        console.log('Destinatario de email vazio; email ignorado.');
        return null;

    }

    const resposta = await fetch(
        'https://api.resend.com/emails',
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${resendKey()}`,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                from,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text
            })
        }
    );

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {

        throw new Error(
            dados?.message ||
            dados?.error ||
            `Erro Resend: ${resposta.status}`
        );

    }

    return dados;

}

function formatarValor(valor) {

    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

}

function textoAcesso(credenciais) {

    return [
        `Usuario: ${credenciais.username || ''}`,
        `Senha: ${credenciais.password || ''}`,
        credenciais.dns ? `DNS: ${credenciais.dns}` : '',
        credenciais.linkM3u ? `Link M3U: ${credenciais.linkM3u}` : ''
    ].filter(Boolean).join('\n');

}

function htmlAcesso(credenciais) {

    return [
        `<p><strong>Usuario:</strong> ${credenciais.username || ''}</p>`,
        `<p><strong>Senha:</strong> ${credenciais.password || ''}</p>`,
        credenciais.dns ? `<p><strong>DNS:</strong> ${credenciais.dns}</p>` : '',
        credenciais.linkM3u ?
            `<p><strong>Link M3U:</strong><br><a href="${credenciais.linkM3u}">${credenciais.linkM3u}</a></p>` :
            ''
    ].filter(Boolean).join('\n');

}

async function enviarConfirmacaoCliente({
    email,
    nome,
    venda,
    credenciais
}) {

    const subject = `Pagamento confirmado - ${venda.plano}`;
    const valor = formatarValor(venda.valor);
    const saudacao = nome ? `Olá, ${nome}!` : 'Olá!';

    return await enviarEmail({
        from: emailClienteFrom(),
        to: email,
        subject,
        text:
`${saudacao}

Seu pagamento foi confirmado.

Item: ${venda.plano}
Valor: ${valor}
Forma de pagamento: ${venda.metodo}

Dados de acesso:
${textoAcesso(credenciais)}

Nossa equipe tambem foi avisada para finalizar a ativacao.`,
        html:
`<h2>Pagamento confirmado</h2>
<p>${saudacao}</p>
<p>Seu pagamento foi confirmado.</p>
<p><strong>Item:</strong> ${venda.plano}</p>
<p><strong>Valor:</strong> ${valor}</p>
<p><strong>Forma de pagamento:</strong> ${venda.metodo}</p>
<h3>Dados de acesso</h3>
${htmlAcesso(credenciais)}
<p>Nossa equipe tambem foi avisada para finalizar a ativacao.</p>`
    });

}

async function enviarNovaVendaAdmin({
    venda,
    pagamento,
    credenciais,
    pagador
}) {

    const valor = formatarValor(venda.valor);
    const nomePagador = pagador.nome || 'Nao informado';
    const emailPagador = pagador.email || 'Nao informado';

    return await enviarEmail({
        from: emailVendasFrom(),
        to: emailVendasTo(),
        subject: `NOVA VENDA - ${venda.plano}`,
        text:
`NOVA VENDA

Item: ${venda.plano}
Valor: ${valor}
Forma: ${venda.metodo}

Nome do pagador: ${nomePagador}
Email do pagador: ${emailPagador}
WhatsApp: ${venda.numero}

Usuario: ${credenciais.username || ''}
Senha: ${credenciais.password || ''}

Referencia: ${venda.reference}
Pagamento Mercado Pago: ${pagamento.id}`,
        html:
`<h2>NOVA VENDA</h2>
<p><strong>Item:</strong> ${venda.plano}</p>
<p><strong>Valor:</strong> ${valor}</p>
<p><strong>Forma:</strong> ${venda.metodo}</p>
<p><strong>Nome do pagador:</strong> ${nomePagador}</p>
<p><strong>Email do pagador:</strong> ${emailPagador}</p>
<p><strong>WhatsApp:</strong> ${venda.numero}</p>
<h3>Dados para ativacao manual</h3>
${htmlAcesso(credenciais)}
<p><strong>Referencia:</strong> ${venda.reference}</p>
<p><strong>Pagamento Mercado Pago:</strong> ${pagamento.id}</p>`
    });

}

module.exports = {
    enviarConfirmacaoCliente,
    enviarNovaVendaAdmin
};
