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

// Preserve report compatibility for fields.GPS, but do not show it twice.
assert(forensics.includes("result.fields['GPS'] = 'present'"),'GPS export compatibility token missing');
assert(results.includes("if(k==='GPS') continue"),'GPS generic row is not suppressed');

console.log('public value hygiene OK — report tokens normalized, DCT reasons localized, suspicious strings escaped');
