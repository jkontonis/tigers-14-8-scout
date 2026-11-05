// Small, reversible production-build adapter for the unified tournament interface.
// This never writes competition data or changes the reader, its schedule or credentials.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const MARK='game-day-polish-v1';
function change(source,from,to){if(!source.includes(from))throw new Error('Game-day integration anchor missing: '+from.slice(0,90));return source.replace(from,to);}
export function enhanceScript(original){
  if(original.includes(MARK))return original;
  let s="import {dutyForGame,dutyStrip,renderDutyBoard,countdownLabel} from './game-day.js'; // "+MARK+'\n'+original;
  s=change(s,'${side(g.home,g.homeScore)}${side(g.away,g.awayScore)}','${side(g.home,g.homeScore)}${side(g.away,g.awayScore)}${dutyStrip(dutyForGame(g,config.ourTeam))}');
  s=change(s,'<div class="matchup">${team(config.ourTeam,a)}',"${next?countdownMarkup(g):''}<div class=\"matchup\">${team(config.ourTeam,a)}");
  s=change(s,'<div class="match-actions"><a href="#games">Game-day details',"${dutyStrip(dutyForGame(g,config.ourTeam),'home')}<div class=\"match-actions\"><a href=\"#games\">Game-day details");
  s=change(s,'function renderGames(){let rows=fixtures();',"function renderGames(){document.querySelectorAll('[data-game-filter]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gameFilter===gameFilter));if(gameFilter==='duties'){$('#games-list').innerHTML=renderDutyBoard(fixtures(),config.ourTeam,when);return;}let rows=fixtures();");
  s=change(s,"gameFilter=['ours','division','finals'].includes(detail)","gameFilter=['ours','division','finals','duties'].includes(detail)");
  s+='\nfunction countdownMarkup(g){const at=when(g);if(!at||!Number.isFinite(+at))return "";const label=countdownLabel(g,at);return label?`<div class="game-countdown" data-at="${at.toISOString()}" data-state="${esc(g.status||"")}">${esc(label)}</div>`:"";}\n';
  s+='function updateGameCountdown(){const el=document.querySelector("#home-game .game-countdown");if(el)el.textContent=countdownLabel({status:el.dataset.state},el.dataset.at);}\nsetInterval(()=>{if(!document.hidden)updateGameCountdown();},60000);\n';
  return s;
}
export function enhanceHTML(original){
  if(original.includes('<!-- '+MARK+' -->'))return original;
  let s=change(original,'</head>','<link rel="stylesheet" href="/assets/game-day.css?v=1"><!-- '+MARK+' --></head>');
  s=change(s,'<button data-game-filter="finals" aria-pressed="false">Finals</button>','<button data-game-filter="finals" aria-pressed="false">Finals</button><button data-game-filter="duties" aria-pressed="false" aria-label="Family duties">Duties</button>');
  s=change(s,'<div id="home-tools"></div>','<a class="home-duty-link" href="#games/duties"><div>Family duties <span> · Who is scoring and spotting?</span></div><b aria-hidden="true">›</b></a><div id="home-tools"></div>');
  s=change(s,'Tip-off, arrival, venue and preparation, together.','Tip-off, arrival, family duties and preparation, together.');
  return s.replace('/assets/tournament.js?v=1','/assets/tournament.js?v=2');
}
export function applyGameDayUI(){
  const js=enhanceScript(fs.readFileSync('assets/tournament.js','utf8'));
  const html=enhanceHTML(fs.readFileSync('index.html','utf8'));
  // Validate both transformations before writing either file.
  fs.writeFileSync('assets/tournament.js',js);
  fs.writeFileSync('index.html',html);
  console.log('Game-day polish ready: family pairs, provisional finals and local countdown');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))applyGameDayUI();
