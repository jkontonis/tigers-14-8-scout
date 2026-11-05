import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {crestOnlyPng} from '../scripts/home-screen.mjs';

test('Home Screen identity belongs to the tournament, not the playbook',()=>{
 const m=JSON.parse(fs.readFileSync('manifest.json','utf8'));
 assert.equal(m.name,'Tigers 14.8 Tournament');assert.equal(m.short_name,'Tigers 14.8');
 assert.equal(m.id,'/');assert.equal(m.start_url,'/');assert.equal(m.scope,'/');
 for(const n of [192,512])assert.ok(m.icons.some(i=>i.sizes===`${n}x${n}`&&i.src===`/assets/icons/tigers-tournament-${n}-v1.png`));
});
test('iPhone and standard icon assets have their declared dimensions',()=>{
 for(const n of [180,192]){const b=fs.readFileSync(`assets/icons/tigers-tournament-${n}-v1.png`);assert.equal(b.readUInt32BE(16),n);assert.equal(b.readUInt32BE(20),n);}
});
test('512px crest conversion removes the old gold footer without new dependencies',()=>{
 const png=crestOnlyPng(fs.readFileSync('content/legacy-icon-source-512.png'));
 assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
 const chunks=[];for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+n));p+=n+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=512*3+1;
 for(let y=473;y<512;y++){assert.equal(raw[y*stride],0);for(let x=0;x<512;x++)assert.deepEqual([...raw.subarray(y*stride+1+x*3,y*stride+4+x*3)],[5,7,8]);}
 assert.throws(()=>crestOnlyPng(Buffer.from('not a png')));
});
