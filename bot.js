const wppconnect = require('@wppconnect-team/wppconnect');

wppconnect.create({
  session: 'bot',
  headless: true,

  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }

})
.then((client) => {
  console.log('BOT ONLINE');

  client.onMessage(async (message) => {

    console.log('Mensagem:', message.body);

    try {

      const response = await fetch('http://127.0.0.1:5000/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          numero: message.from,
          mensagem: message.body
        })
      });

      const data = await response.json();

      if (data.resposta) {
        await client.sendText(message.from, data.resposta);
      }

    } catch (err) {
      console.log(err);
    }

  });

})
.catch((error) => {
  console.log(error);
});