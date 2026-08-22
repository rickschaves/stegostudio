#!/usr/bin/env node
/*
 * CHECK 84 — vetores CONGELADOS do wire P1A (cursor + w-byte STC R2).
 *
 * Por que este check existe, separado do CHECK 83:
 *   O CHECK 83 faz encode → decode dentro da MESMA build. Isso prova que o
 *   encoder e o decoder concordam entre si, e é exatamente por isso que ele
 *   não consegue detectar deriva de wire: se alguém alterar o seed, o jitter
 *   ou a estratificação, os dois lados mudam juntos e o round-trip continua
 *   verde — enquanto toda imagem já escrita para de abrir.
 *
 *   Este check compara a seleção contra valores gerados UMA ÚNICA VEZ na
 *   v2.43.28. Ele é a única coisa no harness que fica vermelha quando o wire
 *   muda sem que ninguém tenha decidido mudá-lo.
 *
 * Lê do HTML FINAL construído, não dos módulos: o contrato que importa é o do
 * artefato que o usuário abre.
 *
 * Se este check ficar vermelho: NÃO regenere o JSON para fazê-lo passar.
 * Ou a mudança de wire foi deliberada — e aí ela precisa de bump de formato,
 * decisão registrada e uma nova família de fixture ao lado da antiga — ou é
 * uma regressão.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { webcrypto } = crypto;
const hashwasm = require('../src/hash-wasm.js');
const ROOT = path.join(__dirname, '..');
const { build } = require(path.join(ROOT, 'build.js'));
function assert(c, m) { if (!c) throw new Error(m); }

const VECTORS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'spread', 'spread_vectors.json'), 'utf8'));

// ── 1. extrai a seleção do HTML final ───────────────────────────────────────
const html = build({ write: false });
const app = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).reduce((a, b) => (b.length > a.length ? b : a), '');

function slice(startMark, endAnchor) {
  const i = app.indexOf(startMark);
  assert(i >= 0, `bloco ausente no HTML final: ${startMark}`);
  const j = app.indexOf(endAnchor, i);
  assert(j > i, `âncora final ausente após ${startMark}`);
  const k = app.indexOf('\n}', j);
  assert(k > j, `fim de função não encontrado após ${startMark}`);
  return app.slice(i, k + 2);
}
const block =
  slice('function mulberry32(', 'return ((t ^ (t >>> 14))') + '\n' +
  slice('function stcSpreadSeed(', 'return s >>> 0;') + '\n' +
  slice('function makeStcSpreadCursor(', 'return out;');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(block + ';this.__seed=stcSpreadSeed;this.__cursor=makeStcSpreadCursor;', ctx);

// ── 2. confronta cada vetor congelado ───────────────────────────────────────
for (const c of VECTORS.cases) {
  const { start, available, count, width, height, stcW, label } = c;
  const seed = ctx.__seed(width, height, start, available, count, stcW) >>> 0;
  assert(seed === c.seed,
    `[${label}] seed do wire mudou: esperado ${c.seed}, obtido ${seed}`);

  const cur = ctx.__cursor(start, available, count, width, height, stcW);
  const pos = new Int32Array(count);
  for (let i = 0; i < count; i++) pos[i] = cur.next();

  // propriedades estruturais que o wire promete, verificadas junto do digest
  assert(pos[0] >= start && pos[count - 1] < start + available,
    `[${label}] carrier fora do pool físico`);
  for (let i = 1; i < count; i++) {
    assert(pos[i] > pos[i - 1], `[${label}] ordem raster quebrada no índice ${i}`);
  }
  let exhausted = false;
  try { cur.next(); } catch (_) { exhausted = true; }
  assert(exhausted, `[${label}] cursor não esgotou após ${count} carriers`);

  for (let i = 0; i < c.first8.length; i++) {
    assert(pos[i] === c.first8[i],
      `[${label}] carrier ${i} mudou: esperado ${c.first8[i]}, obtido ${pos[i]}`);
  }
  for (let i = 0; i < c.last4.length; i++) {
    const k = count - c.last4.length + i;
    assert(pos[k] === c.last4[i],
      `[${label}] carrier ${k} mudou: esperado ${c.last4[i]}, obtido ${pos[k]}`);
  }
  const digest = crypto.createHash('sha256')
    .update(Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength)).digest('hex');
  assert(digest === c.sha256,
    `[${label}] sequência completa divergiu — wire P1A mudou\n` +
    `    esperado ${c.sha256}\n    obtido   ${digest}`);
}

// ── 3. localização congelada do flag: bit 5 do w-byte STC ──────────────────
assert(/const STC_W_FLAG_SPREAD = 0x20;/.test(app), 'STC_W_FLAG_SPREAD deixou de valer 0x20');
assert(/const STC_W_MASK = 0x1F;/.test(app), 'STC_W_MASK deixou de reservar 5 bits para largura');
assert(/const STC_W_RESERVED_MASK = 0xC0;/.test(app), 'bits 6..7 do w-byte deixaram de ser reservados');
assert(!/const FLAG_STC_SPREAD\s*=/.test(app), 'spread voltou a consumir o bit 0x80 do mode byte');

const ctx2 = {};
vm.createContext(ctx2);
const packBlock = slice('function packStcWByte(', "return { stcW, stcSpread:!!(raw & STC_W_FLAG_SPREAD), raw };");
vm.runInContext(`const STC_WMAX=16,STC_W_MASK=0x1F,STC_W_FLAG_SPREAD=0x20,STC_W_RESERVED_MASK=0xC0;\n${packBlock};this.pack=packStcWByte;this.parse=parseStcWByte;`, ctx2);
assert(ctx2.pack(4,false) === 4, 'w-byte sequencial stcW=4 derivou');
assert(ctx2.pack(4,true) === 36, 'w-byte spread stcW=4 precisa ser 0x24');
assert(ctx2.pack(16,true) === 48, 'w-byte spread stcW=16 precisa ser 0x30');
assert(ctx2.parse(36)?.stcW === 4 && ctx2.parse(36)?.stcSpread === true, 'parse 0x24 divergiu');
assert(ctx2.parse(0x44) === null && ctx2.parse(0x84) === null, 'bits reservados do w-byte deixaram de falhar fechado');


// ── 4. fixtures PNG imutáveis do wire R2 ───────────────────────────────────
const FIXDIR = path.join(__dirname, 'fixtures', 'spread');
const manifest = JSON.parse(fs.readFileSync(path.join(FIXDIR, 'manifest.json'), 'utf8'));
function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(FIXDIR, file))).digest('hex');
}
assert(shaFile(manifest.plain.file) === manifest.plain.sha256, 'plain fixture drift');
assert(shaFile(manifest.cover.file) === manifest.cover.sha256, 'cover fixture drift');
for (const [name,c] of Object.entries(manifest.cases)) {
  const raw=fs.readFileSync(path.join(FIXDIR,c.file));
  assert(raw.length===c.bytes, `${name}: fixture byte length drift`);
  assert(shaFile(c.file)===c.sha256, `${name}: fixture SHA drift`);
}

const sourceCode=['crypto.js','f21.js','encoder.js','hill.js','stc.js','decoder.js','png_codec.js']
  .map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',sourceCode+`\nreturn {pngDecodeRGBA,extractLSBStudio,extractLSBStudioV3};`)(webcrypto,hashwasm,k=>k);

(async()=>{
  const plain=fs.readFileSync(path.join(FIXDIR,manifest.plain.file));
  const pRaw=fs.readFileSync(path.join(FIXDIR,manifest.cases.passwordless.file));
  const pDec=await api.pngDecodeRGBA(pRaw);
  const got=api.extractLSBStudio({data:pDec.data,width:pDec.width,height:pDec.height},'');
  assert(got instanceof Uint8Array, 'passwordless R2 fixture deixou de ser reconhecida');
  assert(Buffer.compare(Buffer.from(got),plain)===0, 'passwordless R2 fixture plaintext drift');
  assert(got.stcSpread===true && got.stcW===manifest.stcW, 'passwordless R2 fixture perdeu metadado spread/w');

  const fRaw=fs.readFileSync(path.join(FIXDIR,manifest.cases.f21.file));
  const fDec=await api.pngDecodeRGBA(fRaw);
  const fg=await api.extractLSBStudioV3({data:fDec.data,width:fDec.width,height:fDec.height},manifest.password);
  assert(fg?.headerMatched && fg?.bodyAuthenticated, 'F21 R2 fixture deixou de autenticar');
  assert(fg.stcSpread===true && fg.stcW===manifest.stcW, 'F21 R2 fixture perdeu spread/w autenticado');
  assert(Buffer.compare(Buffer.from(fg.plainBytes),plain)===0, 'F21 R2 fixture plaintext drift');
  const wrong=await api.extractLSBStudioV3({data:fDec.data,width:fDec.width,height:fDec.height},manifest.password+'!');
  assert(wrong===null, 'F21 R2 fixture aceitou senha errada');

  console.log(`P1A wire vectors OK — ${VECTORS.cases.length} vetores de cursor + 2 PNGs imutáveis; ` +
    `spread=bit5 do w-byte, mode 0x80 reservado`);
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
