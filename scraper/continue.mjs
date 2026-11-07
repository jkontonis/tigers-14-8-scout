// Bounded tournament checks using the job's scoped GitHub token only.
import {setTimeout as sleep} from 'node:timers/promises';
const START=Date.parse('2026-11-06T07:30:00Z'),STOP=Date.parse('2026-11-08T11:00:00Z');
if(Date.now()<START||Date.now()>=STOP){console.log('Tournament hand-off closed');process.exit(0);}
if(process.env.GITHUB_REPOSITORY!=='jkontonis/tigers-14-8-scout'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Wrong workflow scope');
if(!process.env.GH_TOKEN)throw Error('Workflow dispatch permission unavailable');
const hour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',hour:'numeric',hourCycle:'h23'}).format());
const delay=hour<7?20*60000:process.env.GITHUB_EVENT_NAME==='push'?60000:5*60000;
console.log('Next tournament check in '+delay/60000+' minutes; public reader uses no Browserless credits. Stops at 2026-11-08T11:00:00Z.');
await sleep(Math.min(delay,STOP-Date.now()));if(Date.now()>=STOP)process.exit(0);
const endpoint='https://api.github.com/repos/jkontonis/tigers-14-8-scout/actions/workflows/scrape.yml/dispatches';
for(let n=0;n<3;n++){const r=await fetch(endpoint,{method:'POST',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:'main'}),signal:AbortSignal.timeout(15000)});if(r.status===204){console.log('Successor dispatched on main');process.exit(0);}if(n===2)throw Error('Successor dispatch failed: HTTP '+r.status);await sleep(5000);}
