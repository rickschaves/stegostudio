#!/usr/bin/env node
'use strict';

// Round-trip sintético de mensagens em camadas pela portadora real: cria um pequeno RGBA com alguns
// pixels transparentes, embute payload principal furtivo + camada alternativa,
// serializa pelo codec PNG de produção, decodifica e só então tenta as duas senhas. Complementa
// os vetores históricos compactos: aqueles provam retrocompatibilidade de formato;
// este prova opaquePixels(), âncoras início/fim, aritmética de offset e codec PNG.

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const hashwasm = require('../src/hash-wasm.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const root = path.join(__dirname, '..');
const code = [
  'crypto.js', 'hill.js', 'stc.js', 'encoder.js', 'decoder.js', 'png_codec.js'
].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');

const api = new Function('crypto', 'hashwasm', 't', code + `
return { aesEncryptBytes, aesDecryptBytes, buildPayload, embedLSB, embedDecoyTail,
         extractLSBStudio, extractDecoyTail, pngEncodeRGBA, pngDecodeRGBA, MODE_B };
`)(webcrypto, hashwasm, k => k);

(async () => {
  const w = 64, h = 64;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    data[p*4]   = (p * 17 + 11) & 255;
    data[p*4+1] = (p * 29 + 37) & 255;
    data[p*4+2] = (p * 43 + 73) & 255;
    // Transparência deliberada: obriga encode/decode a concordarem sobre opaquePixels().
    data[p*4+3] = (p % 11 === 0) ? 0 : 255;
  }
  const id = { data, width:w, height:h };

  const mainPwd = 'fixture-main-2414';
  const altPwd  = 'fixture-alt-1424';
  const mainText = 'principal synth';
  const altText  = 'alternativa synth';

  const encrypted = await api.aesEncryptBytes(new TextEncoder().encode(mainText), mainPwd);
  const payload = api.buildPayload(encrypted, api.MODE_B);
  api.embedLSB(id, payload, api.MODE_B, mainPwd, false, true, 0);
  await api.embedDecoyTail(id, altText, altPwd, payload.length * 8);

  // O teste cruza a fronteira do codec PNG usado no caminho normal de PNG em produção,
  // em vez de reler o mesmo array alterado. Não simula o fallback canvas de PNG
  // interlaçado/16-bit nem outros formatos; a matriz completa de modos é um teste separado.
  const png = await api.pngEncodeRGBA(w, h, id.data);
  const decodedPng = await api.pngDecodeRGBA(png);
  assert(decodedPng.width === w && decodedPng.height === h, 'round-trip PNG mudou dimensões');
  const reopened = { data:decodedPng.data, width:w, height:h };

  const nativePayload = api.extractLSBStudio(reopened, mainPwd);
  assert(nativePayload && nativePayload.length, 'senha principal não localizou payload nativo após PNG');
  const plain = await api.aesDecryptBytes(nativePayload, mainPwd);
  const recoveredMain = new TextDecoder().decode(plain);
  assert(recoveredMain === mainText, `principal: esperado "${mainText}", veio "${recoveredMain}"`);

  const recoveredAlt = await api.extractDecoyTail(reopened, altPwd);
  assert(recoveredAlt === altText, `alternativa: esperado "${altText}", veio "${recoveredAlt}"`);
  assert(await api.extractDecoyTail(reopened, mainPwd) === null,
    'senha principal foi aceita indevidamente pela camada alternativa');
  assert(api.extractLSBStudio(reopened, altPwd) === null,
    'senha alternativa localizou indevidamente o header furtivo principal');
  assert(await api.extractDecoyTail(reopened, 'fixture-wrong-9999') === null,
    'senha errada produziu mensagem na camada alternativa');

  process.stdout.write('PNG sintético 64x64 · MODE_B furtivo · codec PNG: principal + alternativa + transparência -> round-trip OK');
})().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
