// Short-lived GitHub identity verification. No shared publishing password.
import { createPublicKey, verify } from 'node:crypto';
export const AUDIENCE = 'https://tigers148-tournament.vercel.app';
const ISSUER = 'https://token.actions.githubusercontent.com';
let cached = { at: 0, keys: [] };
export function validateClaims(p, now = Date.now() / 1000) {
  if (p.iss !== ISSUER || p.aud !== AUDIENCE || !Number.isFinite(p.exp) || p.exp <= now || !Number.isFinite(p.iat) || p.iat > now + 30 || now - p.iat > 600 || !Number.isFinite(p.nbf) || p.nbf > now + 30) throw new Error('Invalid token lifetime or issuer');
  if (String(p.repository_id) !== '1444894042' || String(p.repository_owner_id) !== '277422209' || p.repository !== 'jkontonis/tigers-14-8-scout' || p.ref !== 'refs/heads/main' || p.workflow_ref !== 'jkontonis/tigers-14-8-scout/.github/workflows/scrape.yml@refs/heads/main' || !['schedule','workflow_dispatch','push'].includes(p.event_name)) throw new Error('Untrusted workflow');
  const allowed = ['repo:jkontonis/tigers-14-8-scout:ref:refs/heads/main','repo:jkontonis@277422209/tigers-14-8-scout@1444894042:ref:refs/heads/main'];
  if (!allowed.includes(p.sub)) throw new Error('Untrusted subject');
  return p;
}
export async function verifyRunner(req, fetchImpl = fetch) {
  try {
    const bearer = req.headers.authorization || '';
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer) || bearer.length > 18000) return false;
    const token = bearer.slice(7), parts = token.split('.');
    if (parts.length !== 3) return false;
    const h = JSON.parse(Buffer.from(parts[0], 'base64url'));
    if (h.alg !== 'RS256' || typeof h.kid !== 'string' || h.crit) return false;
    if (Date.now() - cached.at > 300000 || !cached.keys.some(k => k.kid === h.kid)) {
      const r = await fetchImpl(ISSUER + '/.well-known/jwks', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return false;
      const j = await r.json();
      if (!Array.isArray(j.keys)) return false;
      cached = { at: Date.now(), keys: j.keys };
    }
    const key = cached.keys.find(k => k.kid === h.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
    if (!key || !verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({ key, format:'jwk' }), Buffer.from(parts[2], 'base64url'))) return false;
    validateClaims(JSON.parse(Buffer.from(parts[1], 'base64url')));
    return true;
  } catch { return false; }
}
