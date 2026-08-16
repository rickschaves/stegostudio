#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const I18N = path.join(ROOT, 'src', 'i18n.js');
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const source = fs.readFileSync(I18N, 'utf8');

function objectRange(lang) {
  const m = new RegExp(lang + '\\s*:\\s*\\{').exec(source);
  assert(m, `i18n block not found: ${lang}`);
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < source.length) {
    const c = source[i++];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  assert(depth === 0, `unterminated i18n block: ${lang}`);
  return [m.index, i];
}

function keysIn(lang) {
  const [a,b] = objectRange(lang);
  return [...source.slice(a,b).matchAll(/^\s{4,6}(\w+)\s*:/gm)].map(m => m[1]);
}

const en = keysIn('en');
const pt = new Set(keysIn('pt'));
assert(en.length === pt.size && en.every(k => pt.has(k)), 'EN/PT key parity is not exact');

const [ea,eb] = objectRange('en');
const [pa,pb] = objectRange('pt');
let corpus = source.slice(0,ea) + source.slice(eb,pa) + source.slice(pb);

function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    if (ent.name === 'internal' || ent.name === 'HTML_PRODUCAO' || ent.name === 'dist') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { walk(p); continue; }
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (rel === 'src/i18n.js' || rel === 'src/hash-wasm.js' || rel === 'ASSETS_BASE64.md' ||
        rel === 'test/check_i18n_orphans.js') continue;
    if (!/\.(js|html|css|md)$/.test(ent.name)) continue;
    corpus += '\n' + fs.readFileSync(p, 'utf8');
  }
}
walk(ROOT);

const orphans = en.filter(k => !corpus.includes(k));
const baseline = new Set([]);
const unexpected = orphans.filter(k => !baseline.has(k));
assert(unexpected.length === 0, `new orphan i18n key(s): ${unexpected.join(', ')}`);

// The baseline may only shrink. If a key is intentionally restored to use it simply
// disappears from `orphans`; if it is deleted, it disappears from both dictionaries.
const stillBaseline = orphans.filter(k => baseline.has(k));
process.stdout.write(`i18n orphan gate OK — ${stillBaseline.length}/${baseline.size} legacy orphan keys remain; no new orphan keys`);
