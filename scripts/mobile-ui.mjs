import fs from 'node:fs';
export function applyMobileUI(){
 let s=fs.readFileSync('scout/index.html','utf8');if(s.includes('iphone-courtside-v1'))return;
 const replace=(a,b)=>{if(!s.includes(a))throw new Error('Mobile UI anchor missing: '+a.slice(0,70));s=s.replace(a,b);};
 replace('</head>',`<link rel="stylesheet" href="/assets/mobile.css?v=1"><script>try{document.documentElement.dataset.theme=localStorage.getItem('scout-theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}</script>\n</head>`);
 replace('<img src="/img/logo.png" alt="Melbourne Tigers">','<span class="brand-mark"><img src="/assets/teams/tigers.png" alt="Melbourne Tigers"></span>');
 replace('<h1>14.8 Scout</h1>','<h1>14.8 SCOUT</h1>');
 replace('<div class="sub" id="subtitle">Loading tournament</div>','<div class="sub" id="subtitle">Melbourne Tigers</div>');
 replace('<div class="status" id="updated"><b>Connecting</b></div>','<div class="status" id="updated"><b>Connecting</b></div><button id="themeToggle" class="theme-toggle" type="button" aria-label="Switch colour mode"></button>');
 replace('function renderNow() {','function legacyRenderNow() {');
 replace('function fxRow(g) {','function legacyFxRow(g) {');
 replace('function renderOpposition() {','function legacyRenderOpposition() {');
 replace('/* ---------- Boot ---------- */',fs.readFileSync('assets/mobile-ui.js','utf8')+'\n/* iphone-courtside-v1 */\n/* ---------- Boot ---------- */');
 replace('<h2 class="name">${esc(CONFIG.ourShortName || t.name)}</h2><div class="rec-line">${esc(t.name)}${t.pool ? \' · \' + esc(t.pool) : \'\'}${t.form.length ? \' · \' + t.form.join(\' \') : \'\'}</div>','${profileHeader(t)}');
 replace('<h2 class="name">${esc(shortName(t.name))}</h2><div class="rec-line">${esc(t.name)}${t.pool ? \' · \' + esc(t.pool) : \'\'}${t.name === nextOpp ? \' · <b>next opponent</b>\' : \'\'}${t.form.length ? \' · \' + t.form.join(\' \') : \'\'}</div>','${profileHeader(t)}');
 replace('<td class="t">${esc(shortName(r.team))}</td>','<td class="t"><span class="club-name">${clubBadge(r.team,\'mini\')}<span>${esc(shortName(r.team))}</span></span></td>');
 replace("$('#subtitle').textContent = `${DATA.meta.gradeName || CONFIG.gradeName || ''} · ${CONFIG.tournament ? CONFIG.tournament.replace(/^New Balance /, '') : ''}`;","$('#subtitle').textContent = 'Melbourne Tigers';");
 fs.writeFileSync('scout/index.html',s);
}
applyMobileUI();
