const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('INICIANDO BOT...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/snap/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', qr => {
    console.log('QR RECEBIDO');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('AUTENTICADO');
});

client.on('ready', () => {
    console.log('BOT PRONTO!');
});

client.on('message', async message => {
    console.log('Mensagem:', message.body);

    if (message.body.toLowerCase() === 'oi') {
        await message.reply('Olá! Bot funcionando.');
    }
});

client.initialize();