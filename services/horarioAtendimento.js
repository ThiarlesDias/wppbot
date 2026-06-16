function partesSaoPaulo(data = new Date()) {

    return new Intl.DateTimeFormat(
        'en-US',
        {
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }
    ).formatToParts(data).reduce(
        (acc, parte) => {
            acc[parte.type] = parte.value;
            return acc;
        },
        {}
    );

}

function horaNumero(partes) {

    return Number(partes.hour) + Number(partes.minute || 0) / 60;

}

function statusHorario(data = new Date()) {

    const partes = partesSaoPaulo(data);
    const weekday = String(partes.weekday || '').toLowerCase();
    const hora = horaNumero(partes);
    const domingo = weekday.startsWith('sun');
    const sabado = weekday.startsWith('sat');
    const dentro =
        !domingo &&
        (
            sabado ?
                hora >= 9 && hora < 13 :
                hora >= 9 && hora < 19
        );

    return {
        dentro,
        domingo,
        sabado,
        texto: dentro ? 'Dentro do horario de atendimento.' : 'Fora do horario de atendimento humano.',
        horario: 'Segunda a sexta das 9h as 19h. Sabado das 9h as 13h. Domingo sem atendimento.'
    };

}

function estaDentroHorario(data = new Date()) {

    return statusHorario(data).dentro;

}

function avisoForaHorario() {

    const status = statusHorario();

    if (status.dentro) return '';

    return [
        'Estamos fora do horario de atendimento humano.',
        status.horario,
        '',
        'Mas pode continuar por aqui: o robo consegue fazer consultas, testes, pagamentos, renovacoes e outras solicitacoes automaticamente.'
    ].join('\n');

}

function avisoAtendenteForaHorario() {

    const status = statusHorario();

    if (status.dentro) return '';

    return [
        'No momento estamos fora do horario de atendimento humano.',
        status.horario,
        '',
        'Sua solicitacao foi registrada. Se alguem da equipe estiver disponivel, vai te responder antes; caso contrario, retornamos no proximo horario de atendimento.'
    ].join('\n');

}

module.exports = {
    avisoAtendenteForaHorario,
    avisoForaHorario,
    estaDentroHorario,
    statusHorario
};
