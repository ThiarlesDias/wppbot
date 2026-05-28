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

    console.log('Mensagem recebida:', message.body);

    try {

      const response = await fetch(
        'http://host.docker.internal:5000/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            numero: message.from,
            mensagem: message.body
          })
        }
      );

      const data = await response.json();

      console.log(data);

      if (data.resposta) {

        await client.sendText(
          message.from,
          data.resposta
        );

      }

    } catch (err) {

      console.log('ERRO API:');
      console.log(err);

    }

  });

})
.catch((error) => {
  console.log(error);
});