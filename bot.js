
const wppconnect = require('@wppconnect-team/wppconnect');

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

            // Ignora mídias
            if (message.type !== 'chat') return;

            // Ignora mensagens do próprio bot
            if (message.fromMe) return;

            const texto = message.body.toLowerCase().trim();

            console.log(`${message.from} -> ${texto}`);

            // OPÇÃO 1
            if (texto === '1') {

                await client.sendText(
                    message.from,

`🛠️ *SISTEMA DE TV*

1️⃣ Renovação

2️⃣ Sem sinal

3️⃣ Adquirir pacote

4️⃣ Falar com atendente`
                );

                return;
            }

            // OPÇÃO 2
            if (texto === '2') {

                await client.sendText(
                    message.from,

`💰 *COMERCIAL*

1️⃣ Desenvolvimento de Sites

2️⃣ Desenvolvimento de Aplicativos

3️⃣ Automação WhatsApp

4️⃣ Marketing Digital

5️⃣ Infraestrutura de TI`
                );

                return;
            }

            // OPÇÃO 3
            if (texto === '3') {

                await client.sendText(
                    message.from,

`💳 *FINANCEIRO*

1️⃣ Informações de Pagamento

2️⃣ Segunda Via

3️⃣ Contratos

4️⃣ Falar com Financeiro`
                );

                return;
            }

            // OPÇÃO 4
            if (texto === '4') {

                await client.sendText(
                    message.from,

`👨‍💼 Seu atendimento foi encaminhado.

Aguarde nosso retorno.`
                );

                return;
            }

            // QUALQUER OUTRA MENSAGEM
            await client.sendText(
                message.from,

`🤖 *TopTec Digital*

Escolha uma opção:

1️⃣ Sistema de TV
2️⃣ Comercial / Vendas
3️⃣ Financeiro
4️⃣ Atendimento Humano`
            );

        } catch (erro) {

            console.log('ERRO');
            console.log(erro);

        }

    });

})

.catch((erro) => {

    console.log('ERRO AO INICIAR');
    console.log(erro);

});

