#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m);}
const enc=fs.readFileSync(path.join(ROOT,'src/encoder.js'),'utf8');
const files=fs.readFileSync(path.join(ROOT,'src/files.js'),'utf8');
const hill=fs.readFileSync(path.join(ROOT,'src/hill.js'),'utf8');
const start=enc.indexOf('const _opaquePixelsCache = new WeakMap();');
const end=enc.indexOf('function isLowTextureCover',start);
assert(start>=0&&end>start,'bloco opaquePixels não encontrado');
const ctx={Uint32Array,WeakMap,Math}; vm.createContext(ctx);
vm.runInContext(enc.slice(start,end)+';this.api={opaquePixels,opaqueAt,opaqueRange,inheritOpaquePixels};',ctx);
const {opaquePixels,opaqueAt,opaqueRange,inheritOpaquePixels}=ctx.api;
function rgba(n,alpha=255){const d=new Uint8ClampedArray(n*4);for(let i=0;i<n;i++)d[i*4+3]=alpha;return d;}
const all=rgba(1000);
const a=opaquePixels(all);
assert(a.identity===true&&a.list===null&&a.length===1000,'cover opaca deveria usar mapa identidade sem lista');
assert(opaqueAt(a,0)===0&&opaqueAt(a,999)===999,'mapa identidade retornou índice incorreto');
assert(opaquePixels(all)===a,'cache por buffer não reutilizou o mapa');
const ar=opaqueRange(a,80);
assert(ar.identityRange===true&&ar.start===80&&ar.length===920,'range identidade incorreto');
const clone=new Uint8ClampedArray(all);
assert(inheritOpaquePixels(all,clone)===a,'herança do mapa falhou');
assert(opaquePixels(clone)===a,'clone não reutilizou mapa herdado');
const mixed=rgba(8); mixed[1*4+3]=0; mixed[4*4+3]=128;
const m=opaquePixels(mixed);
assert(!m.identity&&m.length===6,'cover com transparência teve contagem errada');
assert(Array.from(m.list).join(',')==='0,2,3,5,6,7','lista parcial divergiu da ordem raster antiga');
assert(opaqueAt(m,3)===5,'opaqueAt parcial incorreto');
assert(Array.from(opaqueRange(m,2)).join(',')==='3,5,6,7','range parcial incorreto');
assert(files.includes('inheritOpaquePixels(encID.data, work.data);'),'Encoder não herda mapa da cover para o clone');
assert(hill.includes('if (candidatePx?.identityRange) {')&&hill.includes('idx[i]=candidatePx.start+i;'),'adaptiveOrder não aceita range identidade sem lista opaca');

assert(!/\bop\s*\[/.test(enc)&&! /\bop\s*\[/.test(fs.readFileSync(path.join(ROOT,'src/decoder.js'),'utf8')),
  'acesso direto op[] reintroduz dependência de lista materializada');
console.log('O1-M1 opaque pixels OK — all-opaque usa identidade/cache sem Uint32Array de índices; transparência preserva ordem raster');
