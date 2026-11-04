export function validateSnapshot(data, config) {
  if(!data||data.meta?.gradeUrl!==config.gradeUrl||data.meta?.ourTeam!==config.ourTeam)throw new Error('Wrong competition');
  if(!Array.isArray(data.fixture)||!data.fixture.length||data.fixture.length>5000||!data.fixture.some(g=>g.home===config.ourTeam||g.away===config.ourTeam))throw new Error('Invalid or empty fixture');
  const ids=new Set();
  for(const g of data.fixture){if(!/^[a-f0-9]{8}$/i.test(g.id)||ids.has(g.id)||typeof g.home!=='string'||typeof g.away!=='string')throw new Error('Invalid game identity');ids.add(g.id);const u=new URL(g.url);if(u.protocol!=='https:'||u.hostname!=='www.playhq.com'||!u.pathname.endsWith('/game-centre/'+g.id))throw new Error('Invalid source URL');for(const k of ['homeScore','awayScore'])if(g[k]!==null&&g[k]!==undefined&&(!Number.isInteger(g[k])||g[k]<0||g[k]>500))throw new Error('Invalid score');}
  if(!data.games||Array.isArray(data.games)||typeof data.games!=='object'||!Array.isArray(data.ladder)||!Array.isArray(data.gradeStats))throw new Error('Invalid dataset');
  for(const id of Object.keys(data.games))if(!ids.has(id))throw new Error('Unrelated game in snapshot');
  const stamp=Date.parse(data.meta.scrapedAt);if(!Number.isFinite(stamp)||stamp>Date.now()+60000)throw new Error('Invalid collection time');
  return data;
}
