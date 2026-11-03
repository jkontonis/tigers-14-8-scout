// DOM parsers for PlayHQ public pages. These run inside the browser page
// (Playwright page.evaluate), so they must be self-contained and use only DOM APIs.
// Each function takes the page's `document` and returns plain JSON.

const PARSERS = {
  // Fixture page: /…/<grade-id>  (optionally with ?pool filter via the Pool buttons)
  fixture(document) {
    const lists = Array.from(document.querySelectorAll('[data-testid="fixture-list"]'));
    if (!lists.length) return { games: [], note: 'no fixture-list' };
    const games = [];
    let round = '';
    let pool = '';
    let date = '';
    const nodes = lists.flatMap(list => Array.from(list.querySelectorAll('h3,h4,[data-testid="games-on-date"],[role="listitem"]')));
    for (const node of nodes) {
      const tid = node.getAttribute('data-testid');
      if (node.tagName === 'H3') { round = node.textContent.trim(); pool = ''; }
      else if (node.tagName === 'H4') pool = node.textContent.trim();
      else if (tid === 'games-on-date') {
        const first = node.querySelector('span');
        date = first ? first.textContent.trim() : '';
      } else if (node.getAttribute('role') === 'listitem') {
        const btn = node.querySelector('[data-testid^="fixture-button-"]');
        const id = btn ? btn.getAttribute('data-testid').replace('fixture-button-', '') : '';
        const url = btn ? btn.getAttribute('href') : '';
        // Team names: the two team links (or plain text when a finals slot is still TBD)
        // Team names: links for real teams, plain spans for finals slots still "TBC Team"
        const teamEls = Array.from(node.querySelectorAll('a[href*="/teams/"], span[size="16"][to]'));
        let home = teamEls[0] ? teamEls[0].textContent.trim() : '';
        let away = teamEls[1] ? teamEls[1].textContent.trim() : '';
        const logos = Array.from(node.querySelectorAll('[data-testid$="-team-logo"]')).map(e => e.getAttribute('data-testid').replace(/-team-logo$/, ''));
        if (!home && logos[0]) home = logos[0];
        if (!away && logos[1]) away = logos[1];
        const scores = Array.from(node.querySelectorAll('span[size="28"]')).map(s => s.textContent.trim());
        const labelEl = node.querySelector('span[size="12"][color="white400"]');
        const label = labelEl ? labelEl.textContent.trim() : '';
        const statusEl = Array.from(node.querySelectorAll('span[size="12"]')).find(s => s !== labelEl);
        const status = statusEl ? statusEl.textContent.trim() : '';
        const courtLink = node.querySelector('[data-testid^="court-"]');
        const venue = courtLink ? courtLink.textContent.trim() : '';
        const timeMatch = node.textContent.match(/\d{1,2}:\d{2} [AP]M, \w{3}, \d{2} \w{3} \d{2}/);
        const time = timeMatch ? timeMatch[0] : '';
        const num = v => (v === '' || v === '-' ? null : Number(v));
        games.push({ id, url, round, pool, label, date, time, home, away, homeScore: num(scores[0] ?? ''), awayScore: num(scores[1] ?? ''), status, venue });
      }
    }
    return { games };
  },

  // Ladder page: /…/<grade-id>/ladder  (two side-by-side tables: rank/team and stats)
  ladder(document) {
    const tables = Array.from(document.querySelectorAll('table'));
    if (tables.length < 2) return { rows: [], note: 'ladder tables not found (' + tables.length + ')' };
    const rowsOf = t => Array.from(t.rows).slice(1).map(r => Array.from(r.cells).map(c => c.textContent.trim()));
    const left = rowsOf(tables[0]);
    const headers = Array.from(tables[1].rows[0].cells).map(c => c.textContent.trim());
    const right = rowsOf(tables[1]);
    const rows = [];
    // Pool headings sit above each table pair when the grade has pools; capture by walking headings
    for (let i = 0; i < left.length; i++) {
      const rec = { rank: Number(left[i][0]), team: left[i][1] };
      headers.forEach((h, j) => { const v = right[i] ? right[i][j] : ''; rec[h] = v === '' || v === undefined ? null : (isNaN(Number(v)) ? v : Number(v)); });
      rows.push(rec);
    }
    // Multi-pool ladders render several table pairs; collect them all
    const groups = [];
    for (let k = 0; k + 1 < tables.length; k += 2) {
      const l = rowsOf(tables[k]); const hs = Array.from(tables[k + 1].rows[0].cells).map(c => c.textContent.trim()); const r = rowsOf(tables[k + 1]);
      const g = [];
      for (let i = 0; i < l.length; i++) { const rec = { rank: Number(l[i][0]), team: l[i][1] }; hs.forEach((h, j) => { const v = r[i] ? r[i][j] : ''; rec[h] = v === '' || v === undefined ? null : (isNaN(Number(v)) ? v : Number(v)); }); g.push(rec); }
      // nearest preceding heading (pool name)
      let label = '';
      let el = tables[k];
      while (el && !label) { let p = el.previousElementSibling; while (p && !label) { const h = p.matches('h2,h3,h4') ? p : p.querySelector('h2,h3,h4'); if (h) label = h.textContent.trim(); p = p.previousElementSibling; } el = el.parentElement; }
      groups.push({ label, rows: g });
    }
    return { rows, groups };
  },

  // Game centre page: /…/game-centre/<id>  (after "Show advanced stats" has been clicked)
  game(document) {
    const main = document.querySelector('main') || document.body;
    const text = main.innerText;
    const header = main.querySelector('[data-testid="scores"]') || main;
    const teamLinks = Array.from(header.querySelectorAll('a[href*="/teams/"]')).map(a => a.textContent.trim());
    const statusMatch = text.match(/\n(FINAL|LIVE|UPCOMING|IN PROGRESS|PENDING|FORFEIT|ABANDONED|CANCELLED|POSTPONED|DRAW)\n/i);
    const resultLine = (text.match(/\n([^\n]+ won by \d+ Points?)\n/i) || [])[1] || (text.match(/\n(Drawn[^\n]*)\n/i) || [])[1] || '';
    const whenMatch = text.match(/(\d{1,2}:\d{2} [AP]M, \w+, \d{1,2} \w{3} \d{4})\n([^\n]+)/);
    const tables = Array.from(main.querySelectorAll('table'));
    const periodTable = tables.find(t => /BY PERIOD/i.test(t.rows[0] ? t.rows[0].textContent : ''));
    const periods = [];
    let periodHeaders = [];
    if (periodTable) {
      periodHeaders = Array.from(periodTable.rows[0].cells).map(c => c.textContent.trim()).filter(h => h && !/^by period$/i.test(h) && h !== 'T');
      Array.from(periodTable.rows).slice(1).forEach(r => {
        const cells = Array.from(r.cells).map(c => c.textContent.trim());
        periods.push({ team: cells[0], scores: cells.slice(1).filter(v => v !== '').map(v => (v === '-' ? null : Number(v))) });
      });
    }
    const statTables = tables.filter(t => /PLAYERS/i.test(t.rows[0] ? t.rows[0].textContent : ''));
    const teamIds = Array.from(main.querySelectorAll('[data-testid^="stats-"]')).map(e => e.getAttribute('data-testid').replace('stats-', ''));
    const boxes = statTables.map((t, idx) => {
      const headers = Array.from(t.rows[0].cells).map(c => c.textContent.trim());
      const players = [];
      let totals = null;
      Array.from(t.rows).slice(1).forEach(r => {
        const cells = Array.from(r.cells).map(c => c.textContent.trim());
        if (/^TOTAL$/i.test(cells[0])) {
          totals = {};
          // TOTAL row has one fewer leading cell (no number)
          const vals = cells.slice(1);
          headers.slice(2).forEach((h, j) => { totals[h] = vals[j] === '-' || vals[j] === undefined ? 0 : Number(vals[j]); });
          return;
        }
        const rec = { number: cells[0], name: cells[1] };
        headers.slice(2).forEach((h, j) => { const v = cells[2 + j]; rec[h] = v === '-' || v === undefined || v === '' ? 0 : Number(v); });
        players.push(rec);
      });
      return { teamId: teamIds[idx] || null, team: periods[idx] ? periods[idx].team : (teamLinks[idx] || ''), headers, players, totals };
    });
    // Big scores in the header
    const scoreSpans = Array.from(header.querySelectorAll('span')).filter(s => !s.children.length).map(s => s.textContent.trim()).filter(v => /^\d+$/.test(v));
    return {
      home: teamLinks[0] || (periods[0] ? periods[0].team : ''),
      away: teamLinks[1] || (periods[1] ? periods[1].team : ''),
      status: statusMatch ? statusMatch[1].toUpperCase() : '',
      result: resultLine,
      when: whenMatch ? whenMatch[1] : '',
      venue: whenMatch ? whenMatch[2].trim() : '',
      headerScores: scoreSpans.slice(0, 2).map(Number),
      periodHeaders,
      periods,
      boxes,
    };
  },

  // Play-by-play tab text, grouped by period (raw lines; interpreted later)
  playByPlay(document) {
    const main = document.querySelector('main') || document.body;
    const sections = Array.from(main.querySelectorAll('[data-testid^="period-"]'));
    return sections.map(s => ({ period: s.getAttribute('data-testid').replace('period-', ''), lines: s.innerText.split('\n').map(l => l.trim()).filter(Boolean) }));
  },
};

if (typeof module !== 'undefined') module.exports = PARSERS;
