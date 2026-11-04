// Public, read-only access to the latest published scouting data.
// Publishing remains protected separately by GitHub workflow identity.
import { ready, getText } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'GET or HEAD required' });
  }
  if (!ready()) return res.status(404).json({ error: 'no storage connected yet' });
  const text = await getText('latest.json');
  if (!text) return res.status(404).json({ error: 'no data yet' });
  res.setHeader('content-type', 'application/json');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(text);
}
