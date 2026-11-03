// Parses PlayHQ page HTML (as served to a phone) into the data the app uses.
import * as cheerio from 'cheerio';

const num = v => { const s = String(v ?? '').trim(); return s === '' || s === '-' ? null : (isNaN(Number(s)) ? s : Number(s)); };
const txt = ($, el) => $(el).text().replace(/\s+/g, ' ').trim();

export function parseFixture(html, origin = 'https://www.playhq.com') {
  const $ = cheerio.load(html);
  const games = [];
  let round = '', pool = '', date = '';
  $('[data-testid="fixture-list"]').each((_, list) => {
    $(list).find('h3,h4,[data-testid="games-on-date"],[role="listitem"]').each((__, node) => {
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      const tid = $(node).attr('data-testid');
      if (tag === 'h3') { round = txt($, node); pool = ''; }
      else if (tag === 'h4') pool = txt($, node);
      else if (tid === 'games-on-date') { const first = $(node).find('span').first(); date = first.length ? txt($, first) : ''; }
      else if ($(node).attr('role') === 'listitem') {
        const btn = $(node).find('[data-testid^="fixture-button-"]').first();
        const id = btn.length ? btn.attr('data-testid').replace('fixture-button-', '') : '';
        let url = btn.length ? btn.attr('href') : '';
        if (url && url.startsWith('/')) url = origin + url;
        const teamEls = $(node).find('a[href*="/teams/"], span[size="16"][to]');
        let home = teamEls.eq(0).length ? txt($, teamEls.eq(0)) : '';
        let away = teamEls.eq(1).length ? txt($, teamEls.eq(1)) : '';
        const logos = $(node).find('[data-testid$="-team-logo"]').map((i, e) => $(e).attr('data-testid').replace(/-team-logo$/, '')).get();
        if (!home && logos[0]) home = logos[0];
        if (!away && logos[1]) away = logos[1];
        const scores = $(node).find('span[size="28"]').map((i, e) => txt($, e)).get();
        const labelEl = $(node).find('span[size="12"][color="white400"]').first();
        const label = labelEl.length ? txt($, labelEl) : '';
        let status = '';
        $(node).find('span[size="12"]').each((i, e) => { if (!status && !(labelEl.length && e === labelEl[0])) status = txt($, e); });
        const court = $(node).find('[data-testid^="court-"]').first();
        const venue = court.length ? txt($, court) : '';
        const timeMatch = txt($, node).match(/\d{1,2}:\d{2} [AP]M, \w{3}, \d{2} \w{3} \d{2}/);
        if (!pool && /final|semi|medal|classification/i.test(label + ' ' + round)) pool = 'Finals';
        games.push({ id, url, round, pool, label, date, time: timeMatch ? timeMatch[0] : '', home, away, homeScore: num(scores[0]), awayScore: num(scores[1]), status, venue });
      }
    });
  });
  // de-duplicate by id (the Finals tab repeats nothing, but be safe)
  const seen = new Set();
  return games.filter(g => g.id && !seen.has(g.id) && seen.add(g.id));
}

export function parseLadder(html) {
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  const rowsOf = t => $(t).find('tr').toArray().slice(1).map(r => $(r).find('th,td').toArray().map(c => txt($, c)));
  const groups = [];
  for (let k = 0; k + 1 < tables.length; k += 2) {
    const left = rowsOf(tables[k]);
    const headers = $(tables[k + 1]).find('tr').first().find('th,td').toArray().map(c => txt($, c));
    const right = rowsOf(tables[k + 1]);
    const rows = [];
    for (let i = 0; i < left.length; i++) {
      const rec = { rank: Number(left[i][0]) || i + 1, team: left[i][1] || left[i][0] };
      headers.forEach((h, j) => { rec[h] = right[i] ? num(right[i][j]) : null; });
      rows.push(rec);
    }
    // nearest preceding heading
    let label = '';
    let el = $(tables[k]);
    for (let depth = 0; depth < 6 && !label; depth++) {
      let p = el.prev();
      while (p.length && !label) { const h = p.is('h2,h3,h4') ? p : p.find('h2,h3,h4').first(); if (h.length) label = txt($, h); p = p.prev(); }
      el = el.parent();
      if (!el.length) break;
    }
    groups.push({ label, rows });
  }
  return groups;
}

export function parseGame(html) {
  const $ = cheerio.load(html);
  const main = $('main').length ? $('main') : $('body');
  const text = main.text().replace(/[ \t]+/g, ' ');
  const header = main.find('[data-testid="scores"]').first();
  const teamLinks = (header.length ? header : main).find('a[href*="/teams/"]').map((i, e) => txt($, e)).get();
  const statusMatch = text.match(/\b(FINAL|LIVE|UPCOMING|IN PROGRESS|PENDING|FORFEIT|ABANDONED|CANCELLED|POSTPONED|DRAW)\b/i);
  const resultLine = (text.match(/([A-Za-z0-9 .'()&-]+ won by \d+ Points?)/i) || [])[1] || '';
  const whenMatch = text.match(/(\d{1,2}:\d{2} [AP]M, \w+, \d{1,2} \w{3} \d{4})\s*([^\n]+?)(?=\s{2,}|$)/);
  const tables = main.find('table').toArray();
  const periodTable = tables.find(t => /BY PERIOD/i.test(txt($, $(t).find('tr').first())));
  const periods = []; let periodHeaders = [];
  if (periodTable) {
    periodHeaders = $(periodTable).find('tr').first().find('th,td').toArray().map(c => txt($, c)).filter(h => h && !/^by period$/i.test(h) && h !== 'T');
    $(periodTable).find('tr').toArray().slice(1).forEach(r => {
      const cells = $(r).find('th,td').toArray().map(c => txt($, c));
      periods.push({ team: cells[0], scores: cells.slice(1).filter(v => v !== '').map(v => (v === '-' ? null : Number(v))) });
    });
  }
  const statTables = tables.filter(t => /PLAYERS/i.test(txt($, $(t).find('tr').first())));
  const teamIds = main.find('[data-testid^="stats-"]').map((i, e) => $(e).attr('data-testid').replace('stats-', '')).get();
  const boxes = statTables.map((t, idx) => {
    const headers = $(t).find('tr').first().find('th,td').toArray().map(c => txt($, c));
    const players = []; let totals = null;
    $(t).find('tr').toArray().slice(1).forEach(r => {
      const cells = $(r).find('th,td').toArray().map(c => txt($, c));
      if (/^TOTAL$/i.test(cells[0])) { totals = {}; const vals = cells.slice(1); headers.slice(2).forEach((h, j) => { totals[h] = num(vals[j]) || 0; }); return; }
      const rec = { number: cells[0], name: cells[1] };
      headers.slice(2).forEach((h, j) => { rec[h] = num(cells[2 + j]) || 0; });
      players.push(rec);
    });
    return { teamId: teamIds[idx] || null, team: periods[idx] ? periods[idx].team : (teamLinks[idx] || ''), headers, players, totals };
  });
  let venue = '';
  const courtLink = main.find('a[href*="maps.google"]').first();
  if (courtLink.length) venue = txt($, courtLink);
  return {
    home: teamLinks[0] || (periods[0] ? periods[0].team : ''),
    away: teamLinks[1] || (periods[1] ? periods[1].team : ''),
    status: statusMatch ? statusMatch[1].toUpperCase() : '',
    result: resultLine.trim(),
    when: whenMatch ? whenMatch[1] : '',
    venue,
    periodHeaders, periods, boxes,
  };
}

// Grade statistics page: per-player totals for the grade (TP, 1PT, 2PT, 3PT, F)
export function parseStats(html) {
  const $ = cheerio.load(html);
  const table = $('[data-testid="grade-statistics-table-container"] table').first().length ? $('[data-testid="grade-statistics-table-container"] table').first() : $('table').first();
  if (!table.length) return [];
  const headers = table.find('tr').first().find('th,td').toArray().map(c => txt($, c));
  const iName = headers.findIndex(h => /player/i.test(h)), iTeam = headers.findIndex(h => /team/i.test(h));
  const rows = [];
  table.find('tr').toArray().slice(1).forEach(r => {
    const cells = $(r).find('th,td').toArray().map(c => txt($, c));
    if (cells.length < headers.length) return;
    const rec = { name: cells[iName], team: cells[iTeam] };
    headers.forEach((h, j) => { if (j !== iName && j !== iTeam && h) rec[h] = num(cells[j]) || 0; });
    rows.push(rec);
  });
  return rows;
}
