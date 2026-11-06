import test from 'node:test';import assert from 'node:assert/strict';import{periodQuality,coverage,kickoff,boxQuality}from'../lib/quality.js';
const g={id:'test',home:'A',away:'B',homeScore:55,awayScore:10,status:'Final',time:'07:35 PM, Fri, 06 Nov 26'};
test('bulk-entry half scores cannot generate first-half scouting claims',()=>{const d={periods:[{team:'A',scores:[55,0,55]},{team:'B',scores:[10,0,10]}]};assert.equal(periodQuality(d,g).valid,false);assert.equal(periodQuality(d,g).suspect,true);});
test('genuine halves survive and are not renamed quarters',()=>{const q=periodQuality({periods:[{team:'A',scores:[30,25,55]},{team:'B',scores:[7,3,10]}]},g);assert.equal(q.valid,true);assert.deepEqual(q.labels,['H1','H2']);});
test('coverage exposes missing box scores instead of only counting reports',()=>{const c=coverage({fixture:[g],games:{},meta:{}});assert.equal(c.completed,1);assert.equal(c.boxScores,0);assert.deepEqual(c.missing,['test']);});
test('box reconciliation prevents invalid player shares',()=>assert.equal(boxQuality({boxes:[{team:'A',players:[{TP:50}]}]},g,'A').valid,false));
test('Melbourne tip-off is correctly translated to UTC',()=>assert.equal(new Date(kickoff(g)).toISOString(),'2026-11-06T08:35:00.000Z'));
