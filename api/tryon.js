export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  
    try {
      const { personImage, apparelImage } = req.body || {};
      if (!personImage || !apparelImage) {
        return res.status(400).json({ error: { message: 'personImage and apparelImage (base64 data URLs) are both required.' } });
      }
  
      const toBlob = (dataUrl) => {
        const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
        if (!match) throw new Error('Expected a base64 data URL image');
        const mime = match[1] || 'image/jpeg';
        const buf = Buffer.from(match[2], 'base64');
        return new Blob([buf], { type: mime });
      };
  
      const form = new FormData();
      form.append('image', toBlob(personImage), 'person.jpg');
      form.append('image-apparel', toBlob(apparelImage), 'apparel.jpg');
  
      // Uses api4.ai's free, rate-limited public demo endpoint by default — no signup needed.
      // If you later get an api4.ai API key, set API4AI_KEY in Vercel's env vars to switch to the
      // production endpoint automatically (higher limits, no rate throttling).
      const apiKey = process.env.API4AI_KEY;
      const endpoint = apiKey
        ? 'https://api4ai.cloud/virtual-try-on/v1/results'
        : 'https://demo.api4ai.cloud/virtual-try-on/v1/results';
      const headers = apiKey ? { 'X-API-KEY': apiKey } : {};
  
      const response = await fetch(endpoint, { method: 'POST', headers, body: form });
  
      let data;
      try { data = await response.json(); }
      catch { return res.status(502).json({ error: { message: 'Try-on service returned a non-JSON response (likely rate-limited — try again in a moment).' } }); }
  
      if (!response.ok) {
        return res.status(response.status).json({ error: data.error || data || { message: 'Try-on request failed' } });
      }
  
      const entity = data?.results?.[0]?.entities?.[0];
      if (!entity || !entity.image) {
        return res.status(502).json({ error: { message: 'No result image returned from the try-on service.' } });
      }
  
      const format = (entity.format || 'jpeg').toLowerCase();
      return res.status(200).json({ image: `data:image/${format};base64,${entity.image}` });
    } catch (err) {
      return res.status(500).json({ error: { message: err.message } });
    }
  }