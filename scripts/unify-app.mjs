// Build one tournament application from the existing coaching content and scouting engine.
// The original play definitions, drawings, quiz and report calculations remain the source of truth.
import fs from 'node:fs';
import * as cheerio from 'cheerio';
const read = p => fs.readFileSync(p, 'utf8');
const write = (p,s) => fs.writeFileSync(p,s);
const replace = (s,a,b) => { if (!s.includes(a)) throw new Error('Integration anchor missing: '+a.slice(0,90)); return s.replace(a,b); };
const scoped = css => css.replace(/:root:not\(([^)]+)\)/g, ':host(:not($1))').replace(/:root(\[[^\]]+\])/g, ':host($1)').replaceAll(':root', ':host').replace(/\bbody\b/g, '.component-body').replace(/\bhtml\b/g, ':host');
const shared = `:host,:host([data-theme="dark"]),:host([data-theme="light"]){display:block;padding:0;color:var(--app-fg);--bg:var(--app-bg);--surface:var(--app-surface);--fg:var(--app-fg);--muted:var(--app-muted);--line:var(--app-line);--soft:var(--app-soft);--gold:#ffcb08;--red:#ec1f28;--display:"Barlow Condensed","Arial Narrow",Impact,sans-serif;--body:"Barlow",Arial,sans-serif;} :host([hidden]){display:none!important}.component-body{padding:0;background:transparent}.component-body::before{display:none}main{max-width:none;padding:0;margin:0}button,a,input,select{touch-action:manipulation}button{min-height:44px}.foot:last-child{display:none}`;
fs.mkdirSync('assets/generated',{recursive:true});
const teamSource=read('content/team-source.html');
let teamContent='// Preserved verbatim from the owner\'s tournament draft.\n';
for (const name of ['ROSTER','COACHES','MIND','GAMES','FINALS']) {
 const match=teamSource.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n\\]);'));
 if(!match)throw new Error('Missing team content: '+name);
 teamContent+='export const '+name+' = '+match[1]+';\n';
}
write('assets/generated/team-content.js',teamContent);

const playSource=read('playbook/index.html'), p=cheerio.load(playSource);
const playCss=p('style').toArray().map(e=>p(e).html()).join('\n');
let playJs=p('script').toArray().map(e=>p(e).html()).find(s=>s.includes('const PLAYS ='));
if(!playJs)throw new Error('Playbook source missing');
const entries=[...playJs.matchAll(/id: "([^"]+)", name: "([^"]+)"[^\n]*\n(?:actors:[^\n]*\n)?when: "([^"]+)"/g)].map(m=>({id:m[1],name:m[2],when:m[3]}));
if(entries.length!==6)throw new Error('Expected the six existing plays; found '+entries.length);
p('script,style,link,.logo-strip,header.band').remove();
const playHtml=p('body').html().replace(/src="img\//g,'src="/playbook/img/');
playJs=replace(playJs,'const $ = id => document.getElementById(id);','const $ = id => root.getElementById(id);');
playJs=playJs.replaceAll('"img/','"/playbook/img/');
playJs=replace(playJs,'b.onclick = () => selectPlay(p);','b.onclick = () => api.openPlay(p.id);');
playJs=replace(playJs,'function setFs(on) { fs = on;','function setFs(on) { api.fullscreen(on); fs = on;');
const playOverrides=`.tabs{background:transparent;border:0;margin:0 0 16px}.tabs-inner{padding:0;flex-wrap:nowrap;overflow-x:auto;gap:6px;scrollbar-width:none}.tab{background:var(--soft);border:1px solid var(--line);border-radius:9px;font:600 13px var(--body);text-transform:none;letter-spacing:0;padding:10px 14px}.tab[aria-selected="true"]{background:var(--gold);border-color:var(--gold);color:#050708}.playhead{display:block}.playhead h2{font-size:32px;margin-bottom:6px}.playhead p{font-size:14px;line-height:1.5}.card,.courtwrap{border-radius:16px}.courtwrap{position:relative!important;top:auto!important;z-index:auto!important}.work{grid-template-columns:minmax(0,1fr);gap:16px}.court{max-height:440px}.stage.fs{z-index:300}.stage.fs svg.court{max-height:none}.fsbar{flex-wrap:wrap}.fsbar button{padding:8px 10px;font-size:14px}.chip{min-height:44px;font-size:12px}.tog{min-height:36px}.posrow .lbl::after{content:" (position, not jersey number)";font-weight:400;text-transform:none}.btn{min-width:0}.terms{grid-template-columns:1fr}.panel{min-width:0}.transport{min-width:0;gap:6px}.scrub{min-width:25px}.spd{max-width:82px}.foot{line-height:1.5}@media(min-width:900px){.work{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}}`;
write('assets/generated/playbook-view.js',`export const PLAY_INDEX=${JSON.stringify(entries)};\nexport function mountPlaybook(host,api){const root=host.attachShadow({mode:'open'});root.innerHTML=${JSON.stringify('<style>'+scoped(playCss)+'\n'+shared+'\n'+playOverrides+'</style><div class="component-body">'+playHtml+'</div>')};\n${playJs}\nreturn {open(id){const next=PLAYS.find(p=>p.id===id);if(next&&next!==play)selectPlay(next);},pause(){stopRun();if('speechSynthesis' in window)speechSynthesis.cancel();if(fs)setFs(false);renderPanel();},getState(){return {play:play.id,step,me,mode,running};}};\n}\n`);

const scoutSource=read('scout/index.html'), s=cheerio.load(scoutSource);
let scoutJs=s('script[type="module"]').html();
if(!scoutJs||!scoutSource.includes('scout-report-v2')||!scoutSource.includes('iphone-courtside-v1'))throw new Error('Run scouting safety and mobile builds before unification');
scoutJs=scoutJs.replace(/^import .*$/gm,'').replace('(() => {','');
scoutJs=scoutJs.slice(0,scoutJs.indexOf('/* ---------- Boot ---------- */'));
scoutJs=replace(scoutJs,'const $ = (s, el = document) => el.querySelector(s);','const $ = (s, el = root) => el.querySelector(s);');
scoutJs=scoutJs.replaceAll('document.querySelectorAll(', 'root.querySelectorAll(').replace('\nsetupMobileUI();','\n');
scoutJs=replace(scoutJs,'function switchTab(name) {','function switchTab(name) {\n  if(!A)return;');
scoutJs=replace(scoutJs,"if (b) switchTab(b.dataset.tab);","if (b) api.openScout(b.dataset.tab);");
scoutJs=replace(scoutJs,"function showOpponent(name) {oppSel=name;switchTab('opposition');}","function showOpponent(name) {api.openScout('opposition',name);}");
const scoutCss=s('style').toArray().map(e=>s(e).html()).join('\n')+'\n'+read('assets/mobile.css');
const scoutHtml='<div hidden id="subtitle"></div><div hidden id="updated"></div><nav id="tabs" aria-label="Scouting sections"><button class="tab" data-tab="opposition" aria-selected="true">Opposition</button><button class="tab" data-tab="tigers" aria-selected="false">Tigers stats</button><button class="tab" data-tab="division" aria-selected="false">Division</button></nav><main>'+s('main').html()+'</main>';
const scoutOverrides=`#tabs{position:static;inset:auto;transform:none;width:100%;max-width:none;display:flex;gap:6px;margin:0 0 20px;padding:4px;background:var(--soft);border:1px solid var(--line);border-radius:12px;box-shadow:none}#tabs .tab{flex:1;min-height:42px;padding:10px 4px;font:600 13px var(--body);border:0;border-radius:8px;text-transform:none;letter-spacing:0}#tabs .tab[aria-selected="true"]{background:var(--surface);color:var(--fg)}main{padding:0}#view-now{display:none!important}.page-heading{margin:0 0 20px}.page-heading h2{font-size:34px}.page-heading .eyebrow{display:none}.profile-top{margin-top:0}.foot{font-size:12px}.profile .name{word-break:normal}`;
write('assets/generated/scout-view.js',`import {buildReports} from '/lib/scouting.js';\nexport function mountScout(host,api){const root=host.attachShadow({mode:'open'});root.innerHTML=${JSON.stringify('<style>'+scoped(scoutCss)+'\n'+shared+'\n'+scoutOverrides+'</style><div class="component-body">'+scoutHtml+'</div>')};\n${scoutJs}\nCONFIG=api.config;let desired='opposition';\nroot.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.classList.add('failed');},true);\nreturn {setData(data){DATA=data;CONFIG=api.config;renderAll();switchTab(desired);},open(tab='opposition',team=null){desired=['opposition','tigers','division'].includes(tab)?tab:'opposition';oppSel=team;if(A)switchTab(desired);},getState(){return {view:desired,team:oppSel,loaded:!!DATA};}};\n}\n`);
write('index.html',read('assets/tournament.html'));
// Old bookmarks lead into the same app. Source pages remain available to the build.
for(const [path,target] of [['playbook/index.html','playbook'],['scout/index.html','scout'],['app/index.html','home']]){
 const source=read(path);if(source.includes('unified-route-redirect'))continue;
 const code=`<script>/* unified-route-redirect */location.replace('/#${target}'+(${JSON.stringify(target)}==='playbook'&&location.hash?'/'+encodeURIComponent(location.hash.slice(1)):''));</script>`;
 write(path,source.replace('<head>','<head>'+code));
}
console.log('Unified tournament app built: 6 original plays, shared data and navigation');
