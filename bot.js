const wppconnect = require('@wppconnect-team/wppconnect');

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

    console.log('=================================');
    console.log('MENSAGEM RECEBIDA');
    console.log(message.body);

    await client.sendText(
      message.from,
      'FUNCIONANDO'
    );

  });

})
.catch((error) => {
  console.log(error);
});