
const wppconnect = require('@wppconnect-team/wppconnect');
const registrar = require('./services/logger');
const sessoes = require('./services/sessions');

const menuPrincipal = require('./menus/menuPrincipal');

const menuHandler = require('./handlers/menuHandler');
const suporteHandler = require('./handlers/suporteHandler');
const financeiroHandler = require('./handlers/financeiroHandler');
const comercialHandler = require('./handlers/comercialHandler');
const humanoHandler = require('./handlers/humanoHandler');

console.log('INICIANDO BOT...');

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

    client.onMessage(async (message) => {

        try {

            // Ignora grupos
            if (message.isGroupMsg) return;

            // Ignora mensagens do próprio bot
            if (message.fromMe) return;

            // Apenas texto
            if (message.type !== 'chat') return;

            const numero = message.from;
            const texto = message.body.trim().toLowerCase();

            // PRIMEIRA INTERAÇÃO

            if (!sessoes[numero + '_iniciado']) {

                sessoes[numero + '_iniciado'] = true;

                sessoes[numero] = 'menu';

                await menuPrincipal(
                    client,
                    numero
                );

                return;

            }

            // GARANTE ETAPA

            if (!sessoes[numero]) {

                sessoes[numero] = 'menu';

            }

            const etapa = sessoes[numero];

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

            // ROTEAMENTO

            switch (etapa) {

                case 'menu':

                    return await menuHandler(
                        client,
                        numero,
                        texto
                    );

                case 'suporte':
                case 'renovacao':
                case 'sem_sinal':
                case 'em_analise':
                case 'pacote':
                case 'pacote_1':
                case 'pacote_3':
                case 'pacote_6':

                    return await suporteHandler(
                        client,
                        numero,
                        texto
                    );

                case 'financeiro':

                    return await financeiroHandler(
                        client,
                        numero,
                        texto
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
                        texto
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

    console.log('ERRO INICIALIZAÇÃO');

    console.log(erro);

});
