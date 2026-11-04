import { verifyRunner } from '../lib/runner-auth.js';
import { CONFIG } from '../lib/common.js';
import { ready, putText, getText } from '../lib/store.js';
import { validateSnapshot } from '../lib/snapshot.js';
import { buildReports } from '../lib/scouting.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  if(!(await verifyRunner(req)))return res.status(403).json({error:'Trusted GitHub workflow required'});
  if(!ready())return res.status(503).json({error:'Storage unavailable'});
  try{
    const data=validateSnapshot(typeof req.body==='string'?JSON.parse(req.body):req.body,CONFIG);
    if(Buffer.byteLength(JSON.stringify(data))>3000000)throw new Error('Snapshot too large');
    const old=await getText('latest.json');
    if(old){const previous=JSON.parse(old);if(previous.meta?.gradeUrl===CONFIG.gradeUrl&&Date.parse(previous.meta.scrapedAt)>Date.parse(data.meta.scrapedAt))return res.status(409).json({error:'Older snapshot rejected'});}
    data.reports=buildReports(data,CONFIG);data.meta.publishedAt=new Date().toISOString();
    if(old)await putText('previous.json',old,'application/json');
    await putText('latest.json',JSON.stringify(data),'application/json');
    return res.status(200).json({ok:true,fixtures:data.fixture.length,gameDetails:Object.keys(data.games).length,reports:Object.keys(data.reports).length});
  }catch{return res.status(422).json({error:'Snapshot validation or storage failed; last valid data retained'});}
}
