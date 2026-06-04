const sessoes = require('./sessions');
const {
    formatarData,
    listarVencendoNoDia,
    marcarAvisoVencimento
} = require('./assinaturasStore');
const {
    enviarAvisoVencimentoCliente
} = require('./resend');
const notificar = require('./notificador');

const HORA_ENVIO = Number(process.env.VENCIMENTOS_ENVIO_HORA || 10);
const MINUTO_ENVIO = Number(process.env.VENCIMENTOS_ENVIO_MINUTO || 0);
const UM_DIA_MS = 24 * 60 * 60 * 1000;

let monitorIniciado = false;

function dataSaoPauloAgora(data = new Date()) {

    const partes = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
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

    return {
        ano: Number(partes.year),
        mes: Number(partes.month),
        dia: Number(partes.day),
        hora: Number(partes.hour),
        minuto: Number(partes.minute),
        segundo: Number(partes.second)
    };

}

function dataUtcDeSaoPaulo(ano, mes, dia, hora, minuto, segundo = 0) {

    return new Date(Date.UTC(
        ano,
        mes - 1,
        dia,
        hora + 3,
        minuto,
        segundo
    ));

}

function proximaExecucao() {

    const agora = new Date();
    const sp = dataSaoPauloAgora(agora);
    let alvo = dataUtcDeSaoPaulo(
        sp.ano,
        sp.mes,
        sp.dia,
        HORA_ENVIO,
        MINUTO_ENVIO
    );

    if (alvo <= agora) {

        alvo = new Date(alvo.getTime() + UM_DIA_MS);

    }

    return alvo;

}

function amanhaSaoPaulo() {

    const sp = dataSaoPauloAgora();
    const hojeMeioDiaUtc = dataUtcDeSaoPaulo(
        sp.ano,
        sp.mes,
        sp.dia,
        12,
        0
    );

    return new Date(hojeMeioDiaUtc.getTime() + UM_DIA_MS);

}

function mensagemAviso(assinatura) {

    return [
        '⏰ *Seu acesso vence amanha*',
        '',
        assinatura.nome ? `Cliente: ${assinatura.nome}` : '',
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

Nome:
${assinatura.nome || 'Nao informado'}

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

        assinaturas = listarVencendoNoDia(amanhaSaoPaulo());

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

    function agendarProxima() {

        const alvo = proximaExecucao();
        const delay = Math.max(
            1000,
            alvo.getTime() - Date.now()
        );

        setTimeout(
            async () => {
                await verificarVencimentos(client);
                agendarProxima();
            },
            delay
        );

        console.log(
            'MONITOR VENCIMENTOS AGENDADO PARA',
            alvo.toISOString()
        );

    }

    agendarProxima();

    console.log('MONITOR VENCIMENTOS ATIVO AS 10:00');

}

module.exports = iniciarMonitorVencimentos;
