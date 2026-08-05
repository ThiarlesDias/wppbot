const fs = require('fs');
const path = require('path');
const {
    exec
} = require('child_process');
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
    liberarAtendimento,
    limparPausasAtendimento
} = require('./pausaAtendimento');
const statusDiario = require('./statusDiario');
const iniciarMonitorTestes = require('./testesMonitor');
const {
    caminhoTestesCsv,
    lerTestesCsv
} = require('./testesCsv');
const {
    buscarPagamentoInformado,
    responderPagamentoInformado
} = require('./pagamentosInformados');
const {
    caminhoLeadsCsv,
    encerrarLeadsAtivos,
    lerLeadsCsv
} = require('./leadsCsv');
const {
    buscarServicoPorChamado,
    caminhoServicosCsv,
    formatarServico,
    normalizarChamado,
    obterChamado
} = require('./servicosCsv');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLANILHAS_ALVOS = [
    'clientes',
    'testes',
    'leads',
    'marketing',
    'servicos'
];

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
        '#leads encerrar todos - parar remarketing e encerrar leads ativos',
        '#planilhas atualizar - sincronizar todas as planilhas agora',
        '#planilhas atualizar clientes - sincronizar uma planilha especifica',
        '#chamado enviar OS359 - enviar informacoes do chamado ao cliente',
        '#marketing status - status da campanha',
        '#marketing enviar - disparar campanha com limite/intervalo',
        '#status imagens - ver imagens do status diario',
        '#status postar - postar uma imagem aleatoria agora',
        '#testes - resumo da planilha de testes',
        '#testes verificar - avisar testes vencidos agora',
        '#pgsim CODIGO - confirmar pagamento informado pelo cliente',
        '#pgnao CODIGO - avisar que pagamento nao foi encontrado',
        '#vencimentos - rodar checagem de vencimentos agora',
        '#avaliar telefone/usuario - colocar cliente na avaliacao de atendimento',
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
            `Telas: ${cliente.telas || 'nao informado'}`,
            `Meses: ${cliente.meses || 'nao informado'}`
        ].join('\n'))
    ].join('\n\n');

}

function executarComando(comando, timeoutMs = 120000) {

    return new Promise(resolve => {
        if (!comando) return resolve({
            ok: true,
            ignorado: true,
            stdout: '',
            stderr: ''
        });

        exec(
            comando,
            {
                cwd: path.join(__dirname, '..'),
                maxBuffer: 1024 * 1024 * 5,
                timeout: timeoutMs,
                windowsHide: true
            },
            (erro, stdout, stderr) => resolve({
                ok: !erro,
                ignorado: false,
                erro,
                stdout,
                stderr
            })
        );
    });

}

async function sincronizarServicosAntesEnvio() {

    const comando = process.env.SERVICOS_SYNC_COMMAND || '';
    const resultado = await executarComando(comando);

    if (!resultado.ok) {
        console.log(
            'ERRO SYNC SERVICOS',
            resultado.erro?.message || resultado.stderr || 'falha desconhecida'
        );
    }

    return resultado;

}

function textoUsoPlanilhas() {

    return [
        'Use assim:',
        '*#planilhas atualizar*',
        '',
        'Ou escolha uma planilha:',
        '*#planilhas atualizar clientes*',
        '*#planilhas atualizar testes*',
        '*#planilhas atualizar leads*',
        '*#planilhas atualizar marketing*',
        '*#planilhas atualizar servicos*'
    ].join('\n');

}

function normalizarAlvoPlanilha(valor) {

    const alvo = String(valor || '')
        .trim()
        .toLowerCase();

    if (!alvo || ['todas', 'todos', 'all'].includes(alvo)) return '';

    if (PLANILHAS_ALVOS.includes(alvo)) return alvo;

    return null;

}

function ultimasLinhas(texto, limite = 6) {

    return String(texto || '')
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean)
        .slice(-limite)
        .join('\n');

}

async function sincronizarPlanilhas(alvo) {

    const comandoBase = process.env.PLANILHAS_SYNC_COMMAND || 'npm run sync:google';
    const timeout = Number(process.env.PLANILHAS_SYNC_TIMEOUT_MS || 300000);
    const comando = alvo ? `${comandoBase} -- ${alvo}` : comandoBase;
    const resultado = await executarComando(
        comando,
        timeout
    );

    if (!resultado.ok) {
        console.log(
            'ERRO SYNC PLANILHAS',
            alvo || 'todas',
            resultado.erro?.message || resultado.stderr || resultado.stdout || 'falha desconhecida'
        );
    }

    return resultado;

}

async function importarClientesAposSync(alvo) {

    if (alvo && alvo !== 'clientes') {
        return {
            ok: true,
            ignorado: true,
            stdout: '',
            stderr: ''
        };
    }

    return await executarComando(
        'npm run importar:clientes',
        120000
    );

}

function resumoSyncPlanilhas(alvo, sync, importacao) {

    const detalhesErro = ultimasLinhas(
        [
            sync.erro?.message,
            sync.stderr,
            sync.stdout
        ].filter(Boolean).join('\n'),
        8
    );

    const linhas = [
        sync.ok ? '*Planilhas atualizadas*' : '*Falha ao atualizar planilhas*',
        '',
        `Alvo: ${alvo || 'todas'}`
    ];

    if (!sync.ok) {
        linhas.push(
            '',
            'O Google Sheets/CSV nao foi sincronizado.',
            detalhesErro ? `Detalhes:\n${detalhesErro}` : ''
        );

        return linhas.filter(Boolean).join('\n');
    }

    if (importacao.ignorado) {
        linhas.push('Clientes: nao recarregado para este alvo.');
    } else {
        linhas.push(`Clientes: ${importacao.ok ? 'recarregado' : 'falhou ao recarregar'}`);
    }

    if (!importacao.ok) {
        const erroImportacao = ultimasLinhas(
            [
                importacao.stderr,
                importacao.stdout
            ].filter(Boolean).join('\n'),
            6
        );

        if (erroImportacao) {
            linhas.push(
                '',
                `Detalhes importacao:\n${erroImportacao}`
            );
        }
    }

    return linhas.join('\n');

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
        `Enviados neste ciclo: ${status.enviadosNoCiclo}`,
        `Cupons usados: ${status.usados}`,
        `Enviados hoje: ${status.enviadosHoje}/${status.limiteDiario || 'sem limite'}`,
        `Ciclo: ${status.cicloDias} dias`,
        `Proximo ciclo: ${formatarData(status.proximoCiclo)}`,
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

        liberarAtendimento(alias);
        sessoes[alias] = 'renovacao';
        sessoes[`${alias}_iniciado`] = true;
        sessoes[`${alias}_forcar_renovacao`] = true;

    }

}

function colocarEmFluxo(assinatura, destino, fluxo) {

    for (const alias of aliasesAssinatura(assinatura, destino)) {

        liberarAtendimento(alias);
        sessoes[alias] = fluxo;
        sessoes[`${alias}_iniciado`] = true;

    }

}

function aliasesAvulsos(...valores) {

    const aliases = [];

    for (const valor of valores) {

        const telefone = limparNumero(valor);

        aliases.push(
            valor,
            telefone,
            telefone ? `${telefone}@c.us` : ''
        );

    }

    return [...new Set(aliases.filter(Boolean))];

}

function colocarEmFluxoAvulso(fluxo, ...valores) {

    for (const alias of aliasesAvulsos(...valores)) {

        liberarAtendimento(alias);
        sessoes[alias] = fluxo;
        sessoes[`${alias}_iniciado`] = true;

    }

}

function aplicarFluxoForcado({ assinatura, destino, fluxoPedido, termo }) {

    if (assinatura && fluxoPedido === 'renovacao') {

        colocarEmRenovacao(
            assinatura,
            destino
        );

        return;

    }

    if (assinatura) {

        colocarEmFluxo(
            assinatura,
            destino,
            estadoDoFluxo(fluxoPedido)
        );

        return;

    }

    colocarEmFluxoAvulso(
        estadoDoFluxo(fluxoPedido),
        termo,
        destino
    );

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
        avaliar: 'satisfacao',
        avaliacao: 'satisfacao',
        pesquisa: 'satisfacao',
        pesquisa_satisfacao: 'satisfacao',
        satisfacao: 'satisfacao',
        atendimento_avaliacao: 'satisfacao',
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
        'avaliacao ou satisfacao - pesquisa de atendimento',
        'cancelamento - pedir motivo de cancelamento',
        '',
        'Exemplos:',
        '#fluxo 5543998022208 renovacao',
        '#fluxo 49876165849dna pacote',
        '#fluxo 5543998022208 avaliacao'
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

function textoAvaliacaoAtendimento() {

    return [
        'Antes de encerrar, sua opiniao ajuda muito.',
        '',
        'De *1* a *5*, qual nota voce da para este atendimento?',
        '',
        '0 - Nao opinar'
    ].join('\n');

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

    if (fluxo === 'satisfacao') {

        return await client.sendText(
            destino,
            textoAvaliacaoAtendimento()
        );

    }

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

    if (/^#pg(sim|nao)\s+/i.test(texto)) {

        const aprovado = /^#pgsim\b/i.test(texto);
        const codigo = texto.split(/\s+/)[1] || '';
        const pagamento = buscarPagamentoInformado(codigo);

        if (!pagamento) {

            return await client.sendText(
                numero,
                `Nao encontrei pagamento informado com codigo: ${codigo}`
            );

        }

        const atualizado = responderPagamentoInformado(
            codigo,
            aprovado
        );
        const destino = pagamento.numero || pagamento.telefone;

        if (destino) {

            await client.sendText(
                destino,
                aprovado ?
                    'Pagamento localizado. Obrigado! Nossa equipe vai finalizar a renovacao e avisar voce por aqui.' :
                    'Verificamos aqui e ainda nao encontramos esse pagamento. Se voce pagou ha poucos minutos, aguarde um pouco e nos avise novamente. Se preferir, envie o comprovante para um atendente.'
            );

        }

        return await client.sendText(
            numero,
            [
                aprovado ? 'Pagamento confirmado para o cliente.' : 'Cliente avisado que o pagamento nao foi encontrado.',
                '',
                `Codigo: ${atualizado.codigo}`,
                `Cliente: ${atualizado.numero || atualizado.telefone || 'nao informado'}`
            ].join('\n')
        );

    }

    if (/^#planilhas?\s+atualizar(?:\s+(.+))?$/i.test(texto)) {

        const [, alvoPedido] = texto.match(/^#planilhas?\s+atualizar(?:\s+(.+))?$/i);
        const alvo = normalizarAlvoPlanilha(alvoPedido);

        if (alvo === null) {

            return await client.sendText(
                numero,
                textoUsoPlanilhas()
            );

        }

        await client.sendText(
            numero,
            `Atualizando planilhas agora: ${alvo || 'todas'}...`
        );

        const sync = await sincronizarPlanilhas(alvo);
        const importacao = sync.ok ?
            await importarClientesAposSync(alvo) :
            {
                ok: true,
                ignorado: true,
                stdout: '',
                stderr: ''
            };

        return await client.sendText(
            numero,
            resumoSyncPlanilhas(
                alvo,
                sync,
                importacao
            )
        );

    }

    if (/^#chamado\s+enviar\s+/i.test(texto)) {

        const chamado = normalizarChamado(texto.replace(/^#chamado\s+enviar\s+/i, ''));

        if (!chamado) {

            return await client.sendText(
                numero,
                'Use assim: *#chamado enviar OS359*.'
            );

        }

        await client.sendText(
            numero,
            `Atualizando planilha de servicos antes de enviar o chamado ${chamado}...`
        );

        const sync = await sincronizarServicosAntesEnvio();
        const servico = buscarServicoPorChamado(chamado);

        if (!servico) {

            return await client.sendText(
                numero,
                [
                    `Nao encontrei o chamado *${chamado}* em ${caminhoServicosCsv()}.`,
                    sync.ignorado ? 'Obs: SERVICOS_SYNC_COMMAND nao esta configurado; usei a planilha local da VM.' : '',
                    !sync.ok ? 'Obs: a sincronizacao falhou; usei a planilha local disponivel.' : ''
                ].filter(Boolean).join('\n')
            );

        }

        if (!servico.telefone) {

            return await client.sendText(
                numero,
                [
                    `O chamado *${chamado}* existe, mas esta sem telefone cadastrado.`,
                    'Preencha a coluna telefone em servicos.csv antes de enviar ao cliente.'
                ].join('\n')
            );

        }

        const envio = await enviarTextoSeguro(
            client,
            servico.telefone,
            formatarServico(servico)
        );
        const numeroChamado = obterChamado(servico);

        return await client.sendText(
            numero,
            [
                'Informacoes do chamado enviadas ao cliente.',
                '',
                `Chamado: ${numeroChamado}`,
                `Cliente: ${servico.cliente_nome || servico.whatsapp_nome || 'Nao informado'}`,
                `Telefone: ${servico.telefone}`,
                `Destino: ${envio.destino}`,
                `Status: ${servico.status || 'Nao informado'}`,
                sync.ignorado ? 'Sync: nao configurado; usei a planilha local da VM.' : (sync.ok ? 'Sync: executado antes do envio.' : 'Sync: falhou; usei a planilha local da VM.')
            ].join('\n')
        );

    }

    if (/^#avalia(?:r|cao|ção)\s+/i.test(texto)) {

        const termo = texto.replace(/^#avalia(?:r|cao|ção)\s+/i, '').trim();

        if (!termo) {

            return await client.sendText(
                numero,
                'Use assim: *#avaliar telefone/usuario*.'
            );

        }

        const assinatura = buscarAssinaturaAdmin(termo);
        const destinos = assinatura ?
            [
                assinatura.numero,
                assinatura.telefone
            ] :
            [termo];

        aplicarFluxoForcado({
            assinatura,
            destino: destinos[0],
            fluxoPedido: 'satisfacao',
            termo
        });

        const envio = await enviarTextoSeguro(
            client,
            destinos,
            textoAvaliacaoAtendimento()
        );

        aplicarFluxoForcado({
            assinatura,
            destino: envio.destino,
            fluxoPedido: 'satisfacao',
            termo
        });

        return await client.sendText(
            numero,
            [
                'Cliente colocado na avaliacao de atendimento.',
                '',
                `Destino: ${envio.destino}`,
                assinatura ? `Nome: ${assinatura.nome || 'Nao informado'}` : '',
                assinatura ? `Usuario: ${assinatura.username}` : ''
            ].filter(Boolean).join('\n')
        );

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
            'satisfacao',
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

        aplicarFluxoForcado({
            assinatura,
            destino: destinos[0],
            fluxoPedido,
            termo
        });

        const envio = await enviarTextoSeguro(
            client,
            destinos,
            'Vou te direcionar para o atendimento correto agora.'
        );

        aplicarFluxoForcado({
            assinatura,
            destino: envio.destino,
            fluxoPedido,
            termo
        });

        await abrirFluxoCliente(
            client,
            envio.destino,
            fluxoPedido,
            assinatura
        );
        aplicarFluxoForcado({
            assinatura,
            destino: envio.destino,
            fluxoPedido,
            termo
        });

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

        colocarEmRenovacao(
            assinatura,
            termo
        );

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
        colocarEmRenovacao(
            assinatura,
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

    if (
        texto === '#leads encerrar todos' ||
        texto === '#leads parar' ||
        texto === '#remarketing parar'
    ) {

        const resumo = encerrarLeadsAtivos('Encerrado pelo admin para parar remarketing.');

        return await client.sendText(
            numero,
            [
                '*Leads encerrados*',
                '',
                `Arquivo: ${resumo.arquivo}`,
                `Total na planilha: ${resumo.total}`,
                `Encerrados agora: ${resumo.encerrados}`,
                '',
                'O remarketing diario nao vai mais enviar para esses leads.'
            ].join('\n')
        );

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

        await client.sendText(numero, 'Reenviando aviso para testes vencidos agora.');
        await iniciarMonitorTestes.verificarTestesEncerrados(
            client,
            {
                forcar: true
            }
        );

        return await client.sendText(
            numero,
            'Reenvio de aviso de testes vencidos concluido. Veja o log para detalhes.'
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
