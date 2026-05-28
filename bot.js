const wppconnect = require('@wppconnect-team/wppconnect');

wppconnect.create({

  session: 'bot',

  autoClose: 0,

  headless: true,

  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }

})
.then((client) => {

  console.log('BOT ONLINE');

  client.onMessage(async (message) => {

    console.log('NOVA MENSAGEM');
    console.log(message.body);

    await client.sendText(
      message.from,
      'Recebi: ' + message.body
    );

  });

})
.catch((error) => {
  console.log(error);
});