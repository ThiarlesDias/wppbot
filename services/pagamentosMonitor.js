const {
    listarVendasPendentes,
    atualizarVenda,
    buscarPagamentoPorReferencia
} = require('./mercadopago');
const {
    criarTesteGratis
} = require('./sigma');
const {
    enviarConfirmacaoCliente,
    enviarNovaVendaAdmin
} = require('./resend');
const notificar = require('./notificador');

const INTERVALO_MS = Number(process.env.MP_MONITOR_INTERVAL_MS || 60000);

let monitorIniciado = false;

function descricaoMetodo(metodo) {

    if (metodo === 'pix') return 'PIX';
    if (metodo === 'cartao') return 'Cartao';
    if (metodo === 'boleto') return 'Boleto';

    return metodo || 'Mercado Pago';

}

function formatarValor(valor) {

    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

}

function dadosPagador(pagamento) {

    const payer = pagamento?.payer || {};
    const nome = [
        payer.first_name,
        payer.last_name
    ].filter(Boolean).join(' ');

    return {
        nome: nome || payer.name || '',
        email: payer.email || ''
    };

}

function extrairCredenciais(teste) {

    const username = teste?.cliente?.username || teste?.playlist?.username || '';
    const password = teste?.cliente?.password || teste?.playlist?.password || '';
    const dns = String(teste?.playlist?.dns || '').replace(/\/$/, '');
    const dnsComBarra = dns ? `${dns}/` : '';
    const linkM3u = dns && username && password ?
        `${dns}/get.php?username=${username}&password=${password}&type=m3u_plus&output=mpegts` :
        '';

    return {
        username,
        password,
        dns: dnsComBarra,
        linkM3u
    };

}

async function gerarCredenciaisVenda(venda) {

    const numeroTeste = venda.telefone || venda.numero;
    const teste = await criarTesteGratis(numeroTeste);
    const credenciais = extrairCredenciais(teste);

    if (!credenciais.username || !credenciais.password) {

        throw new Error('Sigma nao retornou usuario/senha para a venda aprovada.');

    }

    return credenciais;

}

async function enviarEmailsVenda(venda, pagamento, credenciais, pagador) {

    if (pagador.email) {

        await enviarConfirmacaoCliente({
            email: pagador.email,
            nome: pagador.nome,
            venda,
            credenciais
        });

    }

    await enviarNovaVendaAdmin({
        venda,
        pagamento,
        credenciais,
        pagador
    });

}

async function verificarVenda(client, venda) {

    const pagamento = await buscarPagamentoPorReferencia(venda.reference);

    if (!pagamento) return;

    const status = pagamento.status;

    if (status === 'approved') {

        const pagador = dadosPagador(pagamento);
        const credenciais = venda.credenciais?.username ?
            venda.credenciais :
            await gerarCredenciaisVenda(venda);

        const atualizada = atualizarVenda(
            venda.reference,
            {
                status: 'approved',
                payment_id: pagamento.id,
                payment_status: pagamento.status,
                payment_status_detail: pagamento.status_detail,
                paid_at: new Date().toISOString(),
                payer_email: pagador.email,
                payer_name: pagador.nome,
                credenciais
            }
        );

        await client.sendText(
            venda.numero,

`✅ *Pagamento recebido!*

Plano: ${venda.plano}
Valor: ${formatarValor(venda.valor)}
Forma: ${descricaoMetodo(venda.metodo)}

Seus dados de acesso foram enviados por email.
Nossa equipe tambem foi avisada para finalizar a ativacao.`
        );

        try {

            await enviarEmailsVenda(
                venda,
                pagamento,
                credenciais,
                pagador
            );

        } catch (erro) {

            console.log('ERRO EMAIL VENDA', erro.message);

        }

        await notificar(
            client,
            'PAGAMENTO APROVADO',

`Cliente:
${venda.numero}

Plano:
${venda.plano}

Valor:
${formatarValor(venda.valor)}

Forma:
${descricaoMetodo(venda.metodo)}

Pagador:
${pagador.nome || 'Nao informado'}

Email:
${pagador.email || 'Nao informado'}

Usuario:
${credenciais.username}

Senha:
${credenciais.password}

Referencia:
${venda.reference}

Pagamento Mercado Pago:
${pagamento.id}`
        );

        console.log(
            'PAGAMENTO APROVADO',
            atualizada.reference,
            pagamento.id
        );

        return;

    }

    if (
        status === 'cancelled' ||
        status === 'rejected' ||
        status === 'refunded' ||
        status === 'charged_back'
    ) {

        atualizarVenda(
            venda.reference,
            {
                status,
                payment_id: pagamento.id,
                payment_status: pagamento.status,
                payment_status_detail: pagamento.status_detail
            }
        );

    }

}

async function verificarPagamentos(client) {

    let vendas;

    try {

        vendas = listarVendasPendentes();

    } catch (erro) {

        console.log('ERRO LISTAR VENDAS MP', erro.message);
        return;

    }

    for (const venda of vendas) {

        try {

            await verificarVenda(
                client,
                venda
            );

        } catch (erro) {

            console.log(
                'ERRO MONITOR MP',
                venda.reference,
                erro.message
            );

        }

    }

}

function iniciarMonitorPagamentos(client) {

    if (monitorIniciado) return;

    monitorIniciado = true;

    setTimeout(
        () => verificarPagamentos(client),
        15000
    );

    setInterval(
        () => verificarPagamentos(client),
        INTERVALO_MS
    );

    console.log('MONITOR MERCADO PAGO ATIVO');

}

module.exports = iniciarMonitorPagamentos;
