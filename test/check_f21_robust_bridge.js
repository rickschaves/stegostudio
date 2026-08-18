#!/usr/bin/env node
'use strict';

// CHECK 39 — F21/robust JPEG bridge.
// F21 v3 is scoped to protected PNG/lossless. The second JPEG output must keep
// the pre-F21 robust payload instead of receiving the v3 packet (or null).

const fs = require('fs');
const path = require('path');
function assert(c,m){ if(!c) throw new Error(m); }
function extractFunction(src,name){
  const start=src.indexOf(`function ${name}(`); assert(start>=0,`${name} not found`);
  const sigEnd=src.indexOf(') {',start); assert(sigEnd>=0,`${name} signature end not found`);
  const open=sigEnd+2; let depth=0, quote=null, esc=false, line=false, block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i], n=src[i+1]||'';
    if(line){ if(c==='\n') line=false; continue; }
    if(block){ if(c==='*'&&n==='/'){ block=false; i++; } continue; }
    if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote) quote=null; continue; }
    if(c==='/'&&n==='/'){ line=true; i++; continue; }
    if(c==='/'&&n==='*'){ block=true; i++; continue; }
    if(c==="'"||c==='"'||c==='`'){ quote=c; continue; }
    if(c==='{') depth++; else if(c==='}'&&--depth===0) return src.slice(start,i+1);
  }
  throw new Error(`${name} unterminated`);
}

const ROOT=path.join(__dirname,'..');
const encoder=fs.readFileSync(path.join(ROOT,'src','encoder.js'),'utf8');
const files=fs.readFileSync(path.join(ROOT,'src','files.js'),'utf8');
const jpeg=fs.readFileSync(path.join(ROOT,'src','jpeg_dct.js'),'utf8');
const robust=fs.readFileSync(path.join(ROOT,'src','robust.js'),'utf8');
const robustApi=new Function(jpeg+'\n'+robust+'\nreturn {robustEmbed,robustExtract};')();
const MODE_B=0x00, MODE_RGB=0x01, FLAG_SHUFFLED=0x02, FLAG_STEALTH=0x08, FLAG_COMPRESSED=0x10, FLAG_STC=0x20;
const buildPayloadSrc=extractFunction(encoder,'buildPayload');
const buildRobustSrc='async '+extractFunction(encoder,'buildRobustPayload');

const prelude=`
const MAGIC=[0x53,0x54,0x45,0x47,0x4F];
const MODE_B=0x00, MODE_RGB=0x01;
const FLAG_SHUFFLED=0x02, FLAG_ADAPTIVE=0x04, FLAG_STEALTH=0x08,
      FLAG_COMPRESSED=0x10, FLAG_STC=0x20, FLAG_HILLV2=0x40;
let aesCalls=0;
async function aesEncryptBytes(bytes,password){
  aesCalls++;
  const out=new Uint8Array(bytes.length+2); out[0]=0xA2; out[1]=password.length; out.set(bytes,2); return out;
}
`;
const api=new Function(`${prelude}\n${buildPayloadSrc}\n${buildRobustSrc}\nreturn {buildRobustPayload,getCalls:()=>aesCalls};`)();

(async()=>{
  const body=new Uint8Array([1,2,3,4]);
  const stc=await api.buildRobustPayload(body,'pw',{mode:MODE_B,compressed:true,adaptive:false,stcW:4});
  assert(api.getCalls()===1,'protected robust payload did not perform exactly one legacy content encryption');
  assert(String.fromCharCode(...stc.slice(0,5))==='STEGO','robust bridge lost classic STEGO header');
  assert((stc[5]&FLAG_COMPRESSED)!==0 && (stc[5]&FLAG_STC)!==0 && (stc[5]&FLAG_STEALTH)!==0,
    'STC robust bridge did not preserve historical header flags');
  assert((stc[5]&FLAG_SHUFFLED)===0,'historical STC robust payload unexpectedly gained shuffled flag');
  assert(stc[10]===0xA2,'protected robust body is not the self-contained legacy AES payload');

  const rgb=await api.buildRobustPayload(body,'pw',{mode:MODE_RGB,compressed:false,adaptive:false,stcW:0});
  assert(api.getCalls()===2,'second protected robust payload did not encrypt independently');
  assert((rgb[5]&MODE_RGB)===MODE_RGB && (rgb[5]&FLAG_SHUFFLED)!==0 && (rgb[5]&FLAG_STEALTH)!==0,
    'RGB robust bridge did not reproduce pre-F21 password flags');

  const plain=await api.buildRobustPayload(body,'',{mode:MODE_B,compressed:false,adaptive:false,stcW:0});
  assert(api.getCalls()===2,'passwordless robust payload unexpectedly ran AES/KDF');
  assert(plain.length===14 && plain.slice(10).every((v,i)=>v===body[i]),'passwordless robust payload changed body');

  // The reconstructed payload must survive the real robust transport unchanged.
  const W=128,H=128, rgba=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=(y*W+x)*4; rgba[i]=(x*3+y)&255; rgba[i+1]=(x+y*5)&255; rgba[i+2]=(x*7+y*11)&255; rgba[i+3]=255;
  }
  const wrapped=robustApi.robustEmbed(rgba,W,H,stc,'pw');
  const opened=robustApi.robustExtract(wrapped.jpeg,'pw');
  assert(opened.status==='ok','real robust transport rejected the reconstructed protected payload');
  assert(Buffer.from(opened.payload).equals(Buffer.from(stc)),'real robust transport changed the reconstructed payload');

  // Integration ratchet: the deferred JPEG output must build a classic payload
  // when F21 is active and pass that value — never the F21/null `payload` slot.
  const bridgePos=files.indexOf('const robustPayload = cipher');
  const embedPos=files.indexOf('robustEmbed(robustCoverData, robustCoverW, robustCoverH, robustPayload, key)');
  assert(bridgePos>=0 && embedPos>bridgePos,'Encoder no longer bridges protected F21 PNG to a classic robust JPEG payload');
  assert(files.includes('const encOutputRun = encOutputGeneration') &&
         files.includes('if(encOutputRun !== encOutputGeneration) return;'),
    'robust JPEG async result is no longer generation-guarded');
  assert(files.includes('const robustCoverData = encID?.data') &&
         files.includes('const robustCoverW = encW, robustCoverH = encH'),
    'robust JPEG no longer snapshots the carrier identity before its async KDF');
  const bridgeBlock=files.slice(bridgePos,embedPos+100);
  assert(bridgeBlock.includes('await buildRobustPayload(bodyBytes, key, {mode, compressed, adaptive, stcW})'),
    'protected robust bridge stopped reconstructing the pre-F21 payload');
  assert(!/robustEmbed\(encID\.data,\s*encW,\s*encH,\s*payload,\s*key\)/.test(files),
    'regression: robustEmbed again receives the main payload slot, which is null on protected F21 encodes');
  assert(files.includes('f21Packet = await f21CreatePacket(bodyBytes, key'),
    'main protected PNG no longer uses the F21 packet');

  process.stdout.write('F21 robust bridge OK — protected PNG uses v3 while robust JPEG receives an independent pre-F21 payload');
})().catch(e=>{ console.error(e.stack||e); process.exit(1); });
