#!/usr/bin/env node
'use strict';
// CHECK 85 — v2.43.28_R2: sinal no w-byte + diagnóstico honesto sob deriva geométrica.
const fs=require('fs'),path=require('path');
const {webcrypto}=require('crypto');
const hashwasm=require('../src/hash-wasm.js');
const ROOT=path.join(__dirname,'..'), FIX=path.join(__dirname,'fixtures','spread');
function assert(c,m){if(!c)throw new Error(m)}
const code=['crypto.js','f21.js','encoder.js','hill.js','stc.js','decoder.js','png_codec.js']
 .map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',code+`\nreturn {pngDecodeRGBA,extractLSBStudio,extractLSBStudioV3,packStcWByte,parseStcWByte};`)(webcrypto,hashwasm,k=>k);
const manifest=JSON.parse(fs.readFileSync(path.join(FIX,'manifest.json'),'utf8'));
function mutateAlpha(decoded,p=8001){
  const data=new Uint8ClampedArray(decoded.data);
  assert(data[p*4+3]===255,`fixture pixel ${p} não era opaco`);
  data[p*4+3]=254;
  return {data,width:decoded.width,height:decoded.height};
}
(async()=>{
  assert(api.packStcWByte(4,true)===0x24,'R2 não usa 0x24 para stcW=4 spread');
  assert(api.parseStcWByte(0x24)?.stcSpread===true,'R2 não lê bit 5 do w-byte');
  assert(api.parseStcWByte(0x44)===null && api.parseStcWByte(0x84)===null,'w-byte reservado não falha fechado');

  const pwRaw=fs.readFileSync(path.join(FIX,manifest.cases.passwordless.file));
  const pw=await api.pngDecodeRGBA(pwRaw);
  const damaged=api.extractLSBStudio(mutateAlpha(pw),'');
  assert(damaged instanceof Uint8Array && damaged.stcSpread===true,
    'header passwordless spread não preservou metadado após perturbação de alfa');
  const plain=fs.readFileSync(path.join(FIX,manifest.plain.file));
  assert(Buffer.compare(Buffer.from(damaged),plain)!==0,
    'perturbação de alfa não alterou o corpo do fixture spread — vetor de teste perdeu força');

  const fRaw=fs.readFileSync(path.join(FIX,manifest.cases.f21.file));
  const fd=await api.pngDecodeRGBA(fRaw);
  const fg=await api.extractLSBStudioV3(mutateAlpha(fd),manifest.password);
  assert(fg?.headerMatched===true && fg?.stcSpread===true && fg?.bodyAuthenticated===false,
    'F21 spread alterado deveria manter header autenticado e reprovar o corpo');

  const main=fs.readFileSync(path.join(ROOT,'src','main.js'),'utf8');
  const i=main.indexOf('if(isSpreadClassic){');
  const j=main.indexOf('} else if(isAes){',i);
  assert(i>=0 && j>i,'ramo dedicado de falha spread passwordless ausente');
  const branch=main.slice(i,j);
  assert(branch.includes("t('decStatusSpreadDamaged')"),'ramo spread não usa diagnóstico específico');
  assert(!branch.includes("flashKey('missing')") && !branch.includes("decStatusCipherWrongKey"),
    'ramo spread ainda culpa senha ausente/incorreta');

  const i18n=fs.readFileSync(path.join(ROOT,'src','i18n.js'),'utf8');
  assert((i18n.match(/decStatusSpreadDamaged:/g)||[]).length===2,'status spread precisa existir em EN/PT');
  const compat=fs.readFileSync(path.join(ROOT,'docs','COMPATIBILITY.md'),'utf8');
  assert(compat.includes('Builds `<= v2.43.27`') && compat.includes('transparency map'),
    'COMPATIBILITY não registra compatibilidade/durabilidade do wire spread');

  process.stdout.write('P1A R2 diagnostics OK — w-byte frozen, alpha drift honest, F21 body fails closed, docs aligned');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
