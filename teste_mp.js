const {
    criarCheckoutVenda
} = require('./services/mercadopago');

(async () => {

    try {

        const venda = await criarCheckoutVenda({
            numero: '5500000000000@c.us',
            plano: '1 Mes',
            valor: 'R$ 25,00',
            metodo: 'pix'
        });

        console.log(
            JSON.stringify(
                venda,
                null,
                2
            )
        );

    } catch (erro) {

        console.log('ERRO MP:');
        console.log(erro);

    }

})();
