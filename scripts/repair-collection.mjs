import fs from 'node:fs';
let s=fs.readFileSync('scraper/cloud.mjs','utf8');
const replace=(a,b)=>{if(!s.includes(a))throw Error('Missing collection anchor: '+a);s=s.replace(a,b);};
if(!s.includes('collection-audit-v1')){
 replace("import { AUDIENCE }", "import {coverage,periodQuality,isFinal,kickoff} from '../lib/quality.js'; // collection-audit-v1\nimport { AUDIENCE }");
 replace("scheduled=process.env.GITHUB_EVENT_NAME==='schedule'", "scheduled=process.env.GITHUB_EVENT_NAME==='schedule'||process.env.SCOUT_SCHEDULED==='1'");
 replace("const final=g=>/^final$/i.test(g.status||'');", "const final=isFinal;");
 replace("reads++;const page=await readPlayHQ(config.gradeUrl);", "reads++;let page;try{page=await readPlayHQ(config.gradeUrl);}catch{const left=await remainingUnits();if(left===null||left<70)throw Error('Insufficient allowance for fallback');reads++;page=await readPlayHQ(config.gradeUrl,{proxyMode:'full'});out.meta.reader.proxyFallback=true;}\n    console.log('Fixture audit '+JSON.stringify({proxyMode:page.proxyMode,...page.audit}));");
 replace("const all=new Map([...pool,...finals].map(g=>[g.id,g]));", "const all=new Map([...pool,...finals].map(g=>[g.id,g]));out.meta.fixtureAudit={checkedAt:now,observedIds:[...all.keys()],poolGames:pool.length,finalsGames:finals.length,rounds:[...new Set([...pool,...finals].map(g=>g.round))],retainedIds:[],proxyMode:page.proxyMode};");
 replace("all.set(g.id,g);out.meta.warnings.push", "all.set(g.id,g);out.meta.fixtureAudit.retainedIds.push(g.id);out.meta.warnings.push");
 replace("const complete=d.boxes?.length===2&&d.boxes.every(b=>b.players?.length);", "const complete=d.boxes?.length===2&&d.boxes.every(b=>b.players?.length)&&!periodQuality(d,g).suspect;");
 replace("const completed=out.fixture.filter(final).length;", "const completed=out.fixture.filter(final).length;const ladderBehind=(out.ladder||[]).flatMap(l=>l.rows||[]).some(r=>Number.isFinite(r.P)&&r.P<out.fixture.filter(g=>final(g)&&g.pool!=='Finals'&&(g.home===r.team||g.away===r.team)).length);");
 replace("elapsed(out.meta.pagesAt.ladder)>45*60000", "(elapsed(out.meta.pagesAt.ladder)>45*60000||ladderBehind)");
 replace("out.reports=buildReports(out,config);", "out.meta.coverage=coverage(out);out.meta.reader.lastTrigger=process.env.GITHUB_EVENT_NAME||'local';out.meta.reader.runId=process.env.GITHUB_RUN_ID||null;out.meta.reader.schedule='Bounded tournament hand-off; source collection targets 10 minutes during playing hours';out.reports=buildReports(out,config);");
 // Do not spend proxy credits overnight. Heartbeat dispatches continue until the fixed end.
 replace("if(!process.env.BROWSERLESS_TOKEN)", "if(scheduled){const hour=(new Date().getUTCHours()+11)%24;if(hour<7||hour>=23){console.log('Outside Melbourne playing hours; no Browserless request');process.exit(0);}}\nif(!process.env.BROWSERLESS_TOKEN)");
 fs.writeFileSync('scraper/cloud.mjs',s);
}
let report=fs.readFileSync('lib/scouting.js','utf8');if(!report.includes("from './quality.js'")){report="import {periodQuality} from './quality.js';\n"+report;report=report.replace('if(mine&&other){','if(mine&&other&&periodQuality(det,g).valid){');fs.writeFileSync('lib/scouting.js',report);}
