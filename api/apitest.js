// Calls the PlayHQ public API honestly (tenant header only, optional key) and reports what comes back.
import { authorised } from '../lib/common.js';

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  const path = req.query.path || '/v1/organisations/00000000-0000-0000-0000-000000000000/seasons';
  const headers = { accept: 'application/json', 'x-phq-tenant': req.query.tenant || 'bv' };
  if (process.env.PLAYHQ_API_KEY) headers['x-api-key'] = process.env.PLAYHQ_API_KEY;
  try {
    const r = await fetch('https://api.playhq.com' + path, { headers });
    const text = await r.text();
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    res.status(200).json({ status: r.status, keyUsed: !!process.env.PLAYHQ_API_KEY, body: text.slice(0, 2000), respHeaders: h });
  } catch (e) { res.status(200).json({ error: String(e) }); }
}
