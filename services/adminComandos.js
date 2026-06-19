const fs = require('fs');
const path = require('path');
const sessoes = require('./sessions');
const {
    caminhoCsv,
    lerClientesCsv
} = require('./clientesCsv');
const {
    buscarAssinaturaPorId,
    buscarAssinaturasPorNumero
} = require('./assinaturasStore');
const menuPrincipal = require('../menus/menuPrincipal');
const menuSuporte = require('../menus/suporte');
const menuComercial = require('../menus/comercial');
const menuFinanceiro = require('../menus/financeiro');
const menuHumano = require('../menus/humano');
const pacote = require('../menus/suporte/pacote');
const renovacao = require('../menus/suporte/renovacao');
const testeGratis = require('../menus/suporte/testeGratis');
const semSinal = require('../menus/suporte/semSinal');
const ajudaConfiguracao = require('../menus/suporte/ajudaConfiguracao');
const {
    enviarTextoSeguro
} = require('./envioWhatsapp');
const {
    enviarCampanha,
    statusMarketing
} = require('./marketingCampanha');
const {
    limparPausasAtendimento
} = require('./pausaAtendimento');
const statusDiario = require('./statusDiario');
const iniciarMonitorTestes = require('./testesMonitor');
const {
    caminhoTestesCsv,
    lerTestesCsv
} = require('./testesCsv');
const {
    caminhoLeadsCsv,
    lerLeadsCsv
} = require('./leadsCsv');

const DATA_DIR = path.join(__dirname, '..', 'data');

function arquivoInfo(caminho) {

    try {

        const stat = fs.statSync(caminho);

        return {
            existe: true,
            tamanho: stat.size,
            atualizadoEm: stat.mtime
        };

    } catch (_) {

        return {
            existe: false,
            tamanho: 0,
            atualizadoEm: null
        };

    }

}

function formatarData(data) {

    if (!data) return 'Nao encontrado';

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }
    ).format(data);

}

function menuAdmin() {

    return [
        '🛠️ *Comandos admin*',
        '',
        '#admin - ver esta lista',
        '#status - status rapido do bot',
        '#clientes - resumo da planilha de clientes',
        '#clientes ultimos - ultimos 10 clientes da planilha',
        '#leads - resumo da planilha de leads',
        '#leads ultimos - ultimos 10 leads',
        '#marketing status - status da campanha',
        '#marketing enviar - disparar campanha com limite/intervalo',
        '#status imagens - ver imagens do status diario',
        '#status postar - postar uma imagem aleatoria agora',
        '#testes - resumo da planilha de testes',
        '#testes verificar - avisar testes vencidos agora',
        '#vencimentos - rodar checagem de vencimentos agora',
        '#renovar telefone/usuario - colocar cliente no fluxo de renovacao',
        '#fluxos - listar fluxos disponiveis',
        '#fluxo telefone/usuario fluxo - colocar cliente em um fluxo',
        '#pausas limpar - liberar todos os atendimentos pausados',
        '#restart - reiniciar somente o bot',
        '',
        'Obs: reiniciar a VM inteira nao e feito pelo bot. O container nao deve ter esse poder.'
    ].join('\n');

}

function statusBot() {

    const clientesPath = caminhoCsv();
    const marketingPath = process.env.MARKETING_CSV_PATH ||
        path.join(DATA_DIR, 'marketing.csv');
    const leadsPath = caminhoLeadsCsv();
    const pausaPath = path.join(DATA_DIR, 'atendimentos-pausados.json');
    const clientesInfo = arquivoInfo(clientesPath);
    const marketingInfo = arquivoInfo(marketingPath);
    const leadsInfo = arquivoInfo(leadsPath);
    const pausasInfo = arquivoInfo(pausaPath);

    return [
        '✅ *Bot online*',
        '',
        `Uptime: ${Math.floor(process.uptime() / 60)} min`,
        '',
        '*Arquivos*',
        `Clientes: ${clientesInfo.existe ? 'OK' : 'Nao encontrado'}`,
        `Atualizado: ${formatarData(clientesInfo.atualizadoEm)}`,
        `Leads: ${leadsInfo.existe ? 'OK' : 'Nao encontrado'}`,
        `Marketing: ${marketingInfo.existe ? 'OK' : 'Nao encontrado'}`,
        `Pausas: ${pausasInfo.existe ? 'sim' : 'nao'}`,
        '',
        '*Env*',
        `ADMIN_WHATSAPP: ${process.env.ADMIN_WHATSAPP ? 'configurado' : 'faltando'}`,
        `ADMIN_NOTIFY_WHATSAPP: ${process.env.ADMIN_NOTIFY_WHATSAPP ? 'configurado' : 'faltando'}`,
        `SIGMA_CHATBOT_URL: ${process.env.SIGMA_CHATBOT_URL ? 'configurado' : 'faltando'}`
    ].join('\n');

}

function resumoClientes() {

    const arquivo = caminhoCsv();
    const clientes = lerClientesCsv(arquivo);
    const info = arquivoInfo(arquivo);

    return [
        '📄 *Clientes*',
        '',
        `Arquivo: ${arquivo}`,
        `Existe: ${info.existe ? 'sim' : 'nao'}`,
        `Total: ${clientes.length}`,
        `Atualizado: ${formatarData(info.atualizadoEm)}`
    ].join('\n');

}

function ultimosClientes() {

    const clientes = lerClientesCsv(caminhoCsv()).slice(-10);

    if (!clientes.length) return 'Nenhum cliente encontrado na planilha.';

    return [
        '📄 *Ultimos clientes*',
        '',
        ...clientes.map(cliente => [
            cliente.nome || 'Sem nome',
            `Tel: ${cliente.telefone || 'nao informado'}`,
            `Usuario: ${cliente.usuario || 'nao informado'}`,
            `Vencimento: ${cliente.vencimento || 'nao informado'}`,
            `Valor: ${cliente.valor || 'nao informado'}`,
            `Telas: ${cliente.telas || 'nao informado'}`
        ].join('\n'))
    ].join('\n\n');

}

function resumoLeads() {

    const arquivo = caminhoLeadsCsv();
    const leads = lerLeadsCsv(arquivo);
    const info = arquivoInfo(arquivo);
    const ativos = leads.filter(lead =>
        String(lead.status || '').toLowerCase() === 'lead'
    ).length;

    return [
        '*Leads*',
        '',
        `Arquivo: ${arquivo}`,
        `Existe: ${info.existe ? 'sim' : 'nao'}`,
        `Total: ${leads.length}`,
        `Ativos: ${ativos}`,
        `Atualizado: ${formatarData(info.atualizadoEm)}`
    ].join('\n');

}

function ultimosLeads() {

    const leads = lerLeadsCsv(caminhoLeadsCsv()).slice(-10);

    if (!leads.length) return 'Nenhum lead encontrado na planilha.';

    return [
        '*Ultimos leads*',
        '',
        ...leads.map(lead => [
            lead.nome || 'Sem nome',
            `Tel: ${lead.telefone || 'nao informado'}`,
            `Fluxo: ${lead.fluxo || 'nao informado'}`,
            `Status: ${lead.status || 'nao informado'}`,
            `Ultima interacao: ${lead.ultima_interacao || 'nao informado'}`
        ].join('\n'))
    ].join('\n\n');

}

function textoMarketingStatus() {

    const status = statusMarketing();

    return [
        '📣 *Marketing*',
        '',
        `Arquivo: ${status.arquivo}`,
        `Numeros na planilha: ${status.totalPlanilha}`,
        `Cupons criados: ${status.cupons}`,
        `Mensagens enviadas: ${status.enviados}`,
        `Cupons usados: ${status.usados}`,
        `Enviados hoje: ${status.enviadosHoje}/${status.limiteDiario || 'sem limite'}`,
        `Intervalo: ${Math.round(status.intervaloMs / 1000)} segundos`,
        `Campanha rodando: ${status.rodando ? 'Sim' : 'Nao'}`
    ].join('\n');

}

function textoResumoTestes() {

    const arquivo = caminhoTestesCsv();
    const testes = lerTestesCsv(arquivo);
    const ativos = testes.filter(teste =>
        String(teste.status || '').toLowerCase() === 'ativo'
    ).length;
    const encerrados = testes.filter(teste =>
        String(teste.status || '').toLowerCase() === 'encerrado'
    ).length;
    const sairam = testes.filter(teste =>
        String(teste.status || '').toLowerCase() === 'saiu' ||
        String(teste.saiu_em || '').trim()
    ).length;
    const info = arquivoInfo(arquivo);

    return [
        '*Testes gratis*',
        '',
        `Arquivo: ${arquivo}`,
        `Existe: ${info.existe ? 'sim' : 'nao'}`,
        `Total: ${testes.length}`,
        `Ativos: ${ativos}`,
        `Encerrados: ${encerrados}`,
        `Sairam dos avisos: ${sairam}`,
        `Atualizado: ${formatarData(info.atualizadoEm)}`
    ].join('\n');

}

function textoStatusImagens() {

    const status = statusDiario.resumo();

    return [
        '*Status diario*',
        '',
        `Ativo: ${status.habilitado ? 'Sim' : 'Nao'}`,
        `Pasta: ${status.pasta}`,
        `Imagens: ${status.totalImagens}`,
        `Ultimo dia: ${status.ultimoDia || 'nenhum'}`,
        `Ultimo arquivo: ${status.ultimoArquivo || 'nenhum'}`,
        `Postado em: ${status.postadoEm ? formatarData(new Date(status.postadoEm)) : 'nenhum'}`,
        `Proximo envio: ${status.proximaExecucao ? formatarData(new Date(status.proximaExecucao)) : 'nao agendado'}`
    ].join('\n');

}

function limparNumero(valor) {

    return String(valor || '').replace(/\D/g, '');

}

function aliasesAssinatura(assinatura, destino = '') {

    const telefone = limparNumero(assinatura?.telefone || assinatura?.numero);
    const aliases = [
        destino,
        assinatura?.numero,
        telefone,
        telefone ? `${telefone}@c.us` : ''
    ].filter(Boolean);

    return [...new Set(aliases)];

}

function colocarEmRenovacao(assinatura, destino = '') {

    for (const alias of aliasesAssinatura(assinatura, destino)) {

        sessoes[alias] = 'renovacao';
        sessoes[`${alias}_forcar_renovacao`] = true;

    }

}

function colocarEmFluxo(assinatura, destino, fluxo) {

    for (const alias of aliasesAssinatura(assinatura, destino)) {

        sessoes[alias] = fluxo;
        sessoes[`${alias}_iniciado`] = true;

    }

}

function buscarAssinaturaAdmin(entrada) {

    const termo = String(entrada || '').trim();

    if (!termo) return null;

    const porId = buscarAssinaturaPorId(termo);

    if (porId) return porId;

    const porTelefone = buscarAssinaturasPorNumero(
        termo,
        termo
    ).find(assinatura => assinatura.status === 'ativa') ||
        buscarAssinaturasPorNumero(
            termo,
            termo
        )[0];

    return porTelefone || null;

}

function fluxoNormalizado(valor) {

    const texto = String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const aliases = {
        principal: 'menu',
        inicio: 'menu',
        tv: 'suporte',
        sistema_tv: 'suporte',
        sistema_de_tv: 'suporte',
        produtos: 'comercial',
        servicos: 'comercial',
        produtos_servicos: 'comercial',
        produtos_e_servicos: 'comercial',
        atendente: 'humano',
        atendimento: 'humano',
        atendimento_humano: 'humano',
        adquirir: 'pacote',
        adquirir_pacote: 'pacote',
        planos: 'pacote',
        renovar: 'renovacao',
        renovacao_plano: 'renovacao',
        teste_gratis: 'teste',
        testegratis: 'teste',
        criar_teste: 'teste',
        sem_sinal: 'sem_sinal',
        sinal: 'sem_sinal',
        configuracao: 'config',
        ajuda_configuracao: 'config',
        ajuda_com_configuracao: 'config',
        cancelar: 'cancelamento',
        cancelamento_assinatura: 'cancelamento'
    };

    return aliases[texto] || texto;

}

function textoFluxos() {

    return [
        '*Fluxos disponiveis*',
        '',
        'Use: #fluxo telefone/usuario fluxo',
        '',
        'menu - menu principal',
        'suporte ou tv - Sistema de TV',
        'renovacao - planos para renovar',
        'pacote - adquirir pacote',
        'teste - criar teste gratis',
        'sem_sinal - atendimento sem sinal',
        'config - ajuda com configuracao',
        'financeiro - menu financeiro',
        'comercial - produtos e servicos',
        'humano - atendimento humano',
        'cancelamento - pedir motivo de cancelamento',
        '',
        'Exemplos:',
        '#fluxo 5543998022208 renovacao',
        '#fluxo 49876165849dna pacote'
    ].join('\n');

}

function estadoDoFluxo(fluxo) {

    const estados = {
        teste: 'teste_gratis',
        config: 'ajuda_config',
        sem_sinal: 'em_analise',
        cancelamento: 'cancelamento_feedback'
    };

    return estados[fluxo] || fluxo;

}

async function abrirFluxoCliente(client, destino, fluxo, assinatura) {

    if (fluxo === 'menu') return await menuPrincipal(client, destino);
    if (fluxo === 'suporte') return await menuSuporte(client, destino);
    if (fluxo === 'comercial') return await menuComercial(client, destino);
    if (fluxo === 'financeiro') return await menuFinanceiro(client, destino);
    if (fluxo === 'humano') return await menuHumano(client, destino);
    if (fluxo === 'renovacao') return await renovacao(client, destino);
    if (fluxo === 'pacote') return await pacote(client, destino);
    if (fluxo === 'teste') return await testeGratis(client, destino);
    if (fluxo === 'config') return await ajudaConfiguracao(client, destino);

    if (fluxo === 'sem_sinal') {

        const assinaturas = assinatura ? [assinatura] : [];

        return await semSinal(
            client,
            destino,
            assinaturas
        );

    }

    if (fluxo === 'cancelamento') {

        return await client.sendText(
            destino,

`Tudo bem. Antes de cancelar, se puder, conte rapidamente o motivo.

Se nao quiser responder, envie *0* para pular.`
        );

    }

    return await client.sendText(
        destino,
        `Fluxo *${fluxo}* ativado. Envie sua proxima resposta por aqui.`
    );

}

async function tratarComandoAdmin({
    client,
    numero,
    texto,
    verificarVencimentos
}) {

    if (texto === '#admin' || texto === '#ajuda') {

        return await client.sendText(numero, menuAdmin());

    }

    if (texto === '#fluxos') {

        return await client.sendText(numero, textoFluxos());

    }

    if (texto.startsWith('#fluxo ')) {

        const partes = texto.split(/\s+/);
        const termo = partes[1] || '';
        const fluxoPedido = fluxoNormalizado(partes.slice(2).join(' '));

        if (!termo || !fluxoPedido) {

            return await client.sendText(
                numero,
                'Use assim: *#fluxo telefone/usuario fluxo*. Envie *#fluxos* para ver a lista.'
            );

        }

        const permitidos = new Set([
            'menu',
            'suporte',
            'comercial',
            'financeiro',
            'humano',
            'renovacao',
            'pacote',
            'teste',
            'sem_sinal',
            'config',
            'cancelamento'
        ]);

        if (!permitidos.has(fluxoPedido)) {

            return await client.sendText(
                numero,
                `Fluxo nao reconhecido: ${fluxoPedido}\nEnvie *#fluxos* para ver a lista.`
            );

        }

        const assinatura = buscarAssinaturaAdmin(termo);
        const destinos = assinatura ?
            [
                assinatura.numero,
                assinatura.telefone
            ] :
            [termo];
        const envio = await enviarTextoSeguro(
            client,
            destinos,
            'Vou te direcionar para o atendimento correto agora.'
        );

        if (assinatura && fluxoPedido === 'renovacao') {

            colocarEmRenovacao(
                assinatura,
                envio.destino
            );

        } else if (assinatura) {

            colocarEmFluxo(
                assinatura,
                envio.destino,
                estadoDoFluxo(fluxoPedido)
            );

        } else {

            sessoes[envio.destino] = estadoDoFluxo(fluxoPedido);
            sessoes[`${envio.destino}_iniciado`] = true;

        }

        await abrirFluxoCliente(
            client,
            envio.destino,
            fluxoPedido,
            assinatura
        );

        return await client.sendText(
            numero,
            [
                'Cliente colocado no fluxo.',
                '',
                `Destino: ${envio.destino}`,
                `Fluxo: ${fluxoPedido}`,
                assinatura ? `Nome: ${assinatura.nome || 'Nao informado'}` : '',
                assinatura ? `Usuario: ${assinatura.username}` : ''
            ].filter(Boolean).join('\n')
        );

    }

    if (texto.startsWith('#renovar ')) {

        const termo = texto.replace(/^#renovar\s+/i, '').trim();
        const assinatura = buscarAssinaturaAdmin(termo);

        if (!assinatura) {

            return await client.sendText(
                numero,
                `Nao encontrei cliente para: ${termo}`
            );

        }

        const intro = [
            'Oi! Vamos continuar sua renovacao por aqui.',
            '',
            'Escolha o plano desejado na proxima mensagem.'
        ].join('\n');
        const envio = await enviarTextoSeguro(
            client,
            [
                assinatura.numero,
                assinatura.telefone
            ],
            intro
        );

        colocarEmRenovacao(
            assinatura,
            envio.destino
        );

        await renovacao(
            client,
            envio.destino
        );

        return await client.sendText(
            numero,
            [
                'Cliente colocado no fluxo de renovacao.',
                '',
                `Nome: ${assinatura.nome || 'Nao informado'}`,
                `Usuario: ${assinatura.username}`,
                `Destino: ${envio.destino}`
            ].join('\n')
        );

    }

    if (texto === '#bot' || texto === '/bot' || texto === 'reativar bot') {

        return await client.sendText(
            numero,
            'No chat admin eu nao abro o menu de cliente. Para reativar um cliente, envie *#bot* dentro da conversa dele.'
        );

    }

    if (texto === '#status') {

        return await client.sendText(numero, statusBot());

    }

    if (texto === '#clientes') {

        return await client.sendText(numero, resumoClientes());

    }

    if (texto === '#clientes ultimos') {

        return await client.sendText(numero, ultimosClientes());

    }

    if (texto === '#leads') {

        return await client.sendText(numero, resumoLeads());

    }

    if (texto === '#leads ultimos') {

        return await client.sendText(numero, ultimosLeads());

    }

    if (texto === '#marketing status') {

        return await client.sendText(numero, textoMarketingStatus());

    }

    if (texto === '#marketing enviar') {

        await client.sendText(
            numero,
            'Iniciando campanha de marketing. Vou respeitar limite diario e intervalo entre mensagens.'
        );

        const resultado = await enviarCampanha(client);

        return await client.sendText(
            numero,
            [
                '📣 *Campanha finalizada*',
                '',
                `Total na planilha: ${resultado.total}`,
                `Enviados: ${resultado.enviados}`,
                `Ignorados: ${resultado.ignorados}`,
                `Erros: ${resultado.erros}`,
                `Enviados hoje: ${resultado.enviadosHoje}/${resultado.limiteDiario || 'sem limite'}`,
                '',
                resultado.pausadoPorLimite ?
                    'Pausado porque atingiu o limite diario. Rode novamente amanha para continuar.' :
                    'Campanha concluida para este ciclo.'
            ].join('\n')
        );

    }

    if (texto === '#status imagens') {

        return await client.sendText(numero, textoStatusImagens());

    }

    if (texto === '#status postar') {

        await client.sendText(numero, 'Postando uma imagem aleatoria no status agora.');

        try {

            const resultado = await statusDiario.postarAgora(client, {
                forcar: true
            });

            return await client.sendText(
                numero,
                [
                    '*Status postado*',
                    '',
                    `Arquivo: ${path.basename(resultado.arquivo || '') || 'nao informado'}`
                ].join('\n')
            );

        } catch (erro) {

            return await client.sendText(
                numero,
                `Nao consegui postar o status: ${erro.message}`
            );

        }

    }

    if (texto === '#testes') {

        return await client.sendText(numero, textoResumoTestes());

    }

    if (texto === '#testes verificar') {

        await client.sendText(numero, 'Rodando checagem de testes vencidos agora.');
        await iniciarMonitorTestes.verificarTestesEncerrados(client);

        return await client.sendText(
            numero,
            'Checagem de testes vencidos concluida. Veja o log para detalhes.'
        );

    }

    if (texto === '#vencimentos') {

        await client.sendText(numero, 'Rodando checagem de vencimentos agora.');
        const resumo = await verificarVencimentos(client);

        return await client.sendText(
            numero,
            [
                'Checagem de vencimentos concluida.',
                '',
                `Hoje: ${resumo?.hoje ?? 0}`,
                `Amanha: ${resumo?.amanha ?? 0}`,
                `Enviados: ${resumo?.enviados ?? 0}`,
                `Erros: ${resumo?.erros?.length ?? 0}`,
                ...(resumo?.erros?.length ?
                    [
                        '',
                        'Primeiros erros:',
                        ...resumo.erros.slice(0, 3)
                    ] :
                    [])
            ].join('\n')
        );

    }

    if (texto === '#pausas limpar') {

        limparPausasAtendimento();

        return await client.sendText(
            numero,
            'Pausas de atendimento limpas. O bot volta a responder os clientes nas proximas mensagens.'
        );

    }

    if (texto === '#vm restart' || texto === '#reboot') {

        return await client.sendText(
            numero,
            'Por seguranca, eu nao reinicio a VM inteira pelo WhatsApp. Use *#restart* para reiniciar somente o bot.'
        );

    }

    if (texto === '#restart') {

        await client.sendText(
            numero,
            'Reiniciando o bot agora. O Docker deve subir novamente em alguns segundos.'
        );

        setTimeout(
            () => process.exit(0),
            1500
        );

        return true;

    }

    if (texto.startsWith('#')) {

        return await client.sendText(
            numero,
            'Comando admin nao reconhecido. Envie *#admin* para ver a lista.'
        );

    }

    return false;

}

module.exports = {
    tratarComandoAdmin
};
