const {
    enviarMenu
} = require('../../services/menuInterativo');

module.exports = async function comercial(
    client,
    numero
) {

    return await enviarMenu(
        client,
        numero,
        {
            titulo: 'Comercial',
            descricao: 'Escolha o servico que deseja conhecer.',
            botao: 'Ver servicos',
            secao: 'Servicos',
            opcoes: [
                {
                    id: '1',
                    titulo: 'Desenvolvimento de Sites',
                    descricao: 'Sites institucionais, landing pages e sistemas web.'
                },
                {
                    id: '2',
                    titulo: 'Aplicativos',
                    descricao: 'Apps e solucoes sob medida.'
                },
                {
                    id: '3',
                    titulo: 'Automacao WhatsApp',
                    descricao: 'Bots, atendimento e integracoes.'
                },
                {
                    id: '4',
                    titulo: 'Marketing Digital',
                    descricao: 'Campanhas e presenca online.'
                },
                {
                    id: '5',
                    titulo: 'Infraestrutura de TI',
                    descricao: 'Redes, servidores e suporte tecnico.'
                },
                {
                    id: '6',
                    titulo: 'Consultoria em TI',
                    descricao: 'Analise e orientacao tecnica.'
                },
                {
                    id: '0',
                    titulo: 'Voltar',
                    descricao: 'Retornar ao menu principal.'
                }
            ]
        }
    );

};
