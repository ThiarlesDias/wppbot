const {
    linkPortalChamados
} = require('../services/servicosCsv');

module.exports = async function meuChamado(client, numero) {

    return await client.sendText(
        numero,
        [
            '*Meu chamado*',
            '',
            'Escolha uma opcao:',
            '',
            '1 - Consultar chamado',
            '2 - Abrir chamado externo',
            '9 - Falar com atendente',
            '0 - Voltar ao menu',
            '',
            'Tambem e possivel acompanhar pelo site usando o usuario e senha do cadastro da empresa:',
            linkPortalChamados()
        ].join('\n')
    );

};
