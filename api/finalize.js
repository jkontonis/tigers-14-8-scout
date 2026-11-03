// Placeholder until the page parser is in: reports what has been received this run.
import { authorised, hasBlob } from '../lib/common.js';

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  let pages = [];
  if (hasBlob()) {
    const { list } = await import('@vercel/blob');
    const r = await list({ prefix: 'pages/' });
    pages = r.blobs.map(b => ({ path: b.pathname, size: b.size, at: b.uploadedAt }));
  }
  res.status(200).json({ ok: true, blob: hasBlob(), pages, message: `Received ${pages.length} page(s).` });
}
