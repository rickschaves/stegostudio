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

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// Versão do artefato final. Convenção: pontos entre números (nunca underscore).
const VERSION = '2.41.0';

// ORDEM DE CONCATENAÇÃO — preserva a ordem-fonte do monolito v2.23.1.
// hill.js e stc.js foram retirados de dentro do span do encoder (span 100%
// definições, sem código top-level), portanto reordená-los é seguro: nenhuma
// função é chamada em tempo de carga; só há referências em runtime.
const MODULE_ORDER = [
  'warnings.js',
  'i18n.js',
  'ui.js',
  'crypto.js',
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

// FONTES OFFLINE — woff2 embutidos como data-URI base64. Só os 5 faces
// realmente usados: reproduz a aparência online exata (300 nunca era usado;
// 500/700 já arredondavam para 400/600 no online). Subset latino.
const FONTS = [
  { family: 'IBM Plex Mono', weight: 400, file: 'ibm-plex-mono-400.woff2' },
  { family: 'IBM Plex Mono', weight: 600, file: 'ibm-plex-mono-600.woff2' },
  { family: 'IBM Plex Sans', weight: 400, file: 'ibm-plex-sans-400.woff2' },
  { family: 'IBM Plex Sans', weight: 600, file: 'ibm-plex-sans-600.woff2' },
  { family: 'Bebas Neue',    weight: 400, file: 'bebas-neue-400.woff2'    },
];

function assembleFonts() {
  const faces = FONTS.map(f => {
    const bin = fs.readFileSync(path.join(SRC, 'fonts', f.file));
    const b64 = bin.toString('base64');
    return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};`
         + `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  });
  return `/* fontes offline embutidas (build.js) */\n${faces.join('\n')}\n`;
}

function assembleApp() {
  // Aviso de copyright exigido pela GPL-3.0, embutido no artefato distribuído:
  // o HTML único É a distribuição, então o aviso precisa viajar dentro dele.
  const banner = `/*\n`
               + ` * STEGO·STUDIO v${VERSION} — esteganografia e análise forense de imagens\n`
               + ` * Copyright (C) 2026 RASC\n`
               + ` *\n`
               + ` * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo\n`
               + ` * sob os termos da GNU General Public License, versão 3, publicada pela\n`
               + ` * Free Software Foundation.\n`
               + ` *\n`
               + ` * Distribuído na esperança de ser útil, mas SEM NENHUMA GARANTIA; sequer a\n`
               + ` * garantia implícita de COMERCIABILIDADE ou ADEQUAÇÃO A UM FIM ESPECÍFICO.\n`
               + ` * Veja a GNU General Public License para mais detalhes, no arquivo\n`
               + ` * LICENSE que acompanha o código ou em gnu.org/licenses/gpl-3.0.html\n`
               + ` *\n`
               + ` * Código-fonte: github.com/rickschaves/stegostudio\n`
               + ` * Desenvolvido com a ajuda da JOI, uma IA.\n`
               + ` */\n`
               + `// ===== build gerado por build.js =====\n`
               + `// Fonte modular em src/. NÃO editar este bloco no HTML final; editar os módulos.\n`;
  const chunks = MODULE_ORDER.map(name => {
    const body = read(path.join(SRC, name)).replace(/\s+$/,'');
    return `\n/* ---------- src/${name} ---------- */\n${body}\n`;
  });
  return banner + chunks.join('\n');
}

function build({ write = true } = {}) {
  let html = read(path.join(__dirname, 'template.html'));
  const css = assembleFonts() + read(path.join(SRC, 'styles.css')).replace(/\s+$/,'');
  const hashwasm = read(path.join(SRC, 'hash-wasm.js')).replace(/\s+$/,'');
  const app = assembleApp();

  // Sanidade dos marcadores — falha ruidosa se o template mudou.
  for (const marker of ['/*BUILD:STYLES*/', '/*BUILD:HASHWASM*/', '/*BUILD:APP*/']) {
    if (html.indexOf(marker) === -1) throw new Error(`Marcador ausente no template: ${marker}`);
    if (html.indexOf(marker) !== html.lastIndexOf(marker)) throw new Error(`Marcador duplicado: ${marker}`);
  }

  // Substituição por FUNÇÃO, nunca por string. Com string, o JS interpreta
  // $$, $&, $`, $' e $<nome> como padrões e os consome em silêncio — o
  // hash-wasm.js tem 3 ocorrências de "$$" (formatador PHC do Argon2) que
  // eram engolidas sem erro nem aviso. A forma de função entrega o texto
  // literal. Ver invariante "injeção literal" em test.js.
  html = html
    .replace('/*BUILD:STYLES*/', () => css)
    .replace('/*BUILD:HASHWASM*/', () => hashwasm)
    .replace('/*BUILD:APP*/', () => app);

  // GARANTIA OFFLINE (asserção dura): nenhuma dependência de rede em runtime.
  // Permitidas apenas URLs de metadado/namespace que o app NUNCA busca:
  // schema.org (JSON-LD), w3.org / ns.adobe.com (namespaces XML),
  // stegostudio.com (canonical/og-image, só crawlers) e o link de crédito npmjs.
  // ⚠️ stegostudio.com é permitido só nas formas EXATAS de metadado (canonical,
  // og:image, JSON-LD). Antes o padrão era solto e casava com QUALQUER subdomínio
  // — foi assim que `api.stegostudio.com`, o backend do antigo Modo Pro, passou
  // pela asserção enquanto o build anunciava "0 dependências de rede".
  const OFFLINE_SAFE = /^https?:\/\/(schema\.org|www\.w3\.org|ns\.adobe\.com|(www\.)?stegostudio\.com|www\.npmjs\.com)([\/#?]|$)/;
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
    console.log(`  ✓ build: dist/${outName}  (${html.length.toLocaleString()} bytes)`);
  }
  return html;
}

if (require.main === module) {
  build({ write: !process.argv.includes('--check') });
}
module.exports = { build, MODULE_ORDER, VERSION };
