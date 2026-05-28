const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('INICIANDO BOT...');

process.on('unhandledRejection', error => {
    console.log('ERRO PROMISE:');
    console.log(error);
});

const client = new Client({

    authStrategy: new LocalAuth(),

    authTimeoutMs: 0,

    takeoverOnConflict: true,

    takeoverTimeoutMs: 0,

    puppeteer: {

        headless: 'new',

        executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH,

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ]
    }
});

client.on('qr', qr => {

    console.log('QR RECEBIDO');

    qrcode.generate(qr, {
        small: true
    });

});

client.on('authenticated', () => {

    console.log('AUTENTICADO');

});

client.on('ready', () => {

    console.log('BOT PRONTO');

});

client.on('loading_screen', (percent, message) => {

    console.log('CARREGANDO:', percent, message);

});

client.on('message', async msg => {

    console.log('MENSAGEM:', msg.body);

    if (msg.body.toLowerCase().includes('oi')) {

        try {

            await msg.reply('Olá 😎');

            console.log('RESPONDEU');

        } catch (e) {

            console.log('ERRO AO RESPONDER');
            console.log(e);

        }
    }

});

client.initialize();