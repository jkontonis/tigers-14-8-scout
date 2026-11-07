// Production collector using PlayHQ's unauthenticated public website queries.
// Publishing still requires the existing short-lived GitHub workflow identity.
import fs from 'node:fs/promises';
import {collectPublic} from '../lib/playhq-public.js';
import {validateSnapshot} from '../lib/snapshot.js';
import {AUDIENCE} from '../lib/runner-auth.js';
const config=JSON.parse(await fs.readFile(new URL('../config.json',import.meta.url),'utf8'));
const readOnly=process.argv.includes('--read-only');
const now=Date.now(),scheduled=process.env.GITHUB_EVENT_NAME!=='push'&&!!process.env.GITHUB_EVENT_NAME;
if(scheduled&&(now<Date.parse('2026-11-06T07:30:00Z')||now>=Date.parse('2026-11-08T11:00:00Z'))){console.log('Tournament collection window closed');process.exit(0);}
const localHour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',hour:'numeric',hourCycle:'h23'}).format(now));
if(scheduled&&localHour<7){console.log('Overnight pause; no PlayHQ requests');process.exit(0);}
let previous=null;
try{const r=await fetch(AUDIENCE+'/api/data',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok){const d=await r.json();if(d.meta?.gradeUrl===config.gradeUrl)previous=d;}}catch{}
let out,failed=false;
try{out=await collectPublic(previous,config);validateSnapshot(out,config);}catch(e){
 failed=true;console.error('Public collection failed; retaining source timestamps and verified data.');
 if(!previous)throw e;
 out=structuredClone(previous);const at=new Date().toISOString();out.meta.lastAttemptAt=at;out.meta.reader={...out.meta.reader,provider:'playhq-public',browserlessRequired:false,unitsRemaining:null,state:'reader_error',browserRequests:0,lastRunAt:at,lastAttemptAt:at,lastTrigger:process.env.GITHUB_EVENT_NAME||'local',runId:process.env.GITHUB_RUN_ID||null};out.meta.warnings=['Public PlayHQ refresh failed. Showing the last verified snapshot.'];
}
if(readOnly){await fs.writeFile('/tmp/scout-public-snapshot.json',JSON.stringify(out));console.log(JSON.stringify({readOnly:true,fixtures:out.fixture.length,coverage:out.meta.coverage,reader:out.meta.reader,warnings:out.meta.warnings}));if(failed)process.exitCode=1;}else{
 const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!requestUrl||!requestToken)throw Error('Authorised GitHub workflow identity required');
 const idUrl=new URL(requestUrl);idUrl.searchParams.set('audience',AUDIENCE);
 const auth=await fetch(idUrl,{headers:{Authorization:'Bearer '+requestToken},signal:AbortSignal.timeout(15000)});
 if(!auth.ok)throw Error('Workflow identity unavailable');const identity=(await auth.json()).value;if(!identity)throw Error('Workflow identity missing');
 console.log('::add-mask::'+identity);
 const r=await fetch(AUDIENCE+'/api/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity},body:JSON.stringify(out),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Publication rejected: HTTP '+r.status);
 console.log(JSON.stringify({...await r.json(),source:out.meta.source,sourceCheckedAt:out.meta.scrapedAt,coverage:out.meta.coverage,apiRequests:out.meta.reader.apiRequests,browserRequests:0,warnings:out.meta.warnings}));
 if(failed)process.exitCode=1;
}
