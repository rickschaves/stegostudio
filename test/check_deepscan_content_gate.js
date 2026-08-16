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

// A random alphanumeric prefix is not a tool signature. Only framing we actually
// recognize may raise a candidate to header-backed generic content.
const fakeHeaderBytes = new Uint8Array(32);
fakeHeaderBytes.set(Buffer.from('AB\0\0\0\0Hello world'));
assert(extractHeader(fakeHeaderBytes, 6) === null, 'arbitrary ASCII prefix is still treated as a tool header');
const knownHeaderBytes = new Uint8Array(32);
knownHeaderBytes.set(Buffer.from('JOI_LSB2\0Hello world'));
assert(extractHeader(knownHeaderBytes, 9) === 'JOI_LSB2', 'recognized JOI_LSB header stopped being identified');

console.log(`deep-scan content gate OK — false candidate suppressed, Threat ${threat.score}, trusted generic paths preserved`);
