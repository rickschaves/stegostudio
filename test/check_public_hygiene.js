#!/usr/bin/env node
'use strict';

/*
 * CHECK 20 — public-source hygiene.
 *
 * Public comments are code-adjacent documentation. They may explain invariants,
 * compatibility, format details and non-obvious implementation choices, but they
 * must not carry personal information or the maintainers' private workflow/history.
 * This gate checks those classes mechanically and also inspects the generated
 * artifact banner, which is public prose even though build.js stores it as strings.
 */

const fs = require('fs');
const path = require('path');
const { build, VERSION } = require('../build.js');
const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      if (rel === 'internal' || rel.startsWith('internal/') ||
          rel === 'HTML_PRODUCAO' || rel.startsWith('HTML_PRODUCAO/') ||
          rel === 'dist' || rel.startsWith('dist/')) continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function codeComments(text) {
  const out = [];
  let i = 0, line = 1, state = 'code', quote = '', start = 1, buf = '';
  while (i < text.length) {
    const c = text[i], n = text[i + 1] || '';
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; start = line; buf = ''; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'block'; start = line; buf = ''; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { state = 'string'; quote = c; i++; continue; }
      if (c === '\n') line++;
      i++;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') { out.push({ line: start, text: buf }); state = 'code'; line++; i++; continue; }
      buf += c; i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { out.push({ line: start, text: buf }); state = 'code'; i += 2; continue; }
      if (c === '\n') line++;
      buf += c; i++; continue;
    }
    if (state === 'string') {
      if (c === '\\') { if (n === '\n') line++; i += 2; continue; }
      if (c === quote) { state = 'code'; quote = ''; i++; continue; }
      if (c === '\n') line++;
      i++;
    }
  }
  if (state === 'line') out.push({ line: start, text: buf });
  return out;
}

function htmlComments(text) {
  const out = [];
  const re = /<!--[\s\S]*?-->/g;
  let m;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ line, text: m[0].slice(4, -3) });
  }
  return out;
}

const forbiddenCommentPatterns = [
  [/\bRick\b/i, 'personal name in public source comment'],
  [/dalt[oô]n/i, 'health information'],
  [/\bsmoke\b/i, 'release-process history'],
  [/\b(?:auditor(?:ia)?|parecer externo|revis[aã]o externa)\b/i, 'review-process history'],
  [/\broadmap\b/i, 'planning-process marker'],
  [/\bhandoff\b|passagem de bast[aã]o/i, 'handoff-process marker'],
  [/\b(?:fatia|frente)\s+F?\d+/i, 'private work-slice label'],
  [/\bop[cç][aã]o\s+[ABC]\b/i, 'private option label'],
  [/\b(?:erro meu|eu errei|reportado pelo|relatado pelo)\b/i, 'development-diary attribution'],
  [/\b(?:o|a)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}.-]+\s+(?:relatou|reportou|observou|é)\b/iu, 'named personal attribution'],
  [/\b[A-Z][a-z]+\s+(?:reported|noticed|observed)\b/, 'named personal attribution']
];

const publicDocPatterns = [
  [/dalt[oô]n/i, 'health information'],
  [/\bsmoke\b/i, 'release-process history'],
  [/\b(?:parecer externo|revis[aã]o externa)\b/i, 'review-process history'],
  [/\broadmap\b/i, 'planning-process marker'],
  [/\bhandoff\b|passagem de bast[aã]o/i, 'handoff-process marker'],
  [/\b(?:o|a)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}.-]+\s+(?:relatou|reportou|observou|é)\b/iu, 'named personal attribution']
];

const failures = [];
let scannedComments = 0, scannedDocs = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'src/hash-wasm.js' || rel === 'ASSETS_BASE64.md') continue;
  const ext = path.extname(file).toLowerCase();
  if (!['.js', '.css', '.html', '.md'].includes(ext)) continue;
  const text = fs.readFileSync(file, 'utf8');

  if (['.js', '.css', '.html'].includes(ext)) {
    const comments = codeComments(text).concat(ext === '.html' ? htmlComments(text) : []);
    scannedComments += comments.length;
    for (const c of comments) {
      for (const [re, why] of forbiddenCommentPatterns) {
        if (re.test(c.text)) failures.push(`${rel}:${c.line}: ${why}`);
      }
    }
  }

  if (ext === '.md') {
    scannedDocs++;
    for (const [re, why] of publicDocPatterns) {
      if (re.test(text)) failures.push(`${rel}: ${why}`);
    }
  }
}

// The generated banner is a public surface stored as string literals in build.js,
// so comment-only source scanning would otherwise miss accidental editorial changes.
const html = build({ write: false });
const bannerMatch = html.match(/\/\*\n \* STEGO·STUDIO v[\s\S]*?\n \*\/\n\/\/ ===== Generated by build\.js =====/);
assert(bannerMatch, 'generated public banner not found');
const banner = bannerMatch[0];
assert(banner.includes(`STEGO·STUDIO v${VERSION}`), 'generated banner version is stale');
assert(banner.includes('Concept and human direction by RASC. Developed with JOI, an AI.'),
  'public artifact no longer discloses JOI as an AI');
assert(banner.includes('Source: github.com/rickschaves/stegostudio'), 'generated banner source line missing');
assert(!/(Este programa|Distribu[ií]do|Veja a GNU|Fonte modular|build gerado)/i.test(banner),
  'generated banner contains stale Portuguese/mixed-language maintenance prose');
assert(html.includes('Concept and human direction by RASC. Developed with JOI, an AI.'), 'visible/public artifact attribution to JOI as AI is missing');
const i18nSource = fs.readFileSync(path.join(ROOT, 'src', 'i18n.js'), 'utf8');
assert(i18nSource.includes('footerCredit: "Idealização e direção humana por RASC. Desenvolvido com JOI, uma IA."'),
  'Portuguese footer attribution no longer identifies JOI as an AI');

for (const [re, why] of forbiddenCommentPatterns) {
  if (re.test(banner)) failures.push(`generated banner: ${why}`);
}

if (failures.length) {
  console.error('CHECK20 FAIL — public-source hygiene');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`CHECK20 OK — ${scannedComments} public code comments + ${scannedDocs} public docs + generated banner checked`);
