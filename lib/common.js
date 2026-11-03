import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CONFIG = JSON.parse(readFileSync(path.join(process.cwd(), 'config.json'), 'utf8'));
export const KEY = process.env.INGEST_KEY || CONFIG.ingestKey || CONFIG.passcode || '';

export function authorised(req) {
  const k = req.query.k || req.headers['x-key'] || '';
  return KEY && k === KEY;
}
export function hasBlob() { return !!process.env.BLOB_READ_WRITE_TOKEN; }
