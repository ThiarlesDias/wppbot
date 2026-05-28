const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('INICIANDO BOT...');

const client = new Client({

    authStrategy: new LocalAuth(),

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
    },

    authTimeoutMs: 0
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

client.on('message', async msg => {

    console.log('MENSAGEM:', msg.body);

    if (msg.body.toLowerCase().includes('oi')) {

        await msg.reply('Olá 😎');

    }

});

client.initialize();