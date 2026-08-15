#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const hashwasm = require('../src/hash-wasm.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const root = path.join(__dirname, '..');
const fixtureDir = path.join(root, 'test', 'fixtures', 'layered', 'v2.29.0');
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
const tail = new Uint8Array(fs.readFileSync(path.join(fixtureDir, manifest.fixture)));
const nativePayload = new Uint8Array(fs.readFileSync(path.join(fixtureDir, manifest.nativeFixture)));

// Executa as funções REAIS da build modular. O CHECK de injeção literal do
// test.js garante separadamente que estes módulos chegam byte a byte ao HTML.
const code = [
  fs.readFileSync(path.join(root, 'src', 'crypto.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'encoder.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'decoder.js'), 'utf8'),
].join('\n');
const { extractDecoyTail, aesDecryptBytes } = new Function('crypto', 'hashwasm',
  code + '\nreturn { extractDecoyTail, aesDecryptBytes };')(webcrypto, hashwasm);

// Reconstitui somente a cauda de pixels opacos que extractDecoyTail lê. Isso
// mantém o vetor histórico real sem carregar o PNG de 15,97 MB no repositório.
function imageDataFromTail(bytes) {
  const nBits = bytes.length * 8;
  const data = new Uint8ClampedArray(nBits * 4);
  for (let p = 0; p < nBits; p++) data[p * 4 + 3] = 255;
  for (let i = 0; i < nBits; i++) {
    const bit = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
    const px = nBits - 1 - i; // extractDecoyTail lê do último opaco para trás
    data[px * 4 + 2] = bit;
  }
  return { data, width:nBits, height:1 };
}

(async () => {
  // Rota nativa histórica: payload AES-GCM realmente extraído da imagem v2.29.0.
  const nativePlain = await aesDecryptBytes(nativePayload, manifest.validNativePassword);
  const nativeText = new TextDecoder().decode(nativePlain);
  assert(nativeText === manifest.expectedNativeText,
    `senha nativa: esperado "${manifest.expectedNativeText}", veio "${nativeText}"`);
  let nativeWrong = null;
  try { nativeWrong = await aesDecryptBytes(nativePayload, manifest.validAlternativePassword); } catch {}
  assert(nativeWrong === null, 'a senha alternativa decifrou indevidamente o payload nativo');

  // Rota alternativa histórica: bytes da cauda LSB real.
  const id = imageDataFromTail(tail);
  const alt = await extractDecoyTail(id, manifest.validAlternativePassword);
  assert(alt === manifest.expectedAlternativeText,
    `senha alternativa: esperado "${manifest.expectedAlternativeText}", veio "${alt}"`);

  // A outra senha é válida para a MESMA imagem, mas não para esta camada. O
  // extrator da cauda precisa recusar silenciosamente, sem falso positivo.
  const other = await extractDecoyTail(id, manifest.otherValidImagePassword);
  assert(other === null, 'a senha da outra camada foi aceita indevidamente na cauda alternativa');

  const wrong = await extractDecoyTail(id, 'senha-incorreta-de-regressao');
  assert(wrong === null, 'senha incorreta produziu mensagem na camada alternativa');

  process.stdout.write(`v2.29.0: ${manifest.validNativePassword} -> ${nativeText}; ${manifest.validAlternativePassword} -> ${alt}; senhas cruzadas/errada -> rejeitadas`);
})().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
