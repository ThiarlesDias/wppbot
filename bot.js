const wppconnect = require('@wppconnect-team/wppconnect');

console.log('INICIANDO BOT...');

wppconnect.create({

    session: 'bot',

    autoClose: 0,

    headless: 'new',

    puppeteerOptions: {

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

})

.then((client) => {

    console.log('BOT ONLINE');

    client.onMessage(async (message) => {

        console.log('MENSAGEM:', message.body);

        if (
            message.body &&
            message.body.toLowerCase().includes('oi')
        ) {

            try {

                await client.sendText(
                    message.from,
                    'Olá 😎'
                );

                console.log('RESPONDEU');

            } catch (e) {

                console.log('ERRO');
                console.log(e);

            }
        }
    });

})

.catch((error) => {

    console.log(error);

});