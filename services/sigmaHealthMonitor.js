const {
    criarTesteGratis,
    validarLinkCriacaoTeste
} = require('./sigma');
const notificar = require('./notificador');

const INTERVALO_MS = Number(process.env.SIGMA_HEALTH_INTERVAL_MS || 3600000);
const PRIMEIRA_VALIDACAO_MS = Number(process.env.SIGMA_HEALTH_START_DELAY_MS || 30000);

let iniciado = false;
let ultimoOk = null;
let rodando = false;

async function validarCriacaoTeste() {

    if (process.env.SIGMA_HEALTHCHECK_CREATE === '1') {

        const telefone = process.env.SIGMA_HEALTHCHECK_PHONE;

        if (!telefone) {

            return {
                ok: false,
                detalhe: 'SIGMA_HEALTHCHECK_PHONE nao configurado para teste real.'
            };

        }

        await criarTesteGratis(telefone);

        return {
            ok: true,
            detalhe: 'Teste real criado com sucesso.'
        };

    }

    return await validarLinkCriacaoTeste();

}

async function verificarSigma(client) {

    if (rodando) return;

    rodando = true;

    try {

        const resultado = await validarCriacaoTeste();

        if (!resultado.ok) {

            if (ultimoOk !== false) {

                await notificar(
                    client,
                    'LINK TESTE GRATIS COM PROBLEMA',

`O link de criacao de teste do Sigma falhou na validacao.

Status:
${resultado.status || 'Nao informado'}

Detalhe:
${resultado.detalhe}

Link:
${process.env.SIGMA_CHATBOT_URL || 'Nao configurado'}`
                );

            }

            console.log(
                'SIGMA HEALTH FAIL',
                resultado.status || '',
                resultado.detalhe
            );

            ultimoOk = false;
            return;

        }

        if (ultimoOk === false) {

            await notificar(
                client,
                'LINK TESTE GRATIS NORMALIZADO',

`O link de criacao de teste voltou a responder.

Detalhe:
${resultado.detalhe}`
            );

        }

        console.log(
            'SIGMA HEALTH OK',
            resultado.status || '',
            resultado.detalhe
        );

        ultimoOk = true;

    } catch (erro) {

        if (ultimoOk !== false) {

            await notificar(
                client,
                'LINK TESTE GRATIS COM PROBLEMA',

`Erro ao validar criacao de teste:
${erro.message}`
            );

        }

        console.log('SIGMA HEALTH ERROR', erro.message);
        ultimoOk = false;

    } finally {

        rodando = false;

    }

}

function iniciarMonitorSigma(client) {

    if (iniciado || process.env.SIGMA_HEALTH_ENABLED === '0') return;

    iniciado = true;

    setTimeout(
        () => verificarSigma(client),
        PRIMEIRA_VALIDACAO_MS
    );

    setInterval(
        () => verificarSigma(client),
        INTERVALO_MS
    );

    console.log(
        'MONITOR SIGMA HEALTH ATIVO',
        `${Math.round(INTERVALO_MS / 1000)}s`
    );

}

module.exports = iniciarMonitorSigma;
