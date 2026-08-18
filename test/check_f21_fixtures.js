#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cryptoNode=require('crypto');
const {webcrypto}=cryptoNode;
const hashwasm=require('../src/hash-wasm.js');
function assert(c,m){if(!c)throw new Error(m)}
const ROOT=path.join(__dirname,'..'), DIR=path.join(__dirname,'fixtures','v3');
const manifest=JSON.parse(fs.readFileSync(path.join(DIR,'manifest.json'),'utf8'));
const plain=fs.readFileSync(path.join(DIR,manifest.plainFile));
function sha(b){return cryptoNode.createHash('sha256').update(b).digest('hex')}
assert(sha(fs.readFileSync(path.join(DIR,manifest.coverFile)))===manifest.coverSha256,'cover fixture hash drift');
assert(sha(plain)===manifest.plainSha256,'plain fixture hash drift');
const code=['crypto.js','f21.js','encoder.js','hill.js','stc.js','decoder.js','png_codec.js']
 .map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',code+`\nreturn {pngDecodeRGBA,extractLSBStudioV3};`)(webcrypto,hashwasm,k=>k);
(async()=>{
 for(const [name,c] of Object.entries(manifest.cases)){
   const raw=fs.readFileSync(path.join(DIR,c.file));
   assert(raw.length===c.bytes,`${name}: fixture byte length drift`);
   assert(sha(raw)===c.sha256,`${name}: fixture SHA drift`);
   const d=await api.pngDecodeRGBA(raw);
   const got=await api.extractLSBStudioV3({data:d.data,width:d.width,height:d.height},manifest.password);
   assert(got?.headerMatched && got?.bodyAuthenticated,`${name}: fixture no longer authenticates`);
   assert(Buffer.compare(Buffer.from(got.plainBytes),plain)===0,`${name}: fixture plaintext drift`);
   const wrong=await api.extractLSBStudioV3({data:d.data,width:d.width,height:d.height},manifest.password+'!');
   assert(wrong===null,`${name}: wrong password unexpectedly recognizes fixture`);
 }
 process.stdout.write(`F21 fixtures OK — ${Object.keys(manifest.cases).length} immutable PNG fixtures + hashes + wrong-password rejection`);
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
