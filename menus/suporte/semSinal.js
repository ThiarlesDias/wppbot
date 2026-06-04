async function semSinal(client, numero, assinaturas = []) {

    const acessos = assinaturas.filter(assinatura =>
        assinatura.status !== 'cancelada' &&
        assinatura.username
    );
    const linhasAcessos = acessos.map(assinatura =>
        `• ${assinatura.nome || 'Cliente'} - usuario ${assinatura.username}`
    );

    await client.sendText(
        numero,

`📡 *SEM SINAL*

Recebi sua solicitacao e vou verificar pelo WhatsApp deste atendimento.

${linhasAcessos.length ? `Acesso localizado:\n${linhasAcessos.join('\n')}` : 'Nao encontrei usuario cadastrado neste WhatsApp.'}

Nossa equipe foi avisada e vai continuar o suporte por aqui.`
    );

}

module.exports = semSinal;
