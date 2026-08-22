#!/usr/bin/env node
/* CHECK 82 — O1-J1: JPEG DCT compact store + typed recovery paths.
 * Prova que a nova representação não altera nenhum coeficiente e impede o
 * retorno dos maiores arrays/strings intermediários do caminho JPEG.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const jpegSrc=fs.readFileSync(path.join(ROOT,'src','jpeg_dct.js'),'utf8');
const decSrc=fs.readFileSync(path.join(ROOT,'src','decoder.js'),'utf8');
const forensics=fs.readFileSync(path.join(ROOT,'src','forensics.js'),'utf8');
const robust=fs.readFileSync(path.join(ROOT,'src','robust.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m);}
const api=new Function(jpegSrc+';return {decodeJpegCoefficients,jpegCoeffsLinear,jpegCoeffsMCUOrder,jpegGetBlock};')();
function hashI16(a){
  const b=Buffer.allocUnsafe(a.length*2);
  for(let i=0;i<a.length;i++) b.writeInt16LE(a[i],i*2);
  return crypto.createHash('sha256').update(b).digest('hex');
}
const expected={
 'checker_q75.jpg':['830304229e4b9008f7109763d8050db7b98375fa77eb1a1da85229edf822ee2b','d908d9daa1e1e8a0c4a1ed77825fd44b22491362031463d17711f65ece8bbdf4'],
 'graphic_q80.jpg':['92a49865a75de6465a5060d4484c59d8df8581c1cf841d40faeeca36b4b1de30','72ac70f13bbb706b046ccd07cd84f003b11f4ad2182c5da1f8d5370b4d545dff'],
 'noise_q65.jpg':['cdb195f2a5d216620e81815c9fdda798140c90ee2994dd7d76f6fc6905241d15','bc4506ad60b9048668b793b5992fa62429389b65fdd8401a5d7a0a00016bf44c'],
 'photo_like_1_q60.jpg':['29607c651959cbc3f477d2351d353e515e9918c4cfad43aae46c397eb0824001','7b11d8a8e87c132833010b86f541f13f65776db01d90addd4c09621a317b988b'],
 'photo_like_2_q85.jpg':['2a82f252f4a93ff74cd0c2865563149cbf6bf05361ede20780d613673a8c9bb3','a44c8af3f3e9d050b9fa35845a7e8fcc672d182488165c52a1511e06da26a5d4'],
 'photo_like_3_q72.jpg':['22f6e16a29e26007cb6dd6b3131ac2b5fb820c34a7221683c4c646ff8b496473','ac9fcd34994c642958014e9e1108087fe2e65d1e83b6963c0d64b68d08a043c8'],
 'photo_like_4_q90.jpg':['9fea8f8ca80daa112cfa75e6fa78cd07fad6e676002207a153cb98682152dcac','c14766efc67db01862f7ab056fc190821615d88dd37b723559b2050e6a981dc8'],
 'solid_q90.jpg':['6b1d8f780b2dfdf65465bbc365715c88ae881efbc65e6df37db4331376b18f6a','430a4bf0ec19fc333ef8b148eb2c8f50d0523061216a7215da5659277aa36edd'],
 'cicada3301_first_message.jpg':['b6aa0f563dd653f129717243f58667ae1cf10cc7e37e8c57180cac102dc1a477','d5f65142988ab04773783ab5c43934cb52b4c89bbe60634707f846a08ab3b2ee'],
};
const clean=path.join(ROOT,'test','fixtures','third-party','clean');
for(const [name,[linH,mcuH]] of Object.entries(expected)){
  const f=name==='cicada3301_first_message.jpg'?path.join(ROOT,'test','fixtures','third-party',name):path.join(clean,name);
  const d=api.decodeJpegCoefficients(new Uint8Array(fs.readFileSync(f)));
  assert(d.blocks&&d.blocks._compact===true,`${name}: store DCT não é compacto`);
  const b=api.jpegGetBlock(d,0,0,0);
  assert(b instanceof Int16Array,`${name}: bloco não permaneceu Int16Array`);
  assert(hashI16(api.jpegCoeffsLinear(d))===linH,`${name}: ordem linear divergiu do baseline .26`);
  assert(hashI16(api.jpegCoeffsMCUOrder(d))===mcuH,`${name}: ordem MCU divergiu do baseline .26`);
}
assert(!jpegSrc.includes('Array.from(cd.blocks'), 'decoder voltou a copiar Int16Array para Array JS');
assert(jpegSrc.includes('jpegMakeBlockStore(compData, comps)'), 'decode final não usa store compacto');
assert(decSrc.includes('new Uint8Array(jpegCoeffCount(dec))')&&decSrc.includes('jpegForEachLinear(dec'), 'Steghide voltou a materializar vetor DCT/JS');
assert(decSrc.includes('jpegForEachMCU(dec')&&/const bits=new Uint8Array\(cap\)/.test(decSrc), 'OutGuess voltou a materializar vetor DCT/JS');
const dctFn=forensics.slice(forensics.indexOf('function analyzeJpegDCT'),forensics.indexOf('function analyzeDCT'));
assert(dctFn.includes('jpegForEachLinear(dec')&&!dctFn.includes('jpegCoeffsLinear(dec)'), 'Analyzer JPEG ainda materializa vetor linear completo');
assert(robust.includes('jpegGetBlock(decLido,0')&&robust.includes('jpegGetBlock(blocks,0'), 'robusto ainda depende de chave textual no hot path');
console.log('O1-J1 compact JPEG DCT OK — 9 fixtures coef-bit-exatas; blocos Int16Array; Steghide/OutGuess/Analyzer sem vetor JS intermediário');
