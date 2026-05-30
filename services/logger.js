
const fs = require('fs');
const path = require('path');

function registrar(numero, etapa, texto) {

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

}

module.exports = registrar;

