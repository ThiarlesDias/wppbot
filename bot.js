require('dotenv').config();

const wppconnect =
require('@wppconnect-team/wppconnect');

const logger =
require('./services/logger');

const perguntarIA =
require('./services/openai');

const sessions = {};

logger.info('INICIANDO BOT TOPTEC...');

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

    logger.info('BOT ONLINE');

    client.onMessage(async (message) => {

        try {

            if (!message.body) return;

            const numero = message.from;

            const texto =
            message.body.trim();

            logger.info(
                `${numero} -> ${texto}`
            );

            if (!sessions[numero]) {

                sessions[numero] = {

                    etapa: 'ia'
                };

                await client.sendText(

                    numero,

                    `Olá, eu sou a assistente da ${process.env.BOT_NAME} 🚀`
                );
            }

            const resposta =
            await perguntarIA(texto);

            await client.sendText(

                numero,
                resposta
            );

        } catch (erro) {

            logger.error(
                erro.toString()
            );
        }
    });

})

.catch((error) => {

    logger.error(error.toString());

});