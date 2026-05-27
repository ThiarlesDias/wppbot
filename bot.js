const wppconnect = require('@wppconnect-team/wppconnect');

wppconnect.create({
    session: 'bot'
})

.then((client) => {

    client.onMessage((message) => {

        console.log(message.from);
        console.log(message.body);

        if (message.body.toLowerCase() === 'oi') {

            client.sendText(
                message.from,
                'Olá 😎'
            );
        }
    });

})

.catch((error) => {
    console.log(error);
});