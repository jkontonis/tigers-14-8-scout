// Read public PlayHQ pages with the exact BrowserQL connection proven in the editor.
export async function readPlayHQ(url, { kind = 'fixture', token = process.env.BROWSERLESS_TOKEN, fetchImpl = fetch } = {}) {
  if (!token) throw new Error('BROWSERLESS_TOKEN is missing');
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'www.playhq.com' || u.username || u.password) throw new Error('Unexpected PlayHQ URL');
  const endpoint = new URL('https://production-sfo.browserless.io/stealth/bql');
  for (const [k,v] of Object.entries({token, proxy:'residential', proxyCountry:'au', blockConsentModals:'true', timeout:'55000'})) endpoint.searchParams.set(k,v);
  const selector = kind === 'fixture' ? '[data-testid="fixture-list"]' : kind === 'game' ? '[data-testid="scores"], [data-testid^="stats-"]' : 'main';
  let script = `for(let i=0;i<80;i++){const m=document.querySelector('main');if(m&&(m.querySelector('table')||/no (results|statistics|ladder|player)|not (available|published)|no data/i.test(m.innerText)))break;await new Promise(r=>setTimeout(r,150));}return document.querySelector('main')?.outerHTML||'';`;
  if (kind === 'fixture') script = `await new Promise(r=>setTimeout(r,600));const poolHtml=document.querySelector('main')?.outerHTML||'';let finalsHtml='';const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Finals');if(b){b.click();for(let n=0;n<60;n++){await new Promise(r=>setTimeout(r,150));const m=document.querySelector('main');if(m&&/semi.final|gold.medal|classification|grand.final/i.test(m.innerText)){finalsHtml=m.outerHTML;break;}}}return JSON.stringify({poolHtml,finalsHtml});`;
  if (kind === 'game') script = `for(let n=0;n<60;n++){if([...document.querySelectorAll('table')].some(t=>/Players/i.test(t.innerText)))break;await new Promise(r=>setTimeout(r,150));}for(const b of [...document.querySelectorAll('button')])if(b.innerText.trim()==='Show advanced stats')b.click();await new Promise(r=>setTimeout(r,900));return document.querySelector('main')?.outerHTML||'';`;
  const query = `mutation ScoutPage { viewport(width:1366,height:768){width} reject(type:[image,media,font]){enabled} goto(url:${JSON.stringify(url)},waitUntil:domContentLoaded){status} waitForSelector(selector:${JSON.stringify(selector)},timeout:30000){time} page:evaluate(content:${JSON.stringify(script)}){value} }`;
  let r, j;
  try {
    r = await fetchImpl(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query,operationName:'ScoutPage'}), signal:AbortSignal.timeout(65000) });
    j = await r.json();
  } catch { throw new Error('Browserless request failed or timed out'); }
  if (!r.ok || j.errors?.length || j.data?.goto?.status >= 400) throw new Error('Browserless page unavailable (HTTP ' + r.status + ')');
  const value = j.data?.page?.value;
  if (typeof value !== 'string' || !value.trim() || /Request blocked|ERROR: The request could not be satisfied/i.test(value)) throw new Error('Browserless returned an empty or blocked page');
  return kind === 'fixture' ? JSON.parse(value) : value;
}
export async function remainingUnits(token = process.env.BROWSERLESS_TOKEN, fetchImpl = fetch) {
  try {
    const r = await fetchImpl('https://api.browserless.io/v1/account/usage?token=' + encodeURIComponent(token), {signal:AbortSignal.timeout(8000)});
    if (!r.ok) return null;
    const j = await r.json();
    return Number.isFinite(j.units?.remaining) ? j.units.remaining : null;
  } catch { return null; }
}
