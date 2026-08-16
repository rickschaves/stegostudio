'use strict';

// Vetor dirigido para a pista JPEG mais resistente.
// O Encoder normal usa a MESMA senha no plano externo de slots e no AES interno;
// portanto uma senha totalmente errada normalmente nem chega a robustExtract=ok.
// O Analyzer, porém, abre arquivos hostis. Este vetor sintético constrói de propósito
// um envelope robusto válido com senha EXTERNA diferente da senha AES INTERNA e prova:
//   1) o envelope robusto é confirmado com a senha externa;
//   2) essa mesma senha não abre o AES interno;
//   3) a senha interna abre o conteúdo.
// Assim o pipeline precisa preservar a evidência robusta em vez de cair em
// "nada encontrado" quando o conteúdo interno falha.

const fs = require('fs');
const path = require('path');
const crypto = globalThis.crypto || require('crypto').webcrypto;

const root = path.join(__dirname, '..');
const jpegSrc = fs.readFileSync(path.join(root, 'src', 'jpeg_dct.js'), 'utf8');
const robustSrc = fs.readFileSync(path.join(root, 'src', 'robust.js'), 'utf8');
const { robustEmbed, robustExtract } = new Function(
  jpegSrc + '\n' + robustSrc + '\nreturn {robustEmbed, robustExtract};'
)();

async function aesV1Encrypt(bytes, password) {
  const salt = Uint8Array.from({length:16}, (_,i)=>i+1);
  const iv = Uint8Array.from({length:12}, (_,i)=>0xA0+i);
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, bytes));
  const out = new Uint8Array(1+16+12+ct.length);
  out[0]=0x01; out.set(salt,1); out.set(iv,17); out.set(ct,29);
  return out;
}

async function aesV1Decrypt(block, password) {
  const salt=block.slice(1,17), iv=block.slice(17,29), ct=block.slice(29);
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, ct));
}

function buildPayload(body) {
  const out = new Uint8Array(10 + body.length);
  out.set([0x53,0x54,0x45,0x47,0x4F]); // STEGO
  out[5]=0x00; // MODE_B, não comprimido
  const n=body.length;
  out[6]=n&255; out[7]=(n>>8)&255; out[8]=(n>>16)&255; out[9]=(n>>24)&255;
  out.set(body,10);
  return out;
}

(async()=>{
  const W=128,H=128;
  const rgba=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const i=(y*W+x)*4;
    rgba[i]=(x*2+y)&255; rgba[i+1]=(x+y*3)&255; rgba[i+2]=(x*5+y*7)&255; rgba[i+3]=255;
  }

  const outerKey='outer-plan-key';
  const innerKey='inner-aes-key';
  const body=await aesV1Encrypt(new TextEncoder().encode('robust secret'), innerKey);
  const encoded=robustEmbed(rgba,W,H,buildPayload(body),outerKey);
  const rb=robustExtract(encoded.jpeg,outerKey);
  if(rb.status!=='ok') throw new Error(`envelope robusto não confirmou: ${rb.status}`);

  const innerBlock=rb.payload.slice(10);
  let outerRejected=false;
  try { await aesV1Decrypt(innerBlock,outerKey); } catch (_) { outerRejected=true; }
  if(!outerRejected) throw new Error('senha externa abriu indevidamente o AES interno');

  const recovered=new TextDecoder().decode(await aesV1Decrypt(innerBlock,innerKey));
  if(recovered!=='robust secret') throw new Error('senha interna não recuperou o conteúdo');

  console.log('robust hostile envelope: outer confirmado + AES interno rejeitado -> vetor OK');
})().catch(e=>{ console.error(e.message||e); process.exit(1); });
