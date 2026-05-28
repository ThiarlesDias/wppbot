from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():

    data = request.json

    numero = data.get('numero')
    mensagem = data.get('mensagem')

    print(numero)
    print(mensagem)

    resposta = "Você disse: " + mensagem

    return jsonify({
        "resposta": resposta
    })

app.run(host='0.0.0.0', port=5000)