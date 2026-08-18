#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','src','files.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
const m=/function getEncNormalizedMessage\(id\)\s*\{[\s\S]*?\n\}/.exec(src);
assert(m,'helper getEncNormalizedMessage ausente');
const values={
  'enc-msg':'\n  ABC\nDEF  \n',
  'enc-decoy-msg':'  ISCA  '
};
const ctx={document:{getElementById:(id)=>({value:values[id]||''})}};
vm.createContext(ctx); vm.runInContext(m[0],ctx);
assert(ctx.getEncNormalizedMessage('enc-msg')==='ABC\nDEF','normalização da mensagem real divergiu do encode');
assert(ctx.getEncNormalizedMessage('enc-decoy-msg')==='ISCA','normalização da isca divergiu do encode');
for(const needle of [
  "const realChars = getEncNormalizedMessage('enc-msg').length;",
  "const decoyChars = decoyOn ? getEncNormalizedMessage('enc-decoy-msg').length : 0;",
  "const hasImg=encID&&encFormatOk, hasMsg=getEncNormalizedMessage('enc-msg').length>0;",
  "const msg=getEncNormalizedMessage('enc-msg');",
  "const decoyMsg = getEncNormalizedMessage('enc-decoy-msg');"
]) assert(src.includes(needle), 'medidor/gate/encode não usam a mesma representação: '+needle);
assert(!src.includes("document.getElementById('enc-msg').value.trim()"), 'rota paralela de trim da mensagem real reapareceu');
console.log('encoder count consistency OK — meter/gate/stats/encode share normalized text');
