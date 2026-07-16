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
const {
    enviarTextoSeguro
} = require('./envioWhatsapp');
const {
    agendarFollowUpVencimento
} = require('./vencimentoFollowUp');

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

function hojeSaoPaulo() {

    const sp = dataSaoPauloAgora();

    return dataUtcDeSaoPaulo(
        sp.ano,
        sp.mes,
        sp.dia,
        12,
        0
    );

}

function amanhaSaoPaulo() {

    return new Date(hojeSaoPaulo().getTime() + UM_DIA_MS);

}

function mensagemAviso(assinatura, periodo = 'amanha') {

    const titulo = periodo === 'hoje' ?
        '⚠️ *Seu acesso vence hoje*' :
        '⏰ *Seu acesso vence amanha*';
    const chamada = periodo === 'hoje' ?
        'Para nao ficar sem sinal, renove ainda hoje.' :
        'Renove com antecedencia e evite ficar sem sinal.';

    return [
        titulo,
        '',
        chamada,
        '',
        '📺 *Dados do acesso*',
        assinatura.nome ? `Cliente: ${assinatura.nome}` : '',
        `Usuario: ${assinatura.username}`,
        `Vencimento: ${formatarData(assinatura.expiresAt)}`,
        '',
        '✅ *Renovando agora voce:*',
        '• Mantem o mesmo usuario e senha.',
        '• Nao precisa configurar tudo de novo.',
        '• Tem os dias do pacote somados no vencimento atual apos a confirmacao do pagamento.',
        '',
        'Exemplo: se seu acesso vence hoje e voce renova 1 mes, o novo vencimento passa a contar a partir do vencimento atual.',
        '',
        '━━━━━━━━━━━━━━',
        'Escolha uma opcao:',
        '',
        '1️⃣ Renovar agora',
        '2️⃣ Cancelar minha assinatura',
        '3️⃣ Ja realizei o pagamento',
        '0️⃣ Voltar ao menu',
        '━━━━━━━━━━━━━━'
    ].filter(Boolean).join('\n');

}

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function marcarSessaoVencimento(assinatura, destino = '') {

    const telefone = limparNumero(assinatura.telefone || assinatura.numero);
    const aliases = [
        destino,
        assinatura.numero,
        telefone,
        telefone ? `${telefone}@c.us` : ''
    ].filter(Boolean);

    for (const alias of [...new Set(aliases)]) {

        sessoes[alias] = 'vencimento_aviso';

    }

}

async function avisarAssinatura(client, assinatura, periodo = 'amanha') {

    if (!assinatura.numero && !assinatura.telefone) return;

    const envio = await enviarTextoSeguro(
        client,
        [
            assinatura.numero,
            assinatura.telefone
        ],
        mensagemAviso(
            assinatura,
            periodo
        )
    );

    marcarSessaoVencimento(
        assinatura,
        envio.destino
    );
    agendarFollowUpVencimento(
        client,
        envio.destino
    );

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

Destino enviado:
${envio.destino}

Usuario:
${assinatura.username}

Nome:
${assinatura.nome || 'Nao informado'}

Periodo:
${periodo}

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

    let grupos;
    const resumo = {
        hoje: 0,
        amanha: 0,
        enviados: 0,
        erros: []
    };

    try {

        grupos = [
            {
                periodo: 'hoje',
                assinaturas: listarVencendoNoDia(hojeSaoPaulo())
            },
            {
                periodo: 'amanha',
                assinaturas: listarVencendoNoDia(amanhaSaoPaulo())
            }
        ];

    } catch (erro) {

        console.log('ERRO LISTAR VENCIMENTOS', erro.message);
        resumo.erros.push(`listar: ${erro.message}`);
        return resumo;

    }

    for (const grupo of grupos) {

        resumo[grupo.periodo] = grupo.assinaturas.length;

    }

    console.log(
        'VENCIMENTOS PARA AVISAR',
        grupos.map(grupo => `${grupo.periodo}=${grupo.assinaturas.length}`).join(' ')
    );

    for (const grupo of grupos) {

        for (const assinatura of grupo.assinaturas) {

            try {

                await avisarAssinatura(
                    client,
                    assinatura,
                    grupo.periodo
                );
                resumo.enviados += 1;

            } catch (erro) {

                console.log(
                    'ERRO AVISO VENCIMENTO',
                    assinatura.id,
                    erro.message
                );
                resumo.erros.push(`${assinatura.id}: ${erro.message}`);

            }

        }

    }

    return resumo;

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

    if (process.env.VENCIMENTOS_CHECK_STARTUP !== '0') {

        console.log(
            'MONITOR VENCIMENTOS CHECAGEM INICIAL EM',
            `${Number(process.env.VENCIMENTOS_STARTUP_DELAY_MS || 5000)}ms`
        );

        setTimeout(
            () => verificarVencimentos(client),
            Number(process.env.VENCIMENTOS_STARTUP_DELAY_MS || 5000)
        );

    }

    console.log('MONITOR VENCIMENTOS ATIVO AS 10:00');

}

module.exports = iniciarMonitorVencimentos;
module.exports.verificarVencimentos = verificarVencimentos;
