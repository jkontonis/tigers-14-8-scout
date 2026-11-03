// Turns the pages the phone has uploaded into latest.json, and tells the phone which game pages are still needed.
import { authorised, hasBlob, CONFIG } from '../lib/common.js';
import { parseFixture, parseLadder, parseGame, parseStats } from '../lib/parse.js';

const isFinal = g => /final/i.test(g.status || '') && !/semi|grand/i.test(g.status || '');
const started = g => (g.status && !/upcoming/i.test(g.status)) || g.homeScore != null || g.awayScore != null;

async function getText(url) { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()); return r.ok ? r.text() : ''; }

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  if (!hasBlob()) { res.status(200).json({ ok: false, message: 'Blob storage is not connected to the project yet.', more: [] }); return; }
  const { list, put } = await import('@vercel/blob');
  const r = await list({ prefix: 'pages/', limit: 500 });
  const pages = {};
  for (const b of r.blobs) pages[b.pathname.replace(/^pages\//, '').replace(/\.html$/, '')] = b;

  let previous = null;
  const prev = await list({ prefix: 'latest.json', limit: 1 });
  if (prev.blobs.length) { try { previous = JSON.parse(await getText(prev.blobs[0].url)); } catch { previous = null; } }

  const out = {
    meta: { scrapedAt: new Date().toISOString(), gradeUrl: CONFIG.gradeUrl, gradeName: CONFIG.gradeName || '', tournament: CONFIG.tournament || '', ourTeam: CONFIG.ourTeam, source: 'phone-upload', warnings: [], pagesAt: {} },
    fixture: previous ? previous.fixture : [],
    ladder: previous ? previous.ladder : [],
    gradeStats: previous ? previous.gradeStats || [] : [],
    games: previous && previous.games ? previous.games : {},
  };

  const origin = new URL(CONFIG.gradeUrl).origin;
  if (pages.fixture) {
    const html = await getText(pages.fixture.url);
    const games = parseFixture(html, origin);
    out.meta.pagesAt.fixture = pages.fixture.uploadedAt;
    if (games.length) {
      // keep finals games seen earlier (they sit on a separate tab the phone may not fetch)
      const ids = new Set(games.map(g => g.id));
      const keep = (previous ? previous.fixture : []).filter(g => !ids.has(g.id) && g.pool === 'Finals');
      out.fixture = [...games, ...keep];
    } else out.meta.warnings.push('Fixture page had no games');
  }
  if (pages.finals) {
    const html = await getText(pages.finals.url);
    const games = parseFixture(html, origin).map(g => ({ ...g, pool: 'Finals' }));
    const ids = new Set(out.fixture.map(g => g.id));
    for (const g of games) if (!ids.has(g.id)) out.fixture.push(g);
  }
  if (pages.ladder) {
    const html = await getText(pages.ladder.url);
    const groups = parseLadder(html);
    out.meta.pagesAt.ladder = pages.ladder.uploadedAt;
    if (groups.some(g => g.rows.length)) out.ladder = groups;
  }
  if (pages.stats) {
    const html = await getText(pages.stats.url);
    const rows = parseStats(html);
    out.meta.pagesAt.stats = pages.stats.uploadedAt;
    if (rows.length) out.gradeStats = rows;
  }
  for (const [tag, b] of Object.entries(pages)) {
    if (!tag.startsWith('game-')) continue;
    const id = tag.slice(5);
    const fx = out.fixture.find(g => g.id === id);
    const html = await getText(b.url);
    const d = parseGame(html);
    if (!d.periods.length && !d.boxes.length) { out.meta.warnings.push('Game page had no stats: ' + id); continue; }
    out.games[id] = { id, url: fx ? fx.url : '', fetchedAt: b.uploadedAt, ...d, status: fx && isFinal(fx) ? 'FINAL' : (d.status || (fx ? fx.status.toUpperCase() : '')), home: d.home || (fx ? fx.home : ''), away: d.away || (fx ? fx.away : '') };
  }

  // Which game pages should the phone fetch next?
  const more = out.fixture.filter(g => started(g) && !/TBC/i.test(g.home + g.away)).filter(g => {
    const have = out.games[g.id];
    if (!have) return true;
    const haveFinal = have.status === 'FINAL' && have.boxes && have.boxes.length === 2 && have.boxes.every(b => b.players.length);
    const pageAfterFixture = pages.fixture && have.fetchedAt && new Date(have.fetchedAt) >= new Date(pages.fixture.uploadedAt) - 10 * 60 * 1000;
    return !(haveFinal && isFinal(g)) && !pageAfterFixture;
  }).map(g => ({ id: 'game-' + g.id, url: g.url }));

  await put('latest.json', JSON.stringify(out), { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 30 });
  const played = Object.values(out.games).length;
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({ ok: true, more, count: more.length, message: `${out.fixture.length} fixtures, ${played} game pages, ${more.length} still to fetch`, warnings: out.meta.warnings });
}
