const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('INICIANDO BOT...');

const client = new Client({

    authStrategy: new LocalAuth(),

    webVersionCache: {
        type: 'none'
    },

    puppeteer: {

        headless: true,

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
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

client.on('message', async msg => {

    console.log('MENSAGEM RECEBIDA:', msg.body);

    if (msg.body.toLowerCase().includes('oi')) {

        console.log('ENTROU NO IF');

        try {

            await msg.reply('Olá 😎');

            console.log('RESPOSTA ENVIADA');

        } catch (erro) {

            console.log('ERRO AO RESPONDER');
            console.log(erro);

        }

    }

});

client.initialize();