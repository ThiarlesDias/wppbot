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
const iniciarMonitorPagamentos = require('./services/pagamentosMonitor');
const iniciarMonitorVencimentos = require('./services/vencimentosMonitor');
const iniciarMonitorClientesCsv = require('./services/clientesImportMonitor');
const iniciarMonitorSigma = require('./services/sigmaHealthMonitor');
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

console.log('INICIANDO BOT...');

function limparNumero(numero) {

    return String(numero || '').replace(/\D/g, '');

}

function ehAdmin(numeroWhatsapp, numero) {

    const admin = limparNumero(
        process.env.ADMIN_NOTIFY_WHATSAPP ||
        process.env.ADMIN_WHATSAPP ||
        process.env.ADMIN_WHATSAPP_ID
    );

    if (!admin) return false;

    return [
        limparNumero(numeroWhatsapp),
        limparNumero(numero)
    ].includes(admin);

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

            if (message.isGroupMsg) return;

            if (
                message.from?.endsWith('@g.us') ||
                message.from?.endsWith('@newsletter')
            ) return;

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
            const texto = obterTextoMensagem(message);

            if (!texto) return;

            cancelarFollowUp(numero);

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

            if (
                atendimentoPausado(numero) ||
                atendimentoPausado(numeroWhatsapp) ||
                atendimentoPausado(`${limparNumero(numeroWhatsapp)}@c.us`)
            ) return;

            verificarTimeout(
                numero
            );

            if (!sessoes[numero + '_iniciado']) {

                sessoes[numero + '_iniciado'] = true;

                sessoes[numero] = 'menu';

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
            console.log(
                `[${numero}]`,
                `[${etapa}]`,
                texto
            );

            switch (etapa) {

                case 'menu':

                    return await menuHandler(
                        client,
                        numero,
                        texto,
                        numeroWhatsapp
                    );

                case 'suporte':
                case 'renovacao':
                case 'sem_sinal':
                case 'em_analise':
                case 'pacote':
                case 'pacote_1':
                case 'pacote_3':
                case 'pacote_6':
                case 'teste_gratis':
                case 'teste_ja_usado':
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
