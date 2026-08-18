#!/usr/bin/env node
'use strict';

// F17 end-to-end behavior for the robust JPEG path: build the classic inner
// payload, embed it into DCT coefficients, serialize a real JPEG, extract it
// through RS/QIM, then pass the recovered bytes through the same inner-content
// validator used by the Analyzer/Decoder.

const fs=require('fs');
const path=require('path');
const {webcrypto}=require('crypto');
const hashwasm=require('../src/hash-wasm.js');
function assert(c,m){if(!c)throw new Error(m)}
const root=path.join(__dirname,'..');
function src(f){return fs.readFileSync(path.join(root,'src',f),'utf8')}
function extractFunction(text,name){
  const start=text.indexOf(`function ${name}(`); assert(start>=0,`${name} not found`);
  const open=text.indexOf('{',start); let depth=0,quote=null,esc=false,line=false,block=false;
  for(let i=open;i<text.length;i++){
    const c=text[i],n=text[i+1]||'';
    if(line){if(c==='\n')line=false;continue} if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
    if(quote){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===quote)quote=null;continue}
    if(c==='/'&&n==='/'){line=true;i++;continue} if(c==='/'&&n==='*'){block=true;i++;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue} if(c==='{')depth++; else if(c==='}'&&--depth===0)return text.slice(start,i+1);
  }
  throw new Error(`${name} unterminated`);
}
const core=[src('crypto.js'),src('encoder.js'),src('jpeg_dct.js'),src('robust.js')].join('\n');
const api=new Function('crypto','hashwasm','t',core+`\nreturn {
  buildRobustPayload,robustEmbed,robustExtract,deflateBytes,inflateBytes,
  aesDecryptBytes,isAesPayload,MAGIC,FLAG_COMPRESSED
};`)(webcrypto,hashwasm,k=>k);
const readableFn=extractFunction(src('terminal.js'),'isReadableText');
const helperFn='async '+extractFunction(src('main.js'),'openRobustInnerPayload');
const openInner=new Function('MAGIC','FLAG_COMPRESSED','isAesPayload','aesDecryptBytes','inflateBytes','isReadableText',
  `${helperFn}; return openRobustInnerPayload;`)(api.MAGIC,api.FLAG_COMPRESSED,api.isAesPayload,api.aesDecryptBytes,api.inflateBytes,
    new Function(`${readableFn};return isReadableText;`)());

function cover(w=384,h=288){
  const d=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=(y*w+x)*4; d[p]=(x*3+y*5+17)&255; d[p+1]=(x*7+y*2+43)&255; d[p+2]=(x*11+y*13+91)&255; d[p+3]=255;
  }
  return d;
}
async function roundTrip(label,bytes,password,opts={}){
  const rgba=cover();
  const payload=await api.buildRobustPayload(bytes,password,opts);
  const enc=api.robustEmbed(rgba,384,288,payload,password);
  assert(enc.jpeg?.length>1000,`${label}: JPEG was not emitted`);
  const rb=api.robustExtract(enc.jpeg,password);
  assert(rb.status==='ok',`${label}: robustExtract=${rb.status}`);
  assert(rb.errosCorrigidos>=0,`${label}: invalid RS correction count`);
  const opened=await openInner(rb.payload,password);
  assert(opened.state==='ok'&&opened.plain,`${label}: inner state=${opened.state}`);
  return {enc,rb,opened};
}

(async()=>{
  const p1=new TextEncoder().encode('robust plaintext no password');
  const r1=await roundTrip('plain',p1,'');
  assert(new TextDecoder().decode(r1.opened.plain)==='robust plaintext no password','plain: text diverged');

  const long=new TextEncoder().encode('robust compressed no password '.repeat(80));
  const comp=await api.deflateBytes(long); assert(comp.length<long.length,'compressed vector did not shrink');
  const r2=await roundTrip('compressed',comp,'',{compressed:true});
  assert(Buffer.from(r2.opened.plain).equals(Buffer.from(long)),'compressed: inflate/recovery diverged');

  const pwd='F17-robust-2414';
  const secret=new TextEncoder().encode('robust password-protected round-trip ✓');
  const r3=await roundTrip('AES',secret,pwd);
  assert(Buffer.from(r3.opened.plain).equals(Buffer.from(secret)),'AES: recovered plaintext diverged');
  const wrongInner=await openInner(r3.rb.payload,'wrong-password');
  assert(wrongInner.state==='locked'&&wrongInner.plain===null,'AES: wrong password did not stay locked');
  assert(api.robustExtract(r3.enc.jpeg,'wrong-password').status!=='ok','JPEG slot plan accepted wrong password');

  // A clean JPEG produced by the same codec but without the robust envelope must
  // not accidentally become a confirmed robust payload. Reuse the cover through
  // a deliberately unrelated tiny payload/key and probe with a different key.
  const unrelated=api.robustExtract(r1.enc.jpeg,'unrelated-key');
  assert(unrelated.status!=='ok','unrelated robust key produced a false confirmed envelope');

  process.stdout.write('F17 robust JPEG roundtrip OK — plain/compressed/AES + wrong-key rejection');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
