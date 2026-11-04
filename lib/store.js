// Private Vercel Blob store helpers.
import { put, get, list } from '@vercel/blob';

export const ready = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function putText(pathname, text, contentType) {
  return put(pathname, text, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 0 });
}

export async function getText(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r) return null;
  return new Response(r.stream).text();
}

export async function listPaths(prefix) {
  const r = await list({ prefix, limit: 1000 });
  return r.blobs.map(b => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt, url: b.url }));
}
