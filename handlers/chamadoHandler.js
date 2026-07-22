const sessoes = require('../services/sessions');
const menuPrincipal = require('../menus/menuPrincipal');
const meuChamado = require('../menus/meuChamado');
const encaminharAtendente = require('../services/atendimentoHumano');
const {
    buscarServicoPorChamado,
    formatarServico,
    normalizarChamado
} = require('../services/servicosCsv');

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function chamadoPertenceAoContato(servico, numero, numeroWhatsapp) {

    const telefoneChamado = limparNumero(servico?.telefone);
    const telefonesContato = [
        limparNumero(numeroWhatsapp),
        limparNumero(numero)
    ].filter(Boolean);

    if (!telefoneChamado) return false;

    return telefonesContato.includes(telefoneChamado);

}

module.exports = async function chamadoHandler(
    client,
    numero,
    texto,
    numeroWhatsapp
) {

    if (texto === '0') {

        sessoes[numero] = 'menu';

        return await menuPrincipal(
            client,
            numero
        );

    }

    if (texto === '9') {

        return await encaminharAtendente(
            client,
            numero,
            numeroWhatsapp,
            'Consulta de chamado'
        );

    }

    const chamado = normalizarChamado(texto);

    if (!chamado) {

        return await meuChamado(
            client,
            numero
        );

    }

    const servico = buscarServicoPorChamado(chamado);

    if (!servico) {

        return await client.sendText(
            numero,
            [
                `Nao encontrei o chamado *${chamado}*.`,
                '',
                'Confira o numero da OS e envie novamente.',
                '',
                '9 - Falar com atendente',
                '0 - Voltar ao menu'
            ].join('\n')
        );

    }

    if (!chamadoPertenceAoContato(
        servico,
        numero,
        numeroWhatsapp
    )) {

        return await client.sendText(
            numero,
            [
                `Encontrei o chamado *${chamado}*, mas ele nao esta vinculado a este WhatsApp.`,
                '',
                'Por seguranca, so mostramos os dados quando o numero do atendimento bate com o numero cadastrado na OS.',
                '',
                '9 - Falar com atendente',
                '0 - Voltar ao menu'
            ].join('\n')
        );

    }

    return await client.sendText(
        numero,
        formatarServico(servico)
    );

};
