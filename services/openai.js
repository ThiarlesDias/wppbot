require('dotenv').config();

const axios = require('axios');

async function perguntarIA(pergunta) {

    try {

        const response = await axios.post(

            'https://api.openai.com/v1/chat/completions',

            {
                model: 'gpt-4.1-mini',

                messages: [

                    {
                        role: 'system',
                        content:
                        'Você é a assistente da TopTec Digital.'
                    },

                    {
                        role: 'user',
                        content: pergunta
                    }
                ]
            },

            {
                headers: {

                    Authorization:
                    `Bearer ${process.env.OPENAI_API_KEY}`,

                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (erro) {

        console.log(erro);

        return 'Erro na IA.';
    }
}

module.exports = perguntarIA;