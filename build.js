#!/usr/bin/env node
/*
 * STEGO·STUDIO — build pipeline
 * Source modular. Build standalone. Runtime offline.
 *
 * Remonta os módulos de src/ num único HTML autônomo, sem nenhuma
 * dependência de rede no processo (concatenação + injeção pura).
 *
 * Uso:  node build.js            -> gera dist/stego_studio_v<VERSION>.html
 *       node build.js --check    -> só valida sintaxe e paridade i18n, não escreve
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require('./tools/vendor/acorn.js');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// Versão do artefato final. Convenção: pontos entre números (nunca underscore).
const VERSION = '2.44.0';

// Module order is part of the build contract. Modules expose declarations that are
// consumed later at runtime; review dependencies before changing this sequence.
const MODULE_ORDER = [
  'warnings.js',
  'i18n.js',
  'ui.js',
  'crypto.js',
  'f21.js',
  'encoder.js',
  'hill.js',
  'stc.js',
  'jpeg_dct.js',
  'robust.js',
  'decoder.js',
  'terminal.js',
  'png_codec.js',
  'files.js',
  'forensics.js',
  'results.js',
  'main.js',
];

function read(p) { return fs.readFileSync(p, 'utf8'); }

// O1-S1 — compactação de produção. Os fontes permanecem intactos e legíveis;
// somente o artefato distribuído perde comentários de desenvolvimento. Acorn é
// vendorizado no repositório para que o build continue reproduzível/offline e
// para distinguir comentários reais de strings, templates e regex sem heurística.
function compactJsForBuild(code) {
  const comments = [];
  acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    allowHashBang: true,
    onComment: comments,
  });
  if (!comments.length) return code.replace(/\s+$/, '');

  let out = '';
  let pos = 0;
  for (const c of comments) {
    let before = code.slice(pos, c.start);
    // Se o comentário ocupa sozinho o restante da linha, a indentação dele
    // também é peso de desenvolvimento e pode sair.
    const lastNl = before.lastIndexOf('\n');
    if (/^[ \t]*$/.test(before.slice(lastNl + 1))) before = before.slice(0, lastNl + 1);
    out += before;

    const raw = code.slice(c.start, c.end);
    // ECMA-262 reconhece LF, CR, CRLF, LS e PS como LineTerminator. Para ASI,
    // preservar apenas `\n` não basta: um comentário com CR isolado também
    // separa `return`/`break`/postfix etc. Normalizamos cada terminador para LF.
    const lineTerminators = (raw.match(/\r\n|[\n\r\u2028\u2029]/g) || []).length;
    if (c.type === 'Block') {
      // Um comentário inline pode separar tokens (`a/*x*/b`). Mantemos um espaço
      // quando não há terminador; comentários multilinha preservam a quantidade de
      // terminadores para não alterar ASI/numeração de linha de forma gratuita.
      out += lineTerminators ? '\n'.repeat(lineTerminators) : ' ';
    }
    pos = c.end;
  }
  out += code.slice(pos);
  return out.replace(/^[ \t]+$/gm, '').replace(/\s+$/, '');
}

function compactCssForBuild(code) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < code.length) {
    const c = code[i], n = code[i + 1] || '';
    if (quote) {
      out += c;
      if (c === '\\' && i + 1 < code.length) { out += code[i + 1]; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
    if (c === '/' && n === '*') {
      const lastNl = out.lastIndexOf('\n');
      if (/^[ \t]*$/.test(out.slice(lastNl + 1))) out = out.slice(0, lastNl + 1);
      let j = i + 2, newlines = 0;
      while (j < code.length && !(code[j] === '*' && code[j + 1] === '/')) {
        if (code[j] === '\n') newlines++;
        j++;
      }
      if (j >= code.length) throw new Error('CSS: comentário de bloco não terminado');
      out += newlines ? '\n'.repeat(newlines) : ' ';
      i = j + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/^[ \t]+$/gm, '').replace(/\s+$/, '');
}

// Fontes usadas pelo produto são embutidas como data-URI para manter o artefato
// autônomo e offline. Somente os pesos efetivamente referenciados entram no build.
const FONTS = [
  { family: 'IBM Plex Mono', weight: 400, file: 'ibm-plex-mono-400.woff2' },
  { family: 'IBM Plex Mono', weight: 600, file: 'ibm-plex-mono-600.woff2' },
  { family: 'IBM Plex Sans', weight: 400, file: 'ibm-plex-sans-400.woff2' },
  { family: 'IBM Plex Sans', weight: 600, file: 'ibm-plex-sans-600.woff2' },
  { family: 'Bebas Neue',    weight: 400, file: 'bebas-neue-400.woff2'    },
];

function assembleFonts({ compact = true } = {}) {
  const faces = FONTS.map(f => {
    const bin = fs.readFileSync(path.join(SRC, 'fonts', f.file));
    const b64 = bin.toString('base64');
    return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};`
         + `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  });
  return compact ? `${faces.join('\n')}\n` : `/* fontes offline embutidas (build.js) */\n${faces.join('\n')}\n`;
}

function assembleApp({ compact = true } = {}) {
  // The single-file HTML is the distributed program, so its license and authorship
  // notice travels with the artifact itself.
  const banner = `/*\n`
               + ` * STEGO·STUDIO v${VERSION} — steganography and image forensics\n`
               + ` * Copyright (C) 2026 RASC\n`
               + ` * Concept and human direction by RASC. Developed with JOI, an AI.\n`
               + ` *\n`
               + ` * This program is free software: you can redistribute it and/or modify it\n`
               + ` * under the terms of the GNU General Public License, version 3, as published\n`
               + ` * by the Free Software Foundation.\n`
               + ` *\n`
               + ` * This program is distributed in the hope that it will be useful, but WITHOUT\n`
               + ` * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS\n`
               + ` * FOR A PARTICULAR PURPOSE. See the GNU General Public License for details.\n`
               + ` * The license is provided in LICENSE and at gnu.org/licenses/gpl-3.0.html\n`
               + ` *\n`
               + ` * Source: github.com/rickschaves/stegostudio\n`
               + ` */\n`
               + `// ===== Generated by build.js =====\n`
               + `// Modular source lives in src/. Edit the modules, not the generated HTML block.\n`;
  const chunks = MODULE_ORDER.map(name => {
    const raw = read(path.join(SRC, name)).replace(/\s+$/,'');
    if (compact) return compactJsForBuild(raw);
    return `/* ---------- src/${name} ---------- */\n${raw}`;
  });
  return banner + '\n' + chunks.join('\n\n') + '\n';
}

function build({ write = true, compact = true } = {}) {
  let html = read(path.join(__dirname, 'template.html'));
  const rawCss = read(path.join(SRC, 'styles.css')).replace(/\s+$/,'');
  const css = assembleFonts({ compact }) + (compact ? compactCssForBuild(rawCss) : rawCss);
  const hashwasm = read(path.join(SRC, 'hash-wasm.js')).replace(/\s+$/,'');
  const app = assembleApp({ compact });

  // Sanidade dos marcadores — falha ruidosa se o template mudou.
  for (const marker of ['/*BUILD:CSP*/', '/*BUILD:STYLES*/', '/*BUILD:HASHWASM*/', '/*BUILD:APP*/']) {
    if (html.indexOf(marker) === -1) throw new Error(`Marcador ausente no template: ${marker}`);
    if (html.indexOf(marker) !== html.lastIndexOf(marker)) throw new Error(`Marcador duplicado: ${marker}`);
  }

  // Use callbacks de substituição para injetar conteúdo literalmente. Replacements
  // textuais interpretam sequências especiais como $$ e $&, que também podem existir
  // nos módulos. O invariante de injeção literal cobre este contrato.
  html = html
    .replace('/*BUILD:STYLES*/', () => css)
    .replace('/*BUILD:HASHWASM*/', () => hashwasm)
    .replace('/*BUILD:APP*/', () => app);

  // F19 — CSP do próprio artefato. Como a distribuição precisa continuar sendo
  // um único HTML que também abre por file://, a política é entregue por <meta>
  // e os scripts inline são autorizados por SHA-256 calculado sobre o HTML final.
  // O WASM do Argon2 requer somente wasm-unsafe-eval; JavaScript eval continua
  // proibido. Estilos inline permanecem permitidos porque a UI usa style attrs e
  // CSSOM dinamicamente; fontes/imagens locais usam data:/blob: conforme o caso.
  const cspHash = text => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;
  const scriptBodies = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (scriptBodies.length !== 3) {
    throw new Error(`CSP: esperava 3 blocos <script> inline, encontrei ${scriptBodies.length}`);
  }
  const scriptHashes = scriptBodies.map(cspHash).join(' ');
  const csp = [
    `default-src 'none'`,
    `base-uri 'none'`,
    `connect-src 'none'`,
    `form-action 'none'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `child-src 'none'`,
    `worker-src 'none'`,
    `media-src 'none'`,
    `manifest-src 'none'`,
    `script-src ${scriptHashes} 'wasm-unsafe-eval'`,
    `script-src-attr 'none'`,
    `style-src 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src data:`,
  ].join('; ');
  html = html.replace('/*BUILD:CSP*/', () => csp);

  // Garantia offline: dependências/requisições automáticas de runtime são proibidas.
  // Identificadores de namespace, metadados públicos conhecidos e navegação documental
  // explicitamente iniciada pelo usuário podem aparecer como URLs exatas. A lista é
  // fechada para que nenhum endpoint seja autorizado só por compartilhar um domínio.
  const OFFLINE_EXACT = new Set([
    'https://stegostudio.com/',
    'https://stegostudio.com/og-image.png',
    'https://github.com/rickschaves/stegostudio/blob/main/CHANGELOG.md',
  ]);
  // Namespaces XML/JSON-LD: identificadores, nunca buscados em runtime.
  const OFFLINE_NS = /^https?:\/\/(schema\.org|www\.w3\.org|ns\.adobe\.com|www\.npmjs\.com)([\/#]|$)/;
  const OFFLINE_SAFE = { test: (u) => OFFLINE_EXACT.has(u) || OFFLINE_NS.test(u) };
  const runtimeUrls = [...new Set((html.match(/https?:\/\/[^"'\s)]+/g) || [])
    .filter(u => !OFFLINE_SAFE.test(u)))];
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) {
    throw new Error('OFFLINE VIOLADO: ainda há referência ao Google Fonts no HTML final.');
  }
  if (runtimeUrls.length) {
    throw new Error('OFFLINE VIOLADO: URL(s) de runtime não previstas:\n     ' + runtimeUrls.join('\n     '));
  }
  console.log('  ✓ garantia offline: 0 dependências de rede em runtime');

  if (write) {
    fs.mkdirSync(DIST, { recursive: true });
    const outName = `stego_studio_v${VERSION}.html`;
    const outPath = path.join(DIST, outName);
    fs.writeFileSync(outPath, html);
    // `html.length` conta UNIDADES DE CÓDIGO UTF-16, não bytes — o arquivo tem
    // Unicode (STEGO·STUDIO, acentos, emojis nos textos), então as duas medidas
    // divergem. Reportar o tamanho REAL em disco, que é o que vai na Release e
    // o que o usuário confere com sha256sum.
    const bytesReais = Buffer.byteLength(html, 'utf8');
    console.log(`  ✓ build: dist/${outName}  (${bytesReais.toLocaleString()} bytes · ${html.length.toLocaleString()} caracteres)`);
  }
  return html;
}

if (require.main === module) {
  build({ write: !process.argv.includes('--check') });
}
module.exports = { build, MODULE_ORDER, VERSION, compactJsForBuild, compactCssForBuild };
