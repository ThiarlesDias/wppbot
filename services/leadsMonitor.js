const sessoes = require('./sessions');
const {
    buscarAssinaturasPorNumero
} = require('./assinaturasStore');
const {
    lerTestesCsv
} = require('./testesCsv');
const {
    leadsParaRemarketing,
    marcarLead,
    marcarRemarketingEnviado
} = require('./leadsCsv');
const {
    montarWidTelefone
} = require('./whatsappNumero');
const {
    atendimentoPausado
} = require('./pausaAtendimento');

const INTERVALO_MS = Number(process.env.LEADS_REMARKETING_INTERVAL_MS || 24 * 60 * 60 * 1000);
const START_DELAY_MS = Number(process.env.LEADS_REMARKETING_START_DELAY_MS || 2 * 60 * 1000);
const LIMITE_DIARIO = Number(process.env.LEADS_REMARKETING_LIMITE_DIARIO || 20);

let iniciado = false;

function limparTelefone(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function possuiTeste(telefone) {

    const limpo = limparTelefone(telefone);

    if (!limpo) return false;

    return lerTestesCsv().some(teste =>
        limparTelefone(teste.telefone) === limpo
    );

}

function possuiCliente(telefone, numero) {

    return buscarAssinaturasPorNumero(
        numero,
        telefone
    ).some(assinatura =>
        assinatura.status !== 'cancelada'
    );

}

function aliasesLead(lead, telefone, destino) {

    return [...new Set([
        destino,
        lead.numero,
        lead.telefone,
        telefone,
        telefone ? montarWidTelefone(telefone) : ''
    ].filter(Boolean))];

}

function atendimentoPausadoLead(lead, telefone, destino) {

    return aliasesLead(
        lead,
        telefone,
        destino
    ).some(alias => atendimentoPausado(alias));

}

function mensagemRemarketing(lead) {

    const nome = String(lead.nome || '').trim();

    return [
        nome ? `Oi, ${nome}.` : 'Oi, tudo bem?',
        '',
        'Passando para ver se ainda posso te ajudar com a TopTec.',
        'Se quiser, voce pode continuar de onde parou ou falar com a gente.',
        '',
        '1 - Ver pacotes',
        '9 - Falar com atendente',
        '8 - Encerrar atendimento',
        '0 - Voltar ao menu'
    ].join('\n');

}

async function verificarLeads(client) {

    const leads = leadsParaRemarketing();
    let enviados = 0;

    console.log(`LEADS PARA REMARKETING ${leads.length}`);

    for (const lead of leads) {

        if (enviados >= LIMITE_DIARIO) break;

        const telefone = limparTelefone(lead.telefone || lead.numero);
        const destino = lead.numero && String(lead.numero).includes('@') ?
            lead.numero :
            montarWidTelefone(telefone);

        if (!telefone || !destino) continue;

        if (atendimentoPausadoLead(
            lead,
            telefone,
            destino
        )) {
            continue;
        }

        if (possuiCliente(telefone, destino)) {

            marcarLead(
                telefone,
                'cliente',
                'Encontrado em clientes antes do remarketing.'
            );
            continue;

        }

        if (possuiTeste(telefone)) {

            marcarLead(
                telefone,
                'teste',
                'Encontrado em testes antes do remarketing.'
            );
            continue;

        }

        try {

            await client.sendText(
                destino,
                mensagemRemarketing(lead)
            );

            for (const alias of aliasesLead(
                lead,
                telefone,
                destino
            )) {
                sessoes[alias] = 'followup_compra';
                sessoes[`${alias}_iniciado`] = true;
            }

            marcarRemarketingEnviado(telefone);
            enviados += 1;

        } catch (erro) {

            console.log(
                'ERRO REMARKETING LEAD',
                telefone,
                erro.message
            );

        }

    }

    return enviados;

}

function iniciarMonitorLeads(client) {

    if (iniciado) return verificarLeads;

    iniciado = true;

    setTimeout(
        () => verificarLeads(client).catch(erro =>
            console.log('ERRO MONITOR LEADS', erro.message)
        ),
        START_DELAY_MS
    );

    setInterval(
        () => verificarLeads(client).catch(erro =>
            console.log('ERRO MONITOR LEADS', erro.message)
        ),
        INTERVALO_MS
    );

    console.log(`MONITOR LEADS ATIVO ${Math.round(INTERVALO_MS / 1000)}s`);

    return verificarLeads;

}

iniciarMonitorLeads.verificarLeads = verificarLeads;

module.exports = iniciarMonitorLeads;
