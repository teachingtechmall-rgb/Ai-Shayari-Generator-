// Ye Vercel Serverless Function hai. Ye browser mein kabhi nahi jaati —
// sirf Vercel ke server par chalti hai. API key yahan process.env se aati hai,
// jo Vercel dashboard ke "Environment Variables" mein set hoti hai — code mein
// kahin bhi likhi hui nahi hoti, isliye GitHub par push karne se koi secret leak nahi hota.

// Multiple models try karte hain baari-baari — agar ek ka free quota
// khatam ho ya wo overloaded ho, agla model apne aap try hota hai.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

async function tryModel(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { ok: false, status: res.status, detail: errBody, model };
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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

  const apiKey = process.env.GEMINI_API_KEY; // Vercel dashboard se aayegi
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
      // Sirf quota/rate-limit (429) ya overload (503) par agla model try karo,
      // baaki errors (jaise galat key) par turant ruk jao.
      if (result.status !== 429 && result.status !== 503) {
        return res.status(result.status).json({ error: 'Gemini API error', detail: result.detail, modelTried: model });
      }
    }
    // Saare models fail ho gaye
    return res.status(429).json({ error: 'Sab models par quota khatam', detail: attempts.join('\n') });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
