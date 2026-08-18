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
const resolveProto=extract(rsrc,'resolveProtocolState');
const api=new Function('t','escapeHTML',resolveProto+'\n'+f+'\nreturn {computeThreat};')((k)=>k,(v)=>String(v));

const heuristic={
 format:{cat:'lossless'},
 studio:{},
 strings:{appendedData:true,interesting:[{str:'x'}]},
 stegomalware:[{key:'malwScriptInject',sev:'crit',snippet:'<script>alert(1)</script>'}],
 lsb:{available:true,suspicious:true,foundText:'candidate',headerName:null,printableRatio:'82%',lsbrDetected:true,lsbrStrong:true,rsRate:'31%',neuralSuspect:true},
 frequency:{biasAnomaly:true},
 entropy:{noiseAnomaly:true,highEntropy:true},
 color:{rareSuspicious:true,alphaAnomaly:true},
 c2pa:{}
};
const h=api.computeThreat(heuristic);
assert(h.score===99,`evidência apenas heurística não saturou em 99 (${h.score})`);

for(const [name,studio] of [
 ['native',{nativeExtracted:true}],
 ['robust',{robust:true}],
 ['third-party',{thirdParty:'OutGuess'}]
]){
 const r={format:{cat:'lossy'},studio,strings:{interesting:[]},stegomalware:[]};
 const out=api.computeThreat(r);
 assert(out.score===100,`${name} confirmado não fechou em 100 (${out.score})`);
}
for(const [name,studio] of [
 ['header-only',{nativeHeaderMatched:true}],
 ['robust-locked',{robust:'locked'}],
 ['third-party-partial',{thirdParty:'OutGuess',foreignTruncated:true}],
 ['third-party-identified',{thirdParty:'OpenStego',foreignEncrypted:true}]
]){
 const r={format:{cat:'lossy'},studio,strings:{interesting:[]},stegomalware:[]};
 assert(api.computeThreat(r).score<100,`${name} sem recuperação virou 100`);
}
assert(f.includes('directThreatConfirmed ? 100 : Math.min(score,99)'), 'catraca 100/99 não está explícita em computeThreat');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const i18n=fs.readFileSync(path.join(root,'src','i18n.js'),'utf8');
assert(/0–99 for heuristic suspicion/.test(readme) && /100 is reserved for\s*direct validated recovery/.test(readme),
  'README não documenta explicitamente 0–99 heurístico / 100 confirmado');
assert(i18n.includes('heuristic accumulation is capped at <b>99</b>') && i18n.includes('soma heurística tem teto em <b>99</b>'),
  'ajuda EN/PT não explica o teto heurístico 99');
process.stdout.write('Threat terminal reservation OK — 100 is direct confirmation; heuristic-only evidence caps at 99');
