// Public pages only. Credentials stay in GitHub Actions secrets.
export async function captureFixture(){
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));const deadline=Date.now()+21000;
 const ids=()=>[...new Set([...document.querySelectorAll('[data-testid^="fixture-button-"]')].map(e=>e.getAttribute('data-testid').slice(15)))];
 const snapshots=[],finals=[],poolIds=new Set(),finalIds=new Set(),rounds=new Set();
 const controls=[...document.querySelectorAll('select,button,[role="combobox"]')].map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,120),options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,text:o.text})):undefined})).filter(x=>x.text||x.options);
 async function collect(target,set){let stable=0,last='';while(Date.now()<deadline&&stable<3){await sleep(200);const current=ids().sort().join(',');stable=current===last?stable+1:0;last=current;window.scrollTo(0,document.body.scrollHeight);}const main=document.querySelector('main');if(main){target.push(main.outerHTML);ids().forEach(id=>set.add(id));main.querySelectorAll('[data-testid="fixture-list"] h3').forEach(h=>rounds.add(h.textContent.trim()));}}
 const all=[...document.querySelectorAll('button')].find(b=>/^all rounds$/i.test(b.innerText.trim()));if(all){all.click();await sleep(450);}
 const select=[...document.querySelectorAll('select')].find(s=>[...s.options].filter(o=>/^round \d+/i.test(o.text)).length>1);
 if(select){const opts=[...select.options];const every=opts.find(o=>/all/i.test(o.text));for(const o of (every?[every]:opts.filter(o=>/^round \d+/i.test(o.text)))){if(Date.now()>=deadline)break;select.value=o.value;select.dispatchEvent(new Event('change',{bubbles:true}));await sleep(450);await collect(snapshots,poolIds);}}else await collect(snapshots,poolIds);
 const button=[...document.querySelectorAll('button')].find(b=>/^finals$/i.test(b.innerText.trim()));if(button){button.click();for(let i=0;i<50&&Date.now()<deadline;i++){await sleep(150);if(/semi.final|gold.medal|classification|grand.final/i.test(document.querySelector('main')?.innerText||'')){await collect(finals,finalIds);break;}}}
 return JSON.stringify({poolHtml:snapshots.join('\n'),finalsHtml:finals.join('\n'),audit:{poolIds:[...poolIds],finalIds:[...finalIds],rounds:[...rounds],controls}});
}
export async function readPlayHQ(url,{kind='fixture',token=process.env.BROWSERLESS_TOKEN,fetchImpl=fetch,proxyMode=process.env.BROWSERLESS_PROXY_MODE||'selective'}={}){
 if(!token)throw Error('BROWSERLESS_TOKEN is missing');const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='www.playhq.com'||u.username||u.password)throw Error('Unexpected PlayHQ URL');
 const endpoint=new URL('https://production-sfo.browserless.io/stealth/bql');endpoint.searchParams.set('token',token);endpoint.searchParams.set('blockConsentModals','true');endpoint.searchParams.set('timeout','59000');
 if(proxyMode==='full'){endpoint.searchParams.set('proxy','residential');endpoint.searchParams.set('proxyCountry','au');}
 const selector=kind==='fixture'?'[data-testid="fixture-list"]':kind==='game'?'[data-testid="scores"], [data-testid^="stats-"]':'main';
 let script=`for(let i=0;i<70;i++){const m=document.querySelector('main');if(m&&(m.querySelector('table')||/no (results|statistics|ladder|player)|not (available|published)|no data/i.test(m.innerText)))break;await new Promise(r=>setTimeout(r,120));}return document.querySelector('main')?.outerHTML||'';`;
 if(kind==='fixture')script='return await ('+captureFixture.toString()+')();';
 if(kind==='game')script=`for(let n=0;n<60;n++){if([...document.querySelectorAll('table')].some(t=>/Players/i.test(t.innerText)))break;await new Promise(r=>setTimeout(r,150));}for(const b of document.querySelectorAll('button'))if(b.innerText.trim()==='Show advanced stats')b.click();await new Promise(r=>setTimeout(r,700));return document.querySelector('main')?.outerHTML||'';`;
 const proxy=proxyMode==='full'?'':'proxy(country:AU,type:[document,xhr,fetch],sticky:true){time}';
 const query=`mutation ScoutPage {viewport(width:1366,height:768){width} ${proxy} reject(type:[image,media,font,stylesheet]){enabled} goto(url:${JSON.stringify(url)},waitUntil:domContentLoaded){status} waitForSelector(selector:${JSON.stringify(selector)},timeout:27000){time} page:evaluate(content:${JSON.stringify(script)}){value}}`;
 let r,j;try{r=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,operationName:'ScoutPage'}),signal:AbortSignal.timeout(65000)});j=await r.json();}catch{throw Error('Browserless request failed or timed out');}
 if(!r.ok||j.errors?.length||j.data?.goto?.status>=400)throw Error('Browserless page unavailable (HTTP '+r.status+')');
 const value=j.data?.page?.value;if(typeof value!=='string'||!value.trim()||/Request blocked|ERROR: The request could not be satisfied/i.test(value))throw Error('Browserless returned an empty or blocked page');
 return kind==='fixture'?{...JSON.parse(value),proxyMode}:value;
}
export async function remainingUnits(token=process.env.BROWSERLESS_TOKEN,fetchImpl=fetch){try{const r=await fetchImpl('https://api.browserless.io/v1/account/usage?token='+encodeURIComponent(token),{signal:AbortSignal.timeout(8000)});if(!r.ok)return null;const j=await r.json();return Number.isFinite(j.units?.remaining)?j.units.remaining:null;}catch{return null;}}
