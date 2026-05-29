require('dotenv').config();

const { gerarPix } = require('./services/mercadopago');

(async () => {

    try {

        const pix = await gerarPix(
            25,
            'IPTV 1 Mes'
        );

        console.log(
            JSON.stringify(
                pix,
                null,
                2
            )
        );

    } catch (erro) {

        console.log('ERRO MP:');

        console.log(
            JSON.stringify(
                erro,
                null,
                2
            )
        );

    }

})();