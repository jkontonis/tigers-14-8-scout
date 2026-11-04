// Receives one PlayHQ page posted by the phone. Logs what it contains and, when Blob storage is connected, keeps it.
import { authorised, hasBlob } from '../lib/common.js';

export const config = { api: { bodyParser: false } };

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  const tag = String(req.query.page || 'unknown').replace(/[^a-z0-9_-]/gi, '');
  let body = await readBody(req);
  const rawHead = body.slice(0, 400); const rawLen = body.length;
  // The phone sends JSON {"html": "<base64>"}; accept raw HTML too
  const ct = req.headers['content-type'] || '';
  if (/json/i.test(ct) || body.trimStart().startsWith('{')) {
    try { const j = JSON.parse(body); const b64 = typeof j.html === 'string' ? j.html : ''; body = b64 ? Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8') : ''; } catch (e) { console.log('ingest: json parse failed ' + e.message); }
  }
  const marks = ['fixture-list', 'games-on-date', 'data-testid="scores"', 'Player Statistics', 'By Period', '<table', '__APOLLO_STATE__', '__NEXT_DATA__', 'Request blocked', 'Show advanced stats', '1PT', 'grade-statistics-table', 'standing-0-data'];
  const found = Object.fromEntries(marks.map(m => [m, body.includes(m)]));
  console.log(JSON.stringify({ tag, length: body.length, contentType: ct, ua: req.headers['user-agent'] || '', found, head: body.slice(0, 200), rawLen, rawHead }));
  for (let i = 0; i < Math.min(body.length, 9000); i += 3000) console.log('CHUNK ' + tag + ' ' + (i / 3000) + ' ' + body.slice(i, i + 3000).replace(/\s+/g, ' '));
  const idx = body.indexOf('Player Statistics');
  if (idx > 0) console.log('BOX ' + tag + ' ' + body.slice(Math.max(0, idx - 200), idx + 2800).replace(/\s+/g, ' '));
  const p = body.indexOf('By Period');
  if (p > 0) console.log('PERIOD ' + tag + ' ' + body.slice(Math.max(0, p - 300), p + 1500).replace(/\s+/g, ' '));
  const s = body.indexOf('standing-0-data');
  if (s > 0) console.log('LADDER ' + tag + ' ' + body.slice(Math.max(0, s - 1500), s + 1500).replace(/\s+/g, ' '));
  let stored = false;
  if (hasBlob() && body.length > 1000) {
    const { put } = await import('@vercel/blob');
    await put(`pages/${tag}.html`, body, { access: 'public', addRandomSuffix: false, contentType: 'text/html', cacheControlMaxAge: 60 });
    stored = true;
  }
  res.status(200).json({ ok: true, tag, length: body.length, stored, found });
}
