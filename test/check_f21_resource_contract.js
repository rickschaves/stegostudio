#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cryptoNode=require('crypto');
const {webcrypto}=cryptoNode; const hashwasm=require('../src/hash-wasm.js');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m)}
const f21=fs.readFileSync(path.join(ROOT,'src','f21.js'),'utf8');
const enc=fs.readFileSync(path.join(ROOT,'src','encoder.js'),'utf8');
const dec=fs.readFileSync(path.join(ROOT,'src','decoder.js'),'utf8');
const files=fs.readFileSync(path.join(ROOT,'src','files.js'),'utf8');
const coreCode=['crypto.js','f21.js','hill.js','stc.js','encoder.js']
 .map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',coreCode+`\nreturn {f21TailReservationBoundary,f21UsedOpaquePixels,f21ModeFlagsForEmbed,MODE_B,MODE_RGB,F21_PREFIX_CARRIER_PIXELS,F21_BODY_MAX};`)(webcrypto,hashwasm,k=>k);
const m=/function selectEmbedMode\([\s\S]*?\n\}/.exec(files); assert(m,'selectEmbedMode não encontrado');
const selectEmbedMode=new Function('MODE_B','MODE_RGB',`${m[0]}; return selectEmbedMode;`)(api.MODE_B,api.MODE_RGB);
// A produção não pode voltar a materializar uma permutação Uint32 por bit.
assert(enc.includes('f21ShuffledOrder(body.length, packet.bodyOrderKey)'), 'encoder deixou de permutar bytes do corpo');
assert(dec.includes('f21ShuffledOrder(h.bodyLen, opened.bodyOrderKey)'), 'decoder deixou de permutar bytes do corpo');
assert(!enc.includes('f21ShuffledOrder(bodyBits, packet.bodyOrderKey)'), 'encoder regrediu para ordem por bit');
assert(!dec.includes('f21ShuffledOrder(bodyBits, opened.bodyOrderKey)'), 'decoder regrediu para ordem por bit');
assert(api.F21_BODY_MAX===5_000_000,'bodyLen máximo mudou sem revisão');
assert(api.F21_BODY_MAX*4===20_000_000,'orçamento máximo da Uint32Array deixou de ser ~20 MB');
// A UI de produção continua escolhendo somente STC padrão ou RGB capacidade; HILL
// não-STC existe no decoder/fixtures, mas não pode ganhar F1 por uma fronteira falsa.
for(const n of [1,64,1024]){
 const st=selectEmbedMode(n,10000,api.F21_PREFIX_CARRIER_PIXELS,false);
 assert(st && st.mode===api.MODE_B && st.stc===true && st.adaptive===false,'auto-seleção padrão deixou de ser STC/B');
 const rgb=selectEmbedMode(n,10000,api.F21_PREFIX_CARRIER_PIXELS,true);
 assert(rgb && rgb.mode===api.MODE_RGB && rgb.stc===false && rgb.adaptive===false,'alta capacidade deixou de ser RGB não-adaptativo');
}
let threw=false;try{api.f21TailReservationBoundary(api.f21ModeFlagsForEmbed(api.MODE_B,false,true,0),0,128)}catch(e){threw=/noncontiguous/.test(String(e))}
assert(threw,'HILL não-STC ganhou fronteira F1 falsa');
const b=api.f21ModeFlagsForEmbed(api.MODE_B,false,false,0);
assert(api.f21TailReservationBoundary(b,0,128)===api.F21_PREFIX_CARRIER_PIXELS+128,'fronteira B incorreta');
// Capacidade zero precisa produzir percentual definido; a regressão histórica era 0/0 -> NaN.
assert(files.includes("const pct = max > 0 ? Math.min(used/max*100,100) : (used > 0 ? 100 : 0);"),'medidor pode voltar a produzir NaN% com cover menor que o bootstrap');
assert(!files.includes('F21_PREFIX_CARRIER_PIXELS*3 + f21Packet.body.length*8'),'impacto RGB voltou a triplicar slots do bootstrap B-only');
assert(files.includes(': F21_PREFIX_CARRIER_PIXELS + f21Packet.body.length*8;'),'impacto v3 não conta bootstrap + bits reais de corpo');
assert(files.includes('const f21PlainMax = F21_BODY_MAX - F21_GCM_TAG_BYTES;'),'medidor não respeita teto lógico do wire F21');
assert(files.includes('Math.min(f21PlainMax'),'capacidade protegida pode anunciar mais que o wire suporta');
assert(files.includes("if (cipher && bodyStoredBytes > F21_BODY_MAX) throw new Error(t('msgTooLong'));"),'Encode não falha cedo no teto F21 antes do Argon');
process.stdout.write('F21 resource/boundary OK — byte-order <=20 MB at wire cap, production STC/RGB only, HILL+F1 fails closed, zero-capacity meter finite');
