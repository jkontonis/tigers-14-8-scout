// Reads the public PlayHQ pages for one grade (fixture, ladder, each played game's
// box score and play-by-play) with a real browser and writes data/latest.json.
//
// Usage: node scraper/scrape.mjs [--config config.json] [--out data/latest.json] [--force]
// Needs Node 20+ and Playwright (see scraper/package.json).

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const CONFIG_PATH = args.config || path.join(here, '..', 'config.json');
const OUT = args.out || path.join(here, '..', 'data', 'latest.json');
const FORCE = !!args.force;

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
const parserSrc = (await readFile(path.join(here, 'parsers.js'), 'utf8')).replace(/if \(typeof module[^\n]*\n/, '');
const ORIGIN = new URL(config.gradeUrl).origin;

let previous = null;
if (!FORCE && existsSync(OUT)) {
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { previous = null; }
}

const log = (...m) => console.log(new Date().toISOString(), ...m);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runParser(page, name) {
  return page.evaluate(([src, fn]) => {
    const PARSERS = new Function(src + '\nreturn PARSERS;')();
    return PARSERS[fn](document);
  }, [parserSrc, name]);
}

async function open(page, url, waitFor) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (res && res.status() >= 400) throw new Error('HTTP ' + res.status());
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 25000 });
      await sleep(600);
      return true;
    } catch (e) {
      log(`attempt ${attempt} failed for ${url}: ${e.message}`);
      if (attempt === 3) return false;
      await sleep(2000 * attempt);
    }
  }
  return false;
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate(t => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.trim() === t);
    if (b) { b.click(); return true; }
    return false;
  }, text);
  if (clicked) await sleep(1200);
  return clicked;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 2000 }, locale: 'en-AU', timezoneId: config.timezone || 'Australia/Melbourne' });
const page = await context.newPage();
page.setDefaultTimeout(30000);

const out = {
  meta: {
    scrapedAt: new Date().toISOString(),
    gradeUrl: config.gradeUrl,
    gradeName: config.gradeName || '',
    tournament: config.tournament || '',
    ourTeam: config.ourTeam,
    source: 'playhq-public-pages',
    warnings: [],
  },
  fixture: [],
  ladder: [],
  games: previous && previous.games ? previous.games : {},
};

try {
  // 1. Fixture (pool rounds, then the Finals tab)
  log('fixture', config.gradeUrl);
  if (!(await open(page, config.gradeUrl, '[data-testid="fixture-list"], main'))) throw new Error('fixture page did not load');
  const poolGames = (await runParser(page, 'fixture')).games;
  let finalsGames = [];
  if (await clickButtonByText(page, 'Finals')) {
    try { await page.waitForSelector('[data-testid="fixture-list"]', { timeout: 10000 }); } catch { /* no finals yet */ }
    finalsGames = (await runParser(page, 'fixture')).games.map(g => ({ ...g, pool: 'Finals' }));
  }
  const seen = new Set();
  for (const g of [...poolGames, ...finalsGames]) {
    if (!g.id || seen.has(g.id)) continue;
    seen.add(g.id);
    g.url = g.url && g.url.startsWith('/') ? ORIGIN + g.url : g.url;
    if (!g.pool && /final|semi|medal|classification/i.test(g.label + ' ' + g.round)) g.pool = 'Finals';
    out.fixture.push(g);
  }
  log(`fixture: ${poolGames.length} pool games, ${finalsGames.length} finals games`);
  if (!out.fixture.length) {
    out.meta.warnings.push('No games parsed from the fixture page');
    if (previous && previous.fixture && previous.fixture.length) { out.fixture = previous.fixture; out.meta.warnings.push('Re-using previous fixture'); }
  }

  // 2. Ladder
  const ladderUrl = (config.ladderUrl || config.gradeUrl.replace(/\/$/, '') + '/ladder');
  log('ladder', ladderUrl);
  if (await open(page, ladderUrl, 'table, main')) {
    try { await page.waitForSelector('table', { timeout: 15000 }); } catch { /* ladder may be empty before the first game */ }
    const lad = await runParser(page, 'ladder');
    out.ladder = lad.groups && lad.groups.length ? lad.groups : (lad.rows && lad.rows.length ? [{ label: '', rows: lad.rows }] : []);
    log(`ladder: ${out.ladder.length} group(s)`);
  } else {
    out.meta.warnings.push('Ladder page did not load');
    if (previous && previous.ladder) out.ladder = previous.ladder;
  }

  // 3. Game pages for anything that has started, finished or changed
  const toFetch = out.fixture.filter(g => {
    const started = (g.status && !/upcoming/i.test(g.status)) || g.homeScore != null || g.awayScore != null;
    if (!started) return false;
    if (FORCE) return true;
    const prev = out.games[g.id];
    if (!prev) return true;
    const prevFinal = prev.status === 'FINAL' && prev.boxes && prev.boxes.length === 2;
    const sameScore = prev.periods && prev.periods.length === 2 && prev.periods[0].scores.at(-1) === g.homeScore && prev.periods[1].scores.at(-1) === g.awayScore;
    return !(prevFinal && sameScore);
  });
  log(`games to read: ${toFetch.length}`);
  for (const g of toFetch) {
    if (!(await open(page, g.url, '[data-testid="scores"], main'))) { out.meta.warnings.push('Game page did not load: ' + g.id); continue; }
    await clickButtonByText(page, 'Show advanced stats');
    const detail = await runParser(page, 'game');
    let pbp = [];
    const pbpTab = await page.$('[data-testid="tab-play-by-play"]');
    if (pbpTab) {
      await pbpTab.click();
      await sleep(1200);
      try { pbp = await runParser(page, 'playByPlay'); } catch { pbp = []; }
    }
    out.games[g.id] = { id: g.id, url: g.url, fetchedAt: new Date().toISOString(), ...detail, playByPlay: pbp };
    log(`game ${g.id}: ${detail.home} ${detail.periods[0] ? detail.periods[0].scores.at(-1) : '-'} v ${detail.away} ${detail.periods[1] ? detail.periods[1].scores.at(-1) : '-'} [${detail.status}]`);
    await sleep(500);
  }
} catch (e) {
  out.meta.warnings.push('Fatal: ' + e.message);
  log('ERROR', e);
} finally {
  await browser.close();
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
log(`wrote ${OUT}: ${out.fixture.length} fixtures, ${Object.keys(out.games).length} game details, ${out.meta.warnings.length} warning(s)`);
if (out.meta.warnings.some(w => w.startsWith('Fatal')) && !(previous && previous.fixture && previous.fixture.length)) process.exit(1);
