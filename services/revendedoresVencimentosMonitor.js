const {
    lerRevendedoresCsv,
    lerRevendedoresClientesCsv,
    marcarAvisoFechamentoRevendedor,
    marcarAvisoVencimentoRevendedorCliente
} = require('./revendedoresCsv');
const {
    enviarTextoSeguro
} = require('./envioWhatsapp');
const notificar = require('./notificador');

const HORA_ENVIO = Number(process.env.VENCIMENTOS_ENVIO_HORA || 10);
const MINUTO_ENVIO = Number(process.env.VENCIMENTOS_ENVIO_MINUTO || 0);
const UM_DIA_MS = 24 * 60 * 60 * 1000;

let monitorIniciado = false;

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

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

function chaveDiaSaoPaulo(valor) {

    const data = valor instanceof Date ? valor : new Date(valor);

    if (Number.isNaN(data.getTime())) return '';

    const partes = dataSaoPauloAgora(data);

    return [
        partes.ano,
        String(partes.mes).padStart(2, '0'),
        String(partes.dia).padStart(2, '0')
    ].join('-');

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

function parseDataBrasil(valor) {

    const texto = String(valor || '').trim();
    const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);

    if (match) {
        return dataUtcDeSaoPaulo(
            Number(match[3]),
            Number(match[2]),
            Number(match[1]),
            Number(match[4] || 12),
            Number(match[5] || 0),
            Number(match[6] || 0)
        );
    }

    const data = new Date(texto);

    return Number.isNaN(data.getTime()) ? null : data;

}

function statusAtivo(status) {

    const texto = String(status || 'ativo')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return ![
        'inativo',
        'cancelado',
        'bloqueado'
    ].includes(texto);

}

function mensagemAviso(cliente, periodo) {

    const titulo = periodo === 'hoje' ?
        '*Cliente vence hoje*' :
        '*Cliente vence amanha*';

    return [
        titulo,
        '',
        'Revendedor, este cliente esta proximo do vencimento:',
        '',
        `Cliente: ${cliente.cliente_nome || 'Nao informado'}`,
        cliente.cliente_telefone ? `WhatsApp cliente: ${cliente.cliente_telefone}` : '',
        `Usuario: ${cliente.usuario || 'Nao informado'}`,
        cliente.vencimento ? `Vencimento: ${cliente.vencimento}` : '',
        '',
        'Para solicitar renovacao, entre no menu de revendedor e escolha:',
        '3 - Renovar cliente',
        '',
        'A TOPTEC recebe a solicitacao e faz a renovacao no painel.'
    ].filter(Boolean).join('\n');

}

function mensagemFechamentoRevendedor(revendedor) {

    return [
        '*Fechamento da revenda amanha*',
        '',
        `Revenda: ${revendedor.nome || 'Nao informado'}`,
        `Data de fechamento: ${revendedor.data_fechamento || 'Nao informada'}`,
        `Creditos atuais: ${revendedor.creditos || '0'}`,
        '',
        'Se precisar ajustar creditos ou regularizar algo, fale com a TOPTEC por aqui.'
    ].join('\n');

}

function listarVencimentosRevendedores() {

    const hoje = chaveDiaSaoPaulo(hojeSaoPaulo());
    const amanha = chaveDiaSaoPaulo(amanhaSaoPaulo());

    return lerRevendedoresClientesCsv().map(cliente => {
        const vencimentoData = parseDataBrasil(cliente.vencimento);
        const chave = vencimentoData ? chaveDiaSaoPaulo(vencimentoData) : '';

        return {
            cliente,
            chave
        };
    }).filter(item =>
        item.chave &&
        statusAtivo(item.cliente.status) &&
        item.cliente.usuario &&
        item.cliente.aviso_vencimento !== item.cliente.vencimento &&
        [hoje, amanha].includes(item.chave)
    ).map(item => ({
        ...item.cliente,
        periodo: item.chave === hoje ? 'hoje' : 'amanha'
    }));

}

function listarFechamentosRevendedores() {

    const amanha = chaveDiaSaoPaulo(amanhaSaoPaulo());

    return lerRevendedoresCsv().map(revendedor => {
        const fechamentoData = parseDataBrasil(revendedor.data_fechamento);
        const chave = fechamentoData ? chaveDiaSaoPaulo(fechamentoData) : '';

        return {
            revendedor,
            chave
        };
    }).filter(item =>
        item.chave &&
        statusAtivo(item.revendedor.status) &&
        item.revendedor.aviso_fechamento !== item.revendedor.data_fechamento &&
        item.chave === amanha
    ).map(item => item.revendedor);

}

async function verificarFechamentosRevendedores(client) {

    const fechamentos = listarFechamentosRevendedores();
    const resumo = {
        total: fechamentos.length,
        enviados: 0,
        erros: []
    };

    console.log('FECHAMENTOS REVENDEDORES PARA AVISAR', fechamentos.length);

    for (const revendedor of fechamentos) {
        const telefone = limparNumero(revendedor.telefone);

        if (!telefone) continue;

        try {
            await enviarTextoSeguro(
                client,
                [telefone],
                mensagemFechamentoRevendedor(revendedor)
            );

            await notificar(
                client,
                'FECHAMENTO DE REVENDA AMANHA',
                [
                    `Revenda: ${revendedor.nome || 'Nao informado'}`,
                    `WhatsApp: ${revendedor.telefone || telefone}`,
                    `Creditos: ${revendedor.creditos || '0'}`,
                    `Fechamento: ${revendedor.data_fechamento || 'Nao informado'}`
                ].join('\n')
            );

            marcarAvisoFechamentoRevendedor(revendedor);
            resumo.enviados += 1;
        } catch (erro) {
            console.log(
                'ERRO AVISO FECHAMENTO REVENDEDOR',
                revendedor.telefone,
                erro.message
            );
            resumo.erros.push(`${revendedor.telefone}: ${erro.message}`);
        }
    }

    return resumo;

}

async function verificarVencimentosRevendedores(client) {

    const vencimentos = listarVencimentosRevendedores();
    const resumo = {
        total: vencimentos.length,
        enviados: 0,
        erros: []
    };

    console.log('VENCIMENTOS REVENDEDORES PARA AVISAR', vencimentos.length);

    for (const cliente of vencimentos) {
        const revendedorTelefone = limparNumero(cliente.revendedor_telefone);

        if (!revendedorTelefone) continue;

        try {
            await enviarTextoSeguro(
                client,
                [revendedorTelefone],
                mensagemAviso(
                    cliente,
                    cliente.periodo
                )
            );
            marcarAvisoVencimentoRevendedorCliente(cliente);
            resumo.enviados += 1;
        } catch (erro) {
            console.log(
                'ERRO AVISO VENCIMENTO REVENDEDOR',
                cliente.usuario,
                erro.message
            );
            resumo.erros.push(`${cliente.usuario}: ${erro.message}`);
        }
    }

    resumo.fechamentos = await verificarFechamentosRevendedores(client);

    return resumo;

}

function iniciarMonitorVencimentosRevendedores(client) {

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
                await verificarVencimentosRevendedores(client);
                agendarProxima();
            },
            delay
        );

        console.log(
            'MONITOR VENCIMENTOS REVENDEDORES AGENDADO PARA',
            alvo.toISOString()
        );
    }

    agendarProxima();

    if (process.env.VENCIMENTOS_CHECK_STARTUP !== '0') {
        setTimeout(
            () => verificarVencimentosRevendedores(client),
            Number(process.env.VENCIMENTOS_STARTUP_DELAY_MS || 5000)
        );
    }

    console.log('MONITOR VENCIMENTOS REVENDEDORES ATIVO');

}

module.exports = iniciarMonitorVencimentosRevendedores;
module.exports.verificarVencimentosRevendedores = verificarVencimentosRevendedores;
