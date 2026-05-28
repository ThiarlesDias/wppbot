
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

.then((client) => start(client))

.catch((erro) => {
  console.log('ERRO AO INICIAR');
  console.log(erro);
});

function start(client) {

  console.log('BOT ONLINE');

  client.onMessage(async (message) => {

    try {

      // IGNORA GRUPOS
      if (message.isGroupMsg) return;

      // IGNORA MIDIA
      if (message.type !== 'chat') return;

      // IGNORA MSG DO BOT
      if (message.fromMe) return;

      const texto = message.body.toLowerCase().trim();

      console.log(`${message.from} -> ${texto}`);

      // MENU AUTOMATICO
      await client.sendText(

        message.from,

`🤖 *TopTec Digital*

Bem-vindo ao nosso atendimento.

Escolha uma opção:

1️⃣ Suporte Técnico
2️⃣ Comercial / Vendas
3️⃣ Financeiro
4️⃣ Atendimento Humano`

      );

      // SUPORTE
      if (texto === '1') {

        await client.sendText(

          message.from,

`🛠️ *SUPORTE TÉCNICO*

Descreva seu problema.

Exemplos:
• Sem sinal
• Equipamento offline
• Internet lenta
• Erro no sistema`

        );

        return;
      }

      // VENDAS
      if (texto === '2') {

        await client.sendText(

          message.from,

`💰 *COMERCIAL*

Trabalhamos com:

✅ Internet Satelital
✅ Rastreamento
✅ Telefonia Satelital
✅ Automação
✅ Monitoramento

Informe qual produto deseja.`

        );

        return;
      }

      // FINANCEIRO
      if (texto === '3') {

        await client.sendText(

          message.from,

`💳 *FINANCEIRO*

Informe sua solicitação:

• 2ª via
• Boleto
• Nota fiscal
• Pagamento
• Contrato`

        );

        return;
      }

      // HUMANO
      if (texto === '4') {

        await client.sendText(

          message.from,

`👨‍💼 Encaminhando para um atendente.

Aguarde nosso retorno.`

        );

        return;
      }

    } catch (erro) {

      console.log('ERRO NA MENSAGEM');
      console.log(erro);

    }

  });

}

