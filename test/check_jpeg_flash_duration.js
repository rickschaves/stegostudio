#!/usr/bin/env node
/*
 * CHECK 73 — contrato comportamental do aviso de senha JPEG.
 * Mede o timer no HTML final em vez de casar a formatação do fonte e exige que
 * o estado inconclusivo continue alcançável pelo portão JPEG de produção.
 */
'use strict';
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { build } = require(path.join(ROOT, 'build.js'));
function assert(c, m) { if (!c) throw new Error(m); }

const html = build({ write: false });
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert(scripts.length >= 1, 'scripts inline não encontrados no HTML final');
const app = scripts.reduce((a, b) => (b.length > a.length ? b : a), '');

const start = app.indexOf('let keyFlashTimer = null;');
const end = app.indexOf('function printable(bytes)', start);
assert(start >= 0 && end > start, 'bloco de flash de senha não encontrado no HTML final');
const block = app.slice(start, end);

function makeNode() {
  return {
    classList: { add() {}, remove() {} },
    querySelector: () => makeNode(),
    closest: () => makeNode(),
    textContent: '', value: '', placeholder: ''
  };
}
const nodes = new Map();
const getNode = id => {
  if (!nodes.has(id)) nodes.set(id, makeNode());
  return nodes.get(id);
};
const seen = [];
const ctx = {
  document: { getElementById: getNode },
  t: k => k,
  clearTimeout() {},
  setTimeout: (fn, ms) => { seen.push(ms); return 1; }
};
vm.createContext(ctx);
vm.runInContext(block + ';this.__flashKey=flashKey;', ctx);

const ms = reason => {
  seen.length = 0;
  ctx.__flashKey(reason);
  assert(seen.length === 1, `flashKey('${reason}') deveria agendar exatamente um timer`);
  return seen[0];
};

assert(ms('jpeg') === 8000, `aviso inconclusivo de JPEG deveria durar 8000 ms`);
for (const r of ['wrong', 'missing', undefined, 'reason-desconhecida']) {
  assert(ms(r) === 5000, `flash '${r}' deveria permanecer em 5000 ms`);
}

const jpegGate = /else\s+if\s*\(\s*fmt\?\.ext\s*===\s*['"]JPEG['"]\s*\)\s*\{[\s\S]{0,1200}?jpegKeyFeedback[\s\S]{0,800}?jpegKeyFeedback\s*===\s*['"]inconclusive['"][\s\S]{0,180}?flashKey\(\s*['"]jpeg['"]\s*\)/;
assert(jpegGate.test(app), "portão de produção não liga o veredito 'inconclusive' do JPEG a flashKey('jpeg')");

console.log('JPEG flash duration OK — medido no HTML final: jpeg=8000 ms; demais=5000 ms; portão alcançável');
