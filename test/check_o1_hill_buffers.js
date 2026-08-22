#!/usr/bin/env node
/*
 * CHECK 78 — O1-M2: HILL usa no máximo três buffers Float64 de tamanho da imagem
 * sem mudar um único valor do mapa canônico ou legado. A referência abaixo é a
 * implementação v2.43.23 congelada, anterior ao reuso de buffers.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const acorn=require('../tools/vendor/acorn.js');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m)}

const src=fs.readFileSync(path.join(ROOT,'src','hill.js'),'utf8');
const api=new Function(src+'\nreturn {hillCostMap,hillCostMapLegacy,adaptiveOrder};')();

function refBoxBlurSeparable(src,w,h,radius){
  const k=2*radius+1;
  const tmp=new Float64Array(w*h), out=new Float64Array(w*h);
  const cx=i=>i<0?0:(i>=w?w-1:i), cy=j=>j<0?0:(j>=h?h-1:j);
  for(let y=0;y<h;y++){
    const row=y*w; let sum=0;
    for(let i=-radius;i<=radius;i++)sum+=src[row+cx(i)];
    for(let x=0;x<w;x++){
      tmp[row+x]=sum/k;
      sum-=src[row+cx(x-radius)];
      sum+=src[row+cx(x+radius+1)];
    }
  }
  for(let x=0;x<w;x++){
    let sum=0;
    for(let j=-radius;j<=radius;j++)sum+=tmp[cy(j)*w+x];
    for(let y=0;y<h;y++){
      out[y*w+x]=sum/k;
      sum-=tmp[cy(y-radius)*w+x];
      sum+=tmp[cy(y+radius+1)*w+x];
    }
  }
  return out;
}
function refHill(d,w,h){
  const n=w*h, lum=new Float64Array(n);
  for(let i=0;i<n;i++)lum[i]=0.299*(d[i*4]&0xFE)+0.587*(d[i*4+1]&0xFE)+0.114*(d[i*4+2]&0xFE);
  const res=new Float64Array(n);
  const at=(x,y)=>lum[Math.min(h-1,Math.max(0,y))*w+Math.min(w-1,Math.max(0,x))];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=-at(x-1,y-1)+2*at(x,y-1)-at(x+1,y-1)+2*at(x-1,y)-4*at(x,y)+2*at(x+1,y)-at(x-1,y+1)+2*at(x,y+1)-at(x+1,y+1);
    res[y*w+x]=Math.abs(v);
  }
  const xi=refBoxBlurSeparable(res,w,h,1), inv=new Float64Array(n), EPS=1e-6;
  for(let i=0;i<n;i++)inv[i]=1/(xi[i]+EPS);
  return refBoxBlurSeparable(inv,w,h,7);
}
function refHillLegacy(d,w,h){
  const n=w*h, lum=new Float64Array(n);
  for(let i=0;i<n;i++)lum[i]=0.299*(d[i*4]&0xFE)+0.587*(d[i*4+1]&0xFE)+0.114*(d[i*4+2]&0xFE);
  const res=new Float64Array(n);
  const at=(x,y)=>lum[Math.min(h-1,Math.max(0,y))*w+Math.min(w-1,Math.max(0,x))];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=-at(x-1,y-1)+2*at(x,y-1)-at(x+1,y-1)+2*at(x-1,y)-4*at(x,y)+2*at(x+1,y)-at(x-1,y+1)+2*at(x,y+1)-at(x+1,y+1);
    res[y*w+x]=Math.abs(v);
  }
  const inv=new Float64Array(n), EPS=1e-6;
  for(let i=0;i<n;i++)inv[i]=1/(res[i]+EPS);
  const cost=new Float64Array(n);
  const ai=(x,y)=>inv[Math.min(h-1,Math.max(0,y))*w+Math.min(w-1,Math.max(0,x))];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let s=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)s+=ai(x+dx,y+dy);
    cost[y*w+x]=s/9;
  }
  return cost;
}

function raster(w,h,seed){
  let x=seed>>>0; const d=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){
    x=(Math.imul(x,1664525)+1013904223)>>>0; d[i*4]=x>>>24;
    x=(Math.imul(x,1664525)+1013904223)>>>0; d[i*4+1]=x>>>24;
    x=(Math.imul(x,1664525)+1013904223)>>>0; d[i*4+2]=x>>>24;
    d[i*4+3]=255;
  }
  return d;
}
function same(a,b,label){
  assert(a.length===b.length,`${label}: tamanho mudou`);
  for(let i=0;i<a.length;i++)assert(a[i]===b[i],`${label}: valor divergiu no pixel ${i}: ${a[i]} != ${b[i]}`);
}

const cases=[[1,1,1],[2,3,17],[17,13,2414],[64,48,0xC0FFEE],[127,91,0x51EC7]];
for(const [w,h,seed] of cases){
  const d=raster(w,h,seed);
  const ref=refHill(d,w,h), got=api.hillCostMap(d,w,h); same(ref,got,`HILL ${w}x${h}`);
  const refLegacy=refHillLegacy(d,w,h), gotLegacy=api.hillCostMapLegacy(d,w,h); same(refLegacy,gotLegacy,`HILL legado ${w}x${h}`);
  const cand=Uint32Array.from({length:w*h},(_,i)=>i);
  assert(JSON.stringify(api.adaptiveOrder(ref,cand))===JSON.stringify(api.adaptiveOrder(got,cand)),`ordem adaptativa divergiu ${w}x${h}`);
}

// Prova estrutural: o helper de blur não aloca buffers de imagem e cada mapa HILL
// cria no máximo três Float64Array. Isso deixa aberta uma otimização futura para 2
// buffers sem precisar reescrever o contrato.
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'});
function findFn(name){return ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id&&n.id.name===name)}
function countFloat64(node){let n=0; (function walk(x){if(!x||typeof x!=='object')return;if(x.type==='NewExpression'&&x.callee&&x.callee.type==='Identifier'&&x.callee.name==='Float64Array')n++;for(const [k,v] of Object.entries(x)){if(k==='start'||k==='end')continue;if(Array.isArray(v))v.forEach(walk);else walk(v)}})(node);return n}
const blur=findFn('boxBlurSeparableInto'), canon=findFn('hillCostMap'), legacy=findFn('hillCostMapLegacy');
assert(blur&&canon&&legacy,'funções HILL esperadas não encontradas');
assert(countFloat64(blur)===0,'helper de blur voltou a alocar Float64Array próprios');
assert(countFloat64(canon)<=3,`HILL canônico aloca ${countFloat64(canon)} Float64Array; contrato <=3`);
assert(countFloat64(legacy)<=3,`HILL legado aloca ${countFloat64(legacy)} Float64Array; contrato <=3`);
assert(!src.includes('function boxBlurSeparable('),'helper antigo alocador reapareceu');

console.log(`O1-M2 HILL buffers OK — ${cases.length} corpora bit-exatos; canônico=${countFloat64(canon)} buffers, legado=${countFloat64(legacy)} buffers`);
