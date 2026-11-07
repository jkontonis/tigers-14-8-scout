// One explicitly requested end-of-day catch-up, not a reduction of the recurring reserve.
// Exactly one Browserless page session, no retries, no game/ladder/statistics requests.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {readPlayHQ,remainingUnits} from '../lib/browserless.js';
import {parseFixture} from '../lib/parse.js';
import {coverage,isFinal} from '../lib/quality.js';
import {validateSnapshot} from '../lib/snapshot.js';
import {AUDIENCE} from '../lib/runner-auth.js';
export const REQUEST_ID='day2-close-2026-11-07';
export const EXPIRES=Date.parse('2026-11-07T13:00:00Z');
export function mergeCatchup(previous,incoming,{checkedAt,remaining,runId=null,proxyMode='full'}={}){
 if(!previous?.meta||!Array.isArray(previous.fixture)||!incoming.length)throw Error('Verified fixture required');
 const old=new Map(previous.fixture.map(g=>[g.id,g]));
 const current=new Map(incoming.map(g=>[g.id,g]));
 if(current.size!==incoming.length||[...old.keys()].some(id=>!current.has(id)))throw Error('Catch-up must observe every known fixture');
 if(incoming.some(g=>!old.has(g.id)))throw Error('Unexpected fixture ID requires review');
 for(const g of incoming){const was=old.get(g.id);if(isFinal(was)&&!isFinal(g))throw Error('A final result regressed');if(isFinal(was)&&(was.home!==g.home||was.away!==g.away))throw Error('Completed game team mismatch');}
 const out=structuredClone(previous);
 out.fixture=incoming.map(g=>({...g,sourceCheckedAt:checkedAt}));
 // A changed score must not use a previous game's box score as current evidence.
 out.games=Object.fromEntries(Object.entries(out.games||{}).filter(([id,d])=>{const g=current.get(id);return g&&d.home===g.home&&d.away===g.away&&d.fixtureHomeScore===g.homeScore&&d.fixtureAwayScore===g.awayScore;}));
 out.meta={...out.meta,source:'browserless-au',scrapedAt:checkedAt,lastAttemptAt:checkedAt,pagesAt:{...out.meta.pagesAt,fixture:checkedAt},warnings:['Fixture-only catch-up: scores and fixtures refreshed. Player box scores, official ladders and grade statistics were not re-fetched.'],reader:{...out.meta.reader,state:remaining===null?'quota_unverified':remaining<40?'quota_paused':'partial',unitsRemaining:remaining,lastRunAt:checkedAt,lastAttemptAt:checkedAt,lastSuccessAt:checkedAt,browserRequests:1,lastTrigger:'push',runId},fixtureAudit:{checkedAt,observedIds:[...current.keys()],poolGames:incoming.filter(g=>g.pool!=='Finals').length,finalsGames:incoming.filter(g=>g.pool==='Finals').length,rounds:[...new Set(incoming.map(g=>g.round))],retainedIds:[],proxyMode},fixtureCatchup:{requestId:REQUEST_ID,checkedAt,scope:'fixture-and-scores-only',automaticCollectionRestored:false}};
 out.meta.coverage=coverage(out,Date.parse(checkedAt));
 return out;
}
export async function runCatchup({fetchImpl=fetch,read=readPlayHQ,units=remainingUnits,now=()=>Date.now()}={}){
 if(process.env.SCOUT_FIXTURE_CATCHUP!=='1'||process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_REPOSITORY!=='jkontonis/tigers-14-8-scout')throw Error('This one-off request is not authorised');
 if(Number(process.env.GITHUB_RUN_ATTEMPT||'1')!==1||now()>=EXPIRES||now()<Date.parse('2026-11-07T11:30:00Z'))throw Error('One-off catch-up expired or already attempted');
 const config=JSON.parse(await fs.readFile(new URL('../config.json',import.meta.url),'utf8'));
 const r=await fetchImpl(AUDIENCE+'/api/data',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Previous snapshot unavailable');
 const previous=validateSnapshot(await r.json(),config);
 if(previous.meta.fixtureCatchup?.requestId===REQUEST_ID){console.log('One-off catch-up already published; no browser request');return;}
 const before=await units();if(before===null||before<25)throw Error('At least 25 verified units are required for this single page session');
 // Verify publishing access before consuming any browser units.
 const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;if(!requestUrl||!requestToken)throw Error('Trusted workflow identity unavailable');
 const idUrl=new URL(requestUrl);idUrl.searchParams.set('audience',AUDIENCE);
 const idr=await fetchImpl(idUrl,{headers:{Authorization:'Bearer '+requestToken},signal:AbortSignal.timeout(15000)});if(!idr.ok)throw Error('Workflow identity request failed');
 const identity=(await idr.json()).value;if(!identity)throw Error('Missing workflow identity');console.log('::add-mask::'+identity);
 const page=await read(config.gradeUrl,{proxyMode:'full'});
 const pool=parseFixture(page.poolHtml),finals=parseFixture(page.finalsHtml).map(g=>({...g,pool:'Finals'}));
 const incoming=[...new Map([...pool,...finals].map(g=>[g.id,g])).values()];
 if(pool.length!==12||finals.length!==5)throw Error('Unexpected tournament fixture coverage');
 const after=await units(),checkedAt=new Date(now()).toISOString();
 const out=mergeCatchup(previous,incoming,{checkedAt,remaining:after,runId:process.env.GITHUB_RUN_ID,proxyMode:page.proxyMode});validateSnapshot(out,config);
 const published=await fetchImpl(AUDIENCE+'/api/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity},body:JSON.stringify(out),signal:AbortSignal.timeout(25000)});
 if(!published.ok)throw Error('Catch-up publication rejected: HTTP '+published.status);
 const result=await published.json();
 console.log(JSON.stringify({...result,requestId:REQUEST_ID,checkedAt,scope:'fixture-and-scores-only',unitsBefore:before,unitsAfter:after,coverage:out.meta.coverage,results:out.fixture.filter(isFinal).map(g=>({id:g.id,home:g.home,away:g.away,homeScore:g.homeScore,awayScore:g.awayScore})),sunday:out.fixture.filter(g=>g.pool==='Finals').map(g=>({label:g.label,time:g.time,home:g.home,away:g.away,venue:g.venue}))}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){try{await runCatchup();}catch(e){console.error('::error::'+e.message);process.exitCode=1;}}
