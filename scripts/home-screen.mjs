import fs from 'node:fs';
import {inflateSync,deflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
// A lossless, dependency-free conversion of the reviewed legacy RGB icon.
// Preserve the original Tigers pixels; remove only the obsolete footer and centre the crest.
export function crestOnlyPng(source){
 const signature=Buffer.from('89504e470d0a1a0a','hex');
 if(!source.subarray(0,8).equals(signature))throw Error('Icon source must be PNG');
 const parts=[];let header;
 for(let pos=8;pos<source.length;){const n=source.readUInt32BE(pos),kind=source.toString('ascii',pos+4,pos+8),body=source.subarray(pos+8,pos+8+n);if(kind==='IHDR')header=Buffer.from(body);if(kind==='IDAT')parts.push(body);pos+=n+12;}
 if(!header||header.readUInt32BE(0)!==512||header.readUInt32BE(4)!==512||header[8]!==8||header[9]!==2||header[12]!==0)throw Error('Expected the reviewed 512px RGB icon source');
 const w=512,h=512,stride=w*3,raw=inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(stride*h);
 if(raw.length!==(stride+1)*h)throw Error('Unexpected PNG pixel length');
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<h;y++){const filter=raw[y*(stride+1)];if(filter>4)throw Error('Unsupported PNG filter');for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=3?pixels[i-3]:0,b=y?pixels[i-stride]:0,c=y&&x>=3?pixels[i-stride-3]:0;pixels[i]=(raw[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
 let band=-1;for(let y=256;y<h;y++){let gold=0;for(let x=0;x<w;x++){const i=y*stride+x*3;if(pixels[i]>180&&pixels[i+1]>120&&pixels[i+2]<80)gold++;}if(gold>480){band=y;break;}}
 if(band!==437)throw Error('Original icon changed; inspect before removing its footer');
 const visible=band-2,offset=Math.floor((h-visible)/2),out=Buffer.alloc((stride+1)*h);
 for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*(stride+1)+1+x*3;out[i]=5;out[i+1]=7;out[i+2]=8;}if(y>=offset&&y<offset+visible)pixels.copy(out,y*(stride+1)+1,(y-offset)*stride,(y-offset+1)*stride);}
 const crc32=b=>{let crc=0xffffffff;for(const v of b){crc^=v;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 const chunk=(kind,body)=>{const type=Buffer.from(kind),b=Buffer.alloc(body.length+12);b.writeUInt32BE(body.length);type.copy(b,4);body.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([type,body])),body.length+8);return b;};
 return Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(out,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export function applyHomeScreenIdentity(){
 const icon=n=>`assets/icons/tigers-tournament-${n}-v1.png`;
 fs.mkdirSync('assets/icons',{recursive:true});
 fs.writeFileSync(icon(512),crestOnlyPng(fs.readFileSync('content/legacy-icon-source-512.png')));
 // Update old fallback URLs too; new explicit URLs avoid reusing the Playbook image URL.
 for(const [size,paths] of [[180,['apple-touch-icon.png','playbook/img/apple-touch-icon.png']],[192,['img/icon-192.png','playbook/img/icon-192.png']],[512,['img/icon-512.png','playbook/img/icon-512.png']]])for(const p of paths)fs.copyFileSync(icon(size),p);
 const files=['index.html','playbook/index.html','scout/index.html','app/index.html'];
 for(const file of files){let s=fs.readFileSync(file,'utf8');if(!s.includes('</head>'))throw Error('No document head: '+file);
  s=s.replace(/<head>([\s\S]*?)<\/head>/i,(_,head)=>{
   head=head.replace(/<meta\b[^>]*name=["'](?:apple-mobile-web-app-title|application-name)["'][^>]*>/gi,'');
   head=head.replace(/<link\b[^>]*rel=["'](?:manifest|apple-touch-icon(?:-precomposed)?|icon|shortcut icon)["'][^>]*>/gi,'');
   head=head.replace(/<title>[\s\S]*?<\/title>/i,'<title>Tigers 14.8 Tournament</title>');
   return '<head>'+head+'\n<!-- tournament-home-screen-v1 -->\n<meta name="apple-mobile-web-app-title" content="Tigers 14.8">\n<meta name="application-name" content="Tigers 14.8 Tournament">\n<link rel="manifest" href="/manifest.json?v=tournament-3">\n<link rel="apple-touch-icon" sizes="180x180" href="/'+icon(180)+'">\n<link rel="icon" type="image/png" sizes="192x192" href="/'+icon(192)+'">\n</head>';
  });fs.writeFileSync(file,s);
 }
 console.log('Home Screen identity ready: Tigers 14.8 with the clean Tigers crest');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)applyHomeScreenIdentity();
