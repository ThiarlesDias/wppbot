const sessoes = require('../services/sessions');
const menuRevendedor = require('../menus/revendedor');
const ajudaConfiguracao = require('../menus/suporte/ajudaConfiguracao');
const passosConfiguracao = require('../menus/suporte/passosConfiguracao');
const {
    enviarMenu
} = require('../services/menuInterativo');
const notificar = require('../services/notificador');
const {
    buscarClienteRevendedorPorUsuario,
    consumirCreditoRevendedor,
    formatarData,
    limparTestesRevendedor,
    listarChamadosAbertosRevendedor,
    listarClientesRevendedor,
    listarTestesRevendedor,
    marcarTesteRevendedorComoClienteSolicitado,
    obterCreditosRevendedor,
    registrarChamadoRevendedor,
    registrarTesteRevendedorCliente
} = require('../services/revendedoresCsv');
const {
    criarTesteRevendedor
} = require('../services/revendedoresTestes');

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function normalizarTelefoneBrasil(valor) {

    const limpo = limparNumero(valor);
    let local = limpo;

    if (
        limpo.startsWith('55') &&
        (limpo.length === 12 || limpo.length === 13)
    ) {
        local = limpo.slice(2);
    }

    if (local.length === 10) {
        local = `${local.slice(0, 2)}9${local.slice(2)}`;
    }

    if (
        (local.length === 10 || local.length === 11) &&
        !local.startsWith('55')
    ) {
        return `55${local}`;
    }

    return limpo;

}

function telefoneValido(valor) {

    const limpo = limparNumero(valor);

    return [10, 11, 12, 13].includes(limpo.length);

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

function resumoTestes(testes) {

    if (!testes.length) {
        return 'Nao encontrei testes ativos vinculados ao seu cadastro.';
    }

    const limite = 20;
    const linhas = testes.slice(0, limite).map((teste, indice) => [
        `${indice + 1}. ${teste.cliente_nome || 'Cliente sem nome'}`,
        teste.cliente_telefone ? `   WhatsApp: ${teste.cliente_telefone}` : '',
        teste.usuario ? `   Usuario: ${teste.usuario}` : '',
        teste.vencimento ? `   Vencimento: ${teste.vencimento}` : '',
        `   Situacao: ${situacaoTeste(teste)}`
    ].filter(Boolean).join('\n'));

    if (testes.length > limite) {
        linhas.push(`\nMostrando ${limite} de ${testes.length}.`);
    }

    return linhas.join('\n');

}

function montarDadosAcessoTeste(teste) {

    return [
        '*Teste ativo encontrado*',
        '',
        `Cliente: ${teste.cliente_nome || 'Nao informado'}`,
        teste.cliente_telefone ? `WhatsApp: ${teste.cliente_telefone}` : '',
        teste.vencimento ? `Vencimento: ${teste.vencimento}` : '',
        '',
        '*Dados de acesso*',
        teste.usuario ? `Usuario: ${teste.usuario}` : '',
        teste.senha ? `Senha: ${teste.senha}` : '',
        teste.dns ? `DNS: ${String(teste.dns).replace(/\/$/, '')}/` : '',
        teste.m3u ? `M3U: ${teste.m3u}` : ''
    ].filter(Boolean).join('\n');

}

function parseDataRevenda(valor) {

    if (!valor) return null;

    const texto = String(valor).trim();
    const direta = new Date(texto);

    if (!Number.isNaN(direta.getTime())) return direta;

    const match = texto.match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (!match) return null;

    return new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4] || 0),
        Number(match[5] || 0),
        Number(match[6] || 0)
    );

}

function situacaoTeste(teste) {

    const vencimento = parseDataRevenda(teste?.vencimento);

    if (!vencimento) return 'ativo/vencido';

    return vencimento.getTime() < Date.now() ?
        'vencido' :
        'ativo';

}

function buscarTesteEscolhido(testes, texto) {

    const indice = Number.parseInt(texto, 10);

    if (
        Number.isInteger(indice) &&
        indice >= 1 &&
        indice <= testes.length
    ) {
        return testes[indice - 1];
    }

    const telefone = normalizarTelefoneBrasil(texto);

    if (!telefone) return null;

    return testes.find(teste =>
        normalizarTelefoneBrasil(teste.cliente_telefone) === telefone
    ) || null;

}

function extrairNomeTelefone(texto) {

    const original = String(texto || '').trim();
    const matchTelefone = original.match(/(?:\+?55)?[\s().-]*(\d[\d\s().-]{8,}\d)/);
    const telefone = normalizarTelefoneBrasil(matchTelefone?.[0]);
    const nome = telefone ?
        original.replace(matchTelefone[0], '').trim().replace(/\s+/g, ' ') :
        original.trim();

    return {
        nome,
        telefone
    };

}

async function pedirNomeTeste(client, numero) {

    return await client.sendText(
        numero,
        [
            'Informe o *nome do cliente* para o teste.',
            '',
            'Exemplo: Joao',
            '',
            '0 - Voltar'
        ].join('\n')
    );

}

async function pedirTelefoneTeste(client, numero) {

    return await client.sendText(
        numero,
        [
            'Agora informe o *WhatsApp do cliente* com DDD.',
            '',
            'Pode enviar com ou sem 55.',
            'Exemplos:',
            '42988682052',
            '5542988682052',
            '',
            '0 - Voltar'
        ].join('\n')
    );

}

async function confirmarDadosTeste(client, numero, dados) {

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
                    id: '3',
                    titulo: 'Limpar testes'
                },
                {
                    id: '0',
                    titulo: 'Voltar'
                }
            ]
        }
    );

}

async function menuCriarCliente(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Criar cliente',
            descricao: 'O cliente ja tem teste ativo ou vencido?',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Sim, buscar teste'
                },
                {
                    id: '2',
                    titulo: 'Nao, criar teste'
                },
                {
                    id: '0',
                    titulo: 'Voltar'
                }
            ]
        }
    );

}

async function menuTipoCriarCliente(client, numero) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Tipo do teste',
            descricao: 'Escolha o tipo de teste para criar o acesso do cliente.',
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

function vencimentoTeste(teste) {

    if (teste.vencimento) {
        return formatarData(teste.vencimento);
    }

    return formatarData(new Date(Date.now() + 6 * 60 * 60 * 1000));

}

function vencimentoClienteRevenda() {

    return formatarData(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

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

async function abrirAjudaConfiguracao(client, numero) {

    sessoes[numero] = 'revendedor_ajuda_config';

    return await ajudaConfiguracao(
        client,
        numero
    );

}

async function tratarAjudaConfiguracao(client, numero, texto, numeroWhatsapp, revendedor) {

    if (texto === '1') {
        return await passosConfiguracao.smartTv(
            client,
            numero
        );
    }

    if (texto === '2') {
        return await passosConfiguracao.computador(
            client,
            numero
        );
    }

    if (texto === '3') {
        return await passosConfiguracao.celular(
            client,
            numero
        );
    }

    if (texto === '4') {
        return await passosConfiguracao.outro(
            client,
            numero
        );
    }

    if (texto === '9') {
        return await falarComToptec(
            client,
            numero,
            numeroWhatsapp,
            revendedor,
            'Ajuda de configuracao revendedor'
        );
    }

    if (texto === '8') {
        sessoes[numero] = 'revendedor_menu';

        return await client.sendText(
            numero,
            'Atendimento de configuracao encerrado. Quando precisar, envie uma mensagem por aqui.'
        );
    }

    if (texto === '0') {
        sessoes[numero] = 'revendedor_menu';

        return await menuRevendedor(
            client,
            numero,
            revendedor
        );
    }

    return await ajudaConfiguracao(
        client,
        numero
    );

}

async function menuPosTeste(client, numero) {

    return await client.sendText(
        numero,
        [
            'Precisa de ajuda para configurar no aparelho do cliente?',
            '',
            '6 - Ajuda com configuracao',
            '0 - Voltar ao menu'
        ].join('\n')
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

async function listarTestesParaCriarCliente(client, numero, revendedor) {

    const testes = listarTestesRevendedor(revendedor);

    if (!testes.length) {
        sessoes[numero] = 'revendedor_criar_cliente';

        return await client.sendText(
            numero,
            [
                'Nao encontrei testes ativos ou vencidos vinculados ao seu cadastro.',
                '',
                'Se o cliente nao tem teste, escolha a opcao de informar cliente.'
            ].join('\n')
        );
    }

    sessoes[chave(numero, 'rev_testes_criar_cliente')] = testes;
    sessoes[numero] = 'revendedor_criar_cliente_teste_escolher';

    return await client.sendText(
        numero,
        [
            '*Testes ativos ou vencidos da sua revenda*',
            '',
            resumoTestes(testes),
            '',
            'Digite o *WhatsApp do cliente* que deseja transformar em cliente.',
            'Tambem aceito o numero da lista.',
            '',
            '0 - Voltar'
        ].join('\n')
    );

}

async function escolherTesteParaCriarCliente(client, numero, texto, revendedor) {

    if (texto === '0') {
        sessoes[numero] = 'revendedor_criar_cliente';
        return await menuCriarCliente(
            client,
            numero
        );
    }

    const testes = sessoes[chave(numero, 'rev_testes_criar_cliente')] ||
        listarTestesRevendedor(revendedor);
    const teste = buscarTesteEscolhido(
        testes,
        texto
    );

    if (!teste) {
        return await client.sendText(
            numero,
            [
                'Nao encontrei teste ativo ou vencido com esse WhatsApp.',
                '',
                'Envie o WhatsApp do cliente exatamente como aparece na lista, ou digite 0 para voltar.'
            ].join('\n')
        );
    }

    sessoes[chave(numero, 'rev_criar_cliente_teste')] = teste;
    sessoes[numero] = 'revendedor_criar_cliente_confirmar';

    return await client.sendText(
        numero,
        [
            '*Confirmar criacao de cliente?*',
            '',
            montarDadosAcessoTeste(teste),
            '',
            `Vencimento informado: ${vencimentoClienteRevenda()}`,
            '',
            '1 - Confirmar',
            '0 - Voltar'
        ].join('\n')
    );

}

async function pedirNomeCriarCliente(client, numero) {

    return await client.sendText(
        numero,
        [
            'Informe o *nome do cliente* que sera criado.',
            '',
            'Exemplo: Joao',
            '',
            '0 - Voltar'
        ].join('\n')
    );

}

async function pedirTelefoneCriarCliente(client, numero) {

    return await client.sendText(
        numero,
        [
            'Agora informe o *WhatsApp do cliente* com DDD.',
            '',
            'Pode enviar com ou sem 55.',
            'Exemplo: 42988682052',
            '',
            '0 - Voltar'
        ].join('\n')
    );

}

async function confirmarDadosCriarCliente(client, numero, dados) {

    const tipo = sessoes[chave(numero, 'rev_criar_cliente_tipo')];

    return await client.sendText(
        numero,
        [
            '*Confirmar criacao de cliente?*',
            '',
            `Cliente: ${dados.nome}`,
            `WhatsApp: ${dados.telefone}`,
            tipo ? `Tipo do teste: ${tipo}` : '',
            `Vencimento informado: ${vencimentoClienteRevenda()}`,
            '',
            'O bot vai criar um teste e a TOPTEC sera avisada para validar a ativacao.',
            '',
            '1 - Confirmar',
            '0 - Voltar'
        ].filter(Boolean).join('\n')
    );

}

async function confirmarCriacaoCliente(client, numero, numeroWhatsapp, revendedor) {

    const teste = sessoes[chave(numero, 'rev_criar_cliente_teste')];
    const dadosManual = sessoes[chave(numero, 'rev_criar_cliente_dados')];
    const tipoManual = sessoes[chave(numero, 'rev_criar_cliente_tipo')];
    const vencimentoCliente = vencimentoClienteRevenda();
    let testeFinal = teste;
    let clienteNome = teste?.cliente_nome || dadosManual?.nome || '';
    let clienteTelefone = teste?.cliente_telefone || dadosManual?.telefone || '';
    let usuario = teste?.usuario || '';
    let creditoRestante = null;

    if (!clienteNome && !clienteTelefone && !usuario) {
        sessoes[numero] = 'revendedor_criar_cliente';
        return await menuCriarCliente(
            client,
            numero
        );
    }

    if (!testeFinal && dadosManual) {
        const creditosAtuais = obterCreditosRevendedor(revendedor);

        if (creditosAtuais < 1) {
            await notificar(
                client,
                'REVENDA SEM CREDITOS - CRIAR CLIENTE',
                [
                    `Revendedor: ${nomeRevendedor(revendedor)}`,
                    `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                    `Creditos atuais: ${creditosAtuais}`,
                    '',
                    `Tentou criar cliente/teste para ${clienteNome} (${clienteTelefone}).`
                ].join('\n')
            );

            sessoes[numero] = 'revendedor_menu';

            return await client.sendText(
                numero,
                [
                    'Voce nao tem creditos disponiveis para criar o teste deste cliente.',
                    '',
                    'Fale com a TOPTEC para liberar mais creditos ou regularizar seu fechamento.'
                ].join('\n')
            );
        }

        try {
            testeFinal = await criarTesteRevendedor({
                nome: dadosManual.nome,
                telefone: dadosManual.telefone,
                tipo: tipoManual || 'com adultos',
                revendedor
            });
        } catch (erro) {
            console.error(
                'ERRO CRIAR CLIENTE REVENDEDOR',
                erro.message
            );

            await notificar(
                client,
                'ERRO CRIAR CLIENTE - REVENDEDOR',
                [
                    `Revendedor: ${nomeRevendedor(revendedor)}`,
                    `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                    '',
                    `Cliente: ${clienteNome}`,
                    `WhatsApp cliente: ${clienteTelefone}`,
                    `Tipo: ${tipoManual || 'com adultos'}`,
                    '',
                    `Erro: ${erro.message}`
                ].join('\n')
            );

            return await client.sendText(
                numero,
                [
                    'Nao consegui criar o teste para este cliente agora.',
                    '',
                    'A TOPTEC foi avisada para verificar internamente. Nenhum credito foi consumido.'
                ].join('\n')
            );
        }

        const credito = consumirCreditoRevendedor(
            revendedor,
            1
        );

        if (credito.ok) {
            creditoRestante = credito.creditos;
        } else {
            await notificar(
                client,
                'CREDITO NAO DESCONTADO - CRIAR CLIENTE',
                [
                    `Revendedor: ${nomeRevendedor(revendedor)}`,
                    `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                    '',
                    `Cliente: ${clienteNome}`,
                    `WhatsApp cliente: ${clienteTelefone}`,
                    testeFinal.usuario ? `Usuario teste: ${testeFinal.usuario}` : '',
                    '',
                    `Motivo: ${credito.motivo || 'falha desconhecida'}`
                ].filter(Boolean).join('\n')
            );
        }

        const registrado = registrarTesteRevendedorCliente({
            revendedor,
            clienteNome,
            clienteTelefone,
            usuario: testeFinal.usuario || '',
            senha: testeFinal.senha || '',
            dns: testeFinal.dns || '',
            m3u: testeFinal.m3u || '',
            vencimento: vencimentoCliente,
            observacao: `Criar cliente via teste | Tipo: ${tipoManual || 'com adultos'}`
        });

        testeFinal = {
            ...registrado,
            ...testeFinal,
            cliente_nome: clienteNome,
            cliente_telefone: clienteTelefone,
            vencimento: vencimentoCliente
        };
        usuario = testeFinal.usuario || usuario;
    }

    const chamado = registrarChamadoRevendedor({
        revendedor,
        clienteNome,
        usuario,
        descricao: usuario ?
            `Criar cliente/teste a partir do usuario ${usuario}` :
            `Criar cliente/teste para ${clienteNome} (${clienteTelefone})`,
        observacao: [
            'Solicitacao criada pelo fluxo de revendedor',
            teste ? `Situacao do teste anterior: ${situacaoTeste(teste)}` : `Teste criado no fluxo: ${tipoManual || 'com adultos'}`,
            `Vencimento informado ao revendedor: ${vencimentoCliente}`,
            testeFinal?.senha ? `Senha teste: ${testeFinal.senha}` : '',
            testeFinal?.dns ? `DNS: ${testeFinal.dns}` : '',
            testeFinal?.m3u ? `M3U: ${testeFinal.m3u}` : ''
        ].filter(Boolean).join(' | ')
    });

    await notificar(
        client,
        'CRIAR CLIENTE - REVENDEDOR',
        [
            `Codigo: ${chamado.codigo}`,
            `Revendedor: ${nomeRevendedor(revendedor)}`,
            `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
            '',
            '*Cliente/teste para validar*',
            `Nome: ${clienteNome || 'Nao informado'}`,
            `WhatsApp: ${clienteTelefone || 'Nao informado'}`,
            usuario ? `Usuario teste: ${usuario}` : '',
            testeFinal?.senha ? `Senha teste: ${testeFinal.senha}` : '',
            testeFinal?.dns ? `DNS: ${testeFinal.dns}` : '',
            testeFinal?.m3u ? `M3U: ${testeFinal.m3u}` : '',
            `Vencimento informado: ${vencimentoCliente}`,
            teste ? `Situacao teste anterior: ${situacaoTeste(teste)}` : `Teste criado agora: ${tipoManual || 'com adultos'}`,
            creditoRestante !== null ? `Creditos restantes: ${creditoRestante}` : '',
            '',
            'Validar no painel e ajustar a ativacao para 30 dias, se necessario.'
        ].filter(Boolean).join('\n')
    );

    if (testeFinal) {
        marcarTesteRevendedorComoClienteSolicitado(
            revendedor,
            testeFinal,
            {
                vencimento: vencimentoCliente,
                observacao: `Vencimento de cliente informado: ${vencimentoCliente}`
            }
        );
    }

    delete sessoes[chave(numero, 'rev_testes_criar_cliente')];
    delete sessoes[chave(numero, 'rev_criar_cliente_teste')];
    delete sessoes[chave(numero, 'rev_criar_cliente_dados')];
    delete sessoes[chave(numero, 'rev_criar_cliente_tipo')];
    sessoes[numero] = 'revendedor_menu';

    const dadosTeste = testeFinal?.mensagem ||
        (
            testeFinal ?
                montarDadosAcessoTeste(testeFinal) :
                ''
        );

    return await client.sendText(
        numero,
        [
            `Solicitacao enviada para a TOPTEC. Codigo: ${chamado.codigo}`,
            '',
            dadosTeste,
            '',
            `Vencimento informado: ${vencimentoCliente}`,
            creditoRestante !== null ? `Credito consumido. Restam: ${creditoRestante}` : '',
            '',
            'A TOPTEC vai validar internamente e ajustar a ativacao no painel, se necessario.'
        ].filter(Boolean).join('\n')
    );

}

async function pedirConfirmacaoLimparTestes(client, numero, revendedor) {

    const testes = listarTestesRevendedor(revendedor);

    if (!testes.length) {
        sessoes[numero] = 'revendedor_teste';

        return await client.sendText(
            numero,
            'Nao encontrei testes ativos ou vencidos para limpar.'
        );
    }

    sessoes[chave(numero, 'rev_limpar_testes_total')] = String(testes.length);
    sessoes[numero] = 'revendedor_limpar_testes_confirmar';

    return await client.sendText(
        numero,
        [
            '*Limpar testes da revenda?*',
            '',
            `Encontrei ${testes.length} teste(s) ativo(s) ou vencido(s).`,
            '',
            'Ao confirmar, esses contatos vao para a lista de remarketing da TOPTEC e deixam de aparecer como teste ativo para voce.',
            '',
            '1 - Confirmar limpeza',
            '0 - Voltar'
        ].join('\n')
    );

}

async function confirmarLimpezaTestes(client, numero, texto, numeroWhatsapp, revendedor) {

    if (texto === '0') {
        sessoes[numero] = 'revendedor_teste';
        return await menuTeste(
            client,
            numero
        );
    }

    if (texto !== '1') {
        return await pedirConfirmacaoLimparTestes(
            client,
            numero,
            revendedor
        );
    }

    const movidos = limparTestesRevendedor(revendedor);
    delete sessoes[chave(numero, 'rev_limpar_testes_total')];
    sessoes[numero] = 'revendedor_teste';

    if (movidos.length) {
        await notificar(
            client,
            'TESTES REVENDA PARA REMARKETING',
            [
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                `Total movido: ${movidos.length}`,
                '',
                ...movidos.slice(0, 10).map(item =>
                    `${item.cliente_nome || 'Sem nome'} - ${item.cliente_telefone || 'sem telefone'} - ${item.usuario || 'sem usuario'}`
                ),
                movidos.length > 10 ? `... e mais ${movidos.length - 10}` : ''
            ].filter(Boolean).join('\n')
        );
    }

    await client.sendText(
        numero,
        [
            `Limpeza concluida. ${movidos.length} teste(s) foram enviados para remarketing da TOPTEC.`,
            '',
            'Se quiser criar novo teste, escolha uma opcao abaixo.'
        ].join('\n')
    );

    return await menuTeste(
        client,
        numero
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

    const creditosAtuais = obterCreditosRevendedor(revendedor);

    if (creditosAtuais < 1) {

        await notificar(
            client,
            'REVENDA SEM CREDITOS',
            [
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                `Creditos atuais: ${creditosAtuais}`,
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

    let teste;

    try {
        teste = await criarTesteRevendedor({
            nome: dados.nome,
            telefone: dados.telefone,
            tipo,
            revendedor
        });
    } catch (erro) {

        console.error(
            'ERRO TESTE REVENDEDOR',
            erro.message
        );

        await notificar(
            client,
            'ERRO TESTE REVENDEDOR',
            [
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                '',
                `Cliente: ${dados.nome}`,
                `WhatsApp cliente: ${dados.telefone}`,
                `Tipo: ${tipo}`,
                '',
                `Erro: ${erro.message}`
            ].join('\n')
        );

        return await client.sendText(
            numero,
            [
                'Nao consegui criar o teste automaticamente agora.',
                '',
                'A TOPTEC foi avisada para verificar o link de criacao. Nenhum credito foi consumido.'
            ].join('\n')
        );

    }

    const credito = consumirCreditoRevendedor(
        revendedor,
        1
    );

    if (!credito.ok) {
        await notificar(
            client,
            'CREDITO NAO DESCONTADO - REVENDEDOR',
            [
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                '',
                `Cliente: ${dados.nome}`,
                `WhatsApp cliente: ${dados.telefone}`,
                teste.usuario ? `Usuario teste: ${teste.usuario}` : '',
                '',
                `Motivo: ${credito.motivo || 'falha desconhecida'}`
            ].filter(Boolean).join('\n')
        );

        return await client.sendText(
            numero,
            [
                'O teste foi criado, mas nao consegui descontar o credito automaticamente.',
                '',
                'A TOPTEC foi avisada para ajustar seu saldo.'
            ].join('\n')
        );
    }

    let testeRegistrado;

    try {
        testeRegistrado = registrarTesteRevendedorCliente({
            revendedor,
            clienteNome: dados.nome,
            clienteTelefone: dados.telefone,
            usuario: teste.usuario || '',
            senha: teste.senha || '',
            dns: teste.dns || '',
            m3u: teste.m3u || '',
            vencimento: vencimentoTeste(teste),
            observacao: `Tipo: ${tipo}`
        });
    } catch (erro) {
        console.error(
            'ERRO REGISTRAR TESTE REVENDEDOR CSV',
            erro.message
        );

        await notificar(
            client,
            'ERRO PLANILHA TESTE REVENDEDOR',
            [
                `Revendedor: ${nomeRevendedor(revendedor)}`,
                `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
                '',
                `Cliente: ${dados.nome}`,
                `WhatsApp cliente: ${dados.telefone}`,
                teste.usuario ? `Usuario teste: ${teste.usuario}` : '',
                '',
                `Erro: ${erro.message}`
            ].filter(Boolean).join('\n')
        );
    }

    const chamado = registrarChamadoRevendedor({
        revendedor,
        clienteNome: dados.nome,
        usuario: teste.usuario || '',
        descricao: `Teste ${tipo} criado para ${dados.nome} (${dados.telefone})`,
        observacao: 'Teste criado automaticamente pelo fluxo de revendedor'
    });

    await notificar(
        client,
        'TESTE CRIADO - REVENDEDOR',
        [
            `Codigo: ${chamado.codigo}`,
            `Revendedor: ${nomeRevendedor(revendedor)}`,
            `WhatsApp revendedor: ${revendedor.telefone || numeroWhatsapp || numero}`,
            '',
            `Cliente: ${dados.nome}`,
            `WhatsApp cliente: ${dados.telefone}`,
            `Tipo: ${tipo}`,
            teste.usuario ? `Usuario teste: ${teste.usuario}` : '',
            testeRegistrado?.vencimento ? `Vencimento teste: ${testeRegistrado.vencimento}` : '',
            `Creditos restantes: ${credito.creditos}`,
            '',
            'Teste criado automaticamente pelo link da revenda.'
        ].filter(Boolean).join('\n')
    );

    delete sessoes[chave(numero, 'rev_teste_dados')];
    delete sessoes[chave(numero, 'rev_teste_tipo')];
    sessoes[numero] = 'revendedor_pos_teste';

    await client.sendText(
        numero,
        [
            'Teste criado com sucesso.',
            `Credito consumido. Restam: ${credito.creditos}`,
            '',
            teste.mensagem || 'Dados do teste criados, mas o painel nao retornou uma mensagem pronta.'
        ].join('\n')
    );

    return await menuPosTeste(
        client,
        numero
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

    if (
        texto === '5' &&
        ![
            'revendedor_teste',
            'revendedor_renovar',
            'revendedor_criar_cliente',
            'revendedor_criar_cliente_teste_escolher',
            'revendedor_criar_cliente_nome',
            'revendedor_criar_cliente_telefone',
            'revendedor_criar_cliente_tipo',
            'revendedor_criar_cliente_confirmar'
        ].includes(etapa)
    ) {
        return await falarComToptec(
            client,
            numero,
            numeroWhatsapp,
            revendedor,
            etapa
        );
    }

    if (
        texto === '6' ||
        texto.includes('ajuda') ||
        texto.includes('configuracao') ||
        texto.includes('configuração')
    ) {
        return await abrirAjudaConfiguracao(
            client,
            numero
        );
    }

    if (etapa === 'revendedor_ajuda_config') {
        return await tratarAjudaConfiguracao(
            client,
            numero,
            texto,
            numeroWhatsapp,
            revendedor
        );
    }

    if (etapa === 'revendedor_pos_teste') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_menu';
            return await menuRevendedor(
                client,
                numero,
                revendedor
            );
        }

        return await menuPosTeste(
            client,
            numero
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

        if (texto === '6') {
            return await abrirAjudaConfiguracao(
                client,
                numero
            );
        }

        if (texto === '7') {
            sessoes[numero] = 'revendedor_criar_cliente';
            return await menuCriarCliente(
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

        if (texto === '3') {
            return await pedirConfirmacaoLimparTestes(
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
        delete sessoes[chave(numero, 'rev_teste_dados')];
        sessoes[numero] = 'revendedor_teste_nome';

        return await pedirNomeTeste(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_limpar_testes_confirmar') {
        return await confirmarLimpezaTestes(
            client,
            numero,
            texto,
            numeroWhatsapp,
            revendedor
        );
    }

    if (etapa === 'revendedor_teste_nome' || etapa === 'revendedor_teste_dados') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_teste';
            return await menuTeste(
                client,
                numero
            );
        }

        const dadosCompletos = extrairNomeTelefone(texto);

        if (
            dadosCompletos.nome &&
            telefoneValido(dadosCompletos.telefone)
        ) {
            sessoes[chave(numero, 'rev_teste_dados')] = dadosCompletos;
            sessoes[numero] = 'revendedor_teste_confirmar';

            return await confirmarDadosTeste(
                client,
                numero,
                dadosCompletos
            );
        }

        const nome = String(texto || '').trim();

        if (!nome || nome.length < 2 || /^\d+$/.test(nome)) {
            return await client.sendText(
                numero,
                'Informe apenas o nome do cliente. Exemplo: Joao'
            );
        }

        sessoes[chave(numero, 'rev_teste_dados')] = {
            nome
        };
        sessoes[numero] = 'revendedor_teste_telefone';

        return await pedirTelefoneTeste(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_teste_telefone') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_teste_nome';
            return await pedirNomeTeste(
                client,
                numero
            );
        }

        const dados = sessoes[chave(numero, 'rev_teste_dados')];

        if (!dados?.nome) {
            sessoes[numero] = 'revendedor_teste_nome';
            return await pedirNomeTeste(
                client,
                numero
            );
        }

        if (!telefoneValido(texto)) {
            return await client.sendText(
                numero,
                [
                    'Nao consegui identificar o WhatsApp.',
                    '',
                    'Envie com DDD, com ou sem 55.',
                    'Exemplo: 42988682052'
                ].join('\n')
            );
        }

        const completos = {
            ...dados,
            telefone: normalizarTelefoneBrasil(texto)
        };

        sessoes[chave(numero, 'rev_teste_dados')] = completos;
        sessoes[numero] = 'revendedor_teste_confirmar';

        return await confirmarDadosTeste(
            client,
            numero,
            completos
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

    if (etapa === 'revendedor_criar_cliente') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_menu';
            return await menuRevendedor(
                client,
                numero,
                revendedor
            );
        }

        if (texto === '1') {
            return await listarTestesParaCriarCliente(
                client,
                numero,
                revendedor
            );
        }

        if (texto === '2') {
            delete sessoes[chave(numero, 'rev_criar_cliente_teste')];
            delete sessoes[chave(numero, 'rev_criar_cliente_dados')];
            delete sessoes[chave(numero, 'rev_criar_cliente_tipo')];
            sessoes[numero] = 'revendedor_criar_cliente_nome';
            return await pedirNomeCriarCliente(
                client,
                numero
            );
        }

        return await menuCriarCliente(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_criar_cliente_teste_escolher') {
        return await escolherTesteParaCriarCliente(
            client,
            numero,
            texto,
            revendedor
        );
    }

    if (etapa === 'revendedor_criar_cliente_nome') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_criar_cliente';
            return await menuCriarCliente(
                client,
                numero
            );
        }

        const nome = String(texto || '').trim();

        if (!nome || nome.length < 2 || /^\d+$/.test(nome)) {
            return await client.sendText(
                numero,
                'Informe apenas o nome do cliente. Exemplo: Joao'
            );
        }

        sessoes[chave(numero, 'rev_criar_cliente_dados')] = {
            nome
        };
        sessoes[numero] = 'revendedor_criar_cliente_telefone';

        return await pedirTelefoneCriarCliente(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_criar_cliente_telefone') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_criar_cliente_nome';
            return await pedirNomeCriarCliente(
                client,
                numero
            );
        }

        const dados = sessoes[chave(numero, 'rev_criar_cliente_dados')];

        if (!dados?.nome) {
            sessoes[numero] = 'revendedor_criar_cliente_nome';
            return await pedirNomeCriarCliente(
                client,
                numero
            );
        }

        if (!telefoneValido(texto)) {
            return await client.sendText(
                numero,
                [
                    'Nao consegui identificar o WhatsApp.',
                    '',
                    'Envie com DDD, com ou sem 55.',
                    'Exemplo: 42988682052'
                ].join('\n')
            );
        }

        const completos = {
            ...dados,
            telefone: normalizarTelefoneBrasil(texto)
        };

        sessoes[chave(numero, 'rev_criar_cliente_dados')] = completos;
        sessoes[numero] = 'revendedor_criar_cliente_tipo';

        return await menuTipoCriarCliente(
            client,
            numero
        );

    }

    if (etapa === 'revendedor_criar_cliente_tipo') {

        if (texto === '0') {
            sessoes[numero] = 'revendedor_criar_cliente_telefone';
            return await pedirTelefoneCriarCliente(
                client,
                numero
            );
        }

        if (!['1', '2'].includes(texto)) {
            return await menuTipoCriarCliente(
                client,
                numero
            );
        }

        const dados = sessoes[chave(numero, 'rev_criar_cliente_dados')];

        if (!dados?.nome || !dados?.telefone) {
            sessoes[numero] = 'revendedor_criar_cliente_nome';
            return await pedirNomeCriarCliente(
                client,
                numero
            );
        }

        sessoes[chave(numero, 'rev_criar_cliente_tipo')] = texto === '1' ?
            'com adultos' :
            'sem adultos';
        sessoes[numero] = 'revendedor_criar_cliente_confirmar';

        return await confirmarDadosCriarCliente(
            client,
            numero,
            dados
        );

    }

    if (etapa === 'revendedor_criar_cliente_confirmar') {

        if (texto === '1') {
            return await confirmarCriacaoCliente(
                client,
                numero,
                numeroWhatsapp,
                revendedor
            );
        }

        sessoes[numero] = 'revendedor_criar_cliente';
        return await menuCriarCliente(
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
