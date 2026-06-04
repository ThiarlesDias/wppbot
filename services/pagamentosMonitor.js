const {
    listarVendasPendentes,
    atualizarVenda,
    buscarPagamentoPorReferencia
} = require('./mercadopago');
const {
    criarTesteGratis
} = require('./sigma');
const {
    enviarConfirmacaoCliente,
    enviarNovaVendaAdmin
} = require('./resend');
const {
    adicionarDias,
    buscarAssinaturaPorId,
    diasDoPlano,
    registrarAssinatura,
    renovarAssinatura
} = require('./assinaturasStore');
const {
    atualizarClienteCsv
} = require('./clientesCsv');
const notificar = require('./notificador');

const INTERVALO_MS = Number(process.env.MP_MONITOR_INTERVAL_MS || 60000);

let monitorIniciado = false;

function descricaoMetodo(metodo) {

    if (metodo === 'pix') return 'PIX';
    if (metodo === 'cartao') return 'Cartao';
    if (metodo === 'boleto') return 'Boleto';

    return metodo || 'Mercado Pago';

}

function formatarValor(valor) {

    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

}

function primeiroValor(...valores) {

    return valores.find(valor => valor !== undefined && valor !== null && valor !== '');

}

function normalizarData(valor) {

    if (!valor) return null;

    if (valor instanceof Date) return valor;

    if (typeof valor === 'number') {

        return new Date(valor < 10000000000 ? valor * 1000 : valor);

    }

    const texto = String(valor).trim();

    if (/^\d+$/.test(texto)) {

        const numero = Number(texto);
        return new Date(numero < 10000000000 ? numero * 1000 : numero);

    }

    const data = new Date(texto);

    if (Number.isNaN(data.getTime())) return null;

    return data;

}

function somarHoras(data, horas) {

    return new Date(data.getTime() + Number(horas || 0) * 60 * 60 * 1000);

}

function formatarData(valor) {

    const data = normalizarData(valor);

    if (!data) return '';

    const partes = new Intl.DateTimeFormat(
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
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}:${partes.second}`;

}

function dadosPagador(pagamento) {

    const payer = pagamento?.payer || {};
    const nome = [
        payer.first_name,
        payer.last_name
    ].filter(Boolean).join(' ');

    return {
        nome: nome || payer.name || '',
        email: payer.email || ''
    };

}

function extrairCredenciais(teste) {

    const username = teste?.cliente?.username || teste?.playlist?.username || '';
    const password = teste?.cliente?.password || teste?.playlist?.password || '';
    const dns = String(teste?.playlist?.dns || '').replace(/\/$/, '');
    const dnsComBarra = dns ? `${dns}/` : '';
    const createdAt = primeiroValor(
        teste?.cliente?.createdAt,
        teste?.cliente?.created_at,
        teste?.playlist?.createdAt,
        teste?.playlist?.created_at
    );
    const expiresAt = primeiroValor(
        teste?.cliente?.expiresAt,
        teste?.cliente?.expires_at,
        teste?.cliente?.expiration,
        teste?.cliente?.exp_date,
        teste?.playlist?.expiresAt,
        teste?.playlist?.expires_at,
        teste?.playlist?.expiration,
        teste?.playlist?.exp_date
    );
    const linkM3u = dns && username && password ?
        `${dns}/get.php?username=${username}&password=${password}&type=m3u_plus&output=mpegts` :
        '';

    return {
        username,
        password,
        dns: dnsComBarra,
        linkM3u,
        createdAt,
        expiresAt
    };

}

async function gerarCredenciaisVenda(venda) {

    const numeroTeste = venda.telefone || venda.numero;
    const teste = await criarTesteGratis(numeroTeste);
    const credenciais = extrairCredenciais(teste);

    if (!credenciais.username || !credenciais.password) {

        throw new Error('Sigma nao retornou usuario/senha para a venda aprovada.');

    }

    const criadoEm = normalizarData(credenciais.createdAt) || new Date();
    const vencimentoPlano = adicionarDias(
        criadoEm,
        diasDoPlano(venda.plano)
    );

    return {
        ...credenciais,
        createdAt: criadoEm.toISOString(),
        trialExpiresAt: (
            normalizarData(credenciais.expiresAt) ||
            somarHoras(criadoEm, process.env.SIGMA_TRIAL_HOURS || 6)
        ).toISOString(),
        expiresAt: vencimentoPlano.toISOString()
    };

}

function credenciaisDaAssinatura(assinatura) {

    if (!assinatura) return null;

    return {
        username: assinatura.username,
        password: assinatura.password,
        dns: assinatura.dns,
        linkM3u: assinatura.linkM3u,
        createdAt: assinatura.createdAt,
        expiresAt: assinatura.expiresAt
    };

}

function montarMensagemAcessoWhatsapp(credenciais) {

    return [
        '*Segue os Dados De Acesso*',
        `✅ *Usuário:* ${credenciais.username}`,
        `✅ *Senha:* ${credenciais.password}`,
        `🗓️ *Criado em:* ${formatarData(credenciais.createdAt)}`,
        `🗓️ *Vencimento:* ${formatarData(credenciais.expiresAt)}`,
        '',
        credenciais.dns ? `🟠 *DNS XCIPTV:* ${credenciais.dns}` : '',
        credenciais.dns ? `🟠 *DNS SMARTERS:* ${credenciais.dns}` : '',
        '',
        credenciais.linkM3u ? `🟢 *Link (M3U):* ${credenciais.linkM3u}` : ''
    ].filter(Boolean).join('\n');

}

async function enviarEmailsVenda(venda, pagamento, credenciais, pagador) {

    const credenciaisEmail = {
        ...credenciais,
        expiresAt: formatarData(credenciais.expiresAt)
    };

    if (venda.email) {

        await enviarConfirmacaoCliente({
            email: venda.email,
            nome: venda.nome || pagador.nome,
            venda,
            credenciais: credenciaisEmail
        });

    }

    await enviarNovaVendaAdmin({
        venda,
        pagamento,
        credenciais: credenciaisEmail,
        pagador: {
            ...pagador,
            email: venda.email || (venda.metodo === 'pix' ? '' : pagador.email)
        }
    });

}

async function registrarPagamentoPendenteAtivacao(client, venda, pagamento, pagador, erro) {

    const credenciaisPendentes = {
        username: 'PENDENTE ATIVACAO MANUAL',
        password: '',
        dns: '',
        linkM3u: '',
        createdAt: '',
        expiresAt: ''
    };

    const atualizada = atualizarVenda(
        venda.reference,
        {
            status: 'approved_pending_activation',
            payment_id: pagamento.id,
            payment_status: pagamento.status,
            payment_status_detail: pagamento.status_detail,
            paid_at: new Date().toISOString(),
            payer_email: pagador.email,
            customer_email: venda.email || '',
            customer_name: venda.nome || '',
            payer_name: pagador.nome,
            activation_status: 'pending_manual',
            activation_error: erro.message
        }
    );

    await client.sendText(
        venda.numero,

`âœ… *Pagamento recebido!*

Plano: ${venda.plano}
Valor: ${formatarValor(venda.valor)}
Forma: ${descricaoMetodo(venda.metodo)}

Seu pagamento foi aprovado. A ativacao ficou pendente de liberacao manual e nossa equipe ja foi avisada.
Assim que o acesso for liberado, enviamos os dados aqui no WhatsApp.`
    );

    try {

        await enviarNovaVendaAdmin({
            venda: {
                ...venda,
                status: 'approved_pending_activation'
            },
            pagamento,
            credenciais: credenciaisPendentes,
            pagador: {
                ...pagador,
                email: venda.email || (venda.metodo === 'pix' ? '' : pagador.email)
            }
        });

    } catch (erroEmail) {

        console.log('ERRO EMAIL VENDA PENDENTE', erroEmail.message);

    }

    await notificar(
        client,
        'PAGAMENTO APROVADO - ATIVACAO MANUAL',

`Cliente:
${venda.numero}

WhatsApp:
${venda.telefone || 'Nao informado'}

Nome:
${venda.nome || 'Nao informado'}

Tipo:
${venda.tipo === 'renovacao' ? 'Renovacao' : 'Nova assinatura'}

Plano:
${venda.plano}

Valor:
${formatarValor(venda.valor)}

Forma:
${descricaoMetodo(venda.metodo)}

Pagador:
${pagador.nome || 'Nao informado'}

Email:
${pagador.email || 'Nao informado'}

Referencia:
${venda.reference}

Pagamento Mercado Pago:
${pagamento.id}

Erro na ativacao automatica:
${erro.message}`
    );

    console.log(
        'PAGAMENTO APROVADO PENDENTE ATIVACAO',
        atualizada?.reference || venda.reference,
        pagamento.id,
        erro.message
    );

}

function montarCredenciaisVenda(venda, pagamento) {

    if (venda.tipo === 'renovacao' && venda.assinatura_id) {

        const assinatura = buscarAssinaturaPorId(venda.assinatura_id);

        if (!assinatura) {

            throw new Error('Assinatura da renovacao nao encontrada no banco local.');

        }

        const renovada = renovarAssinatura(
            assinatura.id,
            {
                plano: venda.plano,
                nome: venda.nome,
                email: venda.email,
                vendaReference: venda.reference,
                paymentId: pagamento.id
            }
        );

        return {
            credenciais: credenciaisDaAssinatura(renovada),
            assinatura: renovada,
            tipo: 'renovacao'
        };

    }

    return null;

}

async function verificarVenda(client, venda) {

    const pagamento = await buscarPagamentoPorReferencia(venda.reference);

    if (!pagamento) return;

    const status = pagamento.status;

    if (status === 'approved') {

        const pagador = dadosPagador(pagamento);
        let resultadoAcesso;

        try {

            resultadoAcesso = montarCredenciaisVenda(venda, pagamento);

        } catch (erro) {

            return await registrarPagamentoPendenteAtivacao(
                client,
                venda,
                pagamento,
                pagador,
                erro
            );

        }

        if (!resultadoAcesso) {

            let credenciais;

            try {

                credenciais = venda.credenciais?.username ?
                    venda.credenciais :
                    await gerarCredenciaisVenda(venda);

            } catch (erro) {

                return await registrarPagamentoPendenteAtivacao(
                    client,
                    venda,
                    pagamento,
                    pagador,
                    erro
                );

            }

            const assinatura = registrarAssinatura({
                numero: venda.numero,
                telefone: venda.telefone,
                nome: venda.nome,
                email: venda.email,
                plano: venda.plano,
                origem: 'pagamento',
                credenciais,
                expiresAt: credenciais.expiresAt
            });

            resultadoAcesso = {
                credenciais: credenciaisDaAssinatura(assinatura),
                assinatura,
                tipo: 'nova'
            };

        }

        const credenciais = resultadoAcesso.credenciais;
        const assinatura = resultadoAcesso.assinatura;

        try {

            if (assinatura?.username && assinatura?.password) {

                atualizarClienteCsv(assinatura);

            }

        } catch (erro) {

            console.log('ERRO CLIENTES CSV', erro.message);

        }

        const atualizada = atualizarVenda(
            venda.reference,
            {
                status: 'approved',
                payment_id: pagamento.id,
                payment_status: pagamento.status,
                payment_status_detail: pagamento.status_detail,
                paid_at: new Date().toISOString(),
                payer_email: pagador.email,
                customer_email: venda.email || '',
                customer_name: venda.nome || '',
                payer_name: pagador.nome,
                tipo: resultadoAcesso.tipo,
                assinatura_id: assinatura?.id || venda.assinatura_id || '',
                credenciais
            }
        );

        const textoStatusAcesso = resultadoAcesso.tipo === 'renovacao' ?
            `Seu acesso foi renovado automaticamente. Novo vencimento: ${formatarData(credenciais.expiresAt)}.` :
            'Seu acesso foi criado com sucesso.';

        await client.sendText(
            venda.numero,

`✅ *Pagamento recebido!*

Plano: ${venda.plano}
Valor: ${formatarValor(venda.valor)}
Forma: ${descricaoMetodo(venda.metodo)}

${textoStatusAcesso}
${venda.email ? 'Seus dados de acesso tambem foram enviados por email.' : 'Confirmacao enviada aqui no WhatsApp.'}
Nossa equipe tambem foi avisada para finalizar a ativacao.`
        );

        await client.sendText(
            venda.numero,
            montarMensagemAcessoWhatsapp(credenciais)
        );

        try {

            await enviarEmailsVenda(
                venda,
                pagamento,
                credenciais,
                pagador
            );

        } catch (erro) {

            console.log('ERRO EMAIL VENDA', erro.message);

        }

        await notificar(
            client,
            'PAGAMENTO APROVADO',

`Cliente:
${venda.numero}

WhatsApp:
${venda.telefone || 'Nao informado'}

Nome:
${venda.nome || 'Nao informado'}

Tipo:
${resultadoAcesso.tipo === 'renovacao' ? 'Renovacao' : 'Nova assinatura'}

Plano:
${venda.plano}

Valor:
${formatarValor(venda.valor)}

Forma:
${descricaoMetodo(venda.metodo)}

Pagador:
${pagador.nome || 'Nao informado'}

Email:
${pagador.email || 'Nao informado'}

Usuario:
${credenciais.username}

Senha:
${credenciais.password}

Vencimento:
${formatarData(credenciais.expiresAt)}

Referencia:
${venda.reference}

Pagamento Mercado Pago:
${pagamento.id}`
        );

        console.log(
            'PAGAMENTO APROVADO',
            atualizada.reference,
            pagamento.id
        );

        return;

    }

    if (
        status === 'cancelled' ||
        status === 'rejected' ||
        status === 'refunded' ||
        status === 'charged_back'
    ) {

        atualizarVenda(
            venda.reference,
            {
                status,
                payment_id: pagamento.id,
                payment_status: pagamento.status,
                payment_status_detail: pagamento.status_detail
            }
        );

    }

}

async function verificarPagamentos(client) {

    let vendas;

    try {

        vendas = listarVendasPendentes();

    } catch (erro) {

        console.log('ERRO LISTAR VENDAS MP', erro.message);
        return;

    }

    for (const venda of vendas) {

        try {

            await verificarVenda(
                client,
                venda
            );

        } catch (erro) {

            console.log(
                'ERRO MONITOR MP',
                venda.reference,
                erro.message
            );

        }

    }

}

function iniciarMonitorPagamentos(client) {

    if (monitorIniciado) return;

    monitorIniciado = true;

    setTimeout(
        () => verificarPagamentos(client),
        15000
    );

    setInterval(
        () => verificarPagamentos(client),
        INTERVALO_MS
    );

    console.log('MONITOR MERCADO PAGO ATIVO');

}

module.exports = iniciarMonitorPagamentos;
