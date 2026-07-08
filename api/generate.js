// Ye Vercel Serverless Function hai. Ye browser mein kabhi nahi jaati —
// sirf Vercel ke server par chalti hai. API key yahan process.env se aati hai,
// jo Vercel dashboard ke "Environment Variables" mein set hoti hai — code mein
// kahin bhi likhi hui nahi hoti, isliye GitHub par push karne se koi secret leak nahi hota.
//
// Ab Groq use ho raha hai (Gemini ki jagah) — Groq free tier bina billing card ke
// kaam karta hai aur bahut fast hai.

// Agar ek model fail ho to agla try hota hai
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

async function tryModel(model, apiKey, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.05,
      top_p: 0.95,
      frequency_penalty: 0.4,
      presence_penalty: 0.3,
      max_tokens: 300,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { ok: false, status: res.status, detail: errBody, model };
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { ok: false, status: 502, detail: JSON.stringify(data), model };
  return { ok: true, text: text.trim(), model };
}

export default async function handler(req, res) {
  // Sirf POST requests allow karo
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt missing' });
  }

  const apiKey = process.env.GROQ_API_KEY; // Vercel dashboard se aayegi
  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured' });
  }

  const attempts = [];
  try {
    for (const model of MODELS) {
      const result = await tryModel(model, apiKey, prompt);
      if (result.ok) {
        return res.status(200).json({ text: result.text, modelUsed: result.model });
      }
      attempts.push(`[${model}] ${result.status}: ${result.detail}`);
      console.error('Model failed:', model, result.status, result.detail);
      if (result.status !== 429 && result.status !== 503) {
        return res.status(result.status).json({ error: 'Groq API error', detail: result.detail, modelTried: model });
      }
    }
    return res.status(429).json({ error: 'Sab models par quota khatam', detail: attempts.join('\n') });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
