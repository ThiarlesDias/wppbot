const sessoes = require('../services/sessions');
const menuPrincipal = require('../menus/menuPrincipal');
const meuChamado = require('../menus/meuChamado');
const encaminharAtendente = require('../services/atendimentoHumano');
const notificar = require('../services/notificador');
const {
    buscarServicoPorChamado,
    formatarServico,
    normalizarChamado,
    registrarChamadoExterno
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
    numeroWhatsapp,
    nomeContato = ''
) {

    const etapa = sessoes[numero];
    const chaveServicoExterno = `${numero}_chamado_externo_servico`;

    if (texto === '0' && etapa !== 'chamado_externo_email') {

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

    if (etapa === 'meu_chamado') {

        if (texto === '1') {

            sessoes[numero] = 'chamado_consulta';

            return await client.sendText(
                numero,
                [
                    '*Consultar chamado*',
                    '',
                    'Informe o numero da OS.',
                    '',
                    'Exemplo: OS359',
                    '',
                    '0 - Voltar ao menu'
                ].join('\n')
            );

        }

        if (texto === '2') {

            sessoes[numero] = 'chamado_externo_servico';

            return await client.sendText(
                numero,
                [
                    '*Abrir chamado externo*',
                    '',
                    'Descreva o servico que precisa realizar.',
                    '',
                    'Exemplo: instalar camera, configurar rede, trocar conector, suporte no computador.',
                    '',
                    '0 - Voltar ao menu'
                ].join('\n')
            );

        }

        const possivelChamado = normalizarChamado(texto);

        if (/^OS\d+$/.test(possivelChamado)) {
            sessoes[numero] = 'chamado_consulta';
        } else {
            return await meuChamado(
                client,
                numero
            );
        }

    }

    if (etapa === 'chamado_externo_servico') {

        if (texto.length < 5) {

            return await client.sendText(
                numero,
                'Descreva um pouco melhor o servico para nossa equipe entender o chamado.'
            );

        }

        sessoes[chaveServicoExterno] = texto;
        sessoes[numero] = 'chamado_externo_email';

        return await client.sendText(
            numero,
            [
                'Informe um email para contato, se tiver.',
                '',
                'Se nao quiser informar, digite *0* para continuar sem email.'
            ].join('\n')
        );

    }

    if (etapa === 'chamado_externo_email') {

        const servicoTexto = sessoes[chaveServicoExterno] || '';
        const email = texto === '0' ? '' : texto;
        const chamado = registrarChamadoExterno({
            telefone: limparNumero(numeroWhatsapp || numero),
            whatsappNome: nomeContato,
            servico: servicoTexto,
            email
        });

        delete sessoes[chaveServicoExterno];
        sessoes[numero] = 'meu_chamado';

        await notificar(
            client,
            'NOVO CHAMADO EXTERNO',
            [
                `Chamado: ${chamado.chamado}`,
                `Cliente: ${chamado.cliente_nome || 'Nao informado'}`,
                `WhatsApp: ${chamado.telefone}`,
                chamado.email ? `Email: ${chamado.email}` : '',
                `Servico: ${chamado.servico}`,
                `Status: ${chamado.status}`
            ].filter(Boolean).join('\n')
        );

        return await client.sendText(
            numero,
            [
                `Chamado *${chamado.chamado}* aberto com sucesso.`,
                '',
                'Status: aguardando atendimento',
                '',
                'Nossa equipe recebeu sua solicitacao e vai acompanhar por aqui.',
                '',
                'Voce tambem pode acompanhar pelo site usando o usuario e senha do cadastro da empresa.',
                '',
                '1 - Consultar chamado',
                '9 - Falar com atendente',
                '0 - Voltar ao menu'
            ].join('\n')
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
