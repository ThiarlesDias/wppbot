
const fs = require('fs');
const path = require('path');

function registrar(numero, etapa, texto) {

    try {

        const data = new Date();

        const linha =
            `[${data.toLocaleString('pt-BR')}] ` +
            `[${numero}] ` +
            `[${etapa}] ` +
            `${texto}\n`;

        const arquivo = path.join(
            __dirname,
            '..',
            'logs',
            'atendimentos.log'
        );

        fs.appendFileSync(
            arquivo,
            linha,
            'utf8'
        );

    } catch (erro) {

        console.log(
            'ERRO LOGGER',
            erro
        );

    }

}

module.exports = registrar;
