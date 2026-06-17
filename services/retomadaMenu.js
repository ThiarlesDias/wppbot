const sessoes = require('./sessions');
const {
    atendimentoPausado
} = require('./pausaAtendimento');

const timers = {};

function numeroEnv(nome, padrao) {

    const numero = Number(process.env[nome]);

    return Number.isFinite(numero) && numero > 0 ? numero : padrao;

}

function cancelarRetomadaMenu(numero) {

    const timer = timers[numero];

    if (!timer) return;

    clearTimeout(timer.id);
    delete timers[numero];

}

function mensagemRetomada(tentativa) {

    const linhas = [
        'Vimos que voce ainda nao escolheu nenhuma opcao.',
        '',
        'Digite a opcao desejada do menu ou *0* para falar com atendente.'
    ];

    if (tentativa >= 3) {

        linhas.push(
            '',
            'Se preferir, digite *8* para encerrar este atendimento.'
        );

    }

    return linhas.join('\n');

}

function etapaPermiteRetomada(numero) {

    return ['menu', 'retomada_menu'].includes(sessoes[numero]);

}

function agendarTentativa(client, numero, tentativa) {

    const intervalo = numeroEnv(
        'RETOMADA_MENU_INTERVALO_MS',
        10 * 60 * 1000
    );

    timers[numero] = {
        id: setTimeout(async () => {

            try {

                delete timers[numero];

                if (atendimentoPausado(numero)) return;
                if (!etapaPermiteRetomada(numero)) return;

                sessoes[numero] = 'retomada_menu';

                await client.sendText(
                    numero,
                    mensagemRetomada(tentativa)
                );

                if (tentativa < 3) {

                    agendarTentativa(
                        client,
                        numero,
                        tentativa + 1
                    );

                }

            } catch (erro) {

                console.log(
                    'ERRO RETOMADA MENU',
                    erro.message
                );

            }

        }, intervalo)
    };

}

function agendarRetomadaMenu(client, numero) {

    if (!client || !numero) return;

    cancelarRetomadaMenu(numero);
    agendarTentativa(
        client,
        numero,
        1
    );

}

module.exports = {
    agendarRetomadaMenu,
    cancelarRetomadaMenu
};
