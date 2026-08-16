#!/usr/bin/env node
'use strict';

// CHECK 19 helper — producer-to-schema coverage.
// The public allowlist prevents unknown internal fields from escaping. This helper
// protects the opposite failure mode: a legitimate public field being produced but
// silently omitted because the schema was not updated. It is not a full JavaScript
// parser; it combines source gates with a frozen real-report corpus.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
const forensics = fs.readFileSync(path.join(ROOT, 'src', 'forensics.js'), 'utf8');
const decoder = fs.readFileSync(path.join(ROOT, 'src', 'decoder.js'), 'utf8');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const allowStart = main.indexOf('//  PUBLIC REPORT ALLOWLIST');
const allowEndMarker = '// PUBLIC REPORT ALLOWLIST — END';
const allowEnd = main.indexOf(allowEndMarker, allowStart);
assert(allowStart >= 0 && allowEnd > allowStart, 'PUBLIC_REPORT_SCHEMA não encontrado');
const allowBlock = main.slice(allowStart, allowEnd + allowEndMarker.length);
const api = new Function(allowBlock + '\nreturn {PUBLIC_REPORT_SCHEMA, serializePublicModules};')();
const schema = api.PUBLIC_REPORT_SCHEMA;
const serializePublicModules = api.serializePublicModules;

function matchingBrace(src, open) {
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function topObjectKeys(src, open) {
  const end = matchingBrace(src, open);
  assert(end > open, 'objeto literal sem fechamento');
  const body = src.slice(open + 1, end);
  const parts = [];
  let start = 0, curly = 0, square = 0, paren = 0, quote = null, esc = false, line = false, block = false;
  for (let i = 0; i <= body.length; i++) {
    const c = body[i], n = body[i + 1];
    if (i === body.length || (!quote && !line && !block && curly === 0 && square === 0 && paren === 0 && c === ',')) {
      parts.push(body.slice(start, i)); start = i + 1; continue;
    }
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') curly++; else if (c === '}') curly--;
    else if (c === '[') square++; else if (c === ']') square--;
    else if (c === '(') paren++; else if (c === ')') paren--;
  }
  const keys = [], spreads = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (part.startsWith('...')) { spreads.push(part.slice(3).trim()); continue; }
    let m = part.match(/^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/);
    if (m) { keys.push(m[1] || m[2] || m[3]); continue; }
    // Object-literal shorthand: {foo, bar}
    m = part.match(/^([A-Za-z_$][\w$]*)$/);
    if (m) keys.push(m[1]);
  }
  return { keys, spreads, end };
}

function moduleSchema(module) {
  const s = schema[module];
  assert(s !== undefined, `produtor grava report.${module}, mas módulo não existe no PUBLIC_REPORT_SCHEMA`);
  return s;
}

// 1) Every top-level report module written by production code must be known.
for (const src of [forensics, main]) {
  for (const m of src.matchAll(/report\.([A-Za-z_$][\w$]*)\s*=/g)) moduleSchema(m[1]);
}

// Nested writes are deliberately rare. Any new report.X.Y assignment must force a
// conscious schema review instead of silently bypassing the literal-object sweep.
const nestedWrites = [];
for (const [file, src] of [['forensics.js', forensics], ['main.js', main]]) {
  for (const m of src.matchAll(/report\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*=/g)) {
    nestedWrites.push(`${file}:${m[1]}.${m[2]}`);
  }
}
assert(nestedWrites.length === 1 && nestedWrites[0] === 'forensics.js:exif.noExif',
  `nested report writes changed: ${nestedWrites.join(', ') || '(none)'}; review PUBLIC_REPORT_SCHEMA`);

// 2) Objetos literais diretamente atribuídos a report.X: todas as chaves públicas
// atuais precisam estar representadas no schema do módulo.
for (const src of [forensics, main]) {
  const re = /report\.([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const module = m[1];
    const open = src.indexOf('{', m.index);
    const {keys, spreads, end} = topObjectKeys(src, open);
    const ms = moduleSchema(module);
    assert(ms && typeof ms === 'object' && !Array.isArray(ms), `report.${module} não tem schema de objeto`);
    const missing = keys.filter(k => !Object.prototype.hasOwnProperty.call(ms, k));
    assert(missing.length === 0, `report.${module} produz chave(s) fora do schema: ${missing.join(', ')}`);
    for (const spread of spreads) {
      const normalized = spread.replace(/\s+/g, '');
      const allowedStudioSpread = module === 'studio' &&
        (normalized === 'report.studio' || normalized === '(report.studio||{})');
      assert(allowedStudioSpread, `report.${module} usa spread top-level não auditado: ...${spread}`);
    }
    re.lastIndex = end + 1;
  }
}

// Alguns produtores retornam objetos em vez de atribuí-los diretamente a report.
// A lista é pequena e explícita de propósito: se a arquitetura mudar, o check
// falha/é revisado em vez de fingir que é um parser JS completo.
function functionRegion(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert(start >= 0, `produtor ${name} não encontrado`);
  const next = src.indexOf('\nfunction ', start + 10);
  return src.slice(start, next >= 0 ? next : src.length);
}
function returnedObjectKeys(src, name) {
  const region = functionRegion(src, name);
  const out = new Set();
  const re = /return\s*\{/g;
  let m;
  while ((m = re.exec(region))) {
    const open = region.indexOf('{', m.index);
    const got = topObjectKeys(region, open);
    got.keys.forEach(k => out.add(k));
    re.lastIndex = got.end + 1;
  }
  return [...out];
}
const returnProducers = [
  [decoder, 'classifyFormat', 'format'],
  [forensics, 'analyzeJpegDCT', 'jpegDCT'],
  [forensics, 'analyzeDCT', 'dct'],
  [forensics, 'analyzeGradients', 'gradients'],
  [forensics, 'analyzeChrominance', 'chroma'],
  [forensics, 'detectSocialPipeline', 'socialPipeline'],
  [forensics, 'computeOrigin', 'origin'],
];
for (const [src,name,module] of returnProducers) {
  const keys = returnedObjectKeys(src, name);
  assert(keys.length > 0, `${name} não expôs nenhum return {…} para conferir`);
  const ms = moduleSchema(module);
  const missing = keys.filter(k => !Object.prototype.hasOwnProperty.call(ms, k));
  assert(missing.length === 0, `${name} produz ${module}.{${missing.join(', ')}} fora do schema`);
}

// C2PA/EXIF montam um objeto `result` incrementalmente.
function incrementalResultKeys(src, name) {
  const region = functionRegion(src, name);
  const keys = new Set();
  const init = /const\s+result\s*=\s*\{/.exec(region);
  assert(init, `${name}: objeto result inicial não encontrado`);
  const open = region.indexOf('{', init.index);
  topObjectKeys(region, open).keys.forEach(k => keys.add(k));
  for (const m of region.matchAll(/result\.([A-Za-z_$][\w$]*)\s*=/g)) keys.add(m[1]);
  return {region, keys:[...keys]};
}
for (const [name,module] of [['parseC2PA','c2pa'],['parseEXIF','exif']]) {
  const got = incrementalResultKeys(forensics, name);
  const ms = moduleSchema(module);
  const missing = got.keys.filter(k => !Object.prototype.hasOwnProperty.call(ms,k));
  assert(missing.length === 0, `${name} produz ${module}.{${missing.join(', ')}} fora do schema`);
  if (name === 'parseEXIF') {
    const fields = new Set();
    for (const m of got.region.matchAll(/result\.fields\[['"]([^'"]+)['"]\]/g)) fields.add(m[1]);
    for (const m of got.region.matchAll(/\bkey\s*:\s*['"]([^'"]+)['"]/g)) fields.add(m[1]);
    for (const m of got.region.matchAll(/0x[0-9A-Fa-f]+\s*:\s*['"]([^'"]+)['"]/g)) fields.add(m[1]);
    fields.delete('ExifIFD'); fields.delete('GPSIFD');
    const fschema = ms.fields || {};
    const fmissing = [...fields].filter(k => !Object.prototype.hasOwnProperty.call(fschema,k));
    assert(fmissing.length === 0, `parseEXIF produz fields fora do schema: ${fmissing.join(', ')}`);
  }
}

// 3) Corpus congelado: todo caminho-folha que já foi público precisa sobreviver.
function leaves(v, p='', out=[]) {
  if (v === null || ['string','number','boolean'].includes(typeof v)) { out.push(p); return out; }
  if (Array.isArray(v)) {
    if (v.length === 0) { out.push(p + '[]'); return out; }
    for (const item of v) leaves(item, p + '[]', out);
    return out;
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) { out.push(p + '{}'); return out; }
    for (const k of keys) leaves(v[k], p ? `${p}.${k}` : k, out);
  }
  return out;
}
const fixtureDir = path.join(ROOT, 'test', 'fixtures', 'reports');
const fixtures = fs.readdirSync(fixtureDir).filter(f => f.endsWith('.json')).sort();
assert(fixtures.length >= 5, 'corpus público de relatórios pequeno demais');
let checkedLeaves = 0;
for (const file of fixtures) {
  const payload = JSON.parse(fs.readFileSync(path.join(fixtureDir,file), 'utf8'));
  assert(payload.modules && typeof payload.modules === 'object', `${file}: modules ausente`);
  const projected = serializePublicModules(payload.modules);
  const before = new Set(leaves(payload.modules));
  const after = new Set(leaves(projected));
  const lost = [...before].filter(p => !after.has(p));
  assert(lost.length === 0, `${file}: caminho(s) público(s) sumiram na allowlist: ${lost.slice(0,8).join(', ')}`);
  checkedLeaves += before.size;
}

console.log(`CHECK19 OK — ${fixtures.length} reports · ${checkedLeaves} leaf paths · producer gates covered`);
