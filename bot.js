const wppconnect = require('@wppconnect-team/wppconnect');

const sessions = {};

console.log('INICIANDO BOT TOPTEC...');

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

        if (!message.body) return;

        const numero = message.from;
        const texto = message.body.toLowerCase().trim();

        console.log(numero);
        console.log(texto);

        if (!sessions[numero]) {

            sessions[numero] = {
                etapa: 'menu'
            };

            await client.sendText(
                numero,
`Olá, seja bem-vindo à TopTec Digital 🚀

Digite uma opção:

1 - Suporte Técnico
2 - Comercial
3 - Financeiro
4 - Falar com atendente`
            );

            return;
        }

        if (sessions[numero].etapa === 'menu') {

            switch (texto) {

                case '1':

                    await client.sendText(
                        numero,
                        'Você entrou no suporte técnico.'
                    );

                    break;

                case '2':

                    await client.sendText(
                        numero,
                        'Você entrou no comercial.'
                    );

                    break;

                case '3':

                    await client.sendText(
                        numero,
                        'Você entrou no financeiro.'
                    );

                    break;

                case '4':

                    await client.sendText(
                        numero,
                        'Um atendente irá falar com você.'
                    );

                    break;

                default:

                    await client.sendText(
                        numero,
                        'Digite uma opção válida.'
                    );
            }
        }

    });

})

.catch((error) => {

    console.log(error);

});