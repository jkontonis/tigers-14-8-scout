// Tells the phone which PlayHQ pages to fetch this run.
import { CONFIG, authorised } from '../lib/common.js';

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(403).json({ error: 'forbidden' }); return; }
  const grade = CONFIG.gradeUrl.replace(/\/$/, '');
  const urls = [
    { id: 'fixture', url: grade },
    { id: 'ladder', url: grade + '/ladder' },
    { id: 'stats', url: grade + '/statistics' },
  ];
  // Until storage holds a fixture page, include a known completed game so the first run shows what PlayHQ serves the phone
  let test = !!req.query.test;
  const { ready, listPaths } = await import('../lib/store.js');
  if (!test && ready()) {
    const r = await listPaths('pages/fixture');
    test = !r.length;
  } else if (!ready()) test = true;
  if (test) {
    urls.push({ id: 'finals', url: grade + '/F1' });
    // Control pages: one on this app, one ordinary public site, to separate PlayHQ's behaviour from the shortcut's
    const host = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    urls.push({ id: 'control-app', url: host + '/config.json' });
    urls.push({ id: 'control-web', url: 'https://www.basketballvictoria.com.au/' });
    // Known completed game with a published box score, used to check what PlayHQ serves the phone
    urls.push({ id: 'testgame', url: 'https://www.playhq.com/basketball-victoria/org/victorian-junior-basketball-league-vjbl/victorian-junior-basketball-league-2023/20-boys-vjl3/game-centre/c2fdfc4d' });
  }
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({ urls, count: urls.length });
}
