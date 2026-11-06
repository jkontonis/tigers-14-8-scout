import fs from 'node:fs';
let js=fs.readFileSync('assets/tournament.js','utf8');js=js.replace("import {mountScout} from './generated/scout-view.js';","import {mountScout} from './scout-v3.js?v=1';");js=js.replace('const api={get config()','const api={refresh,get config()');if(!js.includes("from './scout-v3.js?v=1'"))throw Error('Scout integration anchor missing');fs.writeFileSync('assets/tournament.js',js);
let h=fs.readFileSync('index.html','utf8').replace('/assets/tournament.js?v=2','/assets/tournament.js?v=scout-3');fs.writeFileSync('index.html',h);
console.log('Coach report view v3 ready');
