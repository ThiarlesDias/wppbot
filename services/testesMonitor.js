const sessoes = require('./sessions');
const {
    montarWidTelefone
} = require('./whatsappNumero');
const {
    caminhoTestesCsv,
    marcarAvisoContratacao,
    marcarTesteEncerrado,
    testesParaAvisar,
    testesParaAvisoContratacao,
    testesVencidosParaReenvio
} = require('./testesCsv');

function numeroEnv(nome, padrao) {

    const numero = Number(process.env[nome]);

    return Number.isFinite(numero) && numero > 0 ? numero : padrao;

}

function mensagemTesteEncerrado(teste) {

    return [
        '*Seu teste gratis foi encerrado*',
        '',
        `Usuario testado: ${teste.usuario || 'Nao informado'}`,
        `Vencimento: ${teste.vencimento || 'Nao informado'}`,
        '',
        'Se o sistema funcionou bem para voce, agora e o melhor momento para ativar seu pacote e continuar usando sem interrupcao.',
        '',
        '1 - Contratar agora',
        '9 - Falar com atendente',
        '8 - Nao quero receber avisos',
        '0 - Voltar ao menu'
    ].join('\n');

}

function mensagemConviteContratacao(teste) {

    return [
        '*Ainda quer continuar com seu acesso?*',
        '',
        `Usuario do teste: ${teste.usuario || 'Nao informado'}`,
        `Teste venceu em: ${teste.vencimento || 'Nao informado'}`,
        '',
        'Com o pacote ativo voce continua assistindo sem precisar criar outro teste.',
        '',
        '1 - Contratar agora',
        '9 - Falar com atendente',
        '8 - Nao quero receber avisos',
        '0 - Voltar ao menu'
    ].join('\n');

}

function aliasesTeste(teste, destino = '') {

    const telefone = String(teste.telefone || '').replace(/\D/g, '');

    return [
        destino,
        telefone,
        telefone ? montarWidTelefone(telefone) : ''
    ].filter(Boolean);

}

function marcarSessaoTeste(teste, destino, etapa) {

    for (const alias of [...new Set(aliasesTeste(teste, destino))]) {

        sessoes[alias] = etapa;
        sessoes[`${alias}_iniciado`] = true;
        sessoes[`${alias}_teste_usuario`] = teste.usuario;

    }

}

async function verificarTestesEncerrados(client, opcoes = {}) {

    const forcar = Boolean(opcoes.forcar);
    const vencidos = forcar ?
        testesVencidosParaReenvio() :
        testesParaAvisar();

    if (!vencidos.length) {
        console.log('TESTES VENCIDOS PARA AVISAR 0');
    } else {

        console.log(`TESTES VENCIDOS PARA AVISAR ${vencidos.length}${forcar ? ' FORCADO' : ''}`);

        for (const teste of vencidos) {

            const destino = montarWidTelefone(teste.telefone);

            if (!destino) {
                console.log('TESTE VENCIDO SEM TELEFONE VALIDO', teste.usuario);
                marcarTesteEncerrado(teste.usuario);
                continue;
            }

            try {
                marcarSessaoTeste(
                    teste,
                    destino,
                    'teste_encerrado'
                );

                await client.sendText(
                    destino,
                    mensagemTesteEncerrado(teste)
                );

                marcarTesteEncerrado(teste.usuario);
                console.log('AVISO TESTE ENCERRADO', destino, teste.usuario);
            } catch (erro) {
                console.log(
                    'ERRO AVISO TESTE ENCERRADO',
                    teste.usuario,
                    erro.message
                );
            }

        }
    }

    const pendentesContratacao = forcar ?
        [] :
        testesParaAvisoContratacao();

    if (!pendentesContratacao.length) {
        console.log('TESTES PARA CONVITE CONTRATACAO 0');
        return;
    }

    console.log(`TESTES PARA CONVITE CONTRATACAO ${pendentesContratacao.length}`);

    for (const teste of pendentesContratacao) {

        const destino = montarWidTelefone(teste.telefone);

        if (!destino) {
            console.log('TESTE CONVITE SEM TELEFONE VALIDO', teste.usuario);
            marcarAvisoContratacao(teste.usuario);
            continue;
        }

        try {
            marcarSessaoTeste(
                teste,
                destino,
                'teste_convite'
            );

            await client.sendText(
                destino,
                mensagemConviteContratacao(teste)
            );

            marcarAvisoContratacao(teste.usuario);
            console.log('AVISO CONTRATACAO TESTE', destino, teste.usuario);
        } catch (erro) {
            console.log(
                'ERRO AVISO CONTRATACAO TESTE',
                teste.usuario,
                erro.message
            );
        }

    }

}

function iniciarMonitorTestes(client) {

    const intervalo = numeroEnv(
        'TESTES_MONITOR_INTERVAL_MS',
        6 * 60 * 60 * 1000
    );
    const delayInicial = numeroEnv(
        'TESTES_MONITOR_START_DELAY_MS',
        15000
    );

    console.log(`MONITOR TESTES ATIVO ${Math.round(intervalo / 1000)}s ${caminhoTestesCsv()}`);

    setTimeout(
        () => verificarTestesEncerrados(client),
        delayInicial
    );

    setInterval(
        () => verificarTestesEncerrados(client),
        intervalo
    );

}

iniciarMonitorTestes.verificarTestesEncerrados = verificarTestesEncerrados;

module.exports = iniciarMonitorTestes;
