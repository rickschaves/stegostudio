#!/usr/bin/env node
'use strict';

// F17 behavioral matrix for the CURRENT passwordless lossless wire. Passwordless
// writes intentionally remain on the pre-F21 format for compatibility, so this
// suite exercises real embed -> PNG serialize -> PNG parse -> extract behavior
// across every production embedding family that can be selected without a key.

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const hashwasm = require('../src/hash-wasm.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const root = path.join(__dirname, '..');
const code = ['crypto.js','encoder.js','hill.js','stc.js','decoder.js','png_codec.js']
  .map(f => fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const api = new Function('crypto','hashwasm','t', code + `\nreturn {
  buildPayload,embedLSB,extractLSBStudio,pngEncodeRGBA,pngDecodeRGBA,
  deflateBytes,inflateBytes,MODE_B,MODE_RGB,FLAG_COMPRESSED
};`)(webcrypto, hashwasm, k => k);

function cover(w=128,h=96) {
  const data = new Uint8ClampedArray(w*h*4);
  for (let p=0;p<w*h;p++) {
    data[p*4]   = (p*13 + 17) & 255;
    data[p*4+1] = (p*37 + 59) & 255;
    data[p*4+2] = (p*71 + 101) & 255;
    data[p*4+3] = (p % 53 === 0) ? 0 : 255; // exercise opaquePixels contract
  }
  return {data,width:w,height:h};
}
function clone(id){ return {data:new Uint8ClampedArray(id.data),width:id.width,height:id.height}; }
async function reopen(id) {
  const png = await api.pngEncodeRGBA(id.width,id.height,id.data);
  const d = await api.pngDecodeRGBA(png);
  assert(d.width===id.width && d.height===id.height, 'PNG round-trip changed dimensions');
  return {data:d.data,width:d.width,height:d.height};
}
async function roundTrip(name,{mode,adaptive=false,stcW=0,bytes,compressed=false}) {
  const id=clone(cover());
  const flags=mode | (compressed ? api.FLAG_COMPRESSED : 0);
  const payload=api.buildPayload(bytes,flags);
  api.embedLSB(id,payload,mode,'',adaptive,false,stcW);
  const reopened=await reopen(id);
  const got=api.extractLSBStudio(reopened,'');
  assert(got instanceof Uint8Array, `${name}: decoder did not return bytes`);
  assert(!!got.compressed===compressed, `${name}: compressed flag diverged`);
  const finalBytes=compressed ? await api.inflateBytes(got) : got;
  assert(Buffer.from(finalBytes).equals(Buffer.from(bytes._plain || bytes)), `${name}: recovered bytes differ`);
}

(async()=>{
  const text='legacy passwordless matrix — português ✓ / 日本語 / emoji 🧪';
  const plain=new TextEncoder().encode(text);
  await roundTrip('B',{mode:api.MODE_B,bytes:plain});
  await roundTrip('RGB',{mode:api.MODE_RGB,bytes:plain});
  await roundTrip('HILL',{mode:api.MODE_B,adaptive:true,bytes:plain});
  await roundTrip('STC',{mode:api.MODE_B,stcW:4,bytes:plain});

  const longPlain=new TextEncoder().encode(('compressible current wire '.repeat(90))+'fim');
  const comp=await api.deflateBytes(longPlain);
  assert(comp.length<longPlain.length,'compression vector did not shrink');
  comp._plain=longPlain;
  await roundTrip('compressed-B',{mode:api.MODE_B,bytes:comp,compressed:true});

  // Boundary sanity: a tiny carrier must fail instead of partially writing.
  const tiny=cover(8,8);
  let rejected=false;
  try { api.embedLSB(tiny,api.buildPayload(new Uint8Array(200),api.MODE_B),api.MODE_B,'',false,false,0); }
  catch { rejected=true; }
  assert(rejected,'oversized passwordless payload was partially accepted');

  process.stdout.write('F17 legacy PNG matrix OK — B/RGB/HILL/STC + compressed + capacity failure');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
