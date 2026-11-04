/* Injected within the existing app closure by scripts/mobile-ui.mjs. */
const CLUBS = [
  {prefix:'Melbourne',key:'tigers',city:'Melbourne',nick:'Tigers',code:'MEL'},
  {prefix:'Southern Peninsula',key:'sharks',city:'Sth Peninsula',nick:'Sharks',code:'SP'},
  {prefix:'Camberwell',key:'camberwell',city:'Camberwell',nick:'Dragons',code:'CAM'},
  {prefix:'Darebin',key:'darebin',city:'Darebin',nick:'Phoenix',code:'DAR'},
  {prefix:'Pakenham',key:'pakenham',city:'Pakenham',nick:'Warriors',code:'PAK'}
];
function clubFor(name) {
  const club=CLUBS.find(c=>String(name||'').startsWith(c.prefix+' '));
  const number=String(name||'').match(/Boys\s+(\d+)\s*$/i)?.[1];
  return club ? {...club,squad:number?'U14 Boys '+number:/Future Sharks Blue/i.test(name)?'Future Sharks Blue':'U14 Boys',number} : {key:'unknown',city:/TBC/i.test(name)?'To be confirmed':String(name||'Team'),nick:'',code:'?',squad:'',number:null};
}
function clubBadge(name,size='') {
  const c=clubFor(name);
  return c.key==='unknown'?`<span class="club-badge unknown ${size}" aria-label="Team to be confirmed">?</span>`:`<span class="club-badge ${c.key} ${size}"><img src="/assets/teams/${c.key}.png" alt="${esc(c.city+' '+c.nick+' logo')}" width="96" height="96" decoding="async"><span class="logo-fallback" aria-hidden="true">${c.code}</span></span>`;
}
function uiIcon(name) {
  const paths={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',team:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6m2 11v-4a5 5 0 0 0-2-4"/>',scout:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/>',division:'<path d="M6 3h12v5a6 6 0 0 1-12 0zM8 21h8M12 14v7M6 5H3v3a4 4 0 0 0 4 4m11-7h3v3a4 4 0 0 1-4 4"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.arrow}</svg>`;
}
function heading(title,sub,eyebrow=CONFIG.gradeName||'U14 BOYS') { return `<div class="page-heading"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>`; }
function profileHeader(t) {const c=clubFor(t.name);return `<div class="profile-top">${clubBadge(t.name)}<div><div class="eyebrow">${esc(c.nick)} / ${esc(t.pool||'Division')}</div><h2 class="name">${esc(c.city)}</h2><div class="rec-line">${esc(c.squad)}${t.name===CONFIG.ourTeam?' · Tigers 14.8':''}${t.form?.length?' · '+esc(t.form.join(' ')):''}</div></div></div>`;}
function showOpponent(name) {oppSel=name;switchTab('opposition');}
function wireScouts(el) {el.querySelectorAll('[data-scout]').forEach(b=>b.addEventListener('click',()=>showOpponent(b.dataset.scout)));el.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.goto)));}
function fixtureLabel(g) {const at=parseWhen(g);return at?at.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'Australia/Melbourne'}):g.date||'Date TBC';}
function fxRow(g) {
  const done=hasScores(g),live=done&&!isFinal(g)&&isLive(g),us=[g.home,g.away].includes(CONFIG.ourTeam);
  const side=(name,score)=>{const c=clubFor(name);return `<div class="fixture-side">${clubBadge(name,'small')}<div class="name">${esc(c.city)}<span class="squad">${esc(c.number?'Boys '+c.number:c.squad)}</span></div><span class="points">${done?esc(score):''}</span></div>`;};
  return `<article class="fixture-card ${us?'us':''}"><div class="fixture-meta"><span class="fixture-date">${esc(fixtureLabel(g))} · ${esc(fmtTime(g)||'Time TBC')}</span>${live?'<span class="live-chip">LIVE</span>':`<span>${isFinal(g)?'Final':esc(g.pool==='Finals'?'Finals':g.pool||g.round)}</span>`}</div>${side(g.home,g.homeScore)}${side(g.away,g.awayScore)}${g.label?`<div class="note" style="margin-top:8px;font-size:11px">${esc(g.label)}</div>`:''}<div class="fixture-bottom">${uiIcon('pin')}<span>${esc(shortVenue(g.venue)||'Venue TBC')}</span></div></article>`;
}
function renderNow() {
  const our=A.our,ourFix=DATA.fixture.filter(g=>[g.home,g.away].includes(CONFIG.ourTeam));
  const live=ourFix.find(g=>hasScores(g)&&!isFinal(g)&&isLive(g));
  const upcoming=ourFix.filter(g=>!isFinal(g)&&!hasScores(g)&&!/cancel|abandon|postpon/i.test(g.status||'')).sort((a,b)=>(parseWhen(a)||0)-(parseWhen(b)||0));
  const next=live||upcoming[0];let hero='';
  if(next){const oppName=next.home===our.name?next.away:next.home,opp=A.teams[oppName];const team=(name,score)=>{const c=clubFor(name);return `<div class="match-club">${clubBadge(name,'large')}<strong>${esc(c.city)}</strong><small>${esc(c.squad)}</small>${hasScores(next)?`<span class="match-score">${esc(score)}</span>`:''}</div>`;};
    const usScore=next.home===our.name?next.homeScore:next.awayScore,themScore=next.home===our.name?next.awayScore:next.homeScore;
    const note=opp?.scout?.games?opp.notes.find(n=>n.k==='warn')||opp.notes[0]:null;
    hero=`<article class="match-hero"><div class="match-top"><span class="eyebrow">${live?'On court now':'Next up / Tigers 14.8'}</span>${live?'<span class="live-chip">LIVE</span>':`<span class="match-tag">${esc(next.round)}</span>`}</div><div class="matchup">${team(our.name,usScore)}<div class="match-versus">VS</div>${team(oppName,themScore)}</div><div class="match-details"><div class="match-time">${esc(fixtureLabel(next))} · ${esc(fmtTime(next))}</div><div class="match-venue">${esc(shortVenue(next.venue))}</div></div>${note?`<p class="match-brief"><b>The scout:</b> ${esc(note.t)}</p>`:''}<button class="scout-cta" data-scout="${esc(oppName)}">Opponent scouting report ${uiIcon('arrow')}</button></article>`;
  }
  const results=DATA.fixture.filter(g=>hasScores(g)).sort((a,b)=>(parseWhen(b)||0)-(parseWhen(a)||0));
  const nextGames=DATA.fixture.filter(g=>!hasScores(g)&&!/TBC/i.test(g.home+g.away)).sort((a,b)=>(parseWhen(a)||0)-(parseWhen(b)||0)).slice(0,4);
  const gameCount=DATA.fixture.filter(g=>isFinal(g)).length;
  $('#view-now').innerHTML=heading('Courtside',String(CONFIG.tournament||'').replace(/^New Balance /,''),'MELBOURNE TIGERS / 14.8')+hero+
   (our.gp?`<div class="stats">${stat(our.w+'-'+our.l,'Tigers record')}${stat(r1(our.ppg),'Points per game')}${stat(r1(our.papg),'Conceded per game')}${stat(sgn(r1(our.mpg)),'Points differential')}</div>`:'')+
   `<section><div class="sec-h"><h2>${results.length?'Latest results':'Around the division'}</h2><button class="section-link" data-goto="division">All games &rsaquo;</button></div>${results.length?results.slice(0,6).map(fxRow).join(''):nextGames.map(fxRow).join('')}</section>`+
   `<section><div class="preseason-note">${uiIcon('scout')}<div><strong>${gameCount?'Scouting, backed by the numbers':'Ready for the first tip-off'}</strong><p>${gameCount?'Team reports build from published results and available player statistics. Check the sample size before acting on a trend.':'Team reports build as PlayHQ publishes results. No made-up ratings or player assessments before a game is played.'}</p></div></div></section>`;
  wireScouts($('#view-now'));
}
function renderOpposition() {
  const el=$('#view-opposition');
  if(oppSel&&A.teams[oppSel]){legacyRenderOpposition();return;}
  const our=A.our;const ours=DATA.fixture.filter(g=>[g.home,g.away].includes(our.name));const next=ours.filter(g=>!isFinal(g)).sort((a,b)=>(parseWhen(a)||0)-(parseWhen(b)||0))[0];const nextName=next?(next.home===our.name?next.away:next.home):null;
  const list=Object.values(A.teams).filter(t=>t.name!==our.name&&!/TBC/i.test(t.name));
  const card=t=>{const c=clubFor(t.name);return `<button class="opponent-card ${t.name===nextName?'next':''}" data-scout="${esc(t.name)}" aria-label="Scout ${esc(t.name)}">${t.name===nextName?'<span class="next-badge">NEXT UP</span>':''}${clubBadge(t.name)}<span class="team-title">${esc(c.city)}</span><span class="team-squad">${esc(c.squad)}</span><span class="team-bottom">${t.gp?`<b>${t.w}-${t.l}</b> · ${r1(t.ppg)} PPG`:'Awaiting first result'}</span><span class="chevron" aria-hidden="true">&rsaquo;</span></button>`;};
  const same=list.filter(t=>t.pool===our.pool).sort((a,b)=>Number(b.name===nextName)-Number(a.name===nextName)||a.name.localeCompare(b.name));const other=list.filter(t=>t.pool!==our.pool).sort((a,b)=>a.name.localeCompare(b.name));
  el.innerHTML=heading('The opposition','Every opponent. One scouting report.')+`<h3 class="pool-label">Our pool / ${esc(our.pool||'Pool B')}</h3><div class="team-grid">${same.map(card).join('')}</div><h3 class="pool-label">Across the division</h3><div class="team-grid">${other.map(card).join('')}</div>`;wireScouts(el);
}
function setupMobileUI() {
  const nav=$('#tabs'),names={now:['home','Now'],tigers:['team','Tigers'],opposition:['scout','Opposition'],division:['division','Division']};
  nav.setAttribute('aria-label','Main navigation');nav.querySelectorAll('.tab').forEach(b=>{const [icon,label]=names[b.dataset.tab];b.innerHTML=uiIcon(icon)+`<span>${label}</span>`;b.setAttribute('aria-controls','view-'+b.dataset.tab);});
  document.body.appendChild(nav);
  const theme=$('#themeToggle');theme.innerHTML=uiIcon('sun');theme.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;theme.setAttribute('aria-label','Switch to '+(next==='dark'?'light':'dark')+' mode');try{localStorage.setItem('scout-theme',next)}catch{}});
  document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('.club-badge')){e.target.classList.add('failed');e.target.closest('.club-badge').setAttribute('title','Club logo could not load');}},true);
  nav.addEventListener('keydown',e=>{const tabs=[...nav.querySelectorAll('.tab')],i=tabs.indexOf(document.activeElement);if(i<0||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const n=tabs[(i+(e.key==='ArrowRight'?1:3))%4];n.click();n.focus();});
}
setupMobileUI();
