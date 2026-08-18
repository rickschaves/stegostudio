#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const hashwasm = require('../src/hash-wasm.js');
function assert(c,m){if(!c)throw new Error(m)}
const root=path.join(__dirname,'..');
const code=['crypto.js','f21.js','encoder.js','hill.js','stc.js','decoder.js','png_codec.js']
  .map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',code+`\nreturn {
  f21ModeFlagsForEmbed,f21CreatePacket,embedLSBV3,extractLSBStudioV3,f21UsedOpaquePixels,
  embedDecoyTail,extractDecoyTail,pngEncodeRGBA,pngDecodeRGBA,deflateBytes,inflateBytes,
  MODE_B,MODE_RGB,F21_PREFIX_BITS
};`)(webcrypto,hashwasm,k=>k);

function cover(w=96,h=96){
  const data=new Uint8ClampedArray(w*h*4);
  for(let p=0;p<w*h;p++){
    data[p*4]=(p*17+31)&255; data[p*4+1]=(p*29+7)&255; data[p*4+2]=(p*43+101)&255;
    data[p*4+3]=(p%37===0)?0:255;
  }
  return {data,width:w,height:h};
}
function clone(id){return {data:new Uint8ClampedArray(id.data),width:id.width,height:id.height}}
function fixed(n,seed){const a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=(seed+i*19)&255;return a}

async function reopen(id){
  const png=await api.pngEncodeRGBA(id.width,id.height,id.data);
  const d=await api.pngDecodeRGBA(png);
  return {id:{data:d.data,width:d.width,height:d.height},png};
}

(async()=>{
  const password='F21-roundtrip-2414';
  const text='F21 round-trip — português ✓ / 日本語 / emoji 🔐';
  const plain=new TextEncoder().encode(text);
  const cases=[
    {name:'B',mode:api.MODE_B,adaptive:false,stcW:0,seed:1},
    {name:'RGB',mode:api.MODE_RGB,adaptive:false,stcW:0,seed:2},
    {name:'HILL',mode:api.MODE_B,adaptive:true,stcW:0,seed:3},
    {name:'STC',mode:api.MODE_B,adaptive:false,stcW:4,seed:4},
  ];
  for(const c of cases){
    const id=clone(cover());
    const flags=api.f21ModeFlagsForEmbed(c.mode,false,c.adaptive,c.stcW);
    const packet=await api.f21CreatePacket(plain,password,{modeFlags:flags,stcW:c.stcW,
      structuralSalt:fixed(16,10+c.seed),contentIv:fixed(12,90+c.seed)});
    await api.embedLSBV3(id,packet,c.mode,c.adaptive,c.stcW);
    const {id:reopened}=await reopen(id);
    const got=await api.extractLSBStudioV3(reopened,password);
    assert(got?.headerMatched && got?.bodyAuthenticated,`${c.name}: header/body não autenticou`);
    assert(new TextDecoder().decode(got.plainBytes)===text,`${c.name}: texto divergiu`);
  }

  // Comprimido: o formato transporta os bytes comprimidos e o flag; inflate só
  // acontece no chamador, como na produção.
  const longText='compressível '.repeat(80)+'fim';
  const longPlain=new TextEncoder().encode(longText);
  const comp=await api.deflateBytes(longPlain);
  assert(comp.length<longPlain.length,'vetor de compressão não encolheu');
  const cid=clone(cover());
  const cflags=api.f21ModeFlagsForEmbed(api.MODE_B,true,false,0);
  const cp=await api.f21CreatePacket(comp,password,{modeFlags:cflags,stcW:0,
    structuralSalt:fixed(16,77),contentIv:fixed(12,99)});
  await api.embedLSBV3(cid,cp,api.MODE_B,false,0);
  const {id:creopen}=await reopen(cid);
  const cg=await api.extractLSBStudioV3(creopen,password);
  assert(cg?.compressed===true && cg?.bodyAuthenticated,'compressed: flags/auth falharam');
  const inflated=await api.inflateBytes(cg.plainBytes);
  assert(new TextDecoder().decode(inflated)===longText,'compressed: inflate divergiu');

  // F1: a camada alternativa continua no fim e usa a contagem física real da v3.
  const lid=clone(cover(112,112));
  const main='principal F21'; const alt='alternativa F1';
  const lp=await api.f21CreatePacket(new TextEncoder().encode(main),password,{
    modeFlags:api.f21ModeFlagsForEmbed(api.MODE_B,false,false,0),stcW:0,
    structuralSalt:fixed(16,123),contentIv:fixed(12,211)});
  await api.embedLSBV3(lid,lp,api.MODE_B,false,0);
  const realUsed=api.f21UsedOpaquePixels(lp.modeFlags,0,lp.body.length*8);
  await api.embedDecoyTail(lid,alt,'F21-alt-1424',realUsed);
  const {id:lreopen}=await reopen(lid);
  const mainGot=await api.extractLSBStudioV3(lreopen,password);
  const altGot=await api.extractDecoyTail(lreopen,'F21-alt-1424');
  assert(new TextDecoder().decode(mainGot.plainBytes)===main,'F1: principal divergiu');
  assert(altGot===alt,'F1: alternativa divergiu');
  assert(await api.extractDecoyTail(lreopen,password)===null,'F1: senha principal abriu alternativa');

  // F1 perto da capacidade: a fronteira física v3 (bootstrap STC + corpo STC)
  // precisa impedir colisão e aceitar o mesmo caso quando há espaço real.
  function opaqueCover(w,h){const data=new Uint8ClampedArray(w*h*4);for(let p=0;p<w*h;p++){data[p*4]=(p*11+7)&255;data[p*4+1]=(p*23+9)&255;data[p*4+2]=(p*37+13)&255;data[p*4+3]=255}return{data,width:w,height:h}}
  const nearPlain=new TextEncoder().encode('M');
  const nearPacket=await api.f21CreatePacket(nearPlain,password,{
    modeFlags:api.f21ModeFlagsForEmbed(api.MODE_B,false,false,4),stcW:4,
    structuralSalt:fixed(16,171),contentIv:fixed(12,199)});
  const nearUsed=api.f21UsedOpaquePixels(nearPacket.modeFlags,4,nearPacket.body.length*8);
  const tooSmall=opaqueCover(55,51);
  await api.embedLSBV3(tooSmall,nearPacket,api.MODE_B,false,4);
  let collided=false;try{await api.embedDecoyTail(tooSmall,'A','F21-near-alt',nearUsed)}catch{collided=true}
  assert(collided,'F1: collision guard aceitou camadas sobrepostas perto da capacidade');
  const justFits=opaqueCover(56,51);
  await api.embedLSBV3(justFits,nearPacket,api.MODE_B,false,4);
  await api.embedDecoyTail(justFits,'A','F21-near-alt',nearUsed);
  const nMain=await api.extractLSBStudioV3(justFits,password), nAlt=await api.extractDecoyTail(justFits,'F21-near-alt');
  assert(new TextDecoder().decode(nMain.plainBytes)==='M'&&nAlt==='A','F1: caso perto da capacidade não fez round-trip');

  process.stdout.write('F21 roundtrip OK — B/RGB/HILL/STC + compressed + F1 layered/near-capacity PNG');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
