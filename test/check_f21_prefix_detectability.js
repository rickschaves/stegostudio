#!/usr/bin/env node
'use strict';

// Directed-prefix regression corpus. This is NOT a steganalysis proof and does
// not replace real-cover measurement. It freezes the specific failure discovered
// during Rev.6 implementation: writing 448 masked bits directly into the first
// B-channel LSBs creates a predictable near-random first window on medium covers.

const fs=require('fs'),path=require('path'); const {webcrypto}=require('crypto');
function assert(c,m){if(!c)throw new Error(m)}
const ROOT=path.join(__dirname,'..');
const code=['crypto.js','f21.js','encoder.js','hill.js','stc.js','decoder.js']
 .map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
const api=new Function('crypto','t',code+`\nreturn {embedLSBV3,MODE_B,FLAG_SHUFFLED,FLAG_STEALTH};`)(webcrypto,k=>k);
let seed=0xA5B35719; function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
function bytes(n){const a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=rnd()&255;return a}
function cover(v,w=256,h=256){const d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=((x*13+y*17+v*31+(x*y)%37)&31)-16,i=(y*w+x)*4;d[i]=(x*2+y+n+70)&255;d[i+1]=(x+y*2-n+90)&255;d[i+2]=(x*3+y*2+n+30)&255;d[i+3]=255;}return {data:d,width:w,height:h}}
function chiFirst(d,n=512){let ones=0;for(let i=0;i<n;i++)ones+=d[i*4+2]&1;const ex=n/2;return ((ones-ex)**2+((n-ones)-ex)**2)/ex}
(async()=>{
 const rows=[];
 for(let v=0;v<12;v++){
   const c=cover(v), prod={...c,data:new Uint8ClampedArray(c.data)}, direct={...c,data:new Uint8ClampedArray(c.data)};
   const salt=bytes(16), maskedHeader=bytes(40), prefix=new Uint8Array([...salt,...maskedHeader]);
   for(let i=0;i<448;i++) direct.data[i*4+2]=(direct.data[i*4+2]&0xFE)|((prefix[i>>3]>>(7-(i&7)))&1);
   await api.embedLSBV3(prod,{structuralSalt:salt,maskedHeader,body:new Uint8Array(0),bodyOrderKey:bytes(32),
     modeFlags:api.MODE_B|api.FLAG_SHUFFLED|api.FLAG_STEALTH,stcW:0},api.MODE_B,false,0);
   let directChanges=0,prodChanges=0;
   for(let i=0;i<c.width*c.height;i++){
     directChanges+=((direct.data[i*4+2]&1)!==(c.data[i*4+2]&1));
     prodChanges+=((prod.data[i*4+2]&1)!==(c.data[i*4+2]&1));
   }
   rows.push({cleanChi:chiFirst(c.data),directChi:chiFirst(direct.data),prodChi:chiFirst(prod.data),directChanges,prodChanges});
 }
 const avg=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
 const directFlags=rows.filter(r=>r.directChi<3.84).length, prodFlags=rows.filter(r=>r.prodChi<3.84).length;
 assert(directFlags===rows.length,'control corpus no longer reproduces the direct-448 random-window failure');
 assert(prodFlags===0,`bootstrap STC regressed into the directed first-window signature (${prodFlags}/${rows.length})`);
 assert(avg('prodChi')>avg('directChi')+40,`bootstrap no longer separates from direct-LSBR control (${avg('prodChi')} vs ${avg('directChi')})`);
 assert(avg('prodChanges')<avg('directChanges')*0.6,`bootstrap flip count regressed (${avg('prodChanges')} vs ${avg('directChanges')})`);
 process.stdout.write(`F21 prefix sanity OK — synthetic medium corpus: direct ${directFlags}/${rows.length} low-chi, STC ${prodFlags}/${rows.length}; flips ${avg('directChanges').toFixed(1)}→${avg('prodChanges').toFixed(1)}`);
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
