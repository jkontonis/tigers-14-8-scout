// Evidence-based scouting. Missing stats are not zeros and live games do not enter trends.
const known = x => typeof x === 'number' && Number.isFinite(x);
const avg = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const one = n => Number(n).toFixed(1);
const final = g => /^final$/i.test(g.status || '') && known(g.homeScore) && known(g.awayScore);
export function buildReports(data, config) {
  const names = [...new Set((data.fixture || []).flatMap(g=>[g.home,g.away]).filter(n=>n&&!/TBC/i.test(n)))];
  const reports = {};
  for (const name of names) {
    const games = data.fixture.filter(g=>final(g)&&(g.home===name||g.away===name));
    const notes = [], players = new Map(), splits=[], fouls=[], periods=[];
    const push = (k,t,coaching='',sample=games.length) => notes.push({k,t,coaching,sample});
    const record = {w:0,l:0,d:0,pf:0,pa:0}; let boxCount=0, attributed=0, boxPoints=0;
    for (const g of games) {
      const home=g.home===name, pf=home?g.homeScore:g.awayScore, pa=home?g.awayScore:g.homeScore;
      record.pf+=pf;record.pa+=pa;record[pf>pa?'w':pf<pa?'l':'d']++;
      const det=data.games?.[g.id], box=det?.boxes?.find(b=>b.team===name);
      if (box?.players?.length && box.players.every(p=>known(p.TP))) {
        boxCount++;boxPoints+=pf;
        for(const p of box.players){
          const key=p.id||[p.number||'',p.name||'Anonymous player'].join('|');
          const r=players.get(key)||{name:p.name||'Anonymous player',number:p.number||'',gp:0,tp:0,p3:0,p1:0,threeGames:0,ftGames:0,hi:0,foulGames:0,foulTrouble:[]};
          r.gp++;r.tp+=p.TP;r.hi=Math.max(r.hi,p.TP);attributed+=p.TP;
          if(known(p['3PT'])){r.p3+=p['3PT'];r.threeGames++;}if(known(p['1PT'])){r.p1+=p['1PT'];r.ftGames++;}
          if(known(p.F)){r.foulGames++;if(p.F>=4)r.foulTrouble.push({id:g.id,f:p.F});}players.set(key,r);
        }
        const total=box.totals;
        if(known(total?.F))fouls.push(total.F);
        if(total&&['1PT','2PT','3PT'].every(k=>known(total[k]))&&total['1PT']+2*total['2PT']+3*total['3PT']===pf)splits.push({p1:total['1PT'],p3:total['3PT'],points:pf});
      }
      const mine=det?.periods?.find(p=>p.team===name), other=det?.periods?.find(p=>p.team!==name);
      if(mine&&other){const a=mine.scores.slice(0,-1),b=other.scores.slice(0,-1);if([2,4].includes(a.length)&&b.length===a.length&&a.every(known)&&b.every(known)&&a.reduce((x,y)=>x+y,0)===pf&&b.reduce((x,y)=>x+y,0)===pa)periods.push({a,b});}
    }
    const ps=[...players.values()].sort((a,b)=>b.tp-a.tp), full=boxPoints>0&&attributed===boxPoints;
    const gp=games.length;
    if(!gp){push('info','No completed-game scouting data yet.','The report will build when this team has published results.',0);reports[name]={notes,players:[],games:0,boxGames:0};continue;}
    if(full&&ps[0]){
      const p=ps[0],share=p.tp/boxPoints;
      if(share>=.28)push('warn',`#${p.number} ${p.name} leads the scoring: ${one(p.tp/p.gp)} points per recorded game and ${Math.round(share*100)}% of team points in the available box scores.`,share>=.4?'Prioritise this matchup and identify the next scoring option. Scoring share alone does not establish how to defend the player.':'Identify this player early and prepare a help-defence plan.',boxCount);
      const top2=ps.slice(0,2).reduce((s,p)=>s+p.tp,0)/boxPoints;
      if(top2>=.6&&ps.length>=2)push('warn',`The leading two scorers account for ${Math.round(top2*100)}% of recorded team points.`,'Prepare for both scoring options rather than focusing on only the leading scorer.',boxCount);
      if(ps.slice(0,3).reduce((s,p)=>s+p.tp,0)/boxPoints<.5&&ps.filter(p=>p.tp>0).length>=6)push('info','Scoring is distributed: the top three contribute less than half of recorded team points.','Maintain team defensive discipline; one individual matchup is unlikely to cover every scoring option.',boxCount);
    }
    if(splits.length){const points=splits.reduce((s,p)=>s+p.points,0),threes=splits.reduce((s,p)=>s+p.p3,0),ft=avg(splits.map(p=>p.p1));
      if(points&&3*threes/points>=.25)push('warn',`${Math.round(300*threes/points)}% of points come from made threes (${one(threes/splits.length)} per game).`,'Identify the recorded three-point scorers and use controlled closeouts. Attempts and shooting percentage are not available.',splits.length);
      else if(points&&3*threes/points<=.08)push('info',`Only ${Math.round(300*threes/points)}% of points come from made threes.`,'This describes scoring output, not attempts or ability. Confirm their shooting threats on court before changing help positions.',splits.length);
      if(ft>=8)push('warn',`${one(ft)} made free throws per game in games with complete scoring splits.`,'Emphasise legal positioning and disciplined contests. Free-throw attempts are not available.',splits.length);
    }
    if(fouls.length&&avg(fouls)>=14)push('info',`${one(avg(fouls))} recorded team fouls per game.`,'Consider controlled drives and ball movement to test defensive discipline, while avoiding offensive fouls.',fouls.length);
    const troubled=ps.filter(p=>p.foulTrouble.length);
    if(troubled.length)push('info',`Recorded four-or-more-foul games: ${troubled.map(p=>`#${p.number} ${p.name} (${p.foulTrouble.length})`).join(', ')}.`,'Monitor the actual foul count during the matchup; this is history, not a prediction.',boxCount);
    const groups=[periods.filter(p=>p.a.length===4),periods.filter(p=>p.a.length===2)].sort((a,b)=>b.length-a.length), group=groups[0];
    if(group.length){const count=group[0].a.length,nets=Array.from({length:count},(_,i)=>avg(group.map(p=>p.a[i]-p.b[i]))),labels=count===4?['Q1','Q2','Q3','Q4']:['first half','second half'];
      const first=nets[0],last=nets.at(-1);
      if(Math.abs(first)>=3)push(first>0?'warn':'info',`${labels[0]} points differential averages ${first>0?'+':''}${one(first)}.`,'Prepare for the opening period, but treat a small sample as an early observation.',group.length);
      if(Math.abs(last)>=3)push(last>0?'warn':'info',`${labels.at(-1)} points differential averages ${last>0?'+':''}${one(last)}.`,'Maintain composure and execute late-game possessions. These results do not establish fatigue or guarantee the next finish.',group.length);
    }
    push('rec',`${record.w}-${record.l}${record.d?'-'+record.d:''}; ${one(record.pf/gp)} scored and ${one(record.pa/gp)} conceded per completed game.`,'Compare opponent strength and game context before interpreting the margin.',gp);
    if(boxCount<gp||!full)push('info',`Player-stat coverage: ${boxCount} of ${gp} completed games have usable box scores${boxCount&&!full?'; player totals do not reconcile with team points':''}.`,'Unavailable player statistics are not zero. Scoring-share conclusions are withheld when totals do not reconcile.',boxCount);
    reports[name]={notes,players:ps,games:gp,boxGames:boxCount,splitGames:splits.length,periodGames:periods.length,record};
  }
  return reports;
}
