async function smartTv(client, numero) {

    return await client.sendText(
        numero,

`📺 *Smart TV*

1️⃣ Abra a loja de aplicativos da sua TV.
2️⃣ Procure por *IBO Player* e instale.
3️⃣ Abra o aplicativo e anote o *MAC* e a *Device Key* que aparecem na tela.
4️⃣ No celular ou computador, acesse o site indicado pelo proprio IBO Player.
5️⃣ Cole o *Link M3U* que enviamos no teste.
6️⃣ Salve a lista e reinicie o aplicativo na TV.

Se pedir nome da playlist, pode colocar *TopTec TV*.

↩️ Digite *0* para voltar.`
    );

}

async function computador(client, numero) {

    return await client.sendText(
        numero,

`💻 *Computador / notebook*

1️⃣ Baixe o *ARC Player*:
https://www.arcplayer.com/pt-BR/download

2️⃣ Instale e abra o aplicativo.
3️⃣ Escolha a opcao de adicionar lista/playlist.
4️⃣ Cole o *Link M3U* que enviamos no teste.
5️⃣ Salve e aguarde carregar os canais.

Se pedir nome da lista, use *TopTec TV*.

↩️ Digite *0* para voltar.`
    );

}

async function celular(client, numero) {

    return await client.sendText(
        numero,

`📱 *Celular*

1️⃣ Baixe o *ARC Player*:
https://www.arcplayer.com/pt-BR/download

2️⃣ Instale e abra o aplicativo.
3️⃣ Toque para adicionar uma lista/playlist.
4️⃣ Cole o *Link M3U* que enviamos no teste.
5️⃣ Salve e aguarde carregar.

No Android, tambem pode procurar *ARC Player* na loja de aplicativos.

↩️ Digite *0* para voltar.`
    );

}

async function outro(client, numero) {

    return await client.sendText(
        numero,

`🧩 *Outro dispositivo*

Se for *Android TV, TV Box ou Fire Stick*, baixe o *ARC Player* e adicione a lista usando o *Link M3U* enviado no teste.

Passo geral:
1️⃣ Instale o ARC Player.
2️⃣ Abra o aplicativo.
3️⃣ Escolha adicionar lista/playlist.
4️⃣ Cole o Link M3U.
5️⃣ Salve e aguarde carregar.

Se o aparelho pedir outro formato, fale com a gente que ajudamos a configurar.

↩️ Digite *0* para voltar.`
    );

}

module.exports = {
    smartTv,
    computador,
    celular,
    outro
};
