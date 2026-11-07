// Read-only health interpretation. Source timestamps must never advance on a failed read.
export const UNIT_RESERVE = 40;
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function readerHealth(meta = {}, now = Date.now()) {
  const reader = meta?.reader || {};
  const units = reader.unitsRemaining;
  const state = reader.state || 'unknown';
  if ((finite(units) && units < UNIT_RESERVE) || state === 'quota_paused') {
    return { state: 'quota_paused', paused: true, title: 'LIVE UPDATES PAUSED', message: finite(units) ? `Browserless has ${units} units remaining, below the ${UNIT_RESERVE}-unit collection cutoff. More account allowance is required. Scores and scouting below are saved data, not live.` : 'Browserless collection is paused for insufficient allowance. Scores and scouting below are saved data, not live.' };
  }
  if (['quota_unverified', 'configuration_error', 'reader_error'].includes(state)) {
    return { state, paused: true, title: 'LIVE UPDATES UNAVAILABLE', message: state === 'quota_unverified' ? 'The reader cannot verify the Browserless allowance. Collection is paused and the last verified data is retained.' : 'The automatic reader could not complete its update. The last verified data is retained; reloading this page does not restart the reader.' };
  }
  const sourceAt = Date.parse(meta?.pagesAt?.fixture || meta?.scrapedAt || '');
  const stale = !Number.isFinite(sourceAt) || now - sourceAt > 20 * 60000;
  return { state: stale ? 'stale' : state, paused: false, stale, title: stale ? 'SOURCE CHECK OVERDUE' : 'COLLECTED DATA', message: stale ? 'The source check is overdue. Published results may be out of date.' : '' };
}
export function failureSnapshot(previous, { units = null, tokenPresent = true, at = new Date().toISOString(), runId = null, trigger = 'unknown' } = {}) {
  if (!previous?.meta?.scrapedAt || !Array.isArray(previous.fixture) || !previous.fixture.length) throw new Error('No verified snapshot is available to preserve');
  const out = structuredClone(previous);
  const state = !tokenPresent ? 'configuration_error' : units === null ? 'quota_unverified' : units < UNIT_RESERVE ? 'quota_paused' : 'reader_error';
  out.meta.lastAttemptAt = at;
  out.meta.reader = { ...(out.meta.reader || {}), state, unitsRemaining: finite(units) ? units : null, lastAttemptAt: at, lastRunAt: at, lastSuccessAt: previous.meta.reader?.lastSuccessAt || previous.meta.scrapedAt, lastTrigger: trigger, runId, browserRequests: state === 'reader_error' ? null : 0 };
  const health = readerHealth(out.meta);
  out.meta.warnings = [...(previous.meta.warnings || []).filter(w => !String(w).startsWith('Reader status: ')), 'Reader status: ' + health.message];
  return out;
}
