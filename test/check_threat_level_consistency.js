#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const f=fs.readFileSync(path.join(root,'src','forensics.js'),'utf8');
const rsrc=fs.readFileSync(path.join(root,'src','results.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function extract(text,name){
 const st=text.indexOf(`function ${name}(`);assert(st>=0,`${name} ausente`);const b=text.indexOf('{',st);let d=0,q=null,e=false,ln=false,bl=false;
 for(let i=b;i<text.length;i++){const c=text[i],n=text[i+1]||'';if(ln){if(c==='\n')ln=false;continue}if(bl){if(c==='*'&&n==='/'){bl=false;i++}continue}if(q){if(e){e=false;continue}if(c==='\\'){e=true;continue}if(c===q)q=null;continue}if(c==='/'&&n==='/'){ln=true;i++;continue}if(c==='/'&&n==='*'){bl=true;i++;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return text.slice(st,i+1)}throw new Error(`${name} truncada`);
}
const resolveThird=extract(f,'resolveThirdPartyEvidence');
const compute=extract(f,'computeThreat');
const proto=extract(rsrc,'resolveProtocolState');
const level=extract(rsrc,'resolveThreatLevelKey');
const api=new Function('t','escapeHTML',resolveThird+'\n'+proto+'\n'+compute+'\n'+level+'\nreturn {computeThreat,resolveThreatLevelKey};')((k)=>k,(v)=>String(v));
function report(studio={},extra={}){return {format:{cat:'lossy'},studio,strings:{interesting:[]},stegomalware:[],c2pa:{},...extra};}
for(const [name,studio] of [
 ['native',{nativeExtracted:true}],
 ['framed',{framedExtracted:true}],
 ['robust',{robust:true}],
 ['third-party',{thirdParty:'OutGuess'}]
]){
 const r=report(studio); const out=api.computeThreat(r);
 assert(out.score===100,`${name}: prova direta não fechou score 100`);
 assert(api.resolveThreatLevelKey(r,out.score)==='levelConfirmed',`${name}: score 100 direto não renderiza CONFIRMADO`);
}
for(const [name,studio] of [
 ['header-only',{nativeHeaderMatched:true}],
 ['robust-locked',{robust:'locked'}],
 ['third-party-partial',{thirdParty:'OutGuess',foreignTruncated:true}],
 ['third-party-identified',{thirdParty:'OpenStego',foreignEncrypted:true}]
]){
 const r=report(studio); const out=api.computeThreat(r);
 assert(out.score<100,`${name}: estado não terminal virou 100`);
 assert(api.resolveThreatLevelKey(r,out.score)!=='levelConfirmed',`${name}: estado não terminal renderiza CONFIRMADO`);
}
const heuristic=report({}, {strings:{interesting:[{str:'x'}]},stegomalware:[{key:'x',sev:'crit',snippet:'x'}],lsb:{available:true,suspicious:true,foundText:'candidate',printableRatio:'90%',lsbrDetected:true,lsbrStrong:true,rsRate:'35%'},frequency:{biasAnomaly:true},entropy:{noiseAnomaly:true,highEntropy:true},color:{rareSuspicious:true,alphaAnomaly:true}});
const h=api.computeThreat(heuristic);
assert(h.score===99,'heurística forte não saturou em 99');
assert(api.resolveThreatLevelKey(heuristic,h.score)==='levelHigh','99 heurístico deve renderizar ALTO/HIGH, não CONFIRMADO');
assert(rsrc.includes("tl.textContent=t(resolveThreatLevelKey(r, tScore));"),'renderer não usa a fonte pura do nível de Threat');
process.stdout.write('Threat level consistency OK — score terminal e rótulo CONFIRMADO compartilham as mesmas credenciais');
