#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src','png_codec.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const api=new Function(src+';return {pngRGBAToRawNone,pngRGBAToRawAdaptive,pngDeflate,pngBuild,pngDecodeRGBA,pngEncodeRGBA};')();
(async()=>{
 const w=640,h=360,d=new Uint8ClampedArray(w*h*4);let seed=0x12345678;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,n=(rnd()%7)-3;
  d[i]=Math.max(0,Math.min(255,35+Math.floor(x*170/w)+n));
  d[i+1]=Math.max(0,Math.min(255,65+Math.floor(y*125/h)+n));
  d[i+2]=Math.max(0,Math.min(255,90+Math.floor((x+y)*75/(w+h))+n));d[i+3]=255;
 }
 const rawNone=api.pngRGBAToRawNone(w,h,d),rawAdaptive=api.pngRGBAToRawAdaptive(w,h,d);
 const pngNone=api.pngBuild(w,h,await api.pngDeflate(rawNone));
 const pngAdaptive=api.pngBuild(w,h,await api.pngDeflate(rawAdaptive));
 assert(pngAdaptive.length < pngNone.length*0.8,`filtro adaptativo não reduziu materialmente o corpus (${pngNone.length} -> ${pngAdaptive.length})`);
 const filterTypes=new Set();for(let y=0,o=0;y<h;y++,o+=w*4+1)filterTypes.add(rawAdaptive[o]);
 assert([...filterTypes].every(n=>n>=0&&n<=4) && (filterTypes.size>1 || !filterTypes.has(0)),'encoder adaptativo regrediu para Filter 0 fixo');
 const dec=await api.pngDecodeRGBA(pngAdaptive);
 assert(dec.width===w&&dec.height===h,'round-trip mudou dimensões');
 assert(dec.data.length===d.length,'round-trip mudou tamanho do raster');
 for(let i=0;i<d.length;i++) if(dec.data[i]!==d[i]) throw new Error(`pixel mudou em ${i}: ${d[i]} -> ${dec.data[i]}`);
 const prod=await api.pngEncodeRGBA(w,h,d);
 assert(prod.length===pngAdaptive.length,'pngEncodeRGBA não usa o caminho adaptativo testado');

 // Corpus direcionado que obriga o seletor a exercer Paeth (filter 4).
 // Isso prende não só a escolha adaptativa, mas também a fórmula do filtro: uma
 // mutação em Paeth precisa alterar pixels após decode e deixar o teste vermelho.
 const pw=64,ph=64,pd=new Uint8ClampedArray(pw*ph*4);
 for(let y=0;y<ph;y++) for(let x=0;x<pw;x++){
   const i=(y*pw+x)*4; pd[i]=x*4; pd[i+1]=y*4; pd[i+2]=(x+y)*2; pd[i+3]=255;
 }
 const praw=api.pngRGBAToRawAdaptive(pw,ph,pd);
 const ptypes=new Set(); for(let y=0,o=0;y<ph;y++,o+=pw*4+1) ptypes.add(praw[o]);
 assert(ptypes.has(4),'corpus direcionado deixou de exercer o filtro Paeth');
 const ppng=api.pngBuild(pw,ph,await api.pngDeflate(praw));
 const pdec=await api.pngDecodeRGBA(ppng);
 for(let i=0;i<pd.length;i++) if(pdec.data[i]!==pd[i]) throw new Error(`Paeth mudou pixel em ${i}: ${pd[i]} -> ${pdec.data[i]}`);

 process.stdout.write(`PNG adaptive filters OK — exact pixels incl. Paeth, ${pngNone.length} -> ${pngAdaptive.length} bytes (${(100*pngAdaptive.length/pngNone.length).toFixed(1)}%)`);
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
