#!/usr/bin/env node
'use strict';

// F21 integration boundary: legacy remains the cheap first probe, v3 is only
// attempted actively with a password, and passive Analyzer semantics never turn
// the absence of a recognizable v3 header into negative steganography evidence.

const fs=require('fs'), path=require('path');
const {build}=require('../build.js');
function assert(c,m){if(!c)throw new Error(m)}

function extractFunction(src,name){
  const start=src.indexOf(`function ${name}(`); assert(start>=0,`${name} not found`);
  const open=src.indexOf('{',start); let depth=0, quote=null, esc=false, line=false, block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i],n=src[i+1]||'';
    if(line){if(c==='\n')line=false;continue}
    if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
    if(quote){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===quote)quote=null;continue}
    if(c==='/'&&n==='/'){line=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue}
    if(c==='{')depth++; else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error(`${name} unterminated`);
}

const ROOT=path.join(__dirname,'..');
const html=build({write:false});
const main=fs.readFileSync(path.join(ROOT,'src','main.js'),'utf8');
const files=fs.readFileSync(path.join(ROOT,'src','files.js'),'utf8');
const forensics=fs.readFileSync(path.join(ROOT,'src','forensics.js'),'utf8');

// Dispatch order / scope. This intentionally freezes architecture, not exact
// line formatting: legacy probe first, active v3 only with a non-empty password.
const legacyPos=main.indexOf('let studioPayload=extractLSBStudio(runID,key)');
const v3Pos=main.indexOf('extractLSBStudioV3(runID,key)');
assert(legacyPos>=0 && v3Pos>legacyPos,'v3 decode no longer follows the cheap legacy probe');
const between=main.slice(legacyPos,v3Pos);
assert(/if\s*\(\s*!studioPayload\s*&&\s*key\.length\s*>\s*0\s*\)/.test(between),
  'v3 decode can be attempted without a password or before legacy exclusion');
assert(!forensics.includes('extractLSBStudioV3(') && !forensics.includes('deriveF21Master('),
  'passive Analyzer started running password-derived F21 recognition');
assert(/if\s*\(cipher\)\s*\{[\s\S]*?f21CreatePacket/.test(files) && /else\s*\{[\s\S]*?buildPayload/.test(files),
  'protected/no-password encode routes no longer remain separated');

// Public Analyzer semantics: absence of a passive header must be neutral. The
// same structural evidence gets the same Threat with hasHeader=false or absent.
const t=k=>k;
const protoSrc=extractFunction(html,'resolveProtocolState');
const threatSrc=extractFunction(html,'computeThreat');
const resolveProtocolState=new Function('t',`${protoSrc}; return resolveProtocolState;`)(t);
const computeThreat=new Function('t','resolveProtocolState',`${threatSrc}; return computeThreat;`)(t,resolveProtocolState);
function base(){return {
  format:{cat:'lossless'}, strings:{appendedData:false}, studio:{available:true,hasHeader:false},
  lsb:{available:true,lsbrDetected:true,lsbrStrong:true,rsRate:'31.0',wsRate:'0',wsReliable:true,
       suspicious:true,foundText:false,printableRatio:'0'},
  stegomalware:[], c2pa:{manifestDetected:false}, color:{}, entropy:{}, dct:{}, gradients:{}, chroma:{}, exif:{}
}}
const a=base(), b=base(); delete b.studio.hasHeader;
const ta=computeThreat(a), tb=computeThreat(b);
assert(ta.score===tb.score,`missing passive header changed Threat (${ta.score} vs ${tb.score})`);
assert(JSON.stringify(ta.flags)===JSON.stringify(tb.flags),'missing passive header changed Threat flags');
assert(resolveProtocolState(a).level==='embedded','structural evidence was downgraded because passive header is absent');

// Header presence may add evidence; absence itself may not subtract it.
const c=base(); c.studio.hasHeader=true;
const tc=computeThreat(c);
assert(tc.score>=ta.score,'recognized header unexpectedly lowers Threat');

// Public copy must explicitly avoid an invisibility promise and tell the user
// that password-protected payloads may not expose a recognizable passive header.
const i18n=fs.readFileSync(path.join(ROOT,'src','i18n.js'),'utf8');
assert(/may expose no recognizable Studio header to a passive scan/.test(i18n),'EN passive-v3 limitation missing');
assert(/podem não expor um cabeçalho reconhecível numa análise passiva/.test(i18n),'PT passive-v3 limitation missing');
assert(/not a promise of invisibility/.test(i18n) && /não é promessa de invisibilidade/.test(i18n),
  'F21 copy regressed into an invisibility claim');

process.stdout.write(`F21 integration OK — legacy-first/password-active dispatch + passive-header absence neutral (Threat ${ta.score})`);
