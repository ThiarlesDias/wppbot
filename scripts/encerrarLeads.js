const {
    encerrarLeadsAtivos
} = require('../services/leadsCsv');

const observacao = process.argv.slice(2).join(' ').trim() ||
    'Leads encerrados em lote para interromper remarketing.';
const resumo = encerrarLeadsAtivos(observacao);

console.log(`Arquivo: ${resumo.arquivo}`);
console.log(`Total: ${resumo.total}`);
console.log(`Encerrados: ${resumo.encerrados}`);
