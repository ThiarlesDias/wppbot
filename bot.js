const wppconnect = require('@wppconnect-team/wppconnect');

const sessoes = require('./services/sessions');

const menuPrincipal = require('./menus/menuPrincipal');

const menuSuporte = require('./menus/suporte');
const semSinal = require('./menus/suporte/semSinal');
const renovacao = require('./menus/suporte/renovacao');
const pacote = require('./menus/suporte/pacote');

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

            if (message.isGroupMsg) return;
            if (message.fromMe) return;
            if (message.type !== 'chat') return;

            const numero = message.from;
            const texto = message.body.trim().toLowerCase();

            if (!sessoes[numero]) {
                sessoes[numero] = 'menu';
            }

            const etapa = sessoes[numero];

            console.log(numero, etapa, texto);

            // MENU PRINCIPAL
            if (etapa === 'menu') {

                if (texto === '1') {

                    sessoes[numero] = 'suporte';

                    await menuSuporte(client, numero);

                    return;
                }

                await menuPrincipal(client, numero);

                return;
            }

            // MENU SUPORTE
            if (etapa === 'suporte') {

                if (texto === '1') {

                    await renovacao(client, numero);

                    return;
                }

                if (texto === '2') {

                    await semSinal(client, numero);

                    return;
                }

                if (texto === '3') {

                    await pacote(client, numero);

                    return;
                }

                if (texto === '4') {

                    sessoes[numero] = 'menu';

                    await menuPrincipal(client, numero);

                    return;
                }

                await menuSuporte(client, numero);

                return;
            }

        } catch (erro) {

            console.log(erro);

        }

    });

});