const fs = require('fs');
const {
    caminhoCsv
} = require('./clientesCsv');
const {
    importarArquivo
} = require('../scripts/importarAssinaturas');

const INTERVALO_MS = Number(process.env.CLIENTES_IMPORT_INTERVAL_MS || 300000);

let iniciado = false;
let ultimoMtime = 0;

function importarSeAlterou(forcar = false) {

    if (process.env.CLIENTES_AUTO_IMPORT === '0') return;

    const arquivo = caminhoCsv();

    if (!fs.existsSync(arquivo)) {

        if (forcar) console.log('CLIENTES CSV nao encontrado:', arquivo);
        return;

    }

    const stat = fs.statSync(arquivo);

    if (!forcar && stat.mtimeMs === ultimoMtime) return;

    ultimoMtime = stat.mtimeMs;

    try {

        const resultado = importarArquivo(
            arquivo,
            {
                log: false
            }
        );

        console.log(
            'CLIENTES CSV IMPORTADO',
            `importados=${resultado.importados}`,
            `erros=${resultado.erros.length}`,
            arquivo
        );

        if (resultado.erros.length) {

            console.log(
                'ERROS CLIENTES CSV:',
                resultado.erros.join(' | ')
            );

        }

    } catch (erro) {

        console.log('ERRO IMPORTAR CLIENTES CSV', erro.message);

    }

}

function iniciarMonitorClientesCsv() {

    if (iniciado) return;

    iniciado = true;

    importarSeAlterou(true);

    setInterval(
        () => importarSeAlterou(false),
        INTERVALO_MS
    );

    console.log(
        'MONITOR CLIENTES CSV ATIVO',
        `${Math.round(INTERVALO_MS / 1000)}s`
    );

}

module.exports = iniciarMonitorClientesCsv;
