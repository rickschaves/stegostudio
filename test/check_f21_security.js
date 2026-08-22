#!/usr/bin/env node
'use strict';

const fs=require('fs'), path=require('path');
const {webcrypto}=require('crypto');
const baseHashwasm=require('../src/hash-wasm.js');
function assert(c,m){if(!c)throw new Error(m)}
function clone(b){return new Uint8Array(b)}
const root=path.join(__dirname,'..');
const f21Src=fs.readFileSync(path.join(root,'src','f21.js'),'utf8');
const code=['crypto.js','f21.js','encoder.js','hill.js'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
let argonCalls=0;
const hashwasm={...baseHashwasm,argon2id:async o=>{argonCalls++;return baseHashwasm.argon2id(o)}};
const api=new Function('crypto','hashwasm','t',code+`\nreturn {
 deriveF21Master,deriveF21Keys,f21CreatePacket,f21OpenHeader,f21VerifyHeaderWithKeys,
 f21HeaderTag,f21CtrXor,f21BuildHeaderCore,f21DecryptOpenedBody,f21BytesEqual,
 f21UsedOpaquePixels,hillCostMap,F21_PREFIX_BITS,F21_PREFIX_CARRIER_PIXELS,MODE_B,MODE_RGB,FLAG_SHUFFLED,
 FLAG_STEALTH,FLAG_COMPRESSED,FLAG_STC,FLAG_ADAPTIVE,FLAG_HILLV2
};`)(webcrypto,hashwasm,k=>k);

function fixed(n,seed){const a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=(seed+i*23)&255;return a}

(async()=>{
  // Ratchet estrutural: o resultado `null` sozinho não prova auth-before-parse,
  // porque parse/validate antecipados podem chegar ao mesmo resultado observável.
  // A ordem é parte do protocolo: bytes autenticados primeiro; só então LEN/flags.
  const verifyStart=f21Src.indexOf('async function f21VerifyHeaderWithKeys');
  const verifyEnd=f21Src.indexOf('async function f21OpenHeader',verifyStart);
  const verifyBlock=f21Src.slice(verifyStart,verifyEnd);
  const authPos=verifyBlock.indexOf('if (!f21BytesEqual(receivedTag, expected.truncated)) return null;');
  const parsePos=verifyBlock.indexOf('const parsed = f21ParseHeaderCore(headerCore);');
  const validatePos=verifyBlock.indexOf('f21ValidateParsedHeader(parsed, opaqueCount)');
  assert(authPos>=0 && parsePos>authPos && validatePos>parsePos,
    'header passou a interpretar/validar LEN ou flags antes da HMAC');

  const pwd='F21-security-2414', salt=fixed(16,9), iv=fixed(12,71);
  const flags=api.MODE_B|api.FLAG_SHUFFLED|api.FLAG_STEALTH;
  const plain=new TextEncoder().encode('security vector');

  argonCalls=0;
  const packet=await api.f21CreatePacket(plain,pwd,{modeFlags:flags,stcW:0,structuralSalt:salt,contentIv:iv});
  assert(argonCalls===1,`encode F21 chamou Argon ${argonCalls} vezes`);
  const opened=await api.f21OpenHeader(packet.structuralSalt,packet.maskedHeader,pwd,10000);
  assert(opened && argonCalls===2,`decode F21 não usou exatamente um Argon; total=${argonCalls}`);
  const before=argonCalls;
  assert(await api.f21OpenHeader(packet.structuralSalt,packet.maskedHeader,'',10000)===null,'senha vazia tentou reconhecer v3');
  assert(argonCalls===before,'senha vazia executou Argon F21');

  // Produção: mesma senha + mesmo plaintext não pode repetir salt/IV/packet. Os
  // hooks determinísticos existem somente quando o teste os fornece explicitamente.
  const randomA=await api.f21CreatePacket(plain,pwd,{modeFlags:flags,stcW:0});
  const randomB=await api.f21CreatePacket(plain,pwd,{modeFlags:flags,stcW:0});
  assert(!api.f21BytesEqual(randomA.structuralSalt,randomB.structuralSalt),'salt de produção repetiu');
  assert(!api.f21BytesEqual(randomA.contentIv,randomB.contentIv),'IV de produção repetiu');
  assert(!api.f21BytesEqual(randomA.maskedHeader,randomB.maskedHeader),'header mascarado repetiu');
  assert(!api.f21BytesEqual(randomA.body,randomB.body),'ciphertext de produção repetiu');

  // Com chaves já derivadas, mutações podem provar auth-before-parse sem repetir Argon.
  const master=await api.deriveF21Master(pwd,salt); const keys=await api.deriveF21Keys(master);
  const bitPositions=[0,8,23,24,31,39];
  for(const pos of bitPositions){
    const m=clone(packet.maskedHeader); m[pos]^=1;
    const got=await api.f21VerifyHeaderWithKeys(salt,m,keys,10000);
    assert(got===null,`bit alterado no maskedHeader[${pos}] passou autenticação`);
  }
  const salt2=clone(salt); salt2[0]^=1;
  assert(await api.f21VerifyHeaderWithKeys(salt2,packet.maskedHeader,keys,10000)===null,
    'salt alterado não invalidou autenticação do header');

  // Header reautenticado de teste: a HMAC passa, mas capacidade/flags precisam
  // rejeitar antes de qualquer alocação proporcional ao LEN.
  async function remask(core){
    const tag=await api.f21HeaderTag(keys.headerAuthKey,salt,core);
    return api.f21CtrXor(keys.headerMaskKey,new Uint8Array([...core,...tag.truncated]));
  }
  const huge=api.f21BuildHeaderCore({modeFlags:flags,stcW:0,bodyLen:5_000_000,contentIv:iv});
  assert(await api.f21VerifyHeaderWithKeys(salt,await remask(huge),keys,1000)===null,
    'LEN autenticado mas incompatível com capacidade foi aceito');
  const badSpreadNoStc=api.f21BuildHeaderCore({modeFlags:flags,stcW:0,bodyLen:packet.body.length,contentIv:iv});
  badSpreadNoStc[7]=0x20; // bit spread no w-byte, mas modeFlags sem STC
  assert(await api.f21VerifyHeaderWithKeys(salt,await remask(badSpreadNoStc),keys,10000)===null,
    'spread no w-byte sem STC foi aceito');
  const badReservedMode=api.f21BuildHeaderCore({modeFlags:flags|0x80,stcW:0,bodyLen:packet.body.length,contentIv:iv});
  assert(await api.f21VerifyHeaderWithKeys(salt,await remask(badReservedMode),keys,10000)===null,
    'bit reservado 0x80 do mode byte foi aceito');
  const badReservedW=api.f21BuildHeaderCore({modeFlags:api.MODE_B|api.FLAG_STEALTH|api.FLAG_STC,
    stcW:4,bodyLen:packet.body.length,contentIv:iv});
  badReservedW[7]|=0x40;
  assert(await api.f21VerifyHeaderWithKeys(salt,await remask(badReservedW),keys,10000)===null,
    'bit reservado 6 do w-byte STC foi aceito');
  const badStc=api.f21BuildHeaderCore({modeFlags:api.MODE_B|api.FLAG_STEALTH|api.FLAG_STC|api.FLAG_SHUFFLED,
    stcW:4,bodyLen:packet.body.length,contentIv:iv});
  assert(await api.f21VerifyHeaderWithKeys(salt,await remask(badStc),keys,10000)===null,
    'STC+SHUFFLED impossível foi aceito');

  const damaged=clone(packet.body); damaged[0]^=1;
  let bodyRejected=false; try{await api.f21DecryptOpenedBody(damaged,opened)}catch{bodyRejected=true}
  assert(bodyRejected,'corpo alterado passou AES-GCM');

  // HILL: mudar só os LSBs do prefixo não pode mudar custo/ordem potencial.
  const w=40,h=40,d=new Uint8ClampedArray(w*h*4);
  for(let p=0;p<w*h;p++){d[p*4]=(p*13)&255;d[p*4+1]=(p*29)&255;d[p*4+2]=(p*47)&255;d[p*4+3]=255}
  const c1=api.hillCostMap(d,w,h); const d2=new Uint8ClampedArray(d);
  for(let p=0;p<api.F21_PREFIX_CARRIER_PIXELS && p<w*h;p++) d2[p*4+2]^=1;
  const c2=api.hillCostMap(d2,w,h);
  assert(c1.length===c2.length,'HILL size mudou');
  for(let i=0;i<c1.length;i++) assert(c1[i]===c2[i],`HILL mudou com LSB-only no pixel ${i}`);

  // Contagem física da F1: fórmulas normativas.
  assert(api.f21UsedOpaquePixels(flags,0,300)===api.F21_PREFIX_CARRIER_PIXELS+300,'B usedPx incorreto');
  const rgbFlags=api.MODE_RGB|api.FLAG_SHUFFLED|api.FLAG_STEALTH;
  assert(api.f21UsedOpaquePixels(rgbFlags,0,301)===api.F21_PREFIX_CARRIER_PIXELS+101,'RGB usedPx incorreto');
  const stcFlags=api.MODE_B|api.FLAG_STEALTH|api.FLAG_STC;
  assert(api.f21UsedOpaquePixels(stcFlags,4,300)===api.F21_PREFIX_CARRIER_PIXELS+1200,'STC usedPx incorreto');

  process.stdout.write('F21 security OK — one Argon/op, auth-before-LEN, hostile header/body rejection, HILL invariant, F1 accounting');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
