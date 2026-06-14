const sessoes = require('./sessions');
const {
    atendimentoPausado
} = require('./pausaAtendimento');

const timers = {};

function numeroEnv(nome, padrao) {

    const numero = Number(process.env[nome]);

    return Number.isFinite(numero) && numero > 0 ? numero : padrao;

}

function cancelarFollowUp(numero) {

    const timer = timers[numero];

    if (!timer) return;

    clearTimeout(timer.id);
    delete timers[numero];

}

function etapaValida(numero, etapas) {

    return etapas.includes(sessoes[numero]);

}

function mensagemCompra() {

    return [
        'Ainda posso te ajudar a finalizar seu atendimento.',
        '',
        '1 - Adquirir agora',
        '4 - Outro valor',
        '9 - Falar com atendente',
        '8 - Encerrar atendimento',
        '0 - Voltar ao menu'
    ].join('\n');

}

function mensagemPagamento() {

    return [
        'Conseguiu finalizar o pagamento?',
        '',
        'Assim que aprovar, enviamos a confirmacao e os dados do usuario aqui.',
        '',
        '1 - Continuar pagamento',
        '9 - Falar com atendente',
        '8 - Encerrar atendimento',
        '0 - Voltar ao menu'
    ].join('\n');

}

function mensagemConfiguracao() {

    return [
        'Conseguiu finalizar a configuracao?',
        '',
        '1 - Sim, funcionou',
        '2 - Preciso de ajuda',
        '9 - Falar com atendente',
        '8 - Encerrar atendimento',
        '0 - Voltar ao menu'
    ].join('\n');

}

function dadosTipo(tipo) {

    if (tipo === 'pagamento') {

        return {
            etapa: 'followup_pagamento',
            mensagem: mensagemPagamento(),
            delay: numeroEnv('FUNIL_FOLLOWUP_PAGAMENTO_MS', 30 * 60 * 1000),
            etapas: ['checkout_nome', 'checkout_email', 'followup_pagamento']
        };

    }

    if (tipo === 'configuracao') {

        return {
            etapa: 'followup_configuracao',
            mensagem: mensagemConfiguracao(),
            delay: numeroEnv('FUNIL_FOLLOWUP_CONFIG_MS', 20 * 60 * 1000),
            etapas: ['ajuda_config', 'followup_configuracao']
        };

    }

    return {
        etapa: 'followup_compra',
        mensagem: mensagemCompra(),
        delay: numeroEnv('FUNIL_FOLLOWUP_COMPRA_MS', 30 * 60 * 1000),
        etapas: ['pacote', 'pacote_1', 'pacote_3', 'pacote_6', 'pacote_outro_valor', 'pacote_outro_pagamento', 'followup_compra']
    };

}

function agendarFollowUp(client, numero, tipo) {

    if (!client || !numero) return;

    cancelarFollowUp(numero);

    const dados = dadosTipo(tipo);

    timers[numero] = {
        id: setTimeout(async () => {

            try {

                delete timers[numero];

                if (atendimentoPausado(numero)) return;
                if (!etapaValida(numero, dados.etapas)) return;

                sessoes[numero] = dados.etapa;

                await client.sendText(
                    numero,
                    dados.mensagem
                );

            } catch (erro) {

                console.log(
                    'ERRO FOLLOWUP FUNIL',
                    erro.message
                );

            }

        }, dados.delay)
    };

}

module.exports = {
    agendarFollowUp,
    cancelarFollowUp
};
