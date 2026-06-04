const {
    listarVendasPendentes,
    atualizarVenda,
    buscarPagamentoPorReferencia
} = require('./mercadopago');
const notificar = require('./notificador');

const INTERVALO_MS = Number(process.env.MP_MONITOR_INTERVAL_MS || 60000);

let monitorIniciado = false;

function descricaoMetodo(metodo) {

    if (metodo === 'pix') return 'PIX';
    if (metodo === 'cartao') return 'Cartao';
    if (metodo === 'boleto') return 'Boleto';

    return metodo || 'Mercado Pago';

}

async function verificarVenda(client, venda) {

    const pagamento = await buscarPagamentoPorReferencia(venda.reference);

    if (!pagamento) return;

    const status = pagamento.status;

    if (status === 'approved') {

        const atualizada = atualizarVenda(
            venda.reference,
            {
                status: 'approved',
                payment_id: pagamento.id,
                payment_status: pagamento.status,
                payment_status_detail: pagamento.status_detail,
                paid_at: new Date().toISOString()
            }
        );

        await client.sendText(
            venda.numero,

`✅ *Pagamento recebido!*

Plano: ${venda.plano}
Valor: R$ ${venda.valor.toFixed(2).replace('.', ',')}
Forma: ${descricaoMetodo(venda.metodo)}

Nossa equipe foi avisada e vai ativar seu acesso.`
        );

        await notificar(
            client,
            'PAGAMENTO APROVADO',

`Cliente:
${venda.numero}

Plano:
${venda.plano}

Valor:
R$ ${venda.valor.toFixed(2).replace('.', ',')}

Forma:
${descricaoMetodo(venda.metodo)}

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
