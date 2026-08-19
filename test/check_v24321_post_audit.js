#!/usr/bin/env node
/*
 * CHECK 74 — contrato de acessibilidade, scroll e limites CSP da v2.43.21.
 * Valida no HTML final a região viva do flash e o contrato de scroll vertical
 * da mensagem recuperada; nos docs disponíveis, prende os limites CSP/processo.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { build } = require(path.join(ROOT, 'build.js'));
function assert(c, m) { if (!c) throw new Error(m); }

const html = build({ write: false });
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const app = scripts.reduce((a, b) => (b.length > a.length ? b : a), '');
const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
assert(styleMatch, 'CSS inline não encontrado no HTML final');
const css = styleMatch[1];

// Acessibilidade: nó dedicado, invisível, atômico e persistente no DOM.
assert(/id="dec-key-live"[^>]*class="sr-only"|class="sr-only"[^>]*id="dec-key-live"/.test(html), 'região viva dedicada do aviso de senha ausente');
const liveTag = html.match(/<div[^>]*id="dec-key-live"[^>]*><\/div>/);
assert(liveTag, 'nó #dec-key-live ausente no HTML final');
assert(/role="status"/.test(liveTag[0]) && /aria-live="polite"/.test(liveTag[0]) && /aria-atomic="true"/.test(liveTag[0]), 'região viva não declara status/polite/atomic');

const start = app.indexOf('let keyFlashTimer = null;');
const end = app.indexOf('// Verifica se bytes brutos', start);
assert(start >= 0 && end > start, 'bloco de flash não encontrado no HTML final');
const block = app.slice(start, end);

function makeNode() {
  return {
    classList: { add() {}, remove() {} },
    querySelector: () => makeNode(),
    closest: () => makeNode(),
    textContent: '', value: '', placeholder: ''
  };
}
let liveText = '';
let liveWrites = 0;
const liveNode = {};
Object.defineProperty(liveNode, 'textContent', {
  get() { return liveText; },
  set(v) { liveText = String(v); liveWrites++; }
});
const nodes = new Map([['dec-key-live', liveNode]]);
const getNode = id => {
  if (!nodes.has(id)) nodes.set(id, makeNode());
  return nodes.get(id);
};
const ctx = {
  document: { getElementById: getNode },
  t: k => k,
  clearTimeout() {},
  setTimeout: () => 1
};
vm.createContext(ctx);
vm.runInContext(block + ';this.__flashKey=flashKey;this.__clearKeyFlash=clearKeyFlash;this.__refreshKeyFlashText=refreshKeyFlashText;', ctx);
ctx.__flashKey('jpeg');
assert(liveText === 'decKeyFlashJpegInconclusive' && liveWrites === 1, 'flash JPEG não anuncia uma vez na região viva dedicada');
ctx.__clearKeyFlash();
assert(liveWrites === 1 && liveText === 'decKeyFlashJpegInconclusive', 'expiração/reset não deve escrever na região viva');
ctx.__refreshKeyFlashText();
assert(liveWrites === 1, 'refresh/troca de idioma não deve reanunciar o flash expirado');
ctx.__flashKey('wrong');
assert(liveText === 'decKeyFlashWrong' && liveWrites === 2, 'novo flash deve produzir novo anúncio sem depender do anterior');

// Scroll vertical: a caixa continua limitada/rolável, mas não contém o overscroll Y.
const decodedRule = css.match(/\.decoded-text\s*\{([^}]*)\}/);
assert(decodedRule, 'regra .decoded-text ausente do HTML final');
const rule = decodedRule[1];
assert(/max-height\s*:\s*300px/.test(rule) && /overflow\s*:\s*auto/.test(rule), 'mensagem longa perdeu limite/scroll interno');
assert(/overscroll-behavior-y\s*:\s*auto/.test(rule), 'scroll vertical da mensagem não encadeia para o painel externo');
assert(/overscroll-behavior-x\s*:\s*contain/.test(rule), 'contenção horizontal da mensagem foi removida sem revisão');
assert(/touch-action\s*:\s*pan-y\s+pinch-zoom/.test(rule), 'gesto vertical/pinch não está explicitamente preservado na mensagem recuperada');
assert(!/(^|;)\s*overscroll-behavior\s*:\s*contain\b/.test(rule), 'contain global voltou a bloquear o encadeamento vertical');

// Limites CSP públicos: connect-src não é promessa de sandbox total.
const security = fs.readFileSync(path.join(ROOT, 'SECURITY.md'), 'utf8');
assert(/top-level\s+navigation/i.test(security) && /connect-src `?'none'`? does not govern top-level navigation/i.test(security), 'SECURITY não documenta o canal residual de navegação de topo');

// Instrumentação interna é validada quando existe; checkout público pode omiti-la.
const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').replace(/\r\n/g, '\n');
const auditPath = path.join(ROOT, 'internal', 'RELEASE_SELF_AUDIT.md');
const f19Path = path.join(ROOT, 'internal', 'F19_CSP_MEASUREMENTS.md');
if (fs.existsSync(auditPath)) {
  const audit = fs.readFileSync(auditPath, 'utf8');
  assert(/check específico[\s\S]{0,220}isoladamente/i.test(audit), 'autoauditoria não exige mutation test do check novo isoladamente');
} else {
  assert(/^internal\/$/m.test(gitignore), 'internal/ ausente sem exclusão explícita no checkout público');
}
if (fs.existsSync(f19Path)) {
  const f19 = fs.readFileSync(f19Path, 'utf8');
  assert(f19.includes("securitypolicyviolation") && f19.includes('ERR_FILE_NOT_FOUND') && f19.includes('raiz do sistema'), 'caderno F19 não registra probe positivo + causa real dos favicons em file://');
}

console.log('v2.43.21 post-audit OK — live region sem reset, scroll Y encadeável, limites CSP/processo documentados');
