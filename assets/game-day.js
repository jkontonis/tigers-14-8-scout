// Team duty sheet supplied by John on 5 November 2026.
// Source: PHOTO-2026-11-04-17-50-21.jpg. This is team information, not PlayHQ data.
// The source pairs families; it does NOT specify which family performs which role.
export const DUTY_TEAM = 'Melbourne U14 Boys 8';
export const DUTY_SOURCE_NOTE = 'Family assignments are from the team duty sheet. Individual scorer and spotter roles were not specified.';
export const DUTY_TIME_NOTE = 'Sunday arrival: 10:40am is inferred from the listed 11:10am game; the sheet says 10:40pm. Please confirm with the team manager. The gold-game arrival is shown as 4:10pm; the sheet reads 4:10pmpm.';
export const FAMILY_DUTIES = Object.freeze([
  {key:'pool-1',round:'Round 1',gameId:'dc70ebf4',opponent:'Southern Peninsula U14 Boys Future Sharks Blue',families:['Jack','Kyrie'],kickoff:'2026-11-06T19:35:00+11:00',arrival:'2026-11-06T19:05:00+11:00',sourceArrival:'7:05pm',venue:'Somerville Recreation and Community Centre / Court 2'},
  {key:'pool-2',round:'Round 2',gameId:'ad5ef185',opponent:'Darebin U14 Boys 3',families:['Hamish','Tom'],kickoff:'2026-11-07T12:45:00+11:00',arrival:'2026-11-07T12:15:00+11:00',sourceArrival:'12:15pm',venue:'Bonbeach Basketball Stadium / Court 1'},
  {key:'pool-3',round:'Round 3',gameId:'5b9af400',opponent:'Camberwell U14 Boys 10',families:['Charlie','Otto'],kickoff:'2026-11-07T19:55:00+11:00',arrival:'2026-11-07T19:25:00+11:00',sourceArrival:'7:25pm',venue:'Patterson River Secondary College / Court 2'},
  {key:'final-1',round:'Finals Round 1',families:['Oliver','Mako'],kickoff:'2026-11-08T11:10:00+11:00',arrival:'2026-11-08T10:40:00+11:00',sourceArrival:'10:40pm',arrivalInferred:true,venue:'Springers Leisure Centre',provisional:true,sourceFixture:'Semi Final 1 (1st Pool A v 2nd Pool B), Court 1',note:'The sheet shows Semi Final 1. Our actual final, opponent and court depend on the pool result.'},
  {key:'gold',round:'Gold Medal Game',families:[],kickoff:'2026-11-08T16:40:00+11:00',arrival:'2026-11-08T16:10:00+11:00',sourceArrival:'4:10pmpm',venue:'Springers Leisure Centre / Court 1',conditional:true,note:'Only if Tigers qualify. Scorer and spotter families are to be confirmed.'}
].map(d=>Object.freeze({...d,families:Object.freeze(d.families)})));

export function dutyForGame(game,ourTeam=DUTY_TEAM){
  if(!game||ourTeam!==DUTY_TEAM||![game.home,game.away].includes(ourTeam))return null;
  const specific=FAMILY_DUTIES.find(d=>d.gameId&&d.gameId===game.id);
  if(specific)return specific;
  // The saved team-guide fixtures have different IDs; allow their exact round and opponent.
  const opponent=game.home===ourTeam?game.away:game.home;
  for(const d of FAMILY_DUTIES.filter(d=>d.gameId)){
    const n=d.key.slice(-1),sameRound=new RegExp('^(Round '+n+'|Pool game '+n+')$','i').test(game.round||'');
    const alias={'pool-1':'Southern Peninsula Future Sharks Blue','pool-2':'Darebin 3','pool-3':'Camberwell 10'}[d.key];
    if(sameRound&&[d.opponent,alias].includes(opponent))return d;
  }
  if(/^Finals Round 1$/i.test(game.round||''))return FAMILY_DUTIES.find(d=>d.key==='final-1');
  if(/gold medal/i.test(game.label||'')||/^Finals Round 2$/i.test(game.round||''))return FAMILY_DUTIES.find(d=>d.key==='gold');
  return null;
}
export function dutyRows(fixtures=[],ourTeam=DUTY_TEAM){
  return FAMILY_DUTIES.map(d=>({duty:d,game:fixtures.find(g=>dutyForGame(g,ourTeam)?.key===d.key)||null}));
}
export function familyLabel(duty){return duty?.families?.length?duty.families.map(n=>n+'\u2019s family').join(' + '):'Families to be confirmed';}
export function countdownLabel(game,start,now=Date.now()){
  if(/final|completed|cancel|abandon|postpon/i.test(game?.status||''))return '';
  if(/live|progress/i.test(game?.status||''))return 'Live on PlayHQ';
  const at=+new Date(start);if(!Number.isFinite(at))return '';
  const mins=Math.ceil((at-now)/60000);if(mins<=0)return 'Awaiting published result';
  if(mins>=1440)return 'Tip-off in '+Math.floor(mins/1440)+'d '+Math.floor(mins%1440/60)+'h';
  if(mins>=60)return 'Tip-off in '+Math.floor(mins/60)+'h '+mins%60+'m';
  return 'Tip-off in '+mins+'m';
}
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const benchIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3m8 2V3M4 10h16m-12 4h2m4 0h2m-8 3h2"/></svg>';
export function dutyStrip(duty,variant='compact'){
  if(!duty)return '';
  return `<div class="bench-duty ${variant}" data-duty="${safe(duty.key)}"><span class="bench-icon">${benchIcon}</span><div><span class="bench-label">Scorer &amp; spotter</span><strong>${safe(familyLabel(duty))}</strong>${variant==='home'?'<span class="bench-caption">Family duties for this game</span>':''}</div></div>`;
}
export function renderDutyBoard(fixtures,ourTeam,startOf){
  const t=d=>d.toLocaleTimeString('en-AU',{timeZone:'Australia/Melbourne',hour:'numeric',minute:'2-digit'}).replace(' ','').toLowerCase();
  const day=d=>d.toLocaleDateString('en-AU',{timeZone:'Australia/Melbourne',weekday:'short',day:'numeric',month:'short'});
  const rows=dutyRows(fixtures,ourTeam);
  return '<div class="duties-heading"><span class="eyebrow">THE TEAM BEHIND THE TEAM</span><h2>FAMILY DUTIES</h2><p>Scorer and spotter, game by game.</p></div><div class="duty-timeline">'+rows.map(({duty:d,game:g},i)=>{
    const liveStart=g?startOf(g):null,at=liveStart&&Number.isFinite(+liveStart)?liveStart:new Date(d.kickoff);
    const changed=+at!==+new Date(d.kickoff),arrival=changed?new Date(+at-30*60000):new Date(d.arrival);
    const opponent=g?(g.home===ourTeam?g.away:g.home):d.opponent;
    const title=d.key==='final-1'?'Sunday final':d.round;
    const status=d.conditional&&!g?'IF TIGERS QUALIFY':d.provisional&&!g?'FIXTURE TBC':g?'TEAM ALLOCATION':'TEAM SHEET';
    return `<article class="duty-card" data-duty-card="${safe(d.key)}"><div class="duty-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</div><div class="duty-content"><div class="duty-card-top"><span>${safe(day(at))}</span><span class="duty-state">${status}</span></div><h3>${safe(title)}</h3>${opponent?`<p class="duty-opponent">v ${safe(opponent)}</p>`:'<p class="duty-opponent">Opponent and our final to be confirmed</p>'}<div class="duty-times"><div><small>TIP-OFF</small><b>${safe(t(at))}</b></div><div><small>ARRIVE BY${d.arrivalInferred?' *':''}</small><b>${safe(t(arrival))}</b></div></div><div class="family-chips">${d.families.length?d.families.map(n=>`<span><i aria-hidden="true">${safe(n.charAt(0))}</i>${safe(n)}\u2019s family</span>`).join(''):'<span class="unassigned">Scorer &amp; spotter families TBC</span>'}</div><p class="duty-venue">${safe(g?.venue||d.venue)}${d.provisional&&!g?' · Court TBC':''}</p>${d.note&&(!g||d.conditional)?`<p class="duty-detail-note">${safe(d.note)}</p>`:''}${changed?'<p class="duty-detail-note">Arrival recalculated to 30 minutes before the updated fixture time.</p>':''}</div></article>`;
  }).join('')+'</div><div class="duty-source-note"><b>Team-sheet notes</b><p>'+safe(DUTY_SOURCE_NOTE)+'</p><p>'+safe(DUTY_TIME_NOTE)+'</p></div>';
}
