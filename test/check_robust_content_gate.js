'use strict';

// Contrato de evidência do JPEG robusto.
// `robust:true` sustenta o estado terminal 100/CONFIRMADO, então só pode ser
// publicado depois que o payload interno clássico foi validado e o conteúdo
// final foi realmente recuperado.

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mainSrc = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const terminalSrc = fs.readFileSync(path.join(root, 'src', 'terminal.js'), 'utf8');

function extractFunction(src, name) {
  const start = src.indexOf(`async function ${name}(`) >= 0
    ? src.indexOf(`async function ${name}(`)
    : src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} não encontrada`);
  const brace = src.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let esc = false;
  for (let i = brace; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${name} sem fechamento`);
}

function payload(body, {mode=0, declaredLen=body.length, magic=true, trailing=null}={}) {
  const extra = trailing ? trailing.length : 0;
  const out = new Uint8Array(10 + body.length + extra);
  out.set(magic ? [0x53,0x54,0x45,0x47,0x4F] : [0,1,2,3,4], 0);
  out[5] = mode;
  const n = declaredLen >>> 0;
  out[6]=n&255; out[7]=(n>>>8)&255; out[8]=(n>>>16)&255; out[9]=(n>>>24)&255;
  out.set(body, 10);
  if (trailing) out.set(trailing, 10 + body.length);
  return out;
}

const fnSrc = extractFunction(mainSrc, 'openRobustInnerPayload');
const readableSrc = extractFunction(terminalSrc, 'isReadableText');
const productionReadable = new Function(`${readableSrc}\nreturn isReadableText;`)();

function bodyWithReadability(ratio, total=100) {
  const readable = Math.round(total * ratio);
  const out = new Uint8Array(total);
  for (let i=0;i<readable;i++) out[i] = 65 + (i % 26); // ASCII legível
  out.fill(0x0b, readable); // controle UTF-8 válido, mas não contado como legível
  return out;
}

let inflateCalls = 0;
let inflateMode = 'text';
let readabilityCalls = [];
let decryptMode = 'ok';

const api = new Function(
  'MAGIC','FLAG_COMPRESSED','isAesPayload','aesDecryptBytes','inflateBytes','isReadableText',
  `${fnSrc}\nreturn {openRobustInnerPayload};`
)(
  [0x53,0x54,0x45,0x47,0x4F],
  0x10,
  b => b[0] === 0x02,
  async () => {
    if (decryptMode === 'throw') throw new Error('bad tag');
    if (decryptMode === 'empty') return new Uint8Array(0);
    if (decryptMode === 'compressed-empty') return Uint8Array.from([0x78,0x9c,0x00]);
    return Uint8Array.from([0,1,2,3,4,5]); // binário: GCM, não legibilidade, prova validade
  },
  async () => {
    inflateCalls++;
    if (inflateMode === 'empty') return new Uint8Array(0);
    return new TextEncoder().encode('texto comprimido valido');
  },
  b => { readabilityCalls.push(Array.from(b)); return productionReadable(b); }
);

(async()=>{
  const ascii = new TextEncoder().encode('ASCII OK');

  // Estrutura interna: exatamente o wire de buildPayload, sem vazio/truncamento/trailing.
  if ((await api.openRobustInnerPayload(new Uint8Array(9), '')).state !== 'contentError')
    throw new Error('payload interno curto não falhou fechado');
  if ((await api.openRobustInnerPayload(payload(ascii,{magic:false}), '')).state !== 'contentError')
    throw new Error('MAGIC interno inválido foi aceito');
  if ((await api.openRobustInnerPayload(payload(new Uint8Array(0),{declaredLen:0}), '')).state !== 'contentError')
    throw new Error('len=0 foi aceito');
  if ((await api.openRobustInnerPayload(payload(ascii,{declaredLen:0x80000000}), '')).state !== 'contentError')
    throw new Error('len com bit 31 foi aceito');
  if ((await api.openRobustInnerPayload(payload(ascii,{declaredLen:255}), '')).state !== 'contentError')
    throw new Error('corpo truncado foi aceito');
  if ((await api.openRobustInnerPayload(payload(ascii,{trailing:Uint8Array.from([7,8])}), '')).state !== 'contentError')
    throw new Error('trailing bytes foram aceitos');

  const ok = await api.openRobustInnerPayload(payload(ascii), '');
  if (ok.state !== 'ok' || !ok.plain || new TextDecoder().decode(ok.plain) !== 'ASCII OK')
    throw new Error('texto não-AES legítimo deixou de abrir');

  // O gate de legibilidade precisa rodar DEPOIS do inflate. O corpo comprimido
  // é binário/ilegível; o plaintext devolvido pelo inflate é legível.
  inflateCalls = 0; readabilityCalls = [];
  const compressedBody = Uint8Array.from([0x78,0x9c,0x00,0xff,0x01,0x80]);
  const comp = await api.openRobustInnerPayload(payload(compressedBody,{mode:0x10}), '');
  if (comp.state !== 'ok' || inflateCalls !== 1)
    throw new Error('payload não-AES comprimido legítimo foi demovido');
  if (readabilityCalls.length !== 1 || readabilityCalls[0][0] !== 't'.charCodeAt(0))
    throw new Error('gate de legibilidade não está sobre o plaintext pós-inflate');

  // Não-AES ilegível deve falhar fechado.
  const badText = await api.openRobustInnerPayload(payload(Uint8Array.from([0,1,2,3,4,5])), '');
  if (badText.state !== 'contentError' || badText.plain !== null)
    throw new Error('corpo não-AES ilegível foi promovido a conteúdo recuperado');

  // Prende o limiar de produção pelos dois lados, sem testar o literal 0.7.
  const below = bodyWithReadability(0.65);
  const above = bodyWithReadability(0.75);
  const belowOpen = await api.openRobustInnerPayload(payload(below), '');
  if (belowOpen.state !== 'contentError' || belowOpen.plain !== null)
    throw new Error('corpo com legibilidade 0.65 atravessou o gate');
  const aboveOpen = await api.openRobustInnerPayload(payload(above), '');
  if (aboveOpen.state !== 'ok' || !aboveOpen.plain)
    throw new Error('corpo com legibilidade 0.75 foi rejeitado pelo gate');

  // AES: GCM é a prova; não aplicar gate de texto ao plaintext autenticado.
  const aesBody = Uint8Array.from([0x02,9,8,7,6,5]);
  decryptMode = 'ok'; readabilityCalls = [];
  const aesOk = await api.openRobustInnerPayload(payload(aesBody), 'pw');
  if (aesOk.state !== 'ok' || !aesOk.plain)
    throw new Error('AES autenticado foi rejeitado por legibilidade');
  if (readabilityCalls.length !== 0)
    throw new Error('gate de texto foi aplicado ao ramo AES autenticado');

  // GCM autenticado vazio não é mensagem recuperada: precisa falhar fechado.
  decryptMode = 'empty';
  const aesEmpty = await api.openRobustInnerPayload(payload(aesBody), 'pw');
  if (aesEmpty.state !== 'contentError' || aesEmpty.plain !== null)
    throw new Error('AES autenticado com plaintext vazio foi promovido a conteúdo recuperado');

  // A checagem de vazio precisa estar depois do inflate: cobre também um
  // plaintext autenticado/comprimido que descomprime legitimamente para 0 B.
  decryptMode = 'compressed-empty'; inflateMode = 'empty';
  const aesCompEmpty = await api.openRobustInnerPayload(payload(aesBody,{mode:0x10}), 'pw');
  if (aesCompEmpty.state !== 'contentError' || aesCompEmpty.plain !== null)
    throw new Error('AES comprimido que inflou para vazio foi promovido a conteúdo recuperado');
  inflateMode = 'text';

  decryptMode = 'ok';
  const aesNeeds = await api.openRobustInnerPayload(payload(aesBody), '');
  if (aesNeeds.state !== 'needsKey' || aesNeeds.plain !== null)
    throw new Error('AES sem senha não preservou needsKey');

  decryptMode = 'throw';
  const aesLocked = await api.openRobustInnerPayload(payload(aesBody), 'pw');
  if (aesLocked.state !== 'locked' || aesLocked.plain !== null)
    throw new Error('falha GCM não preservou locked');

  // Catraca dos produtores: só existe um robust:true e ele está no ramo que
  // exige simultaneamente state ok + plaintext final recuperado.
  const trueSites = [...mainSrc.matchAll(/report\.studio\s*=\s*\{\.\.\.report\.studio,\s*robust\s*:\s*true/g)];
  if (trueSites.length !== 1)
    throw new Error(`robust:true tem ${trueSites.length} produtores; esperado 1`);
  if (!/if\s*\(opened\.state\s*===\s*'ok'\s*&&\s*opened\.plain\)\s*\{[\s\S]{0,500}?robust\s*:\s*true/.test(mainSrc))
    throw new Error('robust:true deixou de estar guardado por conteúdo final válido');

  console.log('robust content gate OK — estrutura exata + vazio pós-inflate + limiar + AES + produtor terminal');
})().catch(e=>{ console.error(e.message||e); process.exit(1); });
