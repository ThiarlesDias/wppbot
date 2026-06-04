const {
    listarAssinaturas
} = require('../services/assinaturasStore');
const {
    caminhoCsv,
    linhaDaAssinatura,
    salvarClientesCsv
} = require('../services/clientesCsv');

function main() {

    const arquivo = process.argv[2] || caminhoCsv();
    const linhas = listarAssinaturas()
        .filter(assinatura =>
            assinatura.status !== 'cancelada' &&
            assinatura.username
        )
        .map(linhaDaAssinatura)
        .sort((a, b) =>
            String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') ||
            String(a.usuario || '').localeCompare(String(b.usuario || ''), 'pt-BR')
        );

    salvarClientesCsv(
        linhas,
        arquivo
    );

    console.log(`Exportados: ${linhas.length}`);
    console.log(`Arquivo: ${arquivo}`);

}

main();
