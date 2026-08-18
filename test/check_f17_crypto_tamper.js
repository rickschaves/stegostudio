#!/usr/bin/env node
'use strict';

// F17 behavioral crypto gate. Executes the production AES-GCM/Argon2id path and
// proves that current writes round-trip while wrong credentials and independent
// mutations of authenticated fields fail closed. This complements the F21
// structural-auth tests by exercising the content cipher directly.

const fs=require('fs');
const path=require('path');
const {webcrypto}=require('crypto');
const hashwasm=require('../src/hash-wasm.js');
function assert(c,m){if(!c)throw new Error(m)}
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'src','crypto.js'),'utf8');
const api=new Function('crypto','hashwasm',code+`\nreturn {
  aesEncryptBytes,aesDecryptBytes,isAesPayload,deflateBytes,inflateBytes,
  decoyGcmEncrypt,decoyGcmDecrypt
};`)(webcrypto,hashwasm);

async function mustReject(label,fn){
  let rejected=false;try{await fn()}catch{rejected=true}
  assert(rejected,`${label}: authenticated mutation was accepted`);
}
function flipCopy(a,i){const b=new Uint8Array(a);b[i]^=0x01;return b}

(async()=>{
  const password='F17-crypto-2414';
  const wrong='F17-wrong-9999';
  const plain=new TextEncoder().encode('authenticated payload — português ✓ / 🔐');
  const enc=await api.aesEncryptBytes(plain,password);
  assert(enc[0]===0x02,'current AES write is not Argon2id wire 0x02');
  assert(api.isAesPayload(enc)===true,'current AES payload not recognized');
  const got=await api.aesDecryptBytes(enc,password);
  assert(Buffer.from(got).equals(Buffer.from(plain)),'AES correct-password round-trip diverged');
  await mustReject('wrong password',()=>api.aesDecryptBytes(enc,wrong));
  await mustReject('salt mutation',()=>api.aesDecryptBytes(flipCopy(enc,1),password));
  await mustReject('IV mutation',()=>api.aesDecryptBytes(flipCopy(enc,17),password));
  await mustReject('ciphertext/tag mutation',()=>api.aesDecryptBytes(flipCopy(enc,enc.length-1),password));

  const longPlain=new TextEncoder().encode('compress before encrypt '.repeat(160));
  const comp=await api.deflateBytes(longPlain);
  assert(comp.length<longPlain.length,'compression vector did not shrink');
  const compEnc=await api.aesEncryptBytes(comp,password);
  const compGot=await api.inflateBytes(await api.aesDecryptBytes(compEnc,password));
  assert(Buffer.from(compGot).equals(Buffer.from(longPlain)),'compress→AES→inflate round-trip diverged');

  // F1 anchor cipher: correct key validates, wrong/tampered blocks become null
  // rather than throwing or producing bytes.
  const decoy=await api.decoyGcmEncrypt(plain,'F17-alt-1424');
  const decoyOk=await api.decoyGcmDecrypt(decoy,'F17-alt-1424');
  assert(Buffer.from(decoyOk).equals(Buffer.from(plain)),'decoy GCM correct key diverged');
  assert(await api.decoyGcmDecrypt(decoy,'wrong')===null,'decoy GCM wrong key did not fail closed');
  assert(await api.decoyGcmDecrypt(flipCopy(decoy,decoy.length-1),'F17-alt-1424')===null,
    'decoy GCM tamper did not fail closed');

  process.stdout.write('F17 crypto/tamper OK — current AES + compression + F1 GCM fail closed');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
