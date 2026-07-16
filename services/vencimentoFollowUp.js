const sessoes = require('./sessions');
const {
    atendimentoPausado
} = require('./pausaAtendimento');

const timers = {};

function numeroEnv(nome, padrao) {

    const numero = Number(process.env[nome]);

    return Number.isFinite(numero) && numero > 0 ? numero : padrao;

}

function cancelarFollowUpVencimento(numero) {

    const timer = timers[numero];

    if (!timer) return;

    clearTimeout(timer.id);
    delete timers[numero];

}

function mensagemRetomada() {

    return [
        'Passando para confirmar se voce conseguiu ver o aviso de vencimento.',
        '',
        'Para manter seu acesso ativo, escolha uma opcao:',
        '',
        '1 - Renovar agora',
        '2 - Cancelar minha assinatura',
        '3 - Ja realizei o pagamento',
        '9 - Falar com atendente',
        '0 - Voltar ao menu'
    ].join('\n');

}

function agendarFollowUpVencimento(client, numero) {

    if (!client || !numero) return;

    cancelarFollowUpVencimento(numero);

    const delay = numeroEnv(
        'VENCIMENTOS_FOLLOWUP_MS',
        6 * 60 * 60 * 1000
    );

    timers[numero] = {
        id: setTimeout(async () => {

            try {

                delete timers[numero];

                if (atendimentoPausado(numero)) return;
                if (sessoes[numero] !== 'vencimento_aviso') return;

                await client.sendText(
                    numero,
                    mensagemRetomada()
                );

            } catch (erro) {

                console.log(
                    'ERRO FOLLOWUP VENCIMENTO',
                    erro.message
                );

            }

        }, delay)
    };

}

module.exports = {
    agendarFollowUpVencimento,
    cancelarFollowUpVencimento
};
