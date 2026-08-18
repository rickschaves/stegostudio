#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const results=fs.readFileSync(path.join(root,'src/results.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const code=['encoder.js','stc.js','decoder.js','png_codec.js'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
function assert(c,m){ if(!c) throw new Error(m); }
const api=new Function('t', code+`\nreturn {buildPayload,embedLSB,extractLSBStudio,pngEncodeRGBA,pngDecodeRGBA,MODE_B};`)(k=>k);
function cover(w=160,h=120){
  const data=new Uint8ClampedArray(w*h*4);
  for(let p=0;p<w*h;p++){
    data[p*4]=(p*17+13)&255; data[p*4+1]=(p*31+71)&255; data[p*4+2]=(p*47+109)&255; data[p*4+3]=255;
  }
  return {data,width:w,height:h};
}
(async()=>{
  const literal=String.raw`LITERAL\\n\\nTAB\\tSLASH\\\\ <script>alert(1)</script> <img src=x onerror=alert(2)> 😄 ❤️ 👍🏽 👨‍👩‍👧‍👦`;
  const text=literal+'\n\nCarta com quebra real.\nAbraços,\nRick';
  const bytes=new TextEncoder().encode(text);
  const id=cover();
  api.embedLSB(id,api.buildPayload(bytes,api.MODE_B),api.MODE_B,'',false,false,0);
  const png=await api.pngEncodeRGBA(id.width,id.height,id.data);
  const reopened=await api.pngDecodeRGBA(png);
  const got=api.extractLSBStudio({data:reopened.data,width:reopened.width,height:reopened.height},'');
  const decoded=new TextDecoder().decode(got);
  assert(decoded===text,'round-trip textual mudou escapes literais, formatação, código ou Unicode');
  assert(decoded.includes(String.raw`\\n\\n`) && decoded.includes(String.raw`\\t`),'escapes literais foram interpretados');
  assert(decoded.includes('\n\nCarta com quebra real.\nAbraços,'),'quebras reais deixaram de ser preservadas');
  assert(decoded.includes('😄 ❤️ 👍🏽 👨‍👩‍👧‍👦'),'emoji/Unicode foi removido ou transformado');
  assert(results.includes("text.textContent = hasText ? decodedMsg"),'sink visual deixou de usar textContent');
  assert(!/decoded-text[^\n]*innerHTML|text\.innerHTML\s*=\s*decodedMsg/.test(results),'mensagem recuperada alcança innerHTML');
  assert(/\.decoded-text\s*\{[\s\S]*?white-space\s*:\s*pre-wrap/.test(css),'UI deixou de preservar formatação real');
  process.stdout.write('text fidelity OK — literal escapes + real line breaks + hostile markup + emoji survive exact round-trip');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
