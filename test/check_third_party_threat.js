#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const f=fs.readFileSync(path.join(root,'src','forensics.js'),'utf8');
const rsrc=fs.readFileSync(path.join(root,'src','results.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
const dec=fs.readFileSync(path.join(root,'src','decoder.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function extract(text,name){
 const st=text.indexOf(`function ${name}(`);assert(st>=0,`${name} ausente`);const b=text.indexOf('{',st);let d=0,q=null,e=false,ln=false,bl=false;
 for(let i=b;i<text.length;i++){const c=text[i],n=text[i+1]||'';if(ln){if(c==='\n')ln=false;continue}if(bl){if(c==='*'&&n==='/'){bl=false;i++}continue}if(q){if(e){e=false;continue}if(c==='\\'){e=true;continue}if(c===q)q=null;continue}if(c==='/'&&n==='/'){ln=true;i++;continue}if(c==='/'&&n==='*'){bl=true;i++;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return text.slice(st,i+1)}throw new Error(`${name} truncada`);
}
const resolveProto=extract(rsrc,'resolveProtocolState');
const api=new Function('t','escapeHTML',resolveProto+'\n'+f+'\nreturn {computeThreat,resolveThirdPartyEvidence};')((k)=>k,(v)=>String(v));
const base={format:{cat:'lossy'},studio:{},strings:{interesting:[]},stegomalware:[]};
const full=structuredClone(base);full.studio={thirdParty:'OutGuess'};
const a=api.computeThreat(full);
assert(a.score===100,'OutGuess completo não virou prova terminal 100');
assert(a.flags.includes('flagThirdPartyRecovered'),'flag de recuperação externa completa ausente');
assert(api.resolveThirdPartyEvidence(full).level==='recovered','helper não reconhece recuperação externa completa');
const steghide=structuredClone(base);steghide.studio={thirdParty:'Steghide'};
assert(api.computeThreat(steghide).score===100,'Steghide completo não virou prova terminal 100');
const open=structuredClone(base);open.studio={thirdParty:'OpenStego'};
assert(api.computeThreat(open).score===100,'OpenStego completo não virou prova terminal 100');
const enc=structuredClone(base);enc.studio={thirdParty:'OpenStego',foreignEncrypted:true};
assert(api.resolveThirdPartyEvidence(enc).level==='identified','OpenStego cifrado não ficou só identificado');
assert(api.computeThreat(enc).score<100,'identificação sem conteúdo virou CONFIRMADO');
const partial=structuredClone(base);partial.studio={thirdParty:'OutGuess',foreignTruncated:true};
const p=api.computeThreat(partial);
assert(api.resolveThirdPartyEvidence(partial).level==='partial','OutGuess truncado não ficou parcial');
assert(p.score<100 && p.flags.includes('flagThirdPartyPartial'),'extração parcial virou 100 ou perdeu sinal forte');
const threatLevelSrc=extract(rsrc,'resolveThreatLevelKey');
assert(/resolveThirdPartyEvidence\(r\)\.level\s*===\s*['"]recovered['"]/.test(threatLevelSrc),'renderer não usa a mesma regra para o rótulo CONFIRMADO');
assert(/shRes\s*&&\s*shRes\.data instanceof Uint8Array\s*&&\s*shRes\.data\.length>0/.test(main),'Steghide pode publicar thirdParty sem bytes recuperados não vazios');
assert(/osRes\.data instanceof Uint8Array\s*&&\s*osRes\.data\.length>0/.test(main),'OpenStego pode publicar thirdParty sem bytes recuperados não vazios');
assert(/ogRes\s*&&\s*ogRes\.data instanceof Uint8Array\s*&&\s*ogRes\.data\.length>0/.test(main),'OutGuess pode publicar thirdParty sem bytes recuperados não vazios');
assert(/if\(!bytes\|\|bytes\.length===0\) return false;/.test(dec),'OutGuess perdeu o gate explícito contra conteúdo vazio');
process.stdout.write('third-party Threat OK — full direct extraction is terminal proof; encrypted/partial states are not');
