const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const registrar = require('./services/logger');
const sessoes = require('./services/sessions');
const {
    resolverNumeroMensagem
} = require('./services/whatsappNumero');
const {
    obterTextoMensagem
} = require('./services/menuInterativo');

const menuPrincipal = require('./menus/menuPrincipal');

const menuHandler = require('./handlers/menuHandler');
const suporteHandler = require('./handlers/suporteHandler');
const financeiroHandler = require('./handlers/financeiroHandler');
const comercialHandler = require('./handlers/comercialHandler');
const humanoHandler = require('./handlers/humanoHandler');
const chamadoHandler = require('./handlers/chamadoHandler');
const iniciarMonitorPagamentos = require('./services/pagamentosMonitor');
const iniciarMonitorVencimentos = require('./services/vencimentosMonitor');
const iniciarMonitorClientesCsv = require('./services/clientesImportMonitor');
const iniciarMonitorSigma = require('./services/sigmaHealthMonitor');
const iniciarStatusDiario = require('./services/statusDiario');
const iniciarMonitorTestes = require('./services/testesMonitor');
const iniciarMonitorLeads = require('./services/leadsMonitor');
const {
    tratarComandoAdmin
} = require('./services/adminComandos');
const {
    atendimentoPausado,
    ehMensagemAutomatica,
    instalarRegistroAutomatico,
    liberarAtendimento,
    pausarAtendimento
} = require('./services/pausaAtendimento');

const {
    atualizarInteracao,
    verificarTimeout
} = require('./services/sessionManager');
const {
    cancelarFollowUp
} = require('./services/followUpFunil');
const {
    cancelarRetomadaMenu
} = require('./services/retomadaMenu');
const {
    cancelarFollowUpVencimento
} = require('./services/vencimentoFollowUp');
const encaminharAtendente = require('./services/atendimentoHumano');
const {
    buscarAssinaturasPorNumero
} = require('./services/assinaturasStore');
const {
    lerTestesCsv,
    marcarSaidaContratacao
} = require('./services/testesCsv');
const {
    marcarSaidaMarketing
} = require('./services/marketingCampanha');
const {
    marcarLead,
    registrarLead
} = require('./services/leadsCsv');

console.log('INICIANDO BOT...');

function limparNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

}

function idsMensagem(message) {

    return [
        message?.from,
        message?.to,
        message?.chatId,
        message?.sender?.id,
        message?.id?.remote
    ].filter(id => typeof id === 'string' && id);

}

function idsIgnoradosConfigurados() {

    const padrao = [
        'status@broadcast',
        '0@c.us',
        '16505361212@c.us'
    ];

    const env = String(process.env.WHATSAPP_IGNORE_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    return new Set([...padrao, ...env]);

}

function textosContatoMensagem(message) {

    return [
        message?.sender?.pushname,
        message?.sender?.name,
        message?.sender?.formattedName,
        message?.notifyName,
        message?.chat?.name,
        message?.chat?.contact?.name,
        message?.chat?.contact?.pushname,
        message?.verifiedName
    ].filter(valor => typeof valor === 'string' && valor);

}

function ehContatoIgnorado(message) {

    if (!message) return true;
    if (message.isStatusV3) return true;
    if (message.isGroupMsg) return true;

    const ids = idsMensagem(message);

    if (ids.some(id =>
        id === 'status@broadcast' ||
        id.endsWith('@g.us') ||
        id.endsWith('@newsletter') ||
        idsIgnoradosConfigurados().has(id)
    )) return true;

    const textoContato = textosContatoMensagem(message)
        .join(' ')
        .toLowerCase();

    if (
        textoContato.includes('whatsapp support') ||
        textoContato.includes('suporte do whatsapp') ||
        textoContato.includes('conta oficial do suporte')
    ) return true;

    return false;

}

function ehAdmin(numeroWhatsapp, numero) {

    const admins = [
        process.env.ADMIN_NOTIFY_WHATSAPP,
        process.env.ADMIN_WHATSAPP,
        process.env.ADMIN_WHATSAPP_ID
    ].map(limparNumero).filter(Boolean);

    if (!admins.length) return false;

    const candidatos = [
        limparNumero(numeroWhatsapp),
        limparNumero(numero)
    ];

    return candidatos.some(candidato =>
        admins.includes(candidato)
    );

}

function chaveDiaSaoPaulo(valor) {

    const data = valor instanceof Date ? valor : new Date(valor);

    if (Number.isNaN(data.getTime())) return '';

    const partes = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.year}-${partes.month}-${partes.day}`;

}

function assinaturaComAvisoPendente(numero, numeroWhatsapp) {

    const hoje = chaveDiaSaoPaulo(new Date());
    const amanha = chaveDiaSaoPaulo(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const assinaturas = buscarAssinaturasPorNumero(
        numero,
        numeroWhatsapp
    );

    return assinaturas.find(assinatura => {
        if (assinatura.status !== 'ativa') return false;
        if (assinatura.origem === 'teste_gratis') return false;
        if (!assinatura.expiresAt || !assinatura.avisoVencimento) return false;

        const vencimento = new Date(assinatura.expiresAt);
        const aviso = new Date(assinatura.avisoVencimento);

        if (Number.isNaN(vencimento.getTime())) return false;
        if (Number.isNaN(aviso.getTime())) return false;
        if (aviso.toISOString() !== vencimento.toISOString()) return false;

        return [hoje, amanha].includes(chaveDiaSaoPaulo(vencimento));
    }) || null;

}

function temTesteRegistrado(numero, numeroWhatsapp) {

    const telefones = [
        limparNumero(numeroWhatsapp),
        limparNumero(numero)
    ].filter(Boolean);

    if (!telefones.length) return false;

    return lerTestesCsv().some(teste =>
        telefones.includes(limparNumero(teste.telefone))
    );

}

function marcarSaidaAvisosTeste(numero, numeroWhatsapp) {

    const telefones = [
        limparNumero(numeroWhatsapp),
        limparNumero(numero)
    ].filter(Boolean);

    if (!telefones.length) return false;

    const teste = lerTestesCsv().find(item =>
        telefones.includes(limparNumero(item.telefone)) &&
        !String(item.saiu_em || '').trim()
    );

    if (!teste) return false;

    marcarSaidaContratacao(teste.usuario);
    marcarSaidaContratacao(teste.telefone);
    marcarSaidaContratacao(numeroWhatsapp || numero);

    return true;

}

function deveRegistrarLead(numero, numeroWhatsapp) {

    if (
        buscarAssinaturasPorNumero(
            numero,
            numeroWhatsapp
        ).some(assinatura => assinatura.status !== 'cancelada')
    ) return false;

    return !temTesteRegistrado(
        numero,
        numeroWhatsapp
    );

}

function nomeMensagem(message) {

    return textosContatoMensagem(message)[0] || '';

}

function registrarLeadAtual(message, numero, numeroWhatsapp, fluxo) {

    if (!deveRegistrarLead(numero, numeroWhatsapp)) return;

    registrarLead({
        numero,
        telefone: numeroWhatsapp,
        nome: nomeMensagem(message),
        fluxo
    });

}

function sincronizarSessaoNumero(numero, numeroWhatsapp) {

    if (!numero || !numeroWhatsapp || numero === numeroWhatsapp) return;

    const sufixos = [
        '',
        '_iniciado',
        '_teste_usuario',
        '_pacote_outro',
        '_checkout',
        '_ultimo_checkout',
        '_forcar_renovacao',
        '_renovacao_atual',
        '_motivo_cancelamento',
        '_telefone_teste',
        '_aguardando_telefone_teste',
        '_marketing_detalhes',
        '_meu_chamado'
    ];

    for (const sufixo of sufixos) {

        const chaveNumero = `${numero}${sufixo}`;
        const chaveWhatsapp = `${numeroWhatsapp}${sufixo}`;

        if (sessoes[chaveNumero] === undefined && sessoes[chaveWhatsapp] !== undefined) {
            sessoes[chaveNumero] = sessoes[chaveWhatsapp];
            continue;
        }

        if (sessoes[chaveWhatsapp] === undefined && sessoes[chaveNumero] !== undefined) {
            sessoes[chaveWhatsapp] = sessoes[chaveNumero];
        }

    }

}

function limparTravasChrome() {
    const pastas = [
        path.join(__dirname, 'tokens', 'bot'),
        path.join(__dirname, 'data', 'sigma-browser')
    ];

    for (const pasta of pastas) {
        let arquivos = [];

        try {
            arquivos = fs.readdirSync(pasta)
                .filter(arquivo => arquivo.startsWith('Singleton'));
        } catch (_) {
            continue;
        }

        for (const arquivo of arquivos) {
            const caminho = path.join(pasta, arquivo);

            try {
                fs.rmSync(
                    caminho,
                    {
                        force: true,
                        recursive: true
                    }
                );
                console.log('TRAVA CHROME REMOVIDA:', caminho);
            } catch (erro) {
                console.log(
                    'NAO FOI POSSIVEL REMOVER TRAVA CHROME:',
                    caminho,
                    erro.message
                );
            }
        }
    }
}

limparTravasChrome();

function idsAtendimentoSaida(message) {

    return [
        message?.to,
        message?.chatId,
        message?.from
    ].filter(id =>
        typeof id === 'string' &&
        id &&
        !id.endsWith('@g.us') &&
        !id.endsWith('@newsletter') &&
        id !== 'status@broadcast'
    );

}

function registrarAtendimentoManual(message) {

    if (!message?.fromMe) return;
    if (ehContatoIgnorado(message)) return;

    const destinos = [...new Set(idsAtendimentoSaida(message))];
    const textoEnviado = obterTextoMensagem(message);

    if (!destinos.length) return;

    if (
        textoEnviado === '#bot' ||
        textoEnviado === '/bot' ||
        textoEnviado === 'reativar bot'
    ) {

        for (const destino of destinos) {

            liberarAtendimento(destino);
            sessoes[destino] = 'menu';

        }

        console.log(
            'ATENDIMENTO MANUAL REATIVOU BOT:',
            destinos.join(', ')
        );

        return;

    }

    const eraAutomatica = destinos.some(destino =>
        ehMensagemAutomatica(
            destino,
            textoEnviado
        )
    );

    if (eraAutomatica) return;

    for (const destino of destinos) {

        pausarAtendimento(
            destino,
            'mensagem manual enviada pelo WhatsApp do bot'
        );

    }

    console.log(
        'ATENDIMENTO MANUAL PAUSOU BOT:',
        destinos.join(', ')
    );

}

wppconnect.create({
    session: 'bot',

    headless: true,

    autoClose: 0,

    puppeteerOptions: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }

})

.then((client) => {

    console.log('BOT ONLINE');

    instalarRegistroAutomatico(client);

    iniciarMonitorPagamentos(client);
    iniciarMonitorClientesCsv();
    iniciarMonitorVencimentos(client);
    iniciarMonitorSigma(client);
    iniciarStatusDiario(client);
    iniciarMonitorTestes(client);
    iniciarMonitorLeads(client);

    client.onAnyMessage((message) => {

        try {

            registrarAtendimentoManual(message);

        } catch (erro) {

            console.log(
                'ERRO PAUSA ATENDIMENTO MANUAL',
                erro.message
            );

        }

    });

    client.onMessage(async (message) => {

        try {

            if (ehContatoIgnorado(message)) return;

            if (message.fromMe) return;

            const numero = message.from;

            console.log(
                'NUMERO:',
                numero
            );

            const numeroWhatsapp = await resolverNumeroMensagem(
                client,
                message
            );
            sincronizarSessaoNumero(
                numero,
                numeroWhatsapp
            );
            const texto = obterTextoMensagem(message);

            if (!texto) return;

            cancelarFollowUp(numero);
            cancelarRetomadaMenu(numero);
            cancelarFollowUpVencimento(numero);
            cancelarFollowUpVencimento(numeroWhatsapp);
            cancelarFollowUpVencimento(`${limparNumero(numeroWhatsapp)}@c.us`);
            const respostaMarketing = String(texto || '').trim().toLowerCase();

            if (respostaMarketing === 'sair' && marcarSaidaMarketing(numeroWhatsapp || numero)) {

                console.log('SAIDA MARKETING', numeroWhatsapp || numero);

                return await client.sendText(
                    numero,
                    'Tudo bem. Removi este contato da lista de ofertas. Quando precisar, envie uma mensagem por aqui.'
                );

            }

            const admin = ehAdmin(
                numeroWhatsapp,
                numero
            );

            if (admin) {

                const tratado = await tratarComandoAdmin({
                    client,
                    numero,
                    texto,
                    verificarVencimentos: iniciarMonitorVencimentos.verificarVencimentos
                });

                if (tratado || texto.startsWith('#')) return;

                return;

            }

            if (
                texto === '#bot' ||
                texto === '/bot' ||
                texto === 'reativar bot'
            ) {

                liberarAtendimento(numero);
                liberarAtendimento(numeroWhatsapp);
                liberarAtendimento(`${limparNumero(numeroWhatsapp)}@c.us`);
                sessoes[numero] = 'menu';

                return await menuPrincipal(
                    client,
                    numero
                );

            }

            if (texto === '0' && (
                atendimentoPausado(numero) ||
                atendimentoPausado(numeroWhatsapp) ||
                atendimentoPausado(`${limparNumero(numeroWhatsapp)}@c.us`)
            )) {

                liberarAtendimento(numero);
                liberarAtendimento(numeroWhatsapp);
                liberarAtendimento(`${limparNumero(numeroWhatsapp)}@c.us`);
                sessoes[numero] = 'menu';

                return await menuPrincipal(
                    client,
                    numero
                );

            }

            if (
                atendimentoPausado(numero) ||
                atendimentoPausado(numeroWhatsapp) ||
                atendimentoPausado(`${limparNumero(numeroWhatsapp)}@c.us`)
            ) return;

            if (
                ['1', '2'].includes(texto) &&
                !['vencimento_aviso', 'renovacao', 'cancelamento_feedback', 'cancelamento_repescagem'].includes(sessoes[numero])
            ) {

                const assinaturaAvisada = assinaturaComAvisoPendente(
                    numero,
                    numeroWhatsapp
                );

                if (assinaturaAvisada) {

                    const telefone = limparNumero(assinaturaAvisada.telefone || assinaturaAvisada.numero);
                    const aliases = [
                        numero,
                        numeroWhatsapp,
                        assinaturaAvisada.numero,
                        telefone,
                        telefone ? `${telefone}@c.us` : ''
                    ].filter(Boolean);

                    for (const alias of [...new Set(aliases)]) {

                        sessoes[alias] = 'vencimento_aviso';
                        sessoes[`${alias}_iniciado`] = true;

                    }

                }

            }

            if (
                texto === '8' &&
                (!sessoes[numero + '_iniciado'] || sessoes[numero] === 'menu') &&
                marcarSaidaAvisosTeste(
                    numero,
                    numeroWhatsapp
                )
            ) {

                sessoes[numero + '_iniciado'] = true;
                sessoes[numero] = 'teste_ja_usado';

                return await client.sendText(
                    numero,
                    [
                        'Tudo bem, parei os avisos sobre esse teste.',
                        '',
                        'O teste gratis continua registrado como ja utilizado. Se quiser voltar, voce pode contratar um pacote ou falar com um atendente.',
                        '',
                        '1 - Contratar agora',
                        '9 - Falar com atendente',
                        '0 - Voltar ao menu'
                    ].join('\n')
                );

            }

            verificarTimeout(
                numero
            );

            if (!sessoes[numero + '_iniciado']) {

                sessoes[numero + '_iniciado'] = true;

                sessoes[numero] = 'menu';

                registrarLeadAtual(
                    message,
                    numero,
                    numeroWhatsapp,
                    'menu'
                );

                await menuPrincipal(
                    client,
                    numero
                );

                return;

            }

            if (!sessoes[numero]) {

                sessoes[numero] = 'menu';

            }

            const etapa = sessoes[numero];

            atualizarInteracao(
                numero
            );

            registrar(
                numero,
                etapa,
                texto
            );
            registrarLeadAtual(
                message,
                numero,
                numeroWhatsapp,
                etapa
            );
            console.log(
                `[${numero}]`,
                `[${etapa}]`,
                texto
            );

            switch (etapa) {

                case 'menu':
                case 'retomada_menu':

                    if (etapa === 'retomada_menu' && texto === '0') {

                        return await encaminharAtendente(
                            client,
                            numero,
                            numeroWhatsapp,
                            'Retomada do menu',
                            {
                                mensagem: 'Atendimento encaminhado para nossa equipe. Aguarde nosso retorno.'
                            }
                        );

                    }

                    if (etapa === 'retomada_menu' && texto === '8') {

                        sessoes[numero] = 'menu';
                        marcarLead(
                            numeroWhatsapp || numero,
                            'encerrado',
                            'Cliente encerrou pela retomada do menu.'
                        );

                        return await client.sendText(
                            numero,
                            'Atendimento encerrado. Quando precisar, e so mandar uma mensagem por aqui.'
                        );

                    }

                    return await menuHandler(
                        client,
                        numero,
                        texto,
                        numeroWhatsapp
                    );

                case 'suporte':
                case 'renovacao_atual':
                case 'renovacao':
                case 'renovacao_personalizada':
                case 'sem_sinal':
                case 'em_analise':
                case 'pacote':
                case 'pacote_personalizado':
                case 'pacote_1':
                case 'pacote_3':
                case 'pacote_6':
                case 'pacote_1_2telas':
                case 'pacote_3_2telas':
                case 'pacote_6_2telas':
                case 'pacote_outro_valor':
                case 'pacote_outro_pagamento':
                case 'teste_gratis':
                case 'teste_ja_usado':
                case 'teste_encerrado':
                case 'teste_convite':
                case 'usuario_nao_encontrado':
                case 'pos_teste':
                case 'ajuda_config':
                case 'checkout_nome':
                case 'checkout_email':
                case 'checkout_cupom':
                case 'followup_compra':
                case 'followup_pagamento':
                case 'followup_configuracao':
                case 'satisfacao':
                case 'vencimento_aviso':
                case 'marketing_info':
                case 'cancelamento_feedback':
                case 'cancelamento_repescagem':

                    return await suporteHandler(
                        client,
                        numero,
                        texto,
                        numeroWhatsapp
                    );

                case 'financeiro':

                    return await financeiroHandler(
                        client,
                        numero,
                        texto,
                        numeroWhatsapp
                    );

                case 'meu_chamado':

                    return await chamadoHandler(
                        client,
                        numero,
                        texto,
                        numeroWhatsapp
                    );

                case 'comercial':

                    return await comercialHandler(
                        client,
                        numero,
                        texto
                    );

                case 'humano':

                    return await humanoHandler(
                        client,
                        numero,
                        texto,
                        numeroWhatsapp
                    );

                default:

                    console.log(
                        'ETAPA DESCONHECIDA:',
                        etapa
                    );

                    sessoes[numero] = 'menu';

                    return await menuPrincipal(
                        client,
                        numero
                    );

            }

        } catch (erro) {

            console.log('ERRO BOT');

            console.log(erro);

        }

    });

})

.catch((erro) => {

    console.log('ERRO INICIALIZACAO');

    console.log(erro);

});
