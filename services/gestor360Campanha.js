const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const sessoes = require('./sessions');
const {
    limparTelefone,
    montarWidTelefone
} = require('./whatsappNumero');
const {
    enviarTextoSeguro
} = require('./envioWhatsapp');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MEDIA_DIR = path.join(ROOT_DIR, 'media');
const CSV_PADRAO = path.join(MEDIA_DIR, 'contatos_mercadinhos_conveniencias_norte_pr.csv');
const PDF_PADRAO = path.join(MEDIA_DIR, 'toptecgestor_360_apresentacao_por_modulos_mercado.pdf');
const CSV_PATH = caminhoConfigurado(process.env.GESTOR360_CSV_PATH, CSV_PADRAO);
const PDF_PATH = caminhoConfigurado(process.env.GESTOR360_PDF_PATH, PDF_PADRAO);
const STORE_PATH = path.join(DATA_DIR, 'gestor360-campanha.json');
const INTERVALO_ENVIO_MS = Number(process.env.GESTOR360_ENVIO_INTERVALO_MS || 60 * 1000);
const INTERVALO_TEXTO_PDF_MS = Number(process.env.GESTOR360_INTERVALO_TEXTO_PDF_MS || 1500);
const LIMITE_DIARIO = Number(process.env.GESTOR360_LIMITE_DIARIO || 10);
const SITE_GESTOR360 = 'https://toptecdigital.com/toptec-gestor-360/';

let campanhaRodando = false;

function caminhoConfigurado(valor, padrao) {

    const texto = String(valor || '').trim();

    if (!texto) return padrao;

    return path.isAbsolute(texto) ? texto : path.join(ROOT_DIR, texto);

}

function garantirDataDir() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

}

function lerStore() {

    garantirDataDir();

    if (!fs.existsSync(STORE_PATH)) {

        return {
            telefones: {}
        };

    }

    try {

        const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

        return {
            telefones: store.telefones || {}
        };

    } catch (_) {

        return {
            telefones: {}
        };

    }

}

function salvarStore(store) {

    garantirDataDir();

    fs.writeFileSync(
        STORE_PATH,
        JSON.stringify(
            {
                atualizadoEm: new Date().toISOString(),
                telefones: store.telefones || {}
            },
            null,
            2
        )
    );

}

function esperar(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}

function textoLinha(valor) {

    return String(valor || '').trim();

}

function primeiroNome(valor) {

    const nome = textoLinha(valor);

    if (!nome) return 'tudo bem';

    return nome.split(/\s+/)[0];

}

function escolherCampo(linha, campos) {

    for (const campo of campos) {

        const valor = textoLinha(linha[campo]);

        if (valor) return valor;

    }

    return '';

}

function normalizarContato(linha) {

    const nome = escolherCampo(
        linha,
        [
            'nome',
            'Nome',
            'cliente',
            'Cliente',
            'contato',
            'Contato'
        ]
    );
    const conveniencia = escolherCampo(
        linha,
        [
            'conveniencia',
            'Conveniencia',
            'conveniência',
            'Conveniência',
            'empresa',
            'Empresa',
            'estabelecimento',
            'Estabelecimento',
            'nome',
            'Nome'
        ]
    );
    const cidade = escolherCampo(
        linha,
        [
            'cidade',
            'Cidade'
        ]
    );
    const endereco = escolherCampo(
        linha,
        [
            'endereco',
            'Endereço',
            'endereço',
            'Endereco'
        ]
    );
    const telefoneOriginal = escolherCampo(
        linha,
        [
            'whatsapp',
            'WhatsApp',
            'telefone',
            'Telefone',
            'celular',
            'Celular'
        ]
    );
    const wid = montarWidTelefone(telefoneOriginal);

    if (!wid) return null;

    return {
        nome,
        primeiroNome: primeiroNome(nome),
        conveniencia: conveniencia || nome || 'sua conveniencia',
        cidade,
        endereco,
        telefone: limparTelefone(wid),
        telefoneOriginal,
        wid
    };

}

function lerContatosGestor360() {

    if (!fs.existsSync(CSV_PATH)) return [];

    const workbook = XLSX.readFile(
        CSV_PATH,
        {
            raw: false
        }
    );
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(
        sheet,
        {
            defval: ''
        }
    );
    const vistos = new Set();
    const contatos = [];

    for (const linha of linhas) {

        const contato = normalizarContato(linha);

        if (!contato) continue;
        if (vistos.has(contato.telefone)) continue;

        vistos.add(contato.telefone);
        contatos.push(contato);

    }

    return contatos;

}

function montarMensagemGestor360(contato) {

    const cidade = contato.cidade ? ` em ${contato.cidade}` : '';

    return [
        `Ola, ${contato.primeiroNome}. Tudo bem?`,
        '',
        'Sou da TopTec Digital.',
        `Separei uma apresentacao do *TopTec Gestor360* para mercadinhos e conveniencias como a *${contato.conveniencia}*${cidade}.`,
        '',
        'Voce pode testar gratuitamente. Basta acessar o site e fazer um cadastro simples e rapido:',
        SITE_GESTOR360,
        '',
        'Vou enviar tambem o PDF com uma visao dos modulos para vendas, estoque, financeiro e atendimento.',
        '',
        'Se nao quiser receber esse tipo de contato, responda *SAIR*.'
    ].join('\n');

}

function montarLegendaPdfGestor360(contato) {

    return [
        `Apresentacao do *TopTec Gestor360* para a *${contato.conveniencia}*.`,
        '',
        `Teste gratis: ${SITE_GESTOR360}`
    ].join('\n');

}

function diaSaoPaulo(valor = new Date()) {

    const partes = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(new Date(valor)).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

    return `${partes.year}-${partes.month}-${partes.day}`;

}

function totalEnviadoHoje(store = lerStore()) {

    const hoje = diaSaoPaulo();

    return Object.values(store.telefones || {}).filter(item =>
        item.status === 'enviado' &&
        item.enviadoEm &&
        diaSaoPaulo(item.enviadoEm) === hoje
    ).length;

}

function resumoStatus() {

    const contatos = lerContatosGestor360();
    const store = lerStore();
    const registros = Object.values(store.telefones || {});

    return {
        csv: CSV_PATH,
        pdf: PDF_PATH,
        csvExiste: fs.existsSync(CSV_PATH),
        pdfExiste: fs.existsSync(PDF_PATH),
        totalContatos: contatos.length,
        enviados: registros.filter(item => item.status === 'enviado').length,
        interessados: registros.filter(item => item.interesseEm).length,
        erros: registros.filter(item => item.status === 'erro').length,
        sairam: registros.filter(item => item.status === 'saiu').length,
        pendentes: contatos.filter(contato => {
            const status = store.telefones[contato.telefone]?.status;
            return !['enviado', 'saiu'].includes(status);
        }).length,
        enviadosHoje: totalEnviadoHoje(store),
        limiteDiario: LIMITE_DIARIO,
        intervaloMs: INTERVALO_ENVIO_MS,
        rodando: campanhaRodando
    };

}

function previewGestor360(quantidade = 5) {

    const contatos = lerContatosGestor360();
    const primeiro = contatos[0] || null;

    return {
        status: resumoStatus(),
        contatos: contatos.slice(0, quantidade),
        mensagem: primeiro ? montarMensagemGestor360(primeiro) : '',
        legendaPdf: primeiro ? montarLegendaPdfGestor360(primeiro) : ''
    };

}

function registrarStatus(telefone, dados) {

    const store = lerStore();

    store.telefones[telefone] = {
        ...(store.telefones[telefone] || {}),
        ...dados
    };

    salvarStore(store);

}

async function enviarCampanhaGestor360(client) {

    if (campanhaRodando) {

        return {
            rodando: true,
            total: 0,
            enviados: 0,
            ignorados: 0,
            erros: 0,
            enviadosHoje: totalEnviadoHoje(),
            limiteDiario: LIMITE_DIARIO,
            pausadoPorLimite: false
        };

    }

    campanhaRodando = true;

    const contatos = lerContatosGestor360();
    const store = lerStore();
    const resultado = {
        rodando: false,
        total: contatos.length,
        enviados: 0,
        ignorados: 0,
        erros: 0,
        enviadosHoje: totalEnviadoHoje(store),
        limiteDiario: LIMITE_DIARIO,
        pausadoPorLimite: false,
        pdfExiste: fs.existsSync(PDF_PATH)
    };

    try {

        if (!resultado.pdfExiste) {

            resultado.erro = `PDF nao encontrado: ${PDF_PATH}`;
            return resultado;

        }

        for (const contato of contatos) {

            if (
                LIMITE_DIARIO > 0 &&
                resultado.enviadosHoje >= LIMITE_DIARIO
            ) {

                resultado.pausadoPorLimite = true;
                break;

            }

            const registro = store.telefones[contato.telefone];

            if (['enviado', 'saiu'].includes(registro?.status)) {

                resultado.ignorados += 1;
                continue;

            }

            try {

                const envioTexto = await enviarTextoSeguro(
                    client,
                    [
                        contato.wid,
                        contato.telefoneOriginal,
                        contato.telefone
                    ],
                    montarMensagemGestor360(contato)
                );
                const destinoEnvio = envioTexto.destino || contato.wid;

                await esperar(INTERVALO_TEXTO_PDF_MS);

                await client.sendFile(
                    destinoEnvio,
                    PDF_PATH,
                    'TopTec-Gestor360.pdf',
                    montarLegendaPdfGestor360(contato)
                );

                registrarStatus(
                    contato.telefone,
                    {
                        status: 'enviado',
                        nome: contato.nome,
                        conveniencia: contato.conveniencia,
                        cidade: contato.cidade,
                        wid: contato.wid,
                        destino: destinoEnvio,
                        enviadoEm: new Date().toISOString(),
                        erro: ''
                    }
                );

                sessoes[destinoEnvio] = 'gestor360_info';
                resultado.enviados += 1;
                resultado.enviadosHoje += 1;

                await esperar(INTERVALO_ENVIO_MS);

            } catch (erro) {

                console.log(
                    'ERRO GESTOR360',
                    contato.telefone,
                    erro.message
                );

                registrarStatus(
                    contato.telefone,
                    {
                        status: 'erro',
                        nome: contato.nome,
                        conveniencia: contato.conveniencia,
                        cidade: contato.cidade,
                        wid: contato.wid,
                        erro: erro.message,
                        erroEm: new Date().toISOString()
                    }
                );

                resultado.erros += 1;

            }

        }

        return resultado;

    } finally {

        campanhaRodando = false;

    }

}

function marcarSaidaGestor360(valor) {

    const telefone = limparTelefone(valor);

    if (!telefone) return false;

    const store = lerStore();

    if (!store.telefones[telefone]) return false;

    store.telefones[telefone] = {
        ...store.telefones[telefone],
        status: 'saiu',
        saiuEm: new Date().toISOString()
    };

    salvarStore(store);

    return true;

}

function buscarRegistroGestor360(valor) {

    const wid = montarWidTelefone(valor);
    const telefone = limparTelefone(wid || valor);

    if (!telefone) return null;

    const store = lerStore();
    const registro = store.telefones[telefone];

    if (!registro) return null;

    return {
        telefone,
        ...registro
    };

}

function registrarInteresseGestor360(valor, resposta) {

    const wid = montarWidTelefone(valor);
    const telefone = limparTelefone(wid || valor);

    if (!telefone) return null;

    const store = lerStore();
    const registro = store.telefones[telefone];

    if (!registro || registro.status === 'saiu') return null;

    store.telefones[telefone] = {
        ...registro,
        status: 'enviado',
        interesseEm: new Date().toISOString(),
        respostaInteresse: String(resposta || '').trim()
    };

    salvarStore(store);

    return {
        telefone,
        ...store.telefones[telefone]
    };

}

module.exports = {
    buscarRegistroGestor360,
    enviarCampanhaGestor360,
    lerContatosGestor360,
    marcarSaidaGestor360,
    montarMensagemGestor360,
    montarLegendaPdfGestor360,
    previewGestor360,
    registrarInteresseGestor360,
    statusGestor360: resumoStatus
};
