// Read only the same public Discover and Spectator data exposed by PlayHQ's website.
// No login token, external API key, Browserless session or proxy is used.
import {known,isFinal,boxQuality,coverage} from './quality.js';
import {buildReports} from './scouting.js';
import {teamReport} from './coach-report.js';
export const DISCOVER='https://api.playhq.com/graphql';
export const SPECTATOR='https://spectator.playhq.com/graphql';
const PLAYER=`playerNumber player {__typename ... on DiscoverParticipant{id profile{firstName lastName}} ... on DiscoverParticipantFillInPlayer{id profile{firstName lastName}} ... on DiscoverGamePermitFillInPlayer{id profile{firstName lastName}} ... on DiscoverRegularFillInPlayer{id name} ... on DiscoverAnonymousParticipant{id name}} statistics{count type{value}}`;
export const GRADE_QUERY=`query ScoutGrade($id:ID!){discoverGrade(gradeID:$id){id name hideScores rounds{id name games{id alias pool{id name} home{... on DiscoverTeam{id name} ... on ProvisionalTeam{name}} away{... on DiscoverTeam{id name} ... on ProvisionalTeam{name}} status{name value} date allocation{time court{name venue{name}}} result{home{score} away{score}} publishLineup statistics{home{players{${PLAYER}} statistics{count type{value}}} away{players{${PLAYER}} statistics{count type{value}}}}}} ladder{pool{id name} standings{team{id name}}}}}`;
export const GAME_QUERY=`query ScoutGame($id:ID!,$scope:PeriodScore){game(id:$id){id status updatedAt statistics{home{statisticsV2{type{value} count} players{id playerNumber statistics{type{value} count}}} away{statisticsV2{type{value} count} players{id playerNumber statistics{type{value} count}}}} result{home{statistics{type{value} count} periods(scope:$scope){period{value} statistics{type{value} count} overtimeSequenceNo}} away{statistics{type{value} count} periods(scope:$scope){period{value} statistics{type{value} count} overtimeSequenceNo}}}}}`;
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const FIELDS={TP:'TOTAL_SCORE','1PT':'1_POINT_SCORE','2PT':'2_POINT_SCORE','3PT':'3_POINT_SCORE',F:'TOTAL_FOULS'};
export function statistic(rows,key){const value=rows?.find(r=>r?.type?.value===key)?.count;return known(value)&&value>=0?value:null;}
export function publicName(player){if(player?.__typename==='DiscoverAnonymousParticipant')return player.name||'Anonymous player';return player?.profile?[player.profile.firstName,player.profile.lastName].filter(Boolean).join(' ')||'Anonymous player':player?.name||'Anonymous player';}
export async function graphql(endpoint,query,variables,{fetchImpl=fetch}={}){
 if(![DISCOVER,SPECTATOR].includes(endpoint)||!/^query\b/.test(query))throw Error('Only approved public query endpoints are allowed');
 const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Tenant:'basketball-victoria','x-phq-tenant':'bv',Origin:'https://www.playhq.com'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Public PlayHQ request failed: HTTP '+response.status);
 const body=await response.json();if(body.errors?.length||!body.data)throw Error('Public PlayHQ query returned incomplete data');return body.data;
}
export function gradeId(config){const u=new URL(config.gradeUrl);if(u.protocol!=='https:'||u.hostname!=='www.playhq.com'||!u.pathname.startsWith('/basketball-victoria/'))throw Error('Unsupported competition source');const id=u.pathname.replace(/\/$/,'').split('/').at(-1);if(!/^[a-f0-9]{8}$/i.test(id))throw Error('Invalid grade ID');return id;}
export function fixtureFrom(g,round,config,hidden=false){
 if(!/^[a-f0-9]{8}$/i.test(g?.id||''))throw Error('Invalid public game ID');
 const iso=g.date?.slice(0,10),clock=g.allocation?.time;
 let date='',time='';if(/^\d{4}-\d{2}-\d{2}$/.test(iso||'')){
  const d=new Date(iso+'T12:00:00Z'),day=d.toLocaleDateString('en-AU',{weekday:'short',timeZone:'UTC'}),month=d.toLocaleDateString('en-AU',{month:'short',timeZone:'UTC'}),dd=iso.slice(8),yy=iso.slice(2,4);
  date=d.toLocaleDateString('en-AU',{weekday:'long',day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});
  if(/^\d{2}:\d{2}/.test(clock||'')){const h=Number(clock.slice(0,2));time=`${String(h%12||12).padStart(2,'0')}:${clock.slice(3,5)} ${h>=12?'PM':'AM'}, ${day}, ${dd} ${month} ${yy}`;}
 }
 const court=g.allocation?.court,venue=court?[court.venue?.name,court.name].filter(Boolean).join(' / '):'';
 return {id:g.id,url:config.gradeUrl.replace(/\/[a-f0-9]{8}\/?$/i,'')+'/game-centre/'+g.id,round:round.name,pool:/final/i.test(round.name)?'Finals':g.pool?.name||'',label:g.alias||'',date,time,home:g.home?.name||'TBC Team',away:g.away?.name||'TBC Team',homeId:g.home?.id||null,awayId:g.away?.id||null,homeScore:hidden?null:known(g.result?.home?.score)?g.result.home.score:null,awayScore:hidden?null:known(g.result?.away?.score)?g.result.away.score:null,status:g.status?.value||g.status?.name||'UPCOMING',venue,publishLineup:g.publishLineup===true};
}
export function detailFrom(raw,discovered,fixture,at=new Date().toISOString()){
 if(!raw||raw.id!==fixture.id)throw Error('Game identity mismatch');
 if(!fixture.publishLineup)return null;
 const boxes=[],periods=[],labels=[];
 for(const side of ['home','away']){
  const team=fixture[side],publicSide=discovered.statistics?.[side],liveSide=raw.statistics?.[side],expected=fixture[side+'Score'];
  const publicPlayers=publicSide?.players||[];
  const specTotal=statistic(raw.result?.[side]?.statistics,'TOTAL_SCORE');
  if(known(expected)&&known(specTotal)&&expected!==specTotal)throw Error('Source scores disagree');
  const players=publicPlayers.map(p=>{
   const id=p.player?.id;const match=(liveSide?.players||[]).find(s=>id&&s.id===id);
   const row={id:id||undefined,number:String(p.playerNumber??''),name:publicName(p.player)};
   for(const [key,value]of Object.entries(FIELDS)){const live=statistic(match?.statistics,value);row[key]=live??statistic(p.statistics,value);}
   return row;
  });
  const totals={};for(const[key,value]of Object.entries(FIELDS))totals[key]=statistic(liveSide?.statisticsV2,value)??statistic(publicSide?.statistics,value)??(players.length&&players.every(p=>known(p[key]))?sum(players.map(p=>p[key])):null);
  boxes.push({team,teamId:fixture[side+'Id'],headers:['#','Players','TP','1PT','2PT','3PT','F'],players,totals});
  const sourcePeriods=raw.result?.[side]?.periods||[];
  if(side==='home')for(const p of sourcePeriods)labels.push(({FIRST_HALF:'H1',SECOND_HALF:'H2',FIRST_QUARTER:'Q1',SECOND_QUARTER:'Q2',THIRD_QUARTER:'Q3',FOURTH_QUARTER:'Q4'})[p.period?.value]||p.period?.value||'Period');
  if(sourcePeriods.length)periods.push({team,scores:[...sourcePeriods.map(p=>statistic(p.statistics,'TOTAL_SCORE')),expected]});
 }
 const detail={id:fixture.id,url:fixture.url,home:fixture.home,away:fixture.away,status:fixture.status,periodHeaders:[...labels,'TOTAL'],periods,boxes,fetchedAt:at,sourceUpdatedAt:raw.updatedAt||null,source:'playhq-public-graphql',fixtureHomeScore:fixture.homeScore,fixtureAwayScore:fixture.awayScore};
 if(isFinal(fixture)&&![fixture.home,fixture.away].every(team=>boxQuality(detail,fixture,team).valid))throw Error('Player totals do not reconcile');
 return detail;
}
export function officialOrder(grade,data){
 return (grade.ladder||[]).map(group=>({label:group.pool?.name||'',source:'Official PlayHQ order; records calculated from current pool results',rows:(group.standings||[]).map((row,index)=>{const name=row.team?.name;const r=teamReport({...data,fixture:data.fixture.filter(g=>g.pool===(group.pool?.name||''))},name);return{rank:index+1,team:name,P:r.gp,W:r.record.w,L:r.record.l,D:r.record.d,F:r.record.pf,A:r.record.pa,'%':r.record.pa?r.record.pf/r.record.pa*100:null,PTS:null};}).filter(r=>r.team)}));
}
export async function collectPublic(previous,config,{request=graphql,clock=()=>new Date().toISOString()}={}){
 let requests=0;const get=async(endpoint,q,v)=>{requests++;return request(endpoint,q,v);};
 const id=gradeId(config),grade=(await get(DISCOVER,GRADE_QUERY,{id})).discoverGrade;
 if(!grade||grade.id!==id||!Array.isArray(grade.rounds)||!grade.rounds.length)throw Error('Grade source incomplete');
 const at=clock(),hidden=grade.hideScores===true;
 const rawGames=grade.rounds.flatMap(r=>(r.games||[]).map(g=>({raw:g,fixture:fixtureFrom(g,r,config,hidden)})));
 const fixture=rawGames.map(g=>g.fixture),ids=fixture.map(g=>g.id);
 if(!fixture.length||new Set(ids).size!==ids.length||!fixture.some(g=>[g.home,g.away].includes(config.ourTeam)))throw Error('Fixture source incomplete');
 const warnings=hidden?['PlayHQ has hidden this grade\'s scores. Previously collected scores and player statistics have been removed.']:[];
 const out={fixture,ladder:[],gradeStats:[],games:{},meta:{gradeUrl:config.gradeUrl,gradeName:grade.name,tournament:config.tournament,ourTeam:config.ourTeam,source:'playhq-public-graphql',warnings,pagesAt:{fixture:at,ladder:at},scrapedAt:at,lastAttemptAt:at,fixtureAudit:{checkedAt:at,observedIds:ids,poolGames:fixture.filter(g=>g.pool!=='Finals').length,finalsGames:fixture.filter(g=>g.pool==='Finals').length,rounds:grade.rounds.map(r=>r.name),retainedIds:[],removedIds:(previous?.fixture||[]).map(g=>g.id).filter(id=>!ids.includes(id)),provider:'playhq-public'}}};
 if(!hidden)for(const {raw,fixture:g}of rawGames){
  if(!g.publishLineup||/TBC|to be confirmed/i.test(g.home+' '+g.away)||!/^(FINAL|COMPLETED|COMPLETE|FINISHED|FULL TIME|LIVE|IN_PROGRESS|IN PROGRESS)$/i.test(g.status))continue;
  try{
   const value=(await get(SPECTATOR,GAME_QUERY,{id:g.id,scope:'BY_PERIOD'})).game;
   if(!isFinal(g)&&value){const h=statistic(value.result?.home?.statistics,'TOTAL_SCORE'),a=statistic(value.result?.away?.statistics,'TOTAL_SCORE');if(known(h)&&known(a)){g.homeScore=h;g.awayScore=a;g.status=value.status||g.status;}}
   const detail=detailFrom(value,raw,g,clock());if(detail){out.games[g.id]=detail;out.meta.pagesAt['game-'+g.id]=detail.fetchedAt;}
  }catch{warnings.push('Current player statistics unavailable or inconsistent: '+g.id);}
 }
 out.ladder=hidden?[]:officialOrder(grade,out);
 out.meta.ladderSource='PlayHQ published ordering; P/W/L/F/A calculated from collected pool results';
 const names=[...new Set(fixture.flatMap(g=>[g.home,g.away]).filter(n=>!/TBC|to be confirmed/i.test(n)))];
 for(const name of names)for(const p of teamReport(out,name).players)out.gradeStats.push({name:p.name,team:name,GP:p.gp,TP:p.tp,'1PT':p.p1,'2PT':p.p2,'3PT':p.p3,F:p.f});
 out.meta.gradeStatsSource='Aggregated reconciled game box scores';out.meta.pagesAt.stats=clock();out.meta.coverage=coverage(out);
 if(out.meta.coverage.missing.length&&!warnings.length)warnings.push('Some completed games do not have publicly available, reconciled player statistics.');
 out.meta.reader={provider:'playhq-public',state:warnings.length?'partial':'ready',browserlessRequired:false,unitsRemaining:null,browserRequests:0,apiRequests:requests,lastRunAt:clock(),lastSuccessAt:at,schedule:'Public PlayHQ checks approximately every five minutes during the tournament; no Browserless credits',lastTrigger:process.env.GITHUB_EVENT_NAME||'local',runId:process.env.GITHUB_RUN_ID||null};
 out.reports=buildReports(out,config);return out;
}
