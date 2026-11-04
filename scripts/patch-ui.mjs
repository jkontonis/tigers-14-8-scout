// Keep the original vanilla interface, applying tested data-quality corrections at build time.
import fs from 'node:fs';
// The legacy phone publisher is retired. Only the verified workflow can publish.
for(const file of ['api/ingest.js','api/finalize.js']) fs.writeFileSync(file, `export default function handler(req,res){res.status(410).json({error:'Use the authenticated scouting workflow publisher'});}`);
const parserFile='lib/parse.js';let parser=fs.readFileSync(parserFile,'utf8');
parser=parser.replaceAll('num(vals[j]) || 0','num(vals[j])').replaceAll('num(cells[2 + j]) || 0','num(cells[2 + j])').replaceAll('num(cells[j]) || 0','num(cells[j])');fs.writeFileSync(parserFile,parser);
const file='index.html';let s=fs.readFileSync(file,'utf8');
if(!s.includes('scout-report-v2')){
 const change=(from,to)=>{if(!s.includes(from))throw new Error('UI integration anchor missing: '+from.slice(0,70));s=s.replace(from,to);};
 change('<script>\n(() => {','<script type="module">\nimport { buildReports } from "/lib/scouting.js"; // scout-report-v2\n(() => {');
 change('for (const t of Object.values(teams)) profile(t, div);',`const reports = buildReports(data, CONFIG);
  for (const t of Object.values(teams)) { profile(t, div); const report=reports[t.name]; if(report){t.notes=report.notes;t.scout=report;} }
  `);
 change('const all = t.games;','const all = fin;');
 change('const withQ = all.filter(g => g.pq.length >= 4 && g.oq.length >= 4);','const withQ = all.filter(g => g.pq.length === 4 && g.oq.length === 4 && [...g.pq,...g.oq].every(Number.isFinite) && g.pq.reduce((a,b)=>a+b,0)===g.pf && g.oq.reduce((a,b)=>a+b,0)===g.pa);');
 change('for (const p of g.box.players) {',`for (const p of g.box.players) {
      if (!Number.isFinite(p.TP)) continue;`);
 change('r.gp++; r.tp += p.TP || 0;',`r.missing3=(r.missing3||0)+Number(!Number.isFinite(p['3PT']));r.missingFT=(r.missingFT||0)+Number(!Number.isFinite(p['1PT']));r.missingF=(r.missingF||0)+Number(!Number.isFinite(p.F));
      r.gp++; r.tp += p.TP || 0;`);
 change("const gs = (DATA.gradeStats || []).filter(r => r.team === t.name);","const gs = []; // Never combine grade-wide totals with a smaller box-score sample.");
 change('t.mix = tot; t.mixPts = tot.p1 + tot.p2 * 2 + tot.p3 * 3;',`t.mix = tot; const splitComplete=all.filter(g=>g.box).every(g=>g.box.totals && ['1PT','2PT','3PT'].every(k=>Number.isFinite(g.box.totals[k])) && g.box.totals['1PT']+2*g.box.totals['2PT']+3*g.box.totals['3PT']===g.pf);
  t.mixPts = splitComplete ? tot.p1 + tot.p2 * 2 + tot.p3 * 3 : 0;
  t.foulsKnown=all.filter(g=>g.box).every(g=>Number.isFinite(g.box.totals?.F));`);
 change('${p.p3}</td><td>${p.p1}</td><td>${p.f}',"${p.missing3 ? '?' : p.p3}</td><td>${p.missingFT ? '?' : p.p1}</td><td>${p.missingF ? '?' : p.f}");
 change("${esc(n.t)}</li>`).join('')}</ul>`;", "${esc(n.t)}${n.coaching ? '<div class=\"note\" style=\"margin-top:6px\"><b>Coaching consideration:</b> '+esc(n.coaching)+'</div>' : ''}${Number.isFinite(n.sample) ? '<div class=\"note\" style=\"margin-top:4px\">Based on '+n.sample+' completed game'+(n.sample===1?'':'s')+(n.sample<3&&n.sample>0?' · early sample':'')+'</div>' : ''}</li>`).join('')}</ul>`;");
 s=s.replaceAll("stat(r1(t.fpg), 'Fouls per game')","stat(t.foulsKnown ? r1(t.fpg) : '?', 'Fouls per game')");
 s=s.replaceAll('Quarter-by-quarter scores appear once a game has been played.','Four-quarter profiles require complete published quarter scores. Half-based tendencies appear in the scouting notes.');
 s=s.replaceAll("'PlayHQ, every 5 min'","(DATA.meta.reader ? 'Automatic reader' : 'Fixture import only')");
 change("u.classList.toggle('stale', mins > 20);","u.classList.toggle('stale', mins > 20 || DATA.meta.reader?.state === 'partial');");
 change("(pools[t.pool] = pools[t.pool] || []).push(t);",`const pg=t.games.filter(g=>g.final&&g.pool===t.pool);(pools[t.pool] = pools[t.pool] || []).push({...t,gp:pg.length,w:pg.filter(g=>g.margin>0).length,l:pg.filter(g=>g.margin<0).length,d:pg.filter(g=>g.margin===0).length,pf:pg.reduce((s,g)=>s+g.pf,0),pa:pg.reduce((s,g)=>s+g.pa,0)});`);
 s=s.replaceAll('computed from results','provisional, computed from pool results');
 fs.writeFileSync(file,s);
}
console.log('Scouting interface integration ready');
