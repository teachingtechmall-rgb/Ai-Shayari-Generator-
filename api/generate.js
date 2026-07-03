// Ye Vercel Serverless Function hai. Ye browser mein kabhi nahi jaati —
// sirf Vercel ke server par chalti hai. API key yahan process.env se aati hai,
// jo Vercel dashboard ke "Environment Variables" mein set hoti hai — code mein
// kahin bhi likhi hui nahi hoti, isliye GitHub par push karne se koi secret leak nahi hota.

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

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(geminiRes.status).json({ error: 'Gemini API error', detail: errBody });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Gemini empty response:', JSON.stringify(data));
      return res.status(502).json({ error: 'Empty response from Gemini', detail: JSON.stringify(data) });
    }

    return res.status(200).json({ text: text.trim() });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
