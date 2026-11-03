// Serves the latest parsed data to the app.
import { authorised, hasBlob } from '../lib/common.js';

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  res.setHeader('cache-control', 'no-store');
  if (!hasBlob()) { res.status(404).json({ error: 'no storage connected yet' }); return; }
  const { list } = await import('@vercel/blob');
  const r = await list({ prefix: 'latest.json', limit: 1 });
  if (!r.blobs.length) { res.status(404).json({ error: 'no data yet' }); return; }
  const f = await fetch(r.blobs[0].url + '?t=' + Date.now());
  res.status(200).send(await f.text());
}
