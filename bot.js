const wppconnect = require('@wppconnect-team/wppconnect');

const atendimento = require('./flows/atendimento');
const suporte = require('./flows/suporte');
const vendas = require('./flows/vendas');
const financeiro = require('./flows/financeiro');

console.log('INICIANDO BOT TOPTEC...');

wppconnect.create({

    session: 'bot',

    autoClose: 0,

    headless: true,

    logQR: true,

    puppeteerOptions: {

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]

    }

})

.then((client) => {

    console.log('BOT ONLINE');

    client.onMessage(async (message) => {

        try {

            if (!message.body) {
                return;
            }

            const texto = message.body.toLowerCase().trim();

            console.log('=================================');
            console.log('MENSAGEM RECEBIDA');
            console.log(texto);

            if (
                texto === '1' ||
                texto.includes('suporte')
            ) {

                return suporte(client, message);

            }

            if (
                texto === '2' ||
                texto.includes('vendas') ||
                texto.includes('comprar') ||
                texto.includes('comercial')
            ) {

                return vendas(client, message);

            }

            if (
                texto === '3' ||
                texto.includes('financeiro')
            ) {

                return financeiro(client, message);

            }

            return atendimento(client, message);

        } catch (erro) {

            console.log('ERRO GERAL');
            console.log(erro);

            await client.sendText(
                message.from,
                '⚠️ Ocorreu um erro no atendimento.'
            );

        }

    });

})

.catch((error) => {

    console.log('ERRO AO INICIAR BOT');
    console.log(error);

});