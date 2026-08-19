#!/usr/bin/env node
'use strict';
const crypto = require('crypto');
const { build } = require('../build.js');

function assert(cond, msg){ if(!cond) throw new Error(msg); }
function hashBody(s){ return `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`; }
function parsePolicy(raw){
  const out = new Map();
  for(const part of raw.split(';')){
    const bits = part.trim().split(/\s+/).filter(Boolean);
    if(!bits.length) continue;
    const name = bits.shift();
    if(out.has(name)) throw new Error(`diretiva CSP duplicada: ${name}`);
    out.set(name, bits);
  }
  return out;
}
function sameSet(actual, expected){
  return actual.length === expected.length && expected.every(x => actual.includes(x));
}

const html = build({write:false});
const m = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i.exec(html);
assert(m, 'meta CSP ausente do HTML final');
const policy = parsePolicy(m[1]);
const metaPos = m.index;
const firstFetchable = Math.min(...['<link rel="icon"','<script','<style'].map(x=>{
  const i=html.indexOf(x); return i<0?Number.POSITIVE_INFINITY:i;
}));
assert(metaPos < firstFetchable, 'meta CSP precisa preceder recursos/script/style que ela protege');

const exactNone = ['default-src','base-uri','connect-src','form-action','object-src','frame-src','child-src','worker-src','media-src','manifest-src'];
for(const d of exactNone){
  assert(policy.has(d), `diretiva obrigatória ausente: ${d}`);
  assert(sameSet(policy.get(d), ["'none'"]), `${d} precisa ser exatamente 'none'`);
}

assert(policy.has('script-src'), 'script-src ausente');
const scriptSrc = policy.get('script-src');
assert(scriptSrc.includes("'wasm-unsafe-eval'"), 'Argon2/WASM exige wasm-unsafe-eval');
assert(!scriptSrc.includes("'unsafe-eval'"), 'unsafe-eval JS não pode ser liberado');
assert(!scriptSrc.includes("'unsafe-inline'"), 'scripts inline não podem depender de unsafe-inline');
assert(!scriptSrc.some(x => /^https?:|^\*|^data:|^blob:$/.test(x)), 'script-src abriu origem/rede desnecessária');
assert(sameSet(policy.get('script-src-attr') || [], ["'none'"]), 'script-src-attr precisa ser none');

const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert(scripts.length===3, `esperava 3 scripts inline no artefato, achei ${scripts.length}`);
const expectedHashes=scripts.map(hashBody);
const actualHashes=scriptSrc.filter(x=>x.startsWith("'sha256-"));
assert(sameSet(actualHashes, expectedHashes), `hashes de script divergentes: esperado ${expectedHashes.length}, achei ${actualHashes.length}`);

assert(sameSet(policy.get('style-src') || [], ["'unsafe-inline'"]), 'style-src deve refletir a dívida atual de style attrs/CSSOM, sem abrir rede');
assert(sameSet(policy.get('img-src') || [], ["'self'",'data:','blob:']), 'img-src precisa ficar limitado a self/data/blob');
assert(sameSet(policy.get('font-src') || [], ['data:']), 'font-src precisa permitir somente fontes data: embutidas');
assert(!m[1].includes('/*BUILD:CSP*/'), 'marcador BUILD:CSP vazou para o artefato final');
assert(!/https?:\/\//.test(m[1]), 'CSP não deve autorizar host remoto explícito');

console.log(`CSP contract OK — ${policy.size} diretivas, ${actualHashes.length} hashes de script, connect-src none`);
