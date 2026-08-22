#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {webcrypto}=require('crypto');
const hashwasm=require('../src/hash-wasm.js');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m);}
const forensic=fs.readFileSync(path.join(ROOT,'src/forensics.js'),'utf8');
const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const robust=fs.readFileSync(path.join(ROOT,'src/robust.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'src/styles.css'),'utf8');

// ---- Helpers novos contra a implementação .25 congelada ----
const ctx={Uint8Array,Uint32Array,Uint8ClampedArray,Map,Set,Math,TextDecoder,TextEncoder,DataView,console};
vm.createContext(ctx);
vm.runInContext(forensic+';this.api={analyzeEntropyStatsExact,analyzeColorStatsExact,regionalEntropySpreadExact};',ctx);
const api=ctx.api;
function legacyEntropy(d,w,h,isLossy,isPalette){
  const total=w*h,freq={};
  for(let i=0;i<d.length;i+=4){const k=`${d[i]},${d[i+1]},${d[i+2]}`;freq[k]=(freq[k]||0)+1;}
  let entropy=0;for(const c of Object.values(freq)){const p=c/total;if(p>0)entropy-=p*Math.log2(p);}
  const noiseSum=[],rows=Math.min(50,h);
  for(let y=0;y<rows;y++)for(let x=0;x<w-1;x++){const i=(y*w+x)*4;noiseSum.push(Math.abs(d[i]-d[i+4]));}
  const avgNoise=noiseSum.reduce((a,b)=>a+b,0)/noiseSum.length;
  const noiseThreshold=isLossy?0.8:isPalette?0.5:2;
  return {shannon:entropy.toFixed(4),uniqueColors:Object.keys(freq).length,
    avgNoise:avgNoise.toFixed(2),noiseAnomaly:avgNoise<noiseThreshold,
    noiseThreshold,highEntropy:entropy>18};
}
function legacyColor(d,total,isLossless,isLossy){
  const alphaVals=new Set();let partialAlpha=0;
  for(let i=3;i<d.length;i+=4){alphaVals.add(d[i]);if(d[i]!==255&&d[i]!==0)partialAlpha++;}
  const colorMap={};
  for(let i=0;i<d.length;i+=4){const k=`${Math.round(d[i]/8)*8},${Math.round(d[i+1]/8)*8},${Math.round(d[i+2]/8)*8}`;colorMap[k]=(colorMap[k]||0)+1;}
  const rare=Object.entries(colorMap).filter(([,v])=>v>5&&v/total<0.001).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const rareThreshold=isLossy?8:2;
  return {uniqueAlpha:alphaVals.size,alphaAnomaly:isLossless&&alphaVals.size>2&&alphaVals.size<20,
    partialAlpha,rareClusters:rare.length,rareSuspicious:rare.length>rareThreshold,
    rareDetails:rare.map(([c,v])=>`RGB(${c}): ${v}px`)};
}
function legacyRegional(d,w,h){
  const qW=Math.floor(w/2),qH=Math.floor(h/2),quadEntropies=[];
  for(let qy=0;qy<2;qy++)for(let qx=0;qx<2;qx++){
    const qFreq={};
    for(let y=qy*qH;y<(qy+1)*qH;y++)for(let x=qx*qW;x<(qx+1)*qW;x++){
      const i=(y*w+x)*4,k=`${Math.round(d[i]/16)*16},${Math.round(d[i+1]/16)*16},${Math.round(d[i+2]/16)*16}`;
      qFreq[k]=(qFreq[k]||0)+1;
    }
    const qTotal=qW*qH;let qEnt=0;
    for(const c of Object.values(qFreq)){const p=c/qTotal;if(p>0)qEnt-=p*Math.log2(p);}
    quadEntropies.push(qEnt);
  }
  return Math.max(...quadEntropies)-Math.min(...quadEntropies);
}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed>>>24;};}
function corpus(w,h,kind){
  const d=new Uint8ClampedArray(w*h*4),rnd=rng(w*4099+h*131);
  for(let i=0;i<w*h;i++){
    const x=i%w,y=(i/w)|0;let r,g,b,a=255;
    if(kind==='random'){r=rnd();g=rnd();b=rnd();a=i%37===0?128:255;}
    else if(kind==='gradient'){r=(x*5+y*3)&255;g=(x*11+y)&255;b=(x+y*13)&255;}
    else if(kind==='solid'){r=24;g=48;b=72;}
    else {r=(i%8)*32;g=((i>>3)%8)*32;b=((i>>6)%8)*32;a=i%101===0?0:255;}
    d[i*4]=r;d[i*4+1]=g;d[i*4+2]=b;d[i*4+3]=a;
  }
  return d;
}
for(const [w,h,kind] of [[64,64,'random'],[65,67,'random'],[100,80,'gradient'],[40,40,'solid'],[101,99,'palette']]){
  const d=corpus(w,h,kind);
  for(const lossy of [false,true])for(const palette of [false,true]){
    const before=legacyEntropy(d,w,h,lossy,palette),after=api.analyzeEntropyStatsExact(d,w,h,lossy,palette);
    assert(JSON.stringify(before)===JSON.stringify(after),`entropy divergiu em ${w}x${h}/${kind}`);
  }
  for(const lossless of [false,true])for(const lossy of [false,true]){
    const before=legacyColor(d,w*h,lossless,lossy),after=api.analyzeColorStatsExact(d,w*h,lossless,lossy);
    assert(JSON.stringify(before)===JSON.stringify(after),`color divergiu em ${w}x${h}/${kind}`);
  }
  const before=legacyRegional(d,w,h),after=api.regionalEntropySpreadExact(d,w,h);
  assert(Object.is(before,after),`regional entropy divergiu em ${w}x${h}/${kind}`);
}
// Vetor de fronteira de quantização: seis pixels raros em valor 7 precisam
// arredondar para 8 (floor mudaria o detalhe para 0 e deve ficar RED).
{
  const w=100,h=100,total=w*h,d=new Uint8ClampedArray(total*4);
  for(let i=0;i<total;i++){d[i*4]=120;d[i*4+1]=120;d[i*4+2]=120;d[i*4+3]=255;}
  for(let i=0;i<6;i++){d[i*4]=7;d[i*4+1]=7;d[i*4+2]=7;}
  const before=legacyColor(d,total,true,false),after=api.analyzeColorStatsExact(d,total,true,false);
  assert(JSON.stringify(before)===JSON.stringify(after),'color divergiu no vetor de fronteira de quantização');
  assert(after.rareDetails[0]==='RGB(8,8,8): 6px','vetor de fronteira não prendeu arredondamento /8');
}

assert(forensic.includes('report.entropy=analyzeEntropyStatsExact(d,w,h,isLossy,isPalette);'),'runForensics não usa entropy otimizada');
assert(forensic.includes('report.color=analyzeColorStatsExact(d,total,isLossless,isLossy);'),'runForensics não usa color otimizada');
assert(forensic.includes('const qSpread=regionalEntropySpreadExact(d,w,h);'),'AI/origin não usa regional entropy otimizada');

// ---- Decode DCT robusto compartilhado: semântica idêntica ao caminho autônomo ----
function src(f){return fs.readFileSync(path.join(ROOT,'src',f),'utf8');}
const core=[src('crypto.js'),src('encoder.js'),src('jpeg_dct.js'),src('robust.js')].join('\n');
const rbApi=new Function('crypto','hashwasm','t',core+';return {buildRobustPayload,robustEmbed,robustExtract,decodeJpegCoefficients};')(webcrypto,hashwasm,k=>k);
function cover(w=384,h=288){const d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;d[p]=(x*3+y*5+17)&255;d[p+1]=(x*7+y*2+43)&255;d[p+2]=(x*11+y*13+91)&255;d[p+3]=255;}return d;}
(async()=>{
  const payload=await rbApi.buildRobustPayload(new TextEncoder().encode('shared DCT robust probe'),'');
  const enc=rbApi.robustEmbed(cover(),384,288,payload,'');
  const shared=rbApi.decodeJpegCoefficients(enc.jpeg);
  const autonomous=rbApi.robustExtract(enc.jpeg,'');
  const reused=rbApi.robustExtract(enc.jpeg,'',shared);
  assert(autonomous.status==='ok'&&reused.status==='ok','robust shared/autônomo não recuperaram');
  assert(Buffer.from(autonomous.payload).equals(Buffer.from(reused.payload)),'robust shared mudou payload');
  assert(autonomous.errosCorrigidos===reused.errosCorrigidos,'robust shared mudou correções RS');
  assert(/function robustExtract\(jpegBytes, senha, sharedDec=null\)/.test(robust),'robustExtract não aceita shared decode opcional');
  assert(main.includes('robustExtract(bytes, key, dec)')&&main.includes("robustExtract(bytes, '', dec)"),'Analyzer ainda redecodifica JPEG no robusto');

  // ---- UX/perf lab ----
  assert(/\.enc-message-field\s*\{[\s\S]{0,450}?overscroll-behavior-x:contain;\s*overscroll-behavior-y:auto;[\s\S]{0,180}?touch-action:pan-y pinch-zoom;/.test(css),
    'textarea do Encoder ainda prende rolagem vertical móvel');
  assert(main.includes('getStegoAnalysisTiming()'),'snapshot de profiling interno ausente');
  assert(!main.includes("LAB JPEG · ")&&!main.includes("LAB RECOVERY · "),'profiling laboratorial voltou a aparecer no terminal público');
  assert(main.includes("analysisLabAdd(analysisLab,'coeff',subT,'jpeg')"),'decode de coeficientes JPEG não é medido isoladamente');
  assert(main.includes("analysisLabAdd(analysisLab,'steghide',shT,'recoveryDetail')")&&main.includes("analysisLabAdd(analysisLab,'outguess',ogT,'recoveryDetail')"),
    'motores JPEG não têm timing isolado');

  console.log('O1 mobile hot paths OK — entropy/color/regional bit-semanticamente idênticos; robusto reutiliza DCT; textarea encadeia scroll; profiling detalhado permanece interno');
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
