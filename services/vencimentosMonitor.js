const sessoes = require('./sessions');
const {
    formatarData,
    listarVencendoEmAteHoras,
    marcarAvisoVencimento
} = require('./assinaturasStore');
const {
    enviarAvisoVencimentoCliente
} = require('./resend');
const notificar = require('./notificador');

const INTERVALO_MS = Number(process.env.VENCIMENTOS_MONITOR_INTERVAL_MS || 60 * 60 * 1000);
const ANTECEDENCIA_HORAS = Number(process.env.VENCIMENTOS_AVISO_HORAS || 24);

let monitorIniciado = false;

function mensagemAviso(assinatura) {

    return [
        '⏰ *Seu acesso vence amanha*',
        '',
        `Usuario: ${assinatura.username}`,
        `Vencimento: ${formatarData(assinatura.expiresAt)}`,
        '',
        'Renovando agora, voce mantem o mesmo usuario e os dias sao somados no vencimento atual assim que o pagamento for confirmado.',
        '',
        '1️⃣ Renovar agora',
        '2️⃣ Cancelar minha assinatura',
        '0️⃣ Voltar ao menu'
    ].join('\n');

}

async function avisarAssinatura(client, assinatura) {

    if (!assinatura.numero) return;

    await client.sendText(
        assinatura.numero,
        mensagemAviso(assinatura)
    );

    sessoes[assinatura.numero] = 'vencimento_aviso';

    if (assinatura.email) {

        try {

            await enviarAvisoVencimentoCliente({
                email: assinatura.email,
                assinatura,
                vencimento: formatarData(assinatura.expiresAt)
            });

        } catch (erro) {

            console.log('ERRO EMAIL VENCIMENTO', erro.message);

        }

    }

    await notificar(
        client,
        'AVISO DE VENCIMENTO ENVIADO',

`Cliente:
${assinatura.numero}

WhatsApp:
${assinatura.telefone || 'Nao informado'}

Usuario:
${assinatura.username}

Vencimento:
${formatarData(assinatura.expiresAt)}

Email:
${assinatura.email || 'Nao informado'}`
    );

    marcarAvisoVencimento(
        assinatura.id,
        assinatura.expiresAt
    );

}

async function verificarVencimentos(client) {

    let assinaturas;

    try {

        assinaturas = listarVencendoEmAteHoras(ANTECEDENCIA_HORAS);

    } catch (erro) {

        console.log('ERRO LISTAR VENCIMENTOS', erro.message);
        return;

    }

    for (const assinatura of assinaturas) {

        try {

            await avisarAssinatura(
                client,
                assinatura
            );

        } catch (erro) {

            console.log(
                'ERRO AVISO VENCIMENTO',
                assinatura.id,
                erro.message
            );

        }

    }

}

function iniciarMonitorVencimentos(client) {

    if (monitorIniciado) return;

    monitorIniciado = true;

    setTimeout(
        () => verificarVencimentos(client),
        30000
    );

    setInterval(
        () => verificarVencimentos(client),
        INTERVALO_MS
    );

    console.log('MONITOR VENCIMENTOS ATIVO');

}

module.exports = iniciarMonitorVencimentos;
