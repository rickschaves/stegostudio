#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m);}
const forensics=fs.readFileSync(path.join(ROOT,'src','forensics.js'),'utf8');
const decoder=fs.readFileSync(path.join(ROOT,'src','decoder.js'),'utf8');
const results=fs.readFileSync(path.join(ROOT,'src','results.js'),'utf8');

// Known report values corrected in .29 stay stable and do not regress to PT literals.
assert(forensics.includes("label:'Sensitive keyword'"),'suspicious-string type is not stable English');
for(const bad of ['Palavra-chave sensível','erro na análise DCT','linearização falhou','sem coeficientes AC'])
  assert(!forensics.includes(bad),`Portuguese public-report value returned: ${bad}`);
for(const code of ['analysis-error','decode-failed','linearization-failed','no-ac-coefficients'])
  assert(forensics.includes(`reason:'${code}'`),`DCT reason code missing: ${code}`);

// classifyFormat.msg is part of the public report. Keep this producer free of PT prose.
const start=decoder.indexOf('function classifyFormat('), end=decoder.indexOf('\nfunction ',start+10);
assert(start>=0,'classifyFormat not found');
const block=decoder.slice(start,end>start?end:decoder.length);
const pt=/\b(usa|compressão|destruídos|análise|coeficientes|metadados|paleta|cores|distorcidos|quantização|confiável|formato|disponível)\b/i;
assert(!pt.test(block),`classifyFormat public message contains Portuguese residue: ${block.match(pt)?.[0]}`);

// UI localizes stable DCT reason codes and never renders suspicious file strings as markup.
for(const key of ['jdctReasonAnalysisError','jdctReasonDecodeFailed','jdctReasonLinearizationFailed','jdctReasonNoAC'])
  assert(results.includes(`'${key}'`),`DCT reason localization missing: ${key}`);
assert(results.includes('[${escapeHTML(s.type)}]'),'suspicious string type is not escaped');
assert(results.includes('${escapeHTML(s.str)}</div></div>`'),'suspicious file string is not escaped');

// v2.42.30: notes are text-only today, but their rendering boundary must not rely
// on classifyFormat/MIME keeping {ext} in a closed set forever.
assert(results.includes("${escapeHTML(r.studio?.note||'')}"), 'studio unavailable note is not escaped');
assert(results.includes("${escapeHTML(r.lsb?.note||'')}"), 'LSB unavailable note is not escaped');



// v2.42.31: close the whole family of public-report strings that enter raw HTML
// or an HTML-bearing interpretation template. The producer may be closed today;
// the sink must remain safe if that producer evolves later.
assert(results.includes("${escapeHTML(r.strings.note||'')}"), 'strings note is not escaped');
assert(results.includes('${escapeHTML(d)}</div>`'), 'rare-color detail is not escaped');
assert(/<b>\$\{escapeHTML\(\s*sp\.platform(?:\s*\|\|\s*['\"]{2})?\s*\)\}<\/b>/.test(results), 'social-platform label is not escaped');
assert(results.includes("replace('{ext}',escapeHTML(r.ai.formatExt))"), 'AI format label is not escaped');
assert(forensics.includes("map(s=>escapeHTML(s.type)).join(', ')"), 'string-type list in interpretation is not escaped');
assert(forensics.includes("replace('{hdr}', escapeHTML(hdr))"), 'deep-scan header token is not escaped at the interpretation sink');
assert(results.includes('class="ai-signal ${escapeHTML(s.level)}"'), 'AI signal level is not escaped in its class attribute');
assert(results.includes("s.labelKey ? t(s.labelKey) : escapeHTML(s.label||'')"), 'AI signal fallback label is not escaped');
assert(results.includes("s.detailKey ? t(s.detailKey) : escapeHTML(s.detail||'')"), 'AI signal fallback detail is not escaped');
assert(results.includes("s.labelKey ? t(s.labelKey) : escapeHTML(s.label || '')"), 'origin-signal fallback label is not escaped');
const warnings=fs.readFileSync(path.join(ROOT,'src','warnings.js'),'utf8');
assert(warnings.includes('[${escapeHTML(sevLabel(it.sev))}] ${escapeHTML(t(it.key))}'), 'stegomalware enum/key labels are not escaped at the warning sink');
assert(warnings.includes('${escapeHTML(reason)}</div>') && warnings.includes('${escapeHTML(safe)}\"</div>'), 'adversarial warning reason/text are not escaped at the final sink');

// Execute the production interpretModule body with deliberately hostile values.
// This tests the sink property rather than relying only on source-string presence.
function extractFunction(src,name){
  const start=src.indexOf(`function ${name}(`);
  assert(start>=0,`${name} not found`);
  const open=src.indexOf('{',start);
  let depth=0, quote=null, esc=false, line=false, block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i], n=src[i+1];
    if(line){ if(c==='\n') line=false; continue; }
    if(block){ if(c==='*'&&n==='/'){block=false;i++;} continue; }
    if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote) quote=null; continue; }
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
    if(c==='{') depth++;
    else if(c==='}'&&--depth===0) return src.slice(start,i+1);
  }
  throw new Error(`${name} closing brace not found`);
}
// This local encoder only supplies hostile values to the production function.
// It is NOT the proof that escapeHTML itself is correct: CHECK 12 executes the
// real escapeHTML implementation against the five HTML metacharacters.
const escape = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const templates={
  interpStrInteresting:'types={types}; count={count}',
  interpStudioDeepHeader:'header={hdr}',
  interpStudioDeepNoHeader:'none'
};
const tStub = k => templates[k] || k;
const interpretModule = new Function('t','escapeHTML','computeThreat','resolveProtocolState',
  `${extractFunction(forensics,'interpretModule')}; return interpretModule;`
)(tStub, escape, ()=>({score:0,flags:[]}), ()=>({level:'generic'}));
const evil='<img src=x onerror=alert(1)>';
const strOut=interpretModule('strings',{strings:{appendedData:false,interesting:[{type:evil}],count:1}});
assert(!strOut.includes('<img'), 'hostile string type survived interpretation as markup');
assert(strOut.includes('&lt;img'), 'hostile string type was not escaped by production interpretation');
const hdrOut=interpretModule('studio',{studio:{headerName:evil},lsb:{}});
assert(!hdrOut.includes('<img'), 'hostile header token survived interpretation as markup');
assert(hdrOut.includes('&lt;img'), 'hostile header token was not escaped by production interpretation');

// Language-dependent legacy enums in forensic-report-v2 are compatibility debt;
// do not rewrite them piecemeal without a schema-versioned migration.

// Preserve report compatibility for fields.GPS, but do not show it twice.
assert(forensics.includes("result.fields['GPS'] = 'present'"),'GPS export compatibility token missing');
assert(results.includes("if(k==='GPS') continue"),'GPS generic row is not suppressed');

console.log('public value hygiene OK — public string sinks escaped and interpretation paths exercised');
