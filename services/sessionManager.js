
const sessoes = require('./sessions');

function obterSessao(numero) {

    if (!sessoes[numero]) {

        sessoes[numero] = {
            etapa: 'menu',
            ultimaInteracao: Date.now()
        };

    }

    return sessoes[numero];

}

function atualizarInteracao(numero) {

    const sessao = obterSessao(numero);

    sessao.ultimaInteracao = Date.now();

}

function verificarTimeout(numero) {

    const sessao = obterSessao(numero);

    const agora = Date.now();

    const tempoParado =
        agora - sessao.ultimaInteracao;

    const timeoutPadrao =
        30 * 60 * 1000;

    const timeoutAnalise =
        2 * 60 * 60 * 1000;

    if (sessao.etapa === 'em_analise') {

        if (tempoParado > timeoutAnalise) {

            sessao.etapa = 'menu';

        }

    } else {

        if (tempoParado > timeoutPadrao) {

            sessao.etapa = 'menu';

        }

    }

    return sessao;

}

module.exports = {
    obterSessao,
    atualizarInteracao,
    verificarTimeout
};
