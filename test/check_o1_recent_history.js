#!/usr/bin/env node
'use strict';

// CHECK 75 — O1-S2: the standalone app carries only the ten most recent public
// releases and delegates the complete public history to the canonical GitHub
// CHANGELOG through an explicit user-initiated navigation link.

const fs = require('fs');
const path = require('path');
const { build, VERSION } = require('../build.js');
function assert(c,m){ if(!c) throw new Error(m); }

const root = path.join(__dirname,'..');
const ui = fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
const i18n = fs.readFileSync(path.join(root,'src','i18n.js'),'utf8');
const css = fs.readFileSync(path.join(root,'src','styles.css'),'utf8');
const md = fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8');
const html = build({write:false});
const FULL_URL = 'https://github.com/rickschaves/stegostudio/blob/main/CHANGELOG.md';

const uiStart = ui.indexOf('const CHANGELOG = [');
const uiEnd = ui.indexOf('function renderChangelog()', uiStart);
assert(uiStart >= 0 && uiEnd > uiStart, 'janela local de Version History não encontrada');
const historyBlock = ui.slice(uiStart, uiEnd);
const local = [...historyBlock.matchAll(/ver:'v([^']+)',\s*date:'([^']+)'/g)].map(m=>({ver:m[1],date:m[2]}));
const completeCount = (md.match(/^## v/gm) || []).length;
const complete = [...md.matchAll(/^## v([^\n]+?)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/gm)]
  .map(m=>({ver:m[1],date:m[2]})).slice(0,10);

assert(completeCount > 10, `CHANGELOG.md completo parece truncado (${completeCount} versões)`);
assert(local.length === 10, `HTML deve carregar exatamente 10 releases públicas, encontrou ${local.length}`);
assert(JSON.stringify(local) === JSON.stringify(complete),
  `janela local não corresponde às 10 releases/datas mais recentes do CHANGELOG.md: ${local.map(x=>x.ver+'@'+x.date).join(', ')}`);
const internalO1=local.map(x=>x.ver).filter(v=>/^2\.43\.(?:2[2-9]|3[01])(?:$|_)/.test(v));
assert(internalO1.length===0, `marco(s) laboratorial(is) O1 não deve(m) aparecer no histórico público local: ${internalO1.join(', ')}`);
assert(!ui.includes('CHANGELOG_LEGACY'), 'bulk legado voltou ao runtime');
assert(!i18n.includes('clLegacyDivider'), 'copy do antigo divisor Legacy voltou ao runtime');

assert((ui.match(new RegExp(FULL_URL.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length === 1,
  'link canônico do histórico completo deve existir exatamente uma vez no módulo UI');
assert(ui.includes('target="_blank"') && ui.includes('rel="noopener noreferrer"'),
  'link externo do histórico precisa abrir isolado com noopener/noreferrer');
assert(i18n.includes('clFullHistory: "View full version history on GitHub"') &&
       i18n.includes('clFullHistory: "Ver histórico completo no GitHub"'),
  'rótulo EN/PT do histórico completo ausente');
assert(i18n.includes('clFullHistoryOnline: "requires internet connection"') &&
       i18n.includes('clFullHistoryOnline: "requer conexão com a internet"'),
  'indicação EN/PT de conexão ausente');
assert(css.includes('.cl-full-history-link') && css.includes('.cl-full-history-note'),
  'estilo do rodapé de histórico completo ausente');

// The exact URL is allowed in the built artifact only as explicit navigation;
// no other github.com address is allowed to creep into runtime markup/scripts.
const githubUrls = [...new Set(html.match(/https?:\/\/github\.com\/[^"'\s)]+/g) || [])];
assert(githubUrls.length === 1 && githubUrls[0] === FULL_URL,
  `URL(s) GitHub inesperadas no HTML: ${githubUrls.join(', ')}`);
assert(html.includes(`href="${FULL_URL}"`), 'link canônico não sobreviveu ao build final');

console.log(`O1-S2 recent history OK — 10/${completeCount} releases locais; bulk legado fora do runtime; link completo explícito`);
