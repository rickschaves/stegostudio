#!/usr/bin/env node
/*
 * CHECK 76 — O1-S1: compactação segura apenas no artefato de produção.
 * O parser vendorizado identifica comentários JS reais; strings/templates/regex
 * não são tratados por heurística. O teste mede ganho, determinismo e semântica.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { build, MODULE_ORDER, VERSION, compactJsForBuild, compactCssForBuild } = require(path.join(ROOT, 'build.js'));
const acorn = require(path.join(ROOT, 'tools', 'vendor', 'acorn.js'));
function assert(c, m) { if (!c) throw new Error(m); }

assert(acorn.version === '8.15.0', `Acorn vendorizado mudou: ${acorn.version}`);
const license = fs.readFileSync(path.join(ROOT, 'tools', 'vendor', 'acorn.LICENSE'), 'utf8');
assert(/MIT License/.test(license), 'licença do parser vendorizado ausente/incorreta');

const compact = build({ write:false, compact:true });
const verbose = build({ write:false, compact:false });
const compact2 = build({ write:false, compact:true });
const defaultBuild = build({ write:false });
assert(compact === compact2, 'compactação não é determinística em builds consecutivos');
assert(defaultBuild === compact, 'build padrão deixou de usar a compactação de produção');
const compactBytes = Buffer.byteLength(compact, 'utf8');
const verboseBytes = Buffer.byteLength(verbose, 'utf8');
const saved = verboseBytes - compactBytes;
assert(saved > 100000, `compactação economizou só ${saved} B; esperado >100000 B nesta arquitetura`);
assert(compactBytes < verboseBytes, 'artefato compacto não ficou menor que o build de diagnóstico');

// Fontes continuam documentadas: a economia vem apenas da transformação de build.
let rawModuleBytes = 0, compactModuleBytes = 0;
for (const name of MODULE_ORDER) {
  const raw = fs.readFileSync(path.join(ROOT, 'src', name), 'utf8').replace(/\s+$/, '');
  rawModuleBytes += Buffer.byteLength(raw, 'utf8');
  const transformed = compactJsForBuild(raw);
  compactModuleBytes += Buffer.byteLength(transformed, 'utf8');
  assert(transformed.length <= raw.length, `${name}: transformação aumentou o módulo`);
}
assert(rawModuleBytes - compactModuleBytes > 100000,
  'fontes parecem ter sido pré-minificadas ou a remoção de comentários deixou de funcionar');

// Comentários do app saem; banner GPL/autoria permanece.
const scripts = [...compact.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const app = scripts.reduce((a,b) => b.length > a.length ? b : a, '');
const appComments = [];
acorn.parse(app, {ecmaVersion:'latest', sourceType:'script', onComment:appComments});
assert(app.includes(`STEGO·STUDIO v${VERSION} — steganography and image forensics`), 'banner GPL/autoria sumiu');
assert(appComments.length <= 3, `app final ainda carrega ${appComments.length} comentários de desenvolvimento`);
assert(!app.includes('/* ---------- src/'), 'separadores de módulos ainda viajam no runtime');

// Prova semântica contra os casos que tornam regex de comentários perigosa:
// URL, regex com backtick, template multilinha com // e /* */, bloco entre tokens.
const probe = [
  'const url = \"https://example.invalid/a//b\";',
  'const rx = /[\"\'`\/]/;',
  'const tpl = `linha 1',
  '// isto é conteúdo literal',
  '/* isto também é conteúdo literal */',
  '${1 + 2}`;',
  'const joined = 1/* remove-me-block */+2;',
  'const glued = typeof/* token-separator */url;',
  '// remove-me-line',
  "this.__probe = {url, regexBacktick:rx.test('`'), regexSlash:rx.test('/'), tpl, joined, glued};",
].join('\n');
const probeCompact = compactJsForBuild(probe);
assert(!probeCompact.includes('remove-me-block') && !probeCompact.includes('remove-me-line') && !probeCompact.includes('token-separator'),
  'comentário de desenvolvimento sobreviveu no probe');
assert(probeCompact.includes('// isto é conteúdo literal') && probeCompact.includes('/* isto também é conteúdo literal */'),
  'conteúdo comment-like dentro de template foi alterado');
function run(src) { const ctx={}; vm.createContext(ctx); vm.runInContext(src,ctx); return JSON.stringify(ctx.__probe); }
assert(run(probe) === run(probeCompact), 'compactação JS mudou a semântica do probe lexical');

const cssProbe = `.a::before{content:"/* literal */";} /* remove-me-css */\n.b{background-image:url("data:image/svg+xml;utf8,<svg><!--x--></svg>");}`;
const cssCompact = compactCssForBuild(cssProbe);
assert(cssCompact.includes('"/* literal */"'), 'compactação CSS alterou comentário literal dentro de string');
assert(!cssCompact.includes('remove-me-css'), 'comentário CSS real sobreviveu');
assert(cssCompact.includes('<!--x-->'), 'compactação CSS alterou conteúdo de data URI');

console.log(`O1-S1 build compaction OK — ${verboseBytes} B diagnóstico → ${compactBytes} B produção; −${saved} B; Acorn ${acorn.version} vendorizado`);
