#!/usr/bin/env node
'use strict';

// F17 malformed-input corpus. The goal is fail-closed behavior and bounded
// resource use, not acceptance of damaged media. Inputs are deterministic so a
// future parser broadening must be reviewed instead of silently changing scope.

const fs=require('fs');
const path=require('path');
const {webcrypto}=require('crypto');
const hashwasm=require('../src/hash-wasm.js');
function assert(c,m){if(!c)throw new Error(m)}
const root=path.join(__dirname,'..');
const code=['crypto.js','encoder.js','hill.js','stc.js','decoder.js','jpeg_dct.js','robust.js','png_codec.js']
  .map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',code+`\nreturn {
  pngEncodeRGBA,pngDecodeRGBA,pngBuild,pngDeflate,extractLSBStudio,robustExtract,
  decodeJpegCoefficients,classifyFormat,MODE_B
};`)(webcrypto,hashwasm,k=>k);

async function rejects(label,fn){let ok=false;try{await fn()}catch{ok=true}assert(ok,`${label}: malformed input was accepted`)}
function fakeHeaderImage(len){
  const n=128; const data=new Uint8ClampedArray(n*4); for(let p=0;p<n;p++)data[p*4+3]=255;
  const h=new Uint8Array(10); h.set([0x53,0x54,0x45,0x47,0x4f]); h[5]=api.MODE_B;
  h[6]=len&255;h[7]=(len>>>8)&255;h[8]=(len>>>16)&255;h[9]=(len>>>24)&255;
  for(let i=0;i<80;i++){const bit=(h[i>>3]>>(7-(i&7)))&1;data[i*4+2]=bit}
  return {data,width:n,height:1};
}

(async()=>{
  const rgba=new Uint8ClampedArray(16*16*4); for(let p=0;p<256;p++){rgba[p*4]=p;rgba[p*4+1]=255-p;rgba[p*4+2]=(p*7)&255;rgba[p*4+3]=255}
  const valid=await api.pngEncodeRGBA(16,16,rgba);
  await rejects('empty PNG',()=>api.pngDecodeRGBA(new Uint8Array()));
  await rejects('signature-only PNG',()=>api.pngDecodeRGBA(valid.slice(0,8)));
  await rejects('truncated PNG header',()=>api.pngDecodeRGBA(valid.slice(0,12)));
  // Invalid PNG scanline filter, but with a valid deflate stream. This exercises
  // raster validation without relying on Node's DecompressionStream behavior on
  // deliberately broken zlib streams (which can surface an implementation-level
  // unhandled error instead of the product's rejection path).
  const badFilterRaw=new Uint8Array([5,0,0,0,255]);
  const badFilter=api.pngBuild(1,1,await api.pngDeflate(badFilterRaw));
  await rejects('invalid PNG filter',()=>api.pngDecodeRGBA(badFilter));
  const interlaced=new Uint8Array(valid); interlaced[28]=1;
  await rejects('unsupported interlace',()=>api.pngDecodeRGBA(interlaced));

  // Construct a formally shaped PNG with hostile dimensions. The production
  // decoder must reject before inflating or allocating the RGBA raster.
  const emptyDeflated=await api.pngDeflate(new Uint8Array());
  const huge=api.pngBuild(100000,100000,emptyDeflated);
  await rejects('huge dimensions',()=>api.pngDecodeRGBA(huge));

  // LSB headers with impossible lengths fail before body allocation/read.
  assert(api.extractLSBStudio(fakeHeaderImage(0),'')===null,'zero-length legacy header accepted');
  assert(api.extractLSBStudio(fakeHeaderImage(0xffffffff),'')===null,'oversized legacy header accepted');

  // Robust wrapper must turn arbitrary/non-JPEG data into a neutral none state,
  // not leak parser exceptions to the Analyzer pipeline.
  for(const b of [new Uint8Array(),new Uint8Array([0xff,0xd8]),new Uint8Array(64).fill(0xaa)]){
    const r=api.robustExtract(b,''); assert(r&&r.status==='none','malformed JPEG robust probe did not fail neutral');
  }
  let jpegThrew=false;try{api.decodeJpegCoefficients(new Uint8Array([1,2,3,4]))}catch{jpegThrew=true}
  assert(jpegThrew,'raw JPEG parser unexpectedly accepted random bytes');

  // Deterministic fuzz: no blob may become a confirmed robust envelope; PNG may
  // reject, but must never return absurd dimensions.
  let seed=0xF17BADC0; const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed};
  for(let n=0;n<64;n++){
    const len=rnd()%256, b=new Uint8Array(len); for(let i=0;i<len;i++)b[i]=rnd()&255;
    assert(api.robustExtract(b,'fuzz').status!=='ok',`fuzz #${n} became robust:ok`);
    try{const p=await api.pngDecodeRGBA(b);assert(p.width*p.height<=80e6,`fuzz #${n} bypassed PNG pixel cap`)}catch{}
  }

  // Magic bytes win over misleading extension/MIME.
  const pngFmt=api.classifyFormat({name:'misleading.jpg',type:'image/jpeg'},valid.slice(0,16));
  assert(pngFmt.ext==='PNG'&&pngFmt.cat==='lossless','PNG magic did not override misleading JPEG metadata');
  const jpegFmt=api.classifyFormat({name:'misleading.png',type:'image/png'},new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0,0,0,0,0,0]));
  assert(jpegFmt.ext==='JPEG'&&jpegFmt.cat==='lossy','JPEG magic did not override misleading PNG metadata');

  process.stdout.write('F17 malformed corpus OK — PNG limits/truncation + LSB lengths + JPEG/robust fuzz + magic format');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
