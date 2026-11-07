// Keep a failed collector from silently leaving yesterday's 'ready' status on the app.
// This wrapper does not start browsers, buy units, change secrets or lower the quota reserve.
import fs from 'node:fs/promises';
import { remainingUnits } from '../lib/browserless.js';
import { failureSnapshot } from '../lib/reader-health.js';
import { validateSnapshot } from '../lib/snapshot.js';
import { AUDIENCE } from '../lib/runner-auth.js';
const config = JSON.parse(await fs.readFile(new URL('../config.json', import.meta.url), 'utf8'));
try {
  await import('./cloud.mjs');
} catch {
  console.error('::error::Automatic collection failed. Retaining the last verified competition data.');
  if (!process.argv.includes('--read-only')) {
    try {
      const tokenPresent = !!process.env.BROWSERLESS_TOKEN;
      const units = tokenPresent ? await remainingUnits() : null;
      const response = await fetch(AUDIENCE + '/api/data', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Previous snapshot unavailable');
      const previous = await response.json();
      const out = failureSnapshot(previous, { units, tokenPresent, runId: process.env.GITHUB_RUN_ID || null, trigger: process.env.GITHUB_EVENT_NAME || 'unknown' });
      validateSnapshot(out, config);
      const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL, requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
      if (!requestUrl || !requestToken) throw new Error('Workflow identity required');
      const idUrl = new URL(requestUrl); idUrl.searchParams.set('audience', AUDIENCE);
      const identityResponse = await fetch(idUrl, { headers: { Authorization: 'Bearer ' + requestToken }, signal: AbortSignal.timeout(15000) });
      if (!identityResponse.ok) throw new Error('Workflow identity unavailable');
      const identity = (await identityResponse.json()).value;
      if (!identity) throw new Error('Workflow identity missing');
      const published = await fetch(AUDIENCE + '/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + identity }, body: JSON.stringify(out), signal: AbortSignal.timeout(25000) });
      if (!published.ok) throw new Error('Health publication rejected');
      console.log(JSON.stringify({ healthPublished: true, state: out.meta.reader.state, unitsRemaining: units, sourceCheckedAt: out.meta.scrapedAt, newResultsCollected: false }));
      if (process.env.GITHUB_OUTPUT && ['quota_paused', 'quota_unverified', 'configuration_error'].includes(out.meta.reader.state)) await fs.appendFile(process.env.GITHUB_OUTPUT, 'blocked=true\n');
    } catch {
      console.error('::warning::Could not publish reader health. The existing snapshot was not replaced.');
    }
  }
  process.exitCode = 1;
}
