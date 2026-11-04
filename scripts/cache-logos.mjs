// Verified official club artwork, pinned by digest and served from our deployment.
// Original colours and proportions are retained. No credentials are sent to sources.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const LOGOS=[
 ['tigers','https://melbournetigers.basketball/wp-content/uploads/2024/01/190124-Melb-Tigers-CMYK.png','ca91c83f1d9b3c18b8cd9f5285cfdf141764a6110aa9b47cc6238b1c5699a076'],
 ['camberwell','https://camberwellbasketball.com/wp-content/uploads/2023/03/junior-representative-logo.png','990598d294ccefea176d25686040061516a4f2f1043d413d45efa51ead612d58'],
 ['darebin','https://www.darebinbasketball.com.au/wp-content/uploads/2024/04/DBA-Logo-1.png','c3dafc9c4552af66add9241c5fb4203da422e6aa82f742be6e24ca62d3616b59'],
 ['sharks','https://www.sthpen.com.au/wp-content/uploads/2026/08/Main-Logo-Outline.png','b77830cd0be4f80122877ce0a255c0ab58de7b7873326c6966f0920bba63b2ab'],
 ['pakenham','https://assets.playhq.com/bv/1ec770/128_128_logo.png','f7713443f93deb8d39295991fd026bf631f1aa18107037daac461a22a0989207']
];
export async function cacheLogos(){
 await fs.mkdir('assets/teams',{recursive:true});
 await Promise.all(LOGOS.map(async([name,url,hash])=>{
  const file=`assets/teams/${name}.png`;const digest=b=>createHash('sha256').update(b).digest('hex');
  try{if(digest(await fs.readFile(file))===hash)return;}catch{}
  const response=await fetch(url,{signal:AbortSignal.timeout(18000),redirect:'error'});
  if(!response.ok)throw new Error('Official logo unavailable: '+name);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>1000000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||digest(bytes)!==hash)throw new Error('Official logo needs re-verification: '+name);
  await fs.writeFile(file,bytes);
 }));
 console.log('Five verified club logos ready');
}
await cacheLogos();
