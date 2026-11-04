import fs from 'node:fs/promises';
import { readPlayHQ, remainingUnits } from '../lib/browserless.js';
import { parseFixture, parseGame, parseLadder, parseStats } from '../lib/parse.js';
import { validateSnapshot } from '../lib/snapshot.js';
import { buildReports } from '../lib/scouting.js';
import { AUDIENCE } from '../lib/runner-auth.js';
const config=JSON.parse(await fs.readFile(new URL('../config.json',import.meta.url),'utf8'));
const started=Date.now(), now=new Date().toISOString(), scheduled=process.env.GITHUB_EVENT_NAME==='schedule';
const final=g=>/^final$/i.test(g.status||'');
const scored=g=>Number.isFinite(g.homeScore)&&Number.isFinite(g.awayScore);
const elapsed=s=>s?started-Date.parse(s):Infinity;
const readOnly=process.argv.includes('--read-only');
const headers={'x-key':config.passcode||''};
let previous=null;
try{const r=await fetch(AUDIENCE+'/api/data',{headers,signal:AbortSignal.timeout(15000)});if(r.ok){const d=await r.json();if(d.meta?.gradeUrl===config.gradeUrl)previous=d;}}catch{}
// These dates constrain this tournament's scheduled job, not manual development probes.
if(scheduled&&(now<'2026-11-06T07:30:00.000Z'||now>'2026-11-08T11:00:00.000Z')){console.log('Outside tournament collection window');process.exit(0);}
if(!process.env.BROWSERLESS_TOKEN)throw new Error('Add the BROWSERLESS_TOKEN repository Actions secret to enable collection.');
// Do not consume the free account without a verifiable remaining allowance.
const remaining=await remainingUnits();
if(remaining===null||remaining<40)throw new Error('Browserless allowance could not be verified or is below the 40-unit safety reserve. Previous data retained.');
const out=previous?structuredClone(previous):{fixture:[],ladder:[],gradeStats:[],games:{}};
out.meta={...(out.meta||{}),gradeUrl:config.gradeUrl,gradeName:config.gradeName,tournament:config.tournament,ourTeam:config.ourTeam,source:'browserless-au',warnings:[],lastAttemptAt:now,reader:{state:'running',schedule:'Five-minute checks during tournament hours; collection is quota-limited',unitsRemaining:remaining},pagesAt:{...(previous?.meta?.pagesAt||{})}};
let reads=0,updated=false;
const active=(out.fixture||[]).some(g=>scored(g)&&!final(g)&&/live|progress/i.test(g.status));
const refreshAfter=active?4*60000:9*60000;
try{
  if(!scheduled||elapsed(out.meta.pagesAt.fixture)>=refreshAfter){
    reads++;const page=await readPlayHQ(config.gradeUrl);
    const pool=parseFixture(page.poolHtml), finals=parseFixture(page.finalsHtml).map(g=>({...g,pool:'Finals'}));
    if(!pool.length||!pool.some(g=>g.home===config.ourTeam||g.away===config.ourTeam))throw new Error('Fixture content incomplete');
    const all=new Map([...pool,...finals].map(g=>[g.id,g]));
    for(const g of out.fixture)if(!all.has(g.id)){all.set(g.id,g);out.meta.warnings.push('Retained a previously known fixture absent from this read: '+g.id);}
    out.fixture=[...all.values()];out.meta.pagesAt.fixture=now;out.meta.scrapedAt=now;updated=true;
  }
  const knownIds=new Set(out.fixture.map(g=>g.id));out.games=Object.fromEntries(Object.entries(out.games||{}).filter(([id])=>knownIds.has(id)));
  const candidates=out.fixture.filter(g=>scored(g)&&(final(g)||/live|progress/i.test(g.status))&&!/TBC/i.test(g.home+g.away)).filter(g=>{
    const d=out.games[g.id],a=out.meta.pagesAt['attempt-'+g.id];
    if(elapsed(a)<18*60000)return false;
    if(!d)return true;
    const same=d.fixtureHomeScore===g.homeScore&&d.fixtureAwayScore===g.awayScore;
    const complete=d.boxes?.length===2&&d.boxes.every(b=>b.players?.length);
    return !same||!final(g)||!complete||elapsed(d.fetchedAt)>4*3600000;
  }).sort((a,b)=>Number(!out.games[b.id])-Number(!out.games[a.id]));
  for(const g of candidates){
    if(reads>=6||Date.now()-started>330000)break;
    const units=await remainingUnits();if(units===null||units<40){out.meta.warnings.push('Collection paused at free-account safety reserve');break;}
    out.meta.pagesAt['attempt-'+g.id]=now;
    try{
      reads++;const html=await readPlayHQ(g.url,{kind:'game'});
      const detail=parseGame(html);
      if(!detail.boxes?.length&&!detail.periods?.length)throw new Error('Game statistics not published');
      const teams=new Set([g.home,g.away]);
      if(detail.boxes.some(b=>!teams.has(b.team))||detail.periods.some(p=>!teams.has(p.team)))throw new Error('Game team mismatch');
      out.games[g.id]={...detail,id:g.id,url:g.url,home:g.home,away:g.away,status:final(g)?'FINAL':g.status,fetchedAt:now,fixtureHomeScore:g.homeScore,fixtureAwayScore:g.awayScore};updated=true;
    }catch{out.meta.warnings.push('Game details unavailable; previous data retained: '+g.id);}
  }
  const completed=out.fixture.filter(final).length;
  if(reads<6&&completed&&elapsed(out.meta.pagesAt.ladder)>45*60000){
    try{reads++;const html=await readPlayHQ(config.gradeUrl+'/ladder',{kind:'ladder'});const groups=parseLadder(html);if(groups.some(g=>g.rows?.length)){out.ladder=groups;out.meta.pagesAt.ladder=now;updated=true;}else out.meta.warnings.push('Official ladder not published yet');}catch{out.meta.warnings.push('Official ladder refresh unavailable');}
  }
  if(reads<6&&completed&&elapsed(out.meta.pagesAt.stats)>90*60000){
    try{reads++;const html=await readPlayHQ(config.gradeUrl+'/statistics',{kind:'stats'});const rows=parseStats(html);if(rows.length){out.gradeStats=rows;out.meta.pagesAt.stats=now;updated=true;}}catch{out.meta.warnings.push('Grade statistics refresh unavailable');}
  }
}catch{out.meta.warnings.push('Fixture refresh failed; previous verified fixture retained');}
if(!out.fixture.length)throw new Error('No valid fixture available; publication stopped');
out.meta.reader.state=out.meta.warnings.length?'partial':'ready';out.meta.reader.lastRunAt=now;
out.meta.reader.browserRequests=reads;out.meta.reader.unitsRemaining=await remainingUnits();
out.reports=buildReports(out,config);
validateSnapshot(out,config);
if(readOnly){await fs.writeFile('/tmp/scout-probe.json',JSON.stringify(out));console.log(JSON.stringify({readOnly:true,fixtures:out.fixture.length,reports:Object.keys(out.reports).length,gameDetails:Object.keys(out.games).length,warnings:out.meta.warnings,reads}));process.exit(0);}
const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL, requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!requestUrl||!requestToken)throw new Error('Publishing requires the authorised GitHub Actions identity');
const idUrl=new URL(requestUrl);idUrl.searchParams.set('audience',AUDIENCE);
const idResponse=await fetch(idUrl,{headers:{Authorization:'Bearer '+requestToken},signal:AbortSignal.timeout(15000)});
if(!idResponse.ok)throw new Error('GitHub identity unavailable');
const identity=(await idResponse.json()).value;if(!identity)throw new Error('GitHub identity missing');
console.log('::add-mask::'+identity);
const published=await fetch(AUDIENCE+'/api/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity},body:JSON.stringify(out),signal:AbortSignal.timeout(25000)});
if(!published.ok)throw new Error('Publish failed with HTTP '+published.status+'; last valid server snapshot retained');
const result=await published.json();console.log(JSON.stringify({...result,reads,warnings:out.meta.warnings,remainingUnits:out.meta.reader.unitsRemaining,updated}));
if(out.meta.warnings.length)console.log('::warning::Some data was unavailable. The app identifies partial/stale coverage.');
