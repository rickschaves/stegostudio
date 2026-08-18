#!/usr/bin/env node
'use strict';

// F17 behavioral regressions for Analyzer decisions. We intentionally freeze
// semantic outcomes (proof vs indication / suppression), not every heuristic
// score from old reports: passive scores may evolve while terminal evidence
// contracts must not.

const fs=require('fs');
const path=require('path');
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
const resolveFn=extractFunction(src('results.js'),'resolveProtocolState');
const api=new Function('t','escapeHTML',resolveFn+'\n'+src('forensics.js')+'\nreturn {computeThreat,consolidateVerdict,resolveProtocolState};')(
  (k)=>k,(v)=>String(v)
);
function load(rel){return JSON.parse(fs.readFileSync(path.join(root,'test','fixtures','reports',rel),'utf8'))}

// Historical native direct proof remains terminal under current semantics.
const native=load('v2.42.17_f1_main_2414.json').modules;
assert(api.computeThreat(native).score===100,'native recovered fixture is no longer terminal 100');
assert(api.resolveProtocolState(native).level==='extracted','native recovered fixture lost extracted protocol state');

// Historical robust recovery is deliberately reinterpreted by current rules as
// terminal proof, even though its old exported report recorded Threat 40.
const robust=load('v2.42.17_robust_2414.json').modules;
assert(api.computeThreat(robust).score===100,'robust recovered fixture is no longer terminal 100');
assert(api.resolveProtocolState(robust).level==='na','JPEG protocol surface should remain LSB N/A');
const rbLocked=structuredClone(robust); rbLocked.studio.robust='locked';
assert(api.computeThreat(rbLocked).score<100,'robust locked state became terminal 100');
const rbContent=structuredClone(robust); rbContent.studio.robust='content-error';
assert(api.computeThreat(rbContent).score<100,'robust content-error state became terminal 100');

// Wrong-password snapshot must not be upgraded to native proof merely because a
// deep-scan candidate exists.
const wrong=load('stegoscan_stego_encoded_1786583484758_pass_2414__pass_incorrect.json').modules;
assert(api.resolveProtocolState(wrong).level!=='extracted','wrong-password fixture became native extracted');

// Freeze the old bug class: adding an active header match to an existing passive
// header must never LOWER Threat by changing only the wording/precedence level.
const base={format:{cat:'lossless'},studio:{available:true,hasHeader:true},lsb:{available:true}};
const s1=api.computeThreat(structuredClone(base)).score;
const plus=structuredClone(base); plus.studio.nativeHeaderMatched=true;
const s2=api.computeThreat(plus).score;
assert(s2>=s1,`additional header evidence lowered Threat (${s1} -> ${s2})`);

// Strong statistical embedding cannot authenticate a random deep-scan text
// island. Use the historical report that originally exposed this class.
const deep=load('deepscan_strong_embedding_false_text_v2.42.23.json');
const consolidated=api.consolidateVerdict(deep.modules,deep.decodedMsg,deep.decodeStatus,true);
assert(consolidated.decodedMsg===null,'strong statistics promoted a headerless deep-scan candidate');
assert(consolidated.decodeStatus==='verdictEmbeddingNoReliableText','deep-scan suppression lost its explicit embedding-without-text status');

// Protocol state precedence remains proof > header-only > passive > heuristic.
for(const [state,expected] of [
  [{available:true,nativeExtracted:true,nativeHeaderMatched:true,hasHeader:true},'extracted'],
  [{available:true,nativeHeaderMatched:true,hasHeader:true},'headerOnly'],
  [{available:true,hasHeader:true},'passive']
]){
  const r={studio:state,lsb:{}}; assert(api.resolveProtocolState(r).level===expected,`protocol precedence lost ${expected}`);
}

process.stdout.write('F17 Analyzer regressions OK — terminal proof, deep-scan suppression, monotonic evidence, protocol precedence');
