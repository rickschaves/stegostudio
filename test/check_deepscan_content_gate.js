#!/usr/bin/env node
'use strict';

// Regression for v2.42.24: structural evidence can establish that LSB embedding
// likely occurred, but cannot authenticate an arbitrary printable island as the
// embedded message. The fixture reproduces a real v2.42.23 false positive where
// ciphertext happened to contain a short readable-looking sequence.

const fs = require('fs');
const path = require('path');
const { build } = require('../build.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} not found`);
  const open = src.indexOf('{', start);
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1] || '';
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
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is unterminated`);
}

const html = build({ write:false });
const t = k => k;
const cvSrc = extractFunction(html, 'consolidateVerdict');
const protoSrc = extractFunction(html, 'resolveProtocolState');
const threatSrc = extractFunction(html, 'computeThreat');
const extractHeaderSrc = extractFunction(html, 'extractHeader');
const consolidateVerdict = new Function('t', `${cvSrc}; return consolidateVerdict;`)(t);
const resolveProtocolState = new Function('t', `${protoSrc}; return resolveProtocolState;`)(t);
const computeThreat = new Function('t','resolveProtocolState', `${threatSrc}; return computeThreat;`)(t, resolveProtocolState);
const extractHeader = new Function(`${extractHeaderSrc}; return extractHeader;`)();

const fixturePath = path.join(__dirname, 'fixtures', 'reports', 'deepscan_strong_embedding_false_text_v2.42.23.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const r = fixture.modules;
assert(fixture.decodedMsg === 'JFR:4kӀe;GF5', 'fixture no longer preserves the historical false-positive candidate');
assert(r.lsb?.headerName === null && r.studio?.hasHeader === false, 'fixture unexpectedly gained a trusted header');
assert(r.lsb?.lsbrDetected === true && parseFloat(r.lsb?.rsRate) >= 25, 'fixture no longer carries strong structural LSB evidence');

const fixed = consolidateVerdict(r, fixture.decodedMsg, fixture.decodeStatus, true);
assert(fixed.decodedMsg === null, `strong statistics promoted unvalidated text again: ${JSON.stringify(fixed.decodedMsg)}`);
assert(fixed.decodeStatus === 'verdictEmbeddingNoReliableText', `wrong status for embedding-without-content: ${fixed.decodeStatus}`);

const proto = resolveProtocolState(r);
assert(proto.level === 'embedded', `unvalidated text is still presented as protocol '${proto.level}' instead of embedding evidence`);

const threat = computeThreat(r);
assert(threat.score >= 45, `structural embedding evidence was lost while suppressing text (${threat.score})`);
assert(threat.flags.includes('flagLSBR'), 'LSB Replacement evidence disappeared from Threat');

// A recognized third-party header remains independent evidence that the text
// candidate belongs to a structured payload; this path must stay recoverable.
const trusted = JSON.parse(JSON.stringify(r));
trusted.lsb.headerName = 'JOI_LSB2';
trusted.studio.headerName = 'JOI_LSB2';
trusted.lsb.foundText = 'Hello from a header-framed LSB payload.';
trusted.lsb.printableRatio = '38.0%';
const trustedVerdict = consolidateVerdict(trusted, trusted.lsb.foundText, 'deepInvestText', true);
assert(trustedVerdict.decodedMsg === trusted.lsb.foundText, 'recognized third-party header text was suppressed');
assert(resolveProtocolState(trusted).level === 'generic', 'recognized third-party header no longer resolves as generic protocol');

// Headerless data can still be considered readable when the extraction itself is
// overwhelmingly printable; the regression only removes statistics-as-authentication.
const highPrintable = JSON.parse(JSON.stringify(r));
highPrintable.lsb.foundText = 'This extraction is overwhelmingly readable text.';
highPrintable.lsb.printableRatio = '91.0%';
const hpVerdict = consolidateVerdict(highPrintable, highPrintable.lsb.foundText, 'deepInvestText', true);
assert(hpVerdict.decodedMsg === highPrintable.lsb.foundText, 'high-printability deep-scan text was suppressed unexpectedly');
assert(resolveProtocolState(highPrintable).level === 'generic', 'high-printability deep-scan text no longer resolves as generic');

// Header recognition is an evidence contract, not just an implementation detail.
// Freeze the *current semantic vocabulary* independently of the production regex:
// JOI_LSB with zero/one decimal suffix, plus STEGO/LSB/STEG, case-insensitive.
// F9 may deliberately expand this contract later, but such a change must turn this
// gate red and force an explicit review instead of silently promoting new prefixes.
function headerBytes(name) {
  const out = new Uint8Array(Math.max(64, name.length + 16));
  out.set(Buffer.from(name + '\0Hello world'));
  return out;
}
function expectedHeader(name) {
  const u=String(name).toUpperCase();
  return u==='STEGO' || u==='LSB' || u==='STEG' || /^JOI_LSB\d?$/.test(u);
}
const knownHeaders = ['JOI_LSB', ...Array.from({length:10},(_,i)=>`JOI_LSB${i}`), 'STEGO', 'LSB', 'STEG'];
for (const name of [...knownHeaders, ...knownHeaders.map(x=>x.toLowerCase())]) {
  assert(extractHeader(headerBytes(name), name.length + 1) === name,
    `recognized header ${name} stopped being identified`);
}

// Near-miss corpus: forms a future broadening is likely to admit accidentally.
const negativeHeaders = new Set([
  'RANDOMHDR','ABCD1','XY_9','THISISALONGPREFIX','A1B2','ZZZ',
  'JOI_LSBX','JOI_LSB10','JOI_LSB_2','JOI_LS','JOI2',
  'STEGO2','STEGOX','STEG2','STEGX','LSB2','LSBX'
]);
for (const base of knownHeaders) {
  const variants=[`X${base}`,`${base}X`,`${base}_`,`${base}00`,base.slice(0,-1),base+base.slice(-1)];
  for(const v of variants) if(v && !expectedHeader(v)) negativeHeaders.add(v);
}
// Deterministic fuzz corpus over the only characters the parser currently admits.
// This is test data, not a claim that the parser must stay restricted to this alphabet.
let seed=0x5EED1234;
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
function rnd(){ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed; }
for(let n=0;n<512;n++){
  const len=1+(rnd()%20); let v='';
  for(let i=0;i<len;i++)v+=alphabet[rnd()%alphabet.length];
  if(!expectedHeader(v))negativeHeaders.add(v);
}
for (const name of negativeHeaders) {
  assert(extractHeader(headerBytes(name), name.length + 1) === null,
    `unknown prefix ${name} gained protocol trust`);
}

console.log(`deep-scan content gate OK — false candidate suppressed, Threat ${threat.score}, trusted generic paths preserved`);
