// test-nvidia-connection.ts
//
// Prueba de humo rapida: confirma que tu API key funciona y que el
// modelo responde, antes de integrarlo al ComboAnalysisAiService.
//
// Correr con: npx ts-node test-nvidia-connection.ts
// Requiere NVIDIA_API_KEY en tu .env (o exportada en la terminal)

import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
  throw new Error('Falta NVIDIA_API_KEY en tus variables de entorno');
}

const openai = new OpenAI({
  apiKey,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'meta/llama-3.1-8b-instruct',
    messages: [
      {
        role: 'user',
        content:
          'Responde solo con la palabra "conectado" si recibes este mensaje.',
      },
    ],
    temperature: 0.2,
    max_tokens: 20,
    stream: false,
  });

  console.log(completion.choices[0]?.message?.content);
}

main().catch((err) => {
  console.error('Fallo la conexion con NVIDIA NIM:', err.message);
  process.exit(1);
});