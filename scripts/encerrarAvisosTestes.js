const {
    encerrarAvisosContratacaoTestes
} = require('../services/testesCsv');

const resumo = encerrarAvisosContratacaoTestes();

console.log(`Arquivo: ${resumo.arquivo}`);
console.log(`Total: ${resumo.total}`);
console.log(`Encerrados: ${resumo.encerrados}`);
