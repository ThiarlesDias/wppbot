const sessoes = require('./sessions');
const notificar = require('./notificador');
const {
    buscarPagamentoAguardandoComprovante,
    buscarPagamentoInformado,
    buscarPagamentoPendenteValidacao,
    marcarComprovantePagamento,
    marcarPagamentoAguardandoComprovante,
    responderPagamentoInformado
} = require('./pagamentosInformados');
const {
    buscarAssinaturaPorId,
    buscarAssinaturasPorNumero,
    formatarData,
    renovarAssinatura
} = require('./assinaturasStore');
const {
    atualizarClienteCsv
} = require('./clientesCsv');

function limparNumero(valor) {

    return String(valor || '')
        .replace('@c.us', '')
        .replace(/\D/g, '');

}

function normalizarLista(valor) {

    if (Array.isArray(valor)) {

        return valor
            .map(item => String(item || '').trim())
            .filter(Boolean);

    }

    return String(valor || '')
        .split(/[;,]/)
        .map(item => item.trim())
        .filter(Boolean);

}

function aliasesContato(...valores) {

    const aliases = [];

    for (const valor of valores) {

        const texto = String(valor || '').trim();
        const telefone = limparNumero(texto);

        if (texto) aliases.push(texto);

        if (telefone && !texto.endsWith('@lid')) {

            aliases.push(telefone);
            aliases.push(`${telefone}@c.us`);

        }

    }

    return [...new Set(aliases.filter(Boolean))];

}

function aliasesAdmin(numero, numeroWhatsapp) {

    return aliasesContato(
        numero,
        numeroWhatsapp,
        typeof notificar.obterAdmin === 'function' ? notificar.obterAdmin() : '',
        process.env.ADMIN_NOTIFY_WHATSAPP,
        process.env.ADMIN_WHATSAPP,
        process.env.ADMIN_WHATSAPP_ID
    );

}

function chaveAdminPagamento(alias) {

    return `${alias}_validacao_pagamento`;

}

function chaveClienteComprovante(alias) {

    return `${alias}_comprovante_pagamento`;

}

function marcarValidacaoAdminPendente(codigo, numero = '', numeroWhatsapp = '') {

    for (const alias of aliasesAdmin(
        numero,
        numeroWhatsapp
    )) {

        sessoes[chaveAdminPagamento(alias)] = codigo;

    }

}

function obterValidacaoAdminPendente(numero, numeroWhatsapp) {

    for (const alias of aliasesAdmin(
        numero,
        numeroWhatsapp
    )) {

        const codigo = sessoes[chaveAdminPagamento(alias)];

        if (codigo) return codigo;

    }

    return buscarPagamentoPendenteValidacao()?.codigo || '';

}

function limparValidacaoAdminPendente(numero, numeroWhatsapp, codigo) {

    for (const alias of aliasesAdmin(
        numero,
        numeroWhatsapp
    )) {

        const chave = chaveAdminPagamento(alias);

        if (!codigo || sessoes[chave] === codigo) delete sessoes[chave];

    }

}

function marcarClienteAguardandoComprovante(pagamento) {

    for (const alias of aliasesContato(
        pagamento?.numero,
        pagamento?.telefone
    )) {

        sessoes[alias] = 'aguardando_comprovante_pagamento';
        sessoes[chaveClienteComprovante(alias)] = pagamento.codigo;

    }

}

function marcarClienteValidacaoPendente(pagamento) {

    for (const alias of aliasesContato(
        pagamento?.numero,
        pagamento?.telefone
    )) {

        sessoes[alias] = 'pagamento_validacao_pendente';
        sessoes[chaveClienteComprovante(alias)] = pagamento.codigo;

    }

}

function limparClienteValidacaoPagamento(pagamento) {

    for (const alias of aliasesContato(
        pagamento?.numero,
        pagamento?.telefone
    )) {

        if (
            sessoes[alias] === 'aguardando_comprovante_pagamento' ||
            sessoes[alias] === 'pagamento_validacao_pendente'
        ) {

            sessoes[alias] = 'menu';

        }

        delete sessoes[chaveClienteComprovante(alias)];

    }

}

function pagamentoResumoCliente(pagamento) {

    return [
        pagamento.nome ? `Cliente: ${pagamento.nome}` : '',
        pagamento.usuario ? `Usuario: ${pagamento.usuario}` : '',
        pagamento.telefone ? `WhatsApp: ${pagamento.telefone}` : '',
        pagamento.resumo ? ['', 'Acessos encontrados:', pagamento.resumo].join('\n') : ''
    ].filter(Boolean).join('\n');

}

function mensagemValidacaoAdmin(pagamento, motivo = 'informou_pagamento') {

    const titulo = motivo === 'comprovante' ?
        'Cliente enviou comprovante de pagamento.' :
        'Cliente informou que ja realizou o pagamento.';

    return [
        titulo,
        '',
        `Codigo: ${pagamento.codigo}`,
        '',
        pagamentoResumoCliente(pagamento),
        '',
        'O financeiro localizou esse pagamento?',
        '',
        '1 - Sim, confirmar e renovar',
        '2 - Nao, pedir comprovante'
    ].filter(Boolean).join('\n');

}

async function solicitarValidacaoPagamento(client, pagamento, motivo = 'informou_pagamento') {

    if (!pagamento?.codigo) return null;

    marcarValidacaoAdminPendente(pagamento.codigo);
    marcarClienteValidacaoPendente(pagamento);

    await notificar(
        client,
        motivo === 'comprovante' ? 'COMPROVANTE RECEBIDO' : 'VALIDAR PAGAMENTO',
        mensagemValidacaoAdmin(
            pagamento,
            motivo
        )
    );

    return pagamento;

}

function assinaturasDoPagamento(pagamento) {

    const ids = [
        ...normalizarLista(pagamento?.assinaturaIds),
        pagamento?.assinaturaId
    ].map(item => String(item || '').trim()).filter(Boolean);

    const porId = [...new Set(ids)]
        .map(id => buscarAssinaturaPorId(id))
        .filter(Boolean);

    if (porId.length) return porId;

    return buscarAssinaturasPorNumero(
        pagamento?.numero,
        pagamento?.telefone
    ).filter(assinatura =>
        assinatura.status !== 'cancelada' &&
        assinatura.username
    );

}

function renovarPagamentoInformado(pagamento) {

    const assinaturas = assinaturasDoPagamento(pagamento);
    const renovadas = [];

    for (const assinatura of assinaturas) {

        const renovada = renovarAssinatura(
            assinatura.id,
            {
                plano: assinatura.plano,
                valor: assinatura.valor,
                telas: assinatura.telas,
                meses: assinatura.meses,
                nome: assinatura.nome,
                vendaReference: pagamento.codigo,
                paymentId: `manual-${pagamento.codigo}`
            }
        );

        if (renovada) {

            try {

                atualizarClienteCsv(renovada);

            } catch (erro) {

                console.log('ERRO ATUALIZAR CSV PAGAMENTO INFORMADO', erro.message);

            }

            renovadas.push(renovada);

        }

    }

    return renovadas;

}

function mensagemClientePagamentoConfirmado(renovadas) {

    if (!renovadas.length) {

        return [
            'Pagamento confirmado. Obrigado!',
            '',
            'Nossa equipe vai finalizar a renovacao manualmente no painel e avisar voce por aqui.'
        ].join('\n');

    }

    const acessos = renovadas.map((assinatura, indice) => [
        renovadas.length > 1 ? `Acesso ${indice + 1}` : 'Seu acesso',
        assinatura.nome ? `Cliente: ${assinatura.nome}` : '',
        `Usuario: ${assinatura.username || assinatura.usuario || 'Nao informado'}`,
        `Novo vencimento: ${formatarData(assinatura.expiresAt)}`
    ].filter(Boolean).join('\n'));

    return [
        'Pagamento confirmado. Obrigado!',
        '',
        'Sua renovacao foi registrada.',
        '',
        ...acessos,
        '',
        'Nao vamos enviar novos avisos automaticos sobre este vencimento.'
    ].join('\n');

}

function mensagemAdminPagamentoConfirmado(pagamento, renovadas) {

    return [
        'Pagamento confirmado para o cliente.',
        '',
        `Codigo: ${pagamento.codigo}`,
        `Cliente: ${pagamento.nome || pagamento.numero || pagamento.telefone || 'nao informado'}`,
        renovadas.length ?
            `Novo vencimento: ${renovadas.map(item => `${item.username}: ${formatarData(item.expiresAt)}`).join(' | ')}` :
            'Renovacao automatica nao encontrada; confira manualmente no painel.'
    ].join('\n');

}

function mensagemClientePagamentoNaoEncontrado() {

    return [
        'Verificamos com o financeiro e ainda nao encontramos registro desse pagamento.',
        '',
        'Para darmos baixa e renovar seu acesso, envie o comprovante por aqui.',
        '',
        'Assim que o comprovante chegar, vamos validar novamente com o financeiro.'
    ].join('\n');

}

function decisaoAdmin(texto) {

    const resposta = String(texto || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (resposta === '1' || resposta === 'sim' || resposta === 's') return true;
    if (resposta === '2' || resposta === 'nao' || resposta === 'n') return false;

    return null;

}

async function tratarRespostaAdminPagamento({
    client,
    numero,
    numeroWhatsapp,
    texto
}) {

    const aprovado = decisaoAdmin(texto);

    if (aprovado === null) return false;

    const codigo = obterValidacaoAdminPendente(
        numero,
        numeroWhatsapp
    );

    if (!codigo) return false;

    const pagamento = buscarPagamentoInformado(codigo);

    if (!pagamento) {

        limparValidacaoAdminPendente(
            numero,
            numeroWhatsapp,
            codigo
        );

        await client.sendText(
            numero,
            `Nao encontrei a validacao de pagamento codigo ${codigo}.`
        );

        return true;

    }

    limparValidacaoAdminPendente(
        numero,
        numeroWhatsapp,
        codigo
    );

    const destino = pagamento.numero || pagamento.telefone;

    if (aprovado) {

        const renovadas = renovarPagamentoInformado(pagamento);
        const atualizado = responderPagamentoInformado(
            codigo,
            true,
            {
                assinaturaIds: renovadas.map(assinatura => assinatura.id),
                vencimentoNovo: renovadas.map(assinatura => formatarData(assinatura.expiresAt)).join(' | ')
            }
        );

        limparClienteValidacaoPagamento(atualizado || pagamento);

        if (destino) {

            await client.sendText(
                destino,
                mensagemClientePagamentoConfirmado(renovadas)
            );

        }

        await client.sendText(
            numero,
            mensagemAdminPagamentoConfirmado(
                atualizado || pagamento,
                renovadas
            )
        );

        return true;

    }

    const atualizado = marcarPagamentoAguardandoComprovante(codigo) || pagamento;

    marcarClienteAguardandoComprovante(atualizado);

    if (destino) {

        await client.sendText(
            destino,
            mensagemClientePagamentoNaoEncontrado()
        );

    }

    await client.sendText(
        numero,
        [
            'Cliente avisado que o pagamento ainda nao foi localizado.',
            '',
            `Codigo: ${codigo}`,
            'Ficarei aguardando o comprovante por aqui.'
        ].join('\n')
    );

    return true;

}

function idMensagem(message) {

    if (!message?.id) return '';
    if (typeof message.id === 'string') return message.id;

    return message.id._serialized ||
        message.id.serialized ||
        message.id.id ||
        '';

}

function pareceComprovante(message, texto) {

    const tipo = String(message?.type || '').toLowerCase();
    const mime = String(message?.mimetype || '').toLowerCase();
    const corpo = String(texto || message?.caption || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (['image', 'document', 'video'].includes(tipo)) return true;
    if (mime.includes('image/') || mime.includes('pdf')) return true;

    return /comprovante|pix|paguei|pagamento|transferencia/.test(corpo);

}

async function tentarEncaminharComprovante(client, message) {

    const admin = typeof notificar.obterAdmin === 'function' ? notificar.obterAdmin() : '';
    const id = idMensagem(message);

    if (!admin || !id) return false;

    try {

        if (typeof client.forwardMessagesV2 === 'function') {

            await client.forwardMessagesV2(
                admin,
                id
            );

            return true;

        }

        if (typeof client.forwardMessage === 'function') {

            await client.forwardMessage(
                admin,
                id
            );

            return true;

        }

    } catch (erro) {

        console.log('ERRO ENCAMINHAR COMPROVANTE', erro.message);

    }

    return false;

}

async function tratarComprovantePagamento({
    client,
    numero,
    numeroWhatsapp,
    message,
    texto
}) {

    const pagamento = buscarPagamentoAguardandoComprovante(
        numero,
        numeroWhatsapp
    );

    if (!pagamento) return false;
    if (!pareceComprovante(message, texto)) return false;

    const atualizado = marcarComprovantePagamento(
        pagamento.codigo,
        {
            tipo: message?.type || '',
            id: idMensagem(message),
            texto: texto || message?.caption || ''
        }
    ) || pagamento;

    await tentarEncaminharComprovante(
        client,
        message
    );

    await solicitarValidacaoPagamento(
        client,
        atualizado,
        'comprovante'
    );

    await client.sendText(
        numero,
        [
            'Recebi seu comprovante.',
            '',
            'Vou validar novamente com o financeiro e te aviso por aqui.'
        ].join('\n')
    );

    return true;

}

module.exports = {
    marcarClienteAguardandoComprovante,
    marcarClienteValidacaoPendente,
    marcarValidacaoAdminPendente,
    solicitarValidacaoPagamento,
    tratarComprovantePagamento,
    tratarRespostaAdminPagamento
};
