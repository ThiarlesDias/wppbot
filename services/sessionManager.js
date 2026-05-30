
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

    const trintaMinutos =
        30 * 60 * 1000;

    const duasHoras =
        2 * 60 * 60 * 1000;

    if (
        sessao.etapa === 'em_analise'
    ) {

        if (tempoParado > duasHoras) {

            sessao.etapa = 'menu';

        }

    } else {

        if (tempoParado > trintaMinutos) {

            sessao.etapa = 'menu';

        }

    }

}

module.exports = {
    obterSessao,
    atualizarInteracao,
    verificarTimeout
};

