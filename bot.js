const venom = require('venom-bot');

vvenom.create({
  session: 'bot',

  headless: 'new',

  puppeteerOptions: {
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
  .then((client) => start(client))
  .catch((erro) => console.log(erro));

function start(client) {

  console.log('BOT ONLINE');

  client.onMessage(async (message) => {

    // Ignora grupos
    if (message.isGroupMsg) return;

    // Ignora mídia
    if (message.type !== 'chat') return;

    const texto = message.body.toLowerCase();

    console.log(`${message.from} -> ${texto}`);

    // MENU
    if (
      texto === 'oi' ||
      texto === 'menu' ||
      texto === 'olá'
    ) {

      await client.sendText(
        message.from,
`🤖 *TopTec Digital*

Escolha uma opção:

1 - Suporte Técnico
2 - Vendas
3 - Financeiro
4 - Falar com atendente`
      );

      return;
    }

    // SUPORTE
    if (texto === '1') {

      await client.sendText(
        message.from,
`🛠️ *Suporte Técnico*

Descreva seu problema.

Exemplos:
- Internet lenta
- Antena sem sinal
- Erro no equipamento`
      );

      return;
    }

    // VENDAS
    if (texto === '2') {

      await client.sendText(
        message.from,
`💰 *Setor de Vendas*

Trabalhamos com:

✅ Internet Satelital
✅ Rastreamento
✅ Telefonia via Satélite
✅ Automação

Informe o produto desejado.`
      );

      return;
    }

    // FINANCEIRO
    if (texto === '3') {

      await client.sendText(
        message.from,
`💳 *Financeiro*

Informe sua dúvida:

- 2ª via
- boleto
- pagamento
- nota fiscal`
      );

      return;
    }

    // HUMANO
    if (texto === '4') {

      await client.sendText(
        message.from,
`👨‍💼 Encaminhando para um atendente humano.

Aguarde nosso contato.`
      );

      return;
    }

    // PADRÃO
    await client.sendText(
      message.from,
`Não entendi sua mensagem.

Digite:
- oi
- menu`
    );

  });
}