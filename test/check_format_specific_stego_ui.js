#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/results.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
function extractFunction(name){
  const start=src.indexOf(`function ${name}(`); assert(start>=0,`função ${name} ausente`);
  const brace=src.indexOf('{',start); let depth=0,end=-1;
  for(let i=brace;i<src.length;i++){ if(src[i]==='{') depth++; else if(src[i]==='}' && --depth===0){end=i+1;break;} }
  assert(end>brace,`função ${name} truncada`); return src.slice(start,end);
}
const fn=new Function(extractFunction('resolveStegoSurface')+'; return resolveStegoSurface;')();
assert(fn({format:{cat:'lossless',ext:'PNG'},jpegDCT:null})==='lossless-lsb','PNG não escolhe família LSB');
assert(fn({format:{cat:'lossless',ext:'BMP'},jpegDCT:null})==='lossless-lsb','lossless alternativo não escolhe família LSB');
assert(fn({format:{cat:'lossy',ext:'JPEG'},jpegDCT:{available:true}})==='jpeg-dct','JPEG não escolhe família DCT');
assert(fn({format:{cat:'lossy',ext:'WEBP lossy'},jpegDCT:null})==='generic','lossy sem DCT inventou módulo JPEG');
assert(src.includes("if(stegoSurface==='lossless-lsb')") && src.includes("if(stegoSurface==='jpeg-dct')"),'render não está governado pela família de formato');
assert(!src.includes("renderModule('studio'") && !src.includes("renderModule('lsb'"),'accordions antigos Protocolo/LSB voltaram separados');
assert(src.includes("renderModule('pnglsb'") && src.includes("renderModule('jpegdct'"),'superfícies format-specific ausentes');
assert(src.includes("const losslessTitle=(r.format?.ext||'PNG')+' / LSB';"),'título lossless não acompanha o formato real');
process.stdout.write('format-specific stego UI OK — only applicable LSB or JPEG/DCT family is rendered');
