#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const hashwasm = require('../src/hash-wasm.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function hex(b) { return Buffer.from(b).toString('hex'); }
function unhex(s) { return new Uint8Array(Buffer.from(s, 'hex')); }
function same(a,b,msg){ assert(hex(a)===String(b).toLowerCase(), `${msg}: ${hex(a)} != ${b}`); }

const root = path.join(__dirname, '..');
const vector = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','v3','vectors.json'),'utf8'));
const code = ['crypto.js','f21.js','encoder.js'].map(f => fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const api = new Function('crypto','hashwasm','t', code + `\nreturn {
  deriveF21Master,deriveF21Keys,f21CtrStreamBytes,f21HeaderTag,f21BuildHeaderCore,
  f21CtrXor,f21EncryptContent,f21ShuffledOrder,f21CreatePacket,f21OpenHeader,
  f21DecryptOpenedBody,f21SampleIndex,F21_DOMAIN_LABELS
};`)(webcrypto, hashwasm, k=>k);

(async()=>{
  const salt=unhex(vector.structuralSalt), iv=unhex(vector.contentIv), plain=unhex(vector.plainUtf8);
  const master=await api.deriveF21Master(vector.password,salt);
  same(master,vector.masterKey,'masterKey Argon2id');
  const keys=await api.deriveF21Keys(master);
  for(const k of ['bodyOrderKey','headerMaskKey','headerAuthKey','contentAesKey']) same(keys[k],vector[k],k);
  const keyHexes=new Set(Object.values(keys).map(hex));
  assert(keyHexes.size===4,'HKDF não separou os quatro domínios');

  const core=api.f21BuildHeaderCore({modeFlags:vector.modeFlags,stcW:vector.stcW,
    bodyLen:plain.length+16,contentIv:iv});
  same(core,vector.headerCore,'headerCore');
  const h=await api.f21HeaderTag(keys.headerAuthKey,salt,core);
  same(h.full,vector.headerHmacFull,'HMAC completo');
  same(h.truncated,vector.headerTag,'HMAC truncado');
  const plainHeader=new Uint8Array([...core,...h.truncated]);
  const masked=await api.f21CtrXor(keys.headerMaskKey,plainHeader);
  same(masked,vector.maskedHeader,'maskedHeader AES-CTR');

  const stream64=await api.f21CtrStreamBytes(keys.bodyOrderKey,64,16);
  same(stream64,vector.bodyOrderStream64,'body-order stream');
  const s5000a=await api.f21CtrStreamBytes(keys.bodyOrderKey,5000,16);
  const s5000b=await api.f21CtrStreamBytes(keys.bodyOrderKey,5000,4096);
  assert(hex(s5000a)===hex(s5000b),'stream AES-CTR depende do chunk interno');

  const perm=await api.f21ShuffledOrder(32,keys.bodyOrderKey,16);
  assert(JSON.stringify(Array.from(perm))===JSON.stringify(vector.permutationN32),'permutação N=32 divergiu');
  const perm2=await api.f21ShuffledOrder(32,keys.bodyOrderKey,4096);
  assert(JSON.stringify(Array.from(perm2))===JSON.stringify(vector.permutationN32),'permutação depende do chunk interno');

  const body=await api.f21EncryptContent(plain,keys.contentAesKey,salt,core,iv);
  same(body,vector.ciphertextTag,'AES-GCM ciphertext+tag');

  // Exercita o envelope de alto nível com os mesmos hooks determinísticos.
  const packet=await api.f21CreatePacket(plain,vector.password,{modeFlags:vector.modeFlags,stcW:0,structuralSalt:salt,contentIv:iv});
  same(packet.maskedHeader,vector.maskedHeader,'packet maskedHeader');
  same(packet.body,vector.ciphertextTag,'packet body');
  const opened=await api.f21OpenHeader(packet.structuralSalt,packet.maskedHeader,vector.password,100000);
  assert(opened && opened.parsed.bodyLen===packet.body.length,'packet não abriu com senha correta');
  const recovered=await api.f21DecryptOpenedBody(packet.body,opened);
  assert(hex(recovered)===hex(plain),'packet não recuperou plaintext');
  const wrong=await api.f21OpenHeader(packet.structuralSalt,packet.maskedHeader,'wrong-password',100000);
  assert(wrong===null,'senha errada autenticou header v3');

  // Rejection sampling dirigido: para m=3, 0xffffffff está fora do maior múltiplo
  // de 3 abaixo de 2^32 e precisa ser descartado antes de aceitar a palavra 1.
  const words=[0xffffffff,1]; let wi=0;
  const sampled=await api.f21SampleIndex(3,async()=>words[wi++]);
  assert(sampled===1 && wi===2,'rejection sampling não descartou palavra acima do limit');

  process.stdout.write('F21 vectors OK — Argon2/HKDF/HMAC/AES-CTR/AES-GCM/permutation match independent Python reference');
})().catch(e=>{ console.error(e.stack||e); process.exit(1); });
