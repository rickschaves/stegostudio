#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const hashwasm = require('../src/hash-wasm.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const root = path.join(__dirname, '..');
const code = [
  'crypto.js', 'encoder.js', 'hill.js', 'stc.js', 'decoder.js', 'terminal.js', 'png_codec.js'
].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');

const api = new Function('crypto', 'hashwasm', 't', code + `
return { pngDecodeRGBA, inspectCarrierPreflight };
`)(webcrypto, hashwasm, k => k);

function writeGenericTextLSB(text) {
  const bytes = new TextEncoder().encode(text);
  const bits = bytes.length * 8;
  const w = 96, h = 64;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w*h; p++) {
    data[p*4] = (p*31 + 17) & 255;
    data[p*4+1] = (p*47 + 23) & 255;
    data[p*4+2] = (p*59 + 41) & 255;
    data[p*4+3] = 255;
  }
  for (let i = 0; i < bits; i++) {
    const bit = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
    data[i*4+2] = (data[i*4+2] & 0xFE) | bit;
  }
  return { data, width:w, height:h };
}

(async () => {
  const fixtureDir = path.join(root, 'test', 'fixtures', 'legacy', 'formato-A');
  const load = async name => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(fixtureDir, name)));
    const dec = await api.pngDecodeRGBA(bytes);
    return { data:dec.data, width:dec.width, height:dec.height };
  };

  const cover = api.inspectCarrierPreflight(await load('cover.png'), {cat:'lossless'});
  assert(cover.checked && !cover.suspicious,
    'cover histórico sem payload disparou o Carrier Preflight');

  const plain = api.inspectCarrierPreflight(await load('encoded_plain.png'), {cat:'lossless'});
  assert(plain.suspicious && plain.signals.includes('native-header'),
    'payload nativo visível não foi reconhecido');

  const shuffled = api.inspectCarrierPreflight(await load('encoded_shuffled.png'), {cat:'lossless'});
  assert(shuffled.suspicious && shuffled.signals.includes('native-header'),
    'header nativo visível com corpo embaralhado não foi reconhecido');

  // Header furtivo é deliberadamente indistinguível sem a senha. O preflight
  // não deve fingir que consegue reconhecer essa classe.
  const stealth = api.inspectCarrierPreflight(await load('encoded_stealth.png'), {cat:'lossless'});
  assert(stealth.checked && !stealth.suspicious,
    'preflight alegou reconhecer header furtivo sem senha');

  const generic = api.inspectCarrierPreflight(
    writeGenericTextLSB('old plaintext remnant that should be noticed by preflight'),
    {cat:'lossless'}
  );
  assert(generic.suspicious && generic.signals.includes('readable-lsb-text'),
    'remanência de texto LSB sem header nativo não foi detectada');

  const lossy = api.inspectCarrierPreflight(writeGenericTextLSB('text in pixels'), {cat:'lossy'});
  assert(!lossy.checked && !lossy.suspicious,
    'preflight pixel-LSB foi aplicado como se fosse válido a uma entrada lossy');

  process.stdout.write('Carrier Preflight OK — reference cover without payload does not trigger; visible header + readable LSB remnants trigger; password-concealed stealth is not overclaimed');
})().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
