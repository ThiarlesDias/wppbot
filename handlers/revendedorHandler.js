const sessoes = require('../services/sessions');
const menuRevendedor = require('../menus/revendedor');
const {
    enviarMenu
} = require('../services/menuInterativo');
const notificar = require('../services/notificador');
const {
    buscarClienteRevendedorPorUsuario,
    consumirCreditoRevendedor,
    listarChamadosAbertosRevendedor,
    listarClientesRevendedor,
    registrarChamadoRevendedor
} = require('../services/revendedoresCsv');

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function chave(numero, sufixo) {

    return `${numero}_${sufixo}`;

}

function nomeRevendedor(revendedor) {

    return revendedor?.nome || limparNumero(revendedor?.telefone) || 'Revendedor';

}

function textoCliente(cliente) {

    return [
        cliente.cliente_nome || 'Cliente sem nome',
        cliente.usuario ? `Usuario: ${cliente.usuario}` : '',
        cliente.vencimento ? `Vencimento: ${cliente.vencimento}` : '',
        cliente.cliente_telefone ? `WhatsApp: ${cliente.cliente_telefone}` : ''
    ].filter(Boolean).join('\n');

}

function resumoClientes(clientes) {

    if (!clientes.length) {
        return 'Nao encontrei clientes vinculados ao seu cadastro de revendedor.';
    }

    const limite = 20;
    const linhas = clientes.slice(0, limite).map((cliente, indice) => [
        `${indice + 1}. ${cliente.cliente_nome || 'Cliente sem nome'}`,
        cliente.usuario ? `   Usuario: ${cliente.usuario}` : '',
        cliente.vencimento ? `   Vencimento: ${cliente.vencimento}` : ''
    ].filter(Boolean).join('\n'));

    if (clientes.length > limite) {
        linhas.push(`\nMostrando ${limite} de ${clientes.length}. Para renovar, informe o usuario do sistema.`);
    }

    return linhas.join('\n');

}

function extrairNomeTelefone(texto) {

    const original = String(texto || '').trim();
    const matchTelefone = original.match(/(?:\+?55)?\D*(\d[\d\s().-]{9,}\d)/);
    const telefone = limparNumero(matchTelefone?.[0]);
    const nome = telefone ?
        original.replace(matchTelefone[0], '').trim().replace(/\s+/g, ' ') :
        original.trim();

    return {
        nome,
        telefone
    };

}

async function menuTeste(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Criar teste',
            descricao: 'Escolha o tipo de teste para o cliente.',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Com adultos'
                },
                {
                    id: '2',
                    titulo: 'Sem adultos'
                },
                {
                    id: '0',
                    titulo: 'Voltar'
                }
            ]
        }
    );

}

async function menuRenovar(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Renovar cliente',
            descricao: 'Voce pode listar seus clientes ou informar direto o usuario do sistema.',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Listar clientes'
                },
                {
                    id: '2',
                    titulo: 'Informar cliente'
                },
                {
                    id: '0',
                    titulo: 'Voltar'
                }
            ]
        }
    );

}

async function menuChamados(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Chamados revendedor',
            descricao: 'Consulte chamados abertos ou abra um novo chamado para a TOPTEC.',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Consultar chamado aberto'
                },
                {
                    id: '2',
                    titulo: 'Abrir chamado'
                },
                {
                    id: '0',
                    titulo: 'Voltar'
                }
            ]
        }
    );

}

async function falarComToptec(client, numero, numeroWhatsapp, revendedor, origem) {

    await notificar(
        client,
        'REVENDEDOR AGUARDANDO ATENDIMENTO',
        [
            'Revendedor aguardando atendimento.',
            '',
            `Revendedor: ${nomeRevendedor(revendedor)}`,
            `WhatsApp cadastro: ${revendedor.telefone || 'nao informado'}`,
            `Atendimento: ${numero}`,
            numeroWhatsapp ? `WhatsApp resolvido: ${numeroWhatsapp}` : '',
            `Origem: ${origem}`
        ].filter(Boolean).join('\n')
    );

    sessoes[numero] = 'revendedor_menu';

    return await client.sendText(
        numero,
        'Seu atendimento foi encaminhado para a TOPTEC. Aguarde nosso retorno por aqui.'
    );

}

async function listarClientes(client, numero, revendedor) {

    const clientes = listarClientesRevendedor(revendedor);

    return await client.sendText(
        numero,
        [
            '*Clientes vinculados a voce*',
            '',
            resumoClientes(clientes),
            '',
            'Para renovar, escolha *2 - Renovar cliente* e informe o usuario do sistema.'
        ].join('\n')
    );

}

async function confirmarTeste(client, numero, numeroWhatsapp, revendedor) {

    const dados = sessoes[chave(numero, 'rev_teste_dados')];
    const tipo = sessoes[chave(numero, 'rev_teste_tipo')];

    if (!dados || !tipo) {
        sessoes[numero] = 'revendedor_menu';
        return await menuRevendedor(
            client,
            numero,
            revendedor
        );
    }

    const credito = consumirCreditoRevendedor(
        revendedor,
        1
    );

    if (!credito.ok) {

        await notificar(
            client,
            'REVENDA SEM CREDITOS',
            [
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                `Creditos atuais: ${credito.creditos || 0}`,
                '',
                `Tentou criar teste ${tipo} para ${dados.nome} (${dados.telefone}).`
            ].join('\n')
        );

        sessoes[numero] = 'revendedor_menu';

        return await client.sendText(
            numero,
            [
                'Voce nao tem creditos disponiveis para criar novo teste.',
                '',
                'Fale com a TOPTEC para liberar mais creditos ou regularizar seu fechamento.'
            ].join('\n')
        );

    }

    const chamado = registrarChamadoRevendedor({
        revendedor,
        clienteNome: dados.nome,
        usuario: '',
        descricao: `Criar teste ${tipo} para ${dados.nome} (${dados.telefone})`,
        observacao: 'Solicitacao criada pelo fluxo de revendedor'
    });

    await notificar(
        client,
        'SOLICITACAO DE TESTE - REVENDEDOR',
        [
            `Codigo: ${chamado.codigo}`,
            `Revendedor: ${nomeRevendedor(revendedor)}`,
            `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
            '',
            `Cliente: ${dados.nome}`,
            `WhatsApp cliente: ${dados.telefone}`,
            `Tipo: ${tipo}`,
            `Creditos restantes: ${credito.creditos}`,
            '',
            'Criar teste no painel e retornar ao revendedor.'
        ].join('\n')
    );

    delete sessoes[chave(numero, 'rev_teste_dados')];
    delete sessoes[chave(numero, 'rev_teste_tipo')];
    sessoes[numero] = 'revendedor_menu';

    return await client.sendText(
        numero,
        [
            `Solicitacao de teste enviada para a TOPTEC. Codigo: ${chamado.codigo}`,
            `Credito consumido. Restam: ${credito.creditos}`,
            '',
            'Como o painel fica com a TOPTEC, nossa equipe vai criar o teste e retornar por aqui.'
        ].join('\n')
    );

}

async function confirmarRenovacao(client, numero, numeroWhatsapp, revendedor) {

    const cliente = sessoes[chave(numero, 'rev_renovar_cliente')];

    if (!cliente) {
        sessoes[numero] = 'revendedor_renovar';
        return await menuRenovar(
            client,
            numero
        );
    }

    const chamado = registrarChamadoRevendedor({
        revendedor,
        clienteNome: cliente.cliente_nome,
        usuario: cliente.usuario,
        descricao: `Solicitacao de renovacao do usuario ${cliente.usuario}`,
        observacao: 'Solicitacao criada pelo fluxo de revendedor'
    });

    await notificar(
        client,
        'RENOVACAO - REVENDEDOR',
        [
            `Codigo: ${chamado.codigo}`,
            `Revendedor: ${nomeRevendedor(revendedor)}`,
            `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
            '',
            '*Cliente para renovar*',
            textoCliente(cliente),
            '',
            'Renovar no painel e avisar o revendedor.'
        ].join('\n')
    );

    delete sessoes[chave(numero, 'rev_renovar_cliente')];
    sessoes[numero] = 'revendedor_menu';

    return await client.sendText(
        numero,
        [
            `Solicitacao de renovacao enviada para a TOPTEC. Codigo: ${chamado.codigo}`,
            '',
            'Nossa equipe vai validar no painel e confirmar por aqui.'
        ].join('\n')
    );

}

async function consultarChamados(client, numero, revendedor) {

    const chamados = listarChamadosAbertosRevendedor(revendedor);

    if (!chamados.length) {
        return await client.sendText(
            numero,
            'Nao encontrei chamados abertos para seu cadastro.'
        );
    }

    const linhas = chamados.slice(0, 10).map(chamado => [
        `*${chamado.codigo}*`,
        `Status: ${chamado.status || 'aguardando atendimento'}`,
        chamado.cliente_nome ? `Cliente: ${chamado.cliente_nome}` : '',
        chamado.usuario ? `Usuario: ${chamado.usuario}` : '',
        chamado.descricao ? `Servico: ${chamado.descricao}` : '',
        chamado.atualizado_em ? `Atualizado: ${chamado.atualizado_em}` : ''
    ].filter(Boolean).join('\n'));

    return await client.sendText(
        numero,
        linhas.join('\n\n')
    );

}

module.exports = async function revendedorHandler(
    client,
    numero,
    texto,
    numeroWhatsapp,
    revendedor
) {

    const etapa = sessoes[numero] || 'revendedor_menu';

    if (texto === '5' && etapa !== 'revendedor_teste' && etapa !== 'revendedor_renovar') {
        return await falarComToptec(
            client,
            numero,
            numeroWhatsapp,
            revendedor,
            etapa
        );
    }

    if (etapa === 'revendedor_menu') {

        if (texto === '1') {
            sessoes[numero] = 'revendedor_teste';
            return await menuTeste(
                client,
                numero
            );
        }

        if (texto === '2') {
            sessoes[numero] = 'revendedor_renovar';
            return await menuRenovar(
                client,
                numero
            );
        }

        if (texto === '3') {
            return await listarClientes(
                client,
                numero,
                revendedor
            );
        }

        if (texto === '4') {
            sessoes[numero] = 'revendedor_chamados';
            return await menuChamados(
                client,
                numero
            );
        }

        return await menuRevendedor(
            client,
            numero,
            revendedor
        );

    }

    if (etapa === 'revendedor_teste') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_menu';
            return await menuRevendedor(
                client,
                numero,
                revendedor
            );
        }

        if (!['1', '2'].includes(texto)) {
            return await menuTeste(
                client,
                numero
            );
        }

        sessoes[chave(numero, 'rev_teste_tipo')] = texto === '1' ?
            'com adultos' :
            'sem adultos';
        sessoes[numero] = 'revendedor_teste_dados';

        return await client.sendText(
            numero,
            [
                'Informe o *nome* e o *WhatsApp* do cliente para o teste.',
                '',
                'Exemplo:',
                'Joao 5543999999999',
                '',
                '0 - Voltar'
            ].join('\n')
        );

    }

    if (etapa === 'revendedor_teste_dados') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_teste';
            return await menuTeste(
                client,
                numero
            );
        }

        const dados = extrairNomeTelefone(texto);

        if (!dados.nome || dados.telefone.length < 10) {
            return await client.sendText(
                numero,
                'Nao consegui identificar nome e WhatsApp. Envie assim: Joao 5543999999999'
            );
        }

        sessoes[chave(numero, 'rev_teste_dados')] = dados;
        sessoes[numero] = 'revendedor_teste_confirmar';

        return await client.sendText(
            numero,
            [
                '*Confirmar solicitacao de teste?*',
                '',
                `Cliente: ${dados.nome}`,
                `WhatsApp: ${dados.telefone}`,
                `Tipo: ${sessoes[chave(numero, 'rev_teste_tipo')]}`,
                '',
                '1 - Confirmar',
                '0 - Voltar'
            ].join('\n')
        );

    }

    if (etapa === 'revendedor_teste_confirmar') {

        if (texto === '1') {
            return await confirmarTeste(
                client,
                numero,
                numeroWhatsapp,
                revendedor
            );
        }

        sessoes[numero] = 'revendedor_teste';
        return await menuTeste(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_renovar') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_menu';
            return await menuRevendedor(
                client,
                numero,
                revendedor
            );
        }

        if (texto === '1') {
            await listarClientes(
                client,
                numero,
                revendedor
            );
            return await menuRenovar(
                client,
                numero
            );
        }

        if (texto === '2') {
            sessoes[numero] = 'revendedor_renovar_usuario';
            return await client.sendText(
                numero,
                [
                    'Informe o *usuario do sistema* do cliente que deseja renovar.',
                    '',
                    '0 - Voltar'
                ].join('\n')
            );
        }

        return await menuRenovar(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_renovar_usuario') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_renovar';
            return await menuRenovar(
                client,
                numero
            );
        }

        const cliente = buscarClienteRevendedorPorUsuario(
            revendedor,
            texto
        );

        if (!cliente) {
            return await client.sendText(
                numero,
                [
                    'Nao encontrei esse usuario na sua lista de clientes.',
                    '',
                    'Confira o usuario do sistema e envie novamente.',
                    '0 - Voltar'
                ].join('\n')
            );
        }

        sessoes[chave(numero, 'rev_renovar_cliente')] = cliente;
        sessoes[numero] = 'revendedor_renovar_confirmar';

        return await client.sendText(
            numero,
            [
                '*Cliente encontrado*',
                '',
                textoCliente(cliente),
                '',
                'Confirmar solicitacao de renovacao?',
                '1 - Confirmar',
                '0 - Voltar'
            ].join('\n')
        );

    }

    if (etapa === 'revendedor_renovar_confirmar') {

        if (texto === '1') {
            return await confirmarRenovacao(
                client,
                numero,
                numeroWhatsapp,
                revendedor
            );
        }

        sessoes[numero] = 'revendedor_renovar';
        return await menuRenovar(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_chamados') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_menu';
            return await menuRevendedor(
                client,
                numero,
                revendedor
            );
        }

        if (texto === '1') {
            await consultarChamados(
                client,
                numero,
                revendedor
            );
            return await menuChamados(
                client,
                numero
            );
        }

        if (texto === '2') {
            sessoes[numero] = 'revendedor_chamado_descricao';
            return await client.sendText(
                numero,
                [
                    'Descreva o chamado com o maximo de detalhes possivel.',
                    '',
                    '0 - Voltar'
                ].join('\n')
            );
        }

        return await menuChamados(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_chamado_descricao') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_chamados';
            return await menuChamados(
                client,
                numero
            );
        }

        sessoes[chave(numero, 'rev_chamado_descricao')] = texto;
        sessoes[numero] = 'revendedor_chamado_confirmar';

        return await client.sendText(
            numero,
            [
                '*Confirmar abertura do chamado?*',
                '',
                texto,
                '',
                '1 - Confirmar',
                '0 - Voltar'
            ].join('\n')
        );

    }

    if (etapa === 'revendedor_chamado_confirmar') {

        if (texto !== '1') {
            sessoes[numero] = 'revendedor_chamados';
            return await menuChamados(
                client,
                numero
            );
        }

        const descricao = sessoes[chave(numero, 'rev_chamado_descricao')];
        const chamado = registrarChamadoRevendedor({
            revendedor,
            descricao,
            observacao: 'Chamado aberto pelo revendedor no WhatsApp'
        });

        delete sessoes[chave(numero, 'rev_chamado_descricao')];
        sessoes[numero] = 'revendedor_menu';

        await notificar(
            client,
            'CHAMADO REVENDEDOR',
            [
                `Codigo: ${chamado.codigo}`,
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                '',
                `Descricao: ${descricao}`
            ].join('\n')
        );

        return await client.sendText(
            numero,
            [
                `Chamado ${chamado.codigo} aberto com sucesso.`,
                '',
                'A TOPTEC recebeu sua solicitacao e vai acompanhar por aqui.'
            ].join('\n')
        );

    }

    sessoes[numero] = 'revendedor_menu';
    return await menuRevendedor(
        client,
        numero,
        revendedor
    );

};
