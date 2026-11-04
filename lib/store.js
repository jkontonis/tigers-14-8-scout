// Private Vercel Blob store helpers. Finds the store token whatever prefix Vercel gave it.
import { put, get, list } from '@vercel/blob';

const tokenKey = () => Object.keys(process.env).find(k => k.endsWith('BLOB_READ_WRITE_TOKEN') && process.env[k]);
export const ready = () => !!tokenKey();
export const tokenName = () => tokenKey() || '';
export const envNames = () => Object.keys(process.env).filter(k => /BLOB|STORE/i.test(k));
const opts = () => ({ token: process.env[tokenKey()] });

export async function putText(pathname, text, contentType) {
  return put(pathname, text, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 0, ...opts() });
}

export async function getText(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false, ...opts() });
  if (!r) return null;
  return new Response(r.stream).text();
}

export async function listPaths(prefix) {
  const r = await list({ prefix, limit: 1000, ...opts() });
  return r.blobs.map(b => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt, url: b.url }));
}
