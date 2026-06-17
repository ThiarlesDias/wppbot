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
const renovacao = require('../menus/suporte/renovacao');
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
        '#marketing status - status da campanha',
        '#marketing enviar - disparar campanha com limite/intervalo',
        '#status imagens - ver imagens do status diario',
        '#status postar - postar uma imagem aleatoria agora',
        '#testes - resumo da planilha de testes',
        '#testes verificar - avisar testes vencidos agora',
        '#vencimentos - rodar checagem de vencimentos agora',
        '#renovar telefone/usuario - colocar cliente no fluxo de renovacao',
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
    const pausaPath = path.join(DATA_DIR, 'atendimentos-pausados.json');
    const clientesInfo = arquivoInfo(clientesPath);
    const marketingInfo = arquivoInfo(marketingPath);
    const pausasInfo = arquivoInfo(pausaPath);

    return [
        '✅ *Bot online*',
        '',
        `Uptime: ${Math.floor(process.uptime() / 60)} min`,
        '',
        '*Arquivos*',
        `Clientes: ${clientesInfo.existe ? 'OK' : 'Nao encontrado'}`,
        `Atualizado: ${formatarData(clientesInfo.atualizadoEm)}`,
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
            `Vencimento: ${cliente.vencimento || 'nao informado'}`
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

async function tratarComandoAdmin({
    client,
    numero,
    texto,
    verificarVencimentos
}) {

    if (texto === '#admin' || texto === '#ajuda') {

        return await client.sendText(numero, menuAdmin());

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
