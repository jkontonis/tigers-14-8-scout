// Serves the latest parsed data to the app.
import { authorised } from '../lib/common.js';
import { ready, getText } from '../lib/store.js';

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  res.setHeader('cache-control', 'no-store');
  if (!ready()) { res.status(404).json({ error: 'no storage connected yet' }); return; }
  const text = await getText('latest.json');
  if (!text) { res.status(404).json({ error: 'no data yet' }); return; }
  res.setHeader('content-type', 'application/json');
  res.status(200).send(text);
}
