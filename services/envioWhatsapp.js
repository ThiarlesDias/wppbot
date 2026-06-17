const {
    limparTelefone,
    montarWidTelefone
} = require('./whatsappNumero');

function serializarId(valor) {

    if (!valor) return null;

    if (typeof valor === 'string') return valor;

    if (typeof valor !== 'object') return null;

    const candidatos = [
        valor._serialized,
        valor.serialized,
        valor.id,
        valor.user && valor.server ? `${valor.user}@${valor.server}` : '',
        valor.user
    ];

    return candidatos
        .map(item => typeof item === 'string' ? item.trim() : '')
        .find(Boolean) || null;

}

function adicionarCandidato(lista, valor) {

    const texto = serializarId(valor);

    if (!texto) return;
    if (texto.includes('@g.us') || texto.includes('@newsletter')) return;
    if (texto === 'status@broadcast') return;
    if (lista.includes(texto)) return;

    lista.push(texto);

}

function candidatosNumero(...valores) {

    const candidatos = [];

    for (const valor of valores) {

        adicionarCandidato(
            candidatos,
            valor
        );

        const telefone = limparTelefone(valor);
        const wid = montarWidTelefone(telefone);

        adicionarCandidato(
            candidatos,
            wid
        );

        if (telefone && !candidatos.includes(telefone)) {

            candidatos.push(telefone);

        }

    }

    return candidatos;

}

async function resolverPeloWhatsapp(client, candidato) {

    if (!client?.checkNumberStatus) return [];

    const resolvidos = [];

    try {

        const status = await client.checkNumberStatus(candidato);

        if (status?.numberExists === false || status?.canReceiveMessage === false) {

            return resolvidos;

        }

        adicionarCandidato(
            resolvidos,
            status?.id
        );

        adicionarCandidato(
            resolvidos,
            status?.id?._serialized
        );

    } catch (_) {

        return resolvidos;

    }

    return resolvidos;

}

function deveTentarResolver(erro) {

    const mensagem = String(erro?.message || erro || '');

    return mensagem.includes('No LID') ||
        mensagem.includes('InvalidWid') ||
        mensagem.includes('wid error') ||
        mensagem.includes('invalid wid');

}

async function enviarTextoSeguro(client, destinos, texto, opcoes = {}) {

    const fila = candidatosNumero(
        ...(Array.isArray(destinos) ? destinos : [destinos])
    );
    const tentados = new Set();
    let ultimoErro = null;

    while (fila.length) {

        const destino = fila.shift();

        if (!destino || tentados.has(destino)) continue;

        tentados.add(destino);

        try {

            const resultado = await client.sendText(
                destino,
                texto,
                opcoes
            );

            return {
                destino,
                resultado
            };

        } catch (erro) {

            ultimoErro = erro;

            if (!deveTentarResolver(erro)) continue;

            const resolvidos = await resolverPeloWhatsapp(
                client,
                destino
            );

            for (const resolvido of resolvidos) {

                if (!tentados.has(resolvido)) fila.push(resolvido);

            }

        }

    }

    throw ultimoErro || new Error('Nao foi possivel enviar mensagem no WhatsApp.');

}

module.exports = {
    enviarTextoSeguro
};
