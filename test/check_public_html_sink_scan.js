#!/usr/bin/env node
'use strict';

// CHECK 28 — structural direct/simple-alias scan for public data inside named renderers.
// Scope is deliberately narrow and honest: this is NOT a JavaScript taint engine.
// It scans the named renderer sources for template interpolations that directly
// reference report/public-item aliases (r/s/sp/it/j), plus simple local aliases
// assigned from sensitive public strings. Each such interpolation must
// either wrap the value at the sink, go through a helper with an independently
// checked escaping contract, or belong to this short inert-value allowlist.
//
// This closes a failure mode of literal-presence checks: one safe route may remain
// while a second raw route of the same field is added elsewhere. New direct-alias
// shapes fail closed until reviewed instead of silently inheriting trust.

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['src/results.js', 'src/warnings.js'];

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function norm(s) { return s.replace(/\s+/g, ''); }

// Expressions intentionally raw after review. Additions need a reason tied to a
// concrete invariant (number/closed enum), not simply "current producer is safe".
const SAFE_RAW = new Map([
  ["s.weight", 'numeric origin-signal weight'],
  ["r.entropy.noiseThreshold", 'numeric threshold'],
  ["r.ai.score", 'numeric classifier score'],
  ["r.ai.score>=70?t('aiLevelHigh'):r.ai.score>=45?t('aiLevelMedium'):r.ai.score>=20?t('aiLevelLow'):t('aiLevelUnlikely')", 'numeric score selects trusted i18n key'],
  ["t('neuralNote').replace('{ent}',r.lsb.neuralEntSim).replace('{hf}',r.lsb.neuralHfSim)", 'numeric neural metrics inserted into trusted i18n text'],
  ["j.acNonZero.toLocaleString()", 'numeric DCT count'],
  ["j.acTotal.toLocaleString()", 'numeric DCT count'],
  ["(j.nonZeroRatio*100).toFixed(1)", 'numeric DCT ratio'],
  ["j.bandLow.toLocaleString()", 'numeric DCT band count'],
  ["j.bandMid.toLocaleString()", 'numeric DCT band count'],
  ["j.bandHigh.toLocaleString()", 'numeric DCT band count'],
]);

// Raw direct concatenation is allowed only for values whose producer contract is numeric.
const SAFE_CONCAT = new Set(['r.studio.payloadBytes','r.strings.appendedBytes','r.entropy.shannon','r.entropy.avgNoise']);

// interpretModule inserts these report values into trusted i18n templates. They are
// numeric/count outputs (or numeric strings) rather than file-controlled prose.
const SAFE_INTERP_REPLACE = new Set([
  'r.lsb.rsRate','r.lsb.wsRate','r.lsb.printableRatio',
  'r.strings.appendedBytes','r.strings.interesting.length','r.strings.count',
  'r.frequency.evenOddBias','r.entropy.shannon','r.entropy.uniqueColors',
  'r.entropy.avgNoise','r.color.uniqueAlpha','r.color.rareClusters',
  'r.studio.payloadBytes'
]);

const DIRECT_ALIAS = /\b(?:r|s|sp|it|j)\s*(?:\?\.|\.)/;

// Scan actual template literals (including nested templates) rather than every
// `${` token in the file. This avoids comment/string false positives and lets the
// alias gate distinguish HTML templates from non-HTML formatting such as
// `"${detectedHeader}"` passed through row().
function htmlInterpolations(src, file) {
  const hits=[];
  const n=src.length;
  const lineAt=i=>src.slice(0,i).split('\n').length;

  function skipQuoted(i,q){
    i++;
    while(i<n){ if(src[i]==='\\'){i+=2;continue;} if(src[i]===q)return i+1; i++; }
    return i;
  }
  function skipLine(i){ const j=src.indexOf('\n',i+2); return j<0?n:j+1; }
  function skipBlock(i){ const j=src.indexOf('*/',i+2); return j<0?n:j+2; }

  function parseTemplate(start){
    let i=start+1, staticText='', local=[];
    while(i<n){
      const c=src[i], nn=src[i+1]||'';
      if(c==='\\'){ staticText+='  '; i+=2; continue; }
      if(c==='`'){
        const htmlLike=/<[^>]*>/.test(staticText);
        for(const h of local) hits.push({...h,htmlLike});
        return i+1;
      }
      if(c==='$'&&nn==='{'){
        const token=i, exprStart=i+2;
        i+=2;
        let depth=1;
        while(i<n&&depth){
          const x=src[i], y=src[i+1]||'';
          if(x==='/'&&y==='/'){i=skipLine(i);continue;}
          if(x==='/'&&y==='*'){i=skipBlock(i);continue;}
          if(x==="'"||x==='"'){i=skipQuoted(i,x);continue;}
          if(x==='`'){i=parseTemplate(i);continue;}
          if(x==='{')depth++;
          else if(x==='}')depth--;
          i++;
        }
        assert(depth===0,`${file}:${lineAt(token)} unterminated template interpolation`);
        local.push({file,line:lineAt(token),expr:src.slice(exprStart,i-1).trim()});
        staticText+='${}';
        continue;
      }
      staticText+=c; i++;
    }
    throw new Error(`${file}:${lineAt(start)} unterminated template literal`);
  }

  let i=0;
  while(i<n){
    const c=src[i], nn=src[i+1]||'';
    if(c==='/'&&nn==='/'){i=skipLine(i);continue;}
    if(c==='/'&&nn==='*'){i=skipBlock(i);continue;}
    if(c==="'"||c==='"'){i=skipQuoted(i,c);continue;}
    if(c==='`'){i=parseTemplate(i);continue;}
    i++;
  }
  return hits.filter(h=>h.htmlLike);
}

// Public string fields whose direct assignment to a local alias deserves the
// same sink review as the original field. This is a one-hop/iterative guard, not
// general taint analysis; it exists specifically to prevent `const n=r.note;
// <div>${n}</div>` from bypassing the direct-alias scanner.
const STRING_SOURCES = [
  /\br\.strings\.note\b/, /\br\.studio\.note\b/, /\br\.lsb\?*\.note\b/,
  /\br\.studio\.headerName\b/, /\br\.lsb\?*\.headerName\b/, /\br\.jpegDCT\.reason\b/,
  /\br\.ai\.formatExt\b/, /\bsp\.platform\b/,
  /\bs\.(?:type|str|level|label|detail)\b/, /\bit\.(?:tool|algoName|modeName|snippet|key|sev|reasonKey|str)\b/
];
function parenEnd(src, open) {
  let depth=0, quote=null, esc=false;
  for(let i=open;i<src.length;i++){
    const c=src[i];
    if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote)quote=null; continue; }
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
    if(c==='(')depth++;
    else if(c===')'&&--depth===0)return i;
  }
  return -1;
}
function insideEscape(src, index){
  let pos=0;
  while((pos=src.indexOf('escapeHTML(',pos))>=0 && pos<index){
    const open=src.indexOf('(',pos), close=parenEnd(src,open);
    if(close>=index)return true;
    pos=open+1;
  }
  return false;
}
function sensitiveOccurrences(rhs, aliases){
  const out=[];
  for(const rx0 of STRING_SOURCES){
    const flags=rx0.flags.includes('g')?rx0.flags:rx0.flags+'g';
    const rx=new RegExp(rx0.source,flags);
    for(const m of rhs.matchAll(rx))out.push({index:m.index,text:m[0]});
  }
  for(const a of aliases){
    const rx=new RegExp(`\\b${a}\\b`,'g');
    for(const m of rhs.matchAll(rx))out.push({index:m.index,text:a});
  }
  return out.sort((a,b)=>a.index-b.index);
}
function stringAliases(src){
  const aliases=new Set();
  let changed=true;
  while(changed){
    changed=false;
    const candidates=[];
    // Declaration aliases, including multiline RHS.
    for(const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);/g))
      candidates.push({name:m[1],rhs:m[2]});
    // Simple re-assignments (`n = r.strings.note;`). Property assignments are
    // intentionally excluded: this is a simple-alias guard, not object taint flow.
    for(const m of src.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*=\s*(?!=)([\s\S]*?);/g))
      candidates.push({name:m[1],rhs:m[2]});
    for(const {name,rhs} of candidates){
      // Track simple value aliases only. Aggregate builders/callbacks are scanned
      // at their inner interpolation sites instead of pretending this is full taint analysis.
      if(/=>|`/.test(rhs) || aliases.has(name))continue;
      const uses=sensitiveOccurrences(rhs,aliases);
      if(!uses.length)continue;
      if(uses.every(u=>insideEscape(rhs,u.index)))continue;
      aliases.add(name);changed=true;
    }
  }
  return aliases;
}

function classify(hit) {
  const compact = norm(hit.expr);
  if (!DIRECT_ALIAS.test(hit.expr)) return {ok:true, why:'no direct public alias'};

  // Whole-expression escaping: do not accept "escapeHTML(x) + rawAlias" merely
  // because the token escapeHTML appears somewhere in the expression.
  if (/^escapeHTML\([\s\S]*\)$/.test(hit.expr.trim())) return {ok:true, why:'escaped at sink'};
  if (/^interpretModule\s*\(/.test(hit.expr)) return {ok:true, why:'interpretModule substitutions audited by CHECK 27'};
  if (/^hl\s*\(/.test(hit.expr)) return {ok:true, why:'hl() escaping contract checked below'};

  const why = SAFE_RAW.get(compact);
  if (why) return {ok:true, why};

  // Two compound guards deliberately inspect a public field to decide whether to
  // emit trusted markup, while the only public string actually emitted is escaped.
  // Count/name checks make an added raw alias fail instead of piggy-backing here.
  const refs = [...hit.expr.matchAll(/\b(?:r|s|sp|it|j)(?:\?\.)?(?:\.[A-Za-z_$][\w$]*)+/g)].map(m=>m[0].replace('?.','.'));
  if (refs.length === 2 && refs.every(x => x === 'r.c2pa.digitalSourceType') &&
      /escapeHTML\(r\.c2pa\.digitalSourceType\)/.test(hit.expr)) {
    return {ok:true, why:'boolean guard + escaped C2PA value'};
  }
  if (refs.length === 2 && refs[0] === 'r.ai.formatCat' && refs[1] === 'r.ai.formatExt' &&
      /escapeHTML\(r\.ai\.formatExt\)/.test(hit.expr)) {
    return {ok:true, why:'format-category guard + escaped extension'};
  }
  return {ok:false, why:'unreviewed raw public alias'};
}

const resultsSrc = fs.readFileSync(path.join(ROOT, 'src/results.js'), 'utf8');
// Helpers trusted by the classifier have their own local contract here rather
// than relying on a name alone.
assert(/const hl\s*=\s*\(lbl,val\)\s*=>[\s\S]{0,500}escapeHTML\(lbl\)[\s\S]{0,300}escapeHTML\(val\)/.test(resultsSrc),
  'hl() no longer escapes both label and file-derived value');

const reviewed = [];
for (const file of FILES) {
  const src = file === 'src/results.js' ? resultsSrc : fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const hit of htmlInterpolations(src, file)) {
    if (!DIRECT_ALIAS.test(hit.expr)) continue;
    const verdict = classify(hit);
    assert(verdict.ok, `${hit.file}:${hit.line}: ${verdict.why}: \${${hit.expr}}`);
    reviewed.push({...hit, why:verdict.why});
  }
}

// Follow simple aliases of high-risk public strings into HTML templates. Known
// sanitized compound aliases are reviewed explicitly; everything else must wrap
// the alias in escapeHTML at the sink.
for (const file of FILES) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const aliases=stringAliases(src);
  for(const hit of htmlInterpolations(src,file)){
    for(const a of aliases){
      if(!new RegExp(`\\b${a}\\b`).test(hit.expr)) continue;
      if(new RegExp(`escapeHTML\\(\\s*${a}\\s*\\)`).test(hit.expr)) continue;
      // reason is a display alias of jpegDCT.reason: the boolean guard is raw,
      // but the only emitted value is escapeHTML(reason).
      if(a==='reason' && /reason\?[^:]*escapeHTML\(reason\)/.test(norm(hit.expr))) continue;
      assert(false,`${file}:${hit.line}: public-string alias ${a} reaches HTML without a reviewed sink: \${${hit.expr}}`);
    }
  }
  // The same alias must not bypass templates through direct string concatenation.
  for(const a of aliases){
    const rxRight=new RegExp(`\\+\\s*${a}\\b`);
    const rxLeft=new RegExp(`\\b${a}\\s*\\+`);
    assert(!rxRight.test(src) && !rxLeft.test(src),`${file}: public-string alias ${a} is concatenated raw into a string`);
  }
}

// Direct string concatenation is another way to bypass a template-only scan.
// Reject public aliases on either side of `+` unless the value is explicitly numeric.
for (const file of FILES) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const concatRx=/(?:(?:((?:r|s|sp|it|j)(?:\?\.)?(?:\.[A-Za-z_$][\w$]*)+)\s*\+)|(?:\+\s*((?:r|s|sp|it|j)(?:\?\.)?(?:\.[A-Za-z_$][\w$]*)+)))/g;
  for (const m of src.matchAll(concatRx)) {
    const expr = (m[1]||m[2]).replace('?.','.');
    assert(SAFE_CONCAT.has(expr), `${file}:${src.slice(0,m.index).split('\n').length}: raw public alias concatenation is not reviewed: ${expr}`);
  }
}

// `interpretModule` deliberately returns HTML-bearing i18n templates. Any report value
// inserted there must be escaped unless it is a reviewed numeric/count field.
const forensicsSrc = fs.readFileSync(path.join(ROOT, 'src/forensics.js'), 'utf8');
const imStart = forensicsSrc.indexOf('function interpretModule(');
const imEnd = forensicsSrc.indexOf('\nfunction ', imStart + 10);
assert(imStart >= 0, 'interpretModule not found for structural scan');
const im = forensicsSrc.slice(imStart, imEnd > imStart ? imEnd : forensicsSrc.length);

function replaceArgs(src) {
  const out=[];
  let pos=0;
  while ((pos=src.indexOf('.replace(',pos))>=0) {
    let i=pos+'.replace('.length, depth=1, quote=null, esc=false, line=false, block=false, comma=-1;
    for (; i<src.length && depth; i++) {
      const c=src[i], n=src[i+1]||'';
      if(line){ if(c==='\n') line=false; continue; }
      if(block){ if(c==='*'&&n==='/'){block=false;i++;} continue; }
      if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote)quote=null; continue; }
      if(c==='/'&&n==='/'){line=true;i++;continue;}
      if(c==='/'&&n==='*'){block=true;i++;continue;}
      if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
      if(c==='(') depth++;
      else if(c===')') depth--;
      else if(c===','&&depth===1&&comma<0) comma=i;
    }
    if(depth!==0||comma<0){ pos+=9; continue; }
    const arg=src.slice(comma+1,i-1).trim();
    out.push({arg,line:src.slice(0,pos).split('\n').length});
    pos=i;
  }
  return out;
}
for (const hit of replaceArgs(im)) {
  if (!/\br\./.test(hit.arg)) continue;
  if (/escapeHTML\s*\(/.test(hit.arg)) continue;
  const refs=[...hit.arg.matchAll(/\br(?:\?\.)?(?:\.[A-Za-z_$][\w$]*)+/g)].map(m=>m[0].replace('?.','.').replace(/\.toLocaleString$/,''));
  for(const ref of refs){
    assert(SAFE_INTERP_REPLACE.has(ref), `src/forensics.js:${forensicsSrc.slice(0,imStart).split('\n').length+hit.line-1}: unescaped report value in interpretModule template replacement: ${ref}`);
  }
}

// Self-tests for the instrument itself. These model the two most dangerous ways
// a positional check can lie: a second raw route, and a compound expression that
// contains one escaped value plus another raw value.
const probes = [
  "const x=`<div>${escapeHTML(r.strings.note||'')}</div><div>${r.strings.note}</div>`;",
  "const y=`<div>${escapeHTML(sp.platform) + r.strings.note}</div>`;"
];
const p1 = htmlInterpolations(probes[0], 'probe1').filter(h => DIRECT_ALIAS.test(h.expr));
assert(p1.length === 2 && classify(p1[0]).ok && !classify(p1[1]).ok,
  'scanner self-test cannot distinguish existing safe route from second raw route');
const p2 = htmlInterpolations(probes[1], 'probe2').filter(h => DIRECT_ALIAS.test(h.expr));
assert(p2.length === 1 && !classify(p2[0]).ok,
  'scanner self-test accepts a compound expression with escaped + raw public data');
const aliasProbe = "const n=r.strings.note; const z=`<div>${n}</div>`;";
const multilineAliasProbe = "const m =\n  r.strings.note; const z=`<div>${m}</div>`;";
const aliasSet=stringAliases(aliasProbe);
const aliasHits=htmlInterpolations(aliasProbe,'alias-probe');
assert(aliasSet.has('n') && aliasHits.some(h=>/\bn\b/.test(h.expr) && !/escapeHTML/.test(h.expr)),
  'scanner self-test cannot see a raw alias route');
const multiAliasSet=stringAliases(multilineAliasProbe);
const multiAliasHits=htmlInterpolations(multilineAliasProbe,'multiline-alias-probe');
assert(multiAliasSet.has('m') && multiAliasHits.some(h=>/\bm\b/.test(h.expr) && !/escapeHTML/.test(h.expr)),
  'scanner self-test misses a multiline raw alias route');
const reassignedAliasProbe = "let q=''; q = r.strings.note; const z=`<div>${q}</div>`;";
const reassignedAliasSet=stringAliases(reassignedAliasProbe);
const reassignedAliasHits=htmlInterpolations(reassignedAliasProbe,'reassigned-alias-probe');
assert(reassignedAliasSet.has('q') && reassignedAliasHits.some(h=>/\bq\b/.test(h.expr) && !/escapeHTML/.test(h.expr)),
  'scanner self-test misses a simple reassignment alias route');
const aliasConcatProbe = "const n=r.strings.note; html += '<div>' + n + '</div>';";
const aliasConcatLeftProbe = "const n=r.strings.note; html += n + '<div></div>';";
assert(/\+\s*n\b/.test(aliasConcatProbe) && /\bn\s*\+/.test(aliasConcatLeftProbe),
  'scanner self-test cannot see raw alias concatenation on both sides of +');
const concatProbe = "html += '<div>' + r.strings.note + '</div>';";
const concatHit = [...concatProbe.matchAll(/\+\s*((?:r|s|sp|it|j)(?:\?\.)?(?:\.[A-Za-z_$][\w$]*)+)/g)].map(m=>m[1].replace('?.','.'));
assert(concatHit.length === 1 && !SAFE_CONCAT.has(concatHit[0]), 'scanner self-test accepts raw public concatenation');

console.log(`public HTML structural sink scan OK — ${reviewed.length} direct public-alias interpolations reviewed; inert allowlist ${SAFE_RAW.size}`);
