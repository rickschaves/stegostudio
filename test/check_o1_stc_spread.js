#!/usr/bin/env node
'use strict';

// CHECK 83 — O1-E1 / P1A: pool STC espalhado, explicitamente sinalizado.
// Prova reconstrução determinística sem mapa HILL, round-trip legado/F21,
// compatibilidade do STC sequencial anterior e a exceção deliberada da camada F1.

const fs=require('fs'), path=require('path');
const {webcrypto}=require('crypto');
const hashwasm=require('../src/hash-wasm.js');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m)}
const code=['crypto.js','f21.js','encoder.js','hill.js','stc.js','decoder.js','png_codec.js']
  .map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
const api=new Function('crypto','hashwasm','t',code+`\nreturn {
  buildPayload,embedLSB,extractLSBStudio,opaquePixels,opaqueAt,
  makeStcSpreadCursor,stcSpreadSeed,MODE_B,FLAG_STC,STC_W_FLAG_SPREAD,STC_W_RESERVED_MASK,
  packStcWByte,parseStcWByte,f21ModeFlagsForEmbed,f21CreatePacket,embedLSBV3,extractLSBStudioV3,
  f21TailReservationBoundary,F21_PREFIX_CARRIER_PIXELS,pngEncodeRGBA,pngDecodeRGBA
};`)(webcrypto,hashwasm,k=>k);

function makeCover(w=128,h=128,transparent=false){
  const d=new Uint8ClampedArray(w*h*4);
  for(let p=0;p<w*h;p++){
    d[p*4]=(p*17+31)&255; d[p*4+1]=(p*29+7)&255; d[p*4+2]=(p*43+101)&255;
    d[p*4+3]=(transparent && p%41===0)?0:255;
  }
  return {data:d,width:w,height:h};
}
function clone(id){return {data:new Uint8ClampedArray(id.data),width:id.width,height:id.height}}
function fixed(n,seed){const a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=(seed+i*19)&255;return a}
async function reopen(id){const png=await api.pngEncodeRGBA(id.width,id.height,id.data);const d=await api.pngDecodeRGBA(png);return {data:d.data,width:d.width,height:d.height}}
function gotWByte(id,api){
  const op=api.opaquePixels(id.data), hLen=10;
  let raw=0; for(let i=0;i<8;i++) raw=(raw<<1)|(id.data[api.opaqueAt(op,hLen*8+i)*4+2]&1);
  return raw;
}

(async()=>{
  // Estratificação: um carrier por estrato, crescente/único e cobrindo a cover.
  const start=88, available=10000, count=160, W=200,H=100, stcW=16;
  const cur=api.makeStcSpreadCursor(start,available,count,W,H,stcW);
  const pos=[]; for(let i=0;i<count;i++)pos.push(cur.next());
  assert(pos.length===count,'cursor retornou contagem errada');
  for(let i=1;i<pos.length;i++) assert(pos[i]>pos[i-1],`posição repetida/fora de ordem em ${i}`);
  assert(pos[0]>=start && pos[pos.length-1]<start+available,'posição saiu do pool físico');
  const span=(pos[pos.length-1]-pos[0]+1)/available;
  assert(span>0.90,`pool pequeno não se espalhou pela cover (${(span*100).toFixed(1)}%)`);
  const cur2=api.makeStcSpreadCursor(start,available,count,W,H,stcW);
  for(let i=0;i<count;i++) assert(cur2.next()===pos[i],`seleção não determinística em ${i}`);


  // Wire R2: largura STC usa bits 0..4; bit 5 sinaliza spread; 6..7 reservados.
  assert(api.packStcWByte(1,false)===1 && api.packStcWByte(16,false)===16,'w-byte sequencial mudou');
  assert(api.packStcWByte(1,true)===33 && api.packStcWByte(16,true)===48,'bit spread não está no bit 5 do w-byte');
  const parsed=api.parseStcWByte(36);
  assert(parsed?.stcW===4 && parsed?.stcSpread===true,'parse do w-byte spread divergiu');
  assert(api.parseStcWByte(0x40|4)===null && api.parseStcWByte(0x80|4)===null,'bits 6..7 do w-byte deixaram de falhar fechado');

  // Passwordless atual: novo flag + round-trip, inclusive com transparência.
  const text='P1A spread passwordless — português ✓';
  const bytes=new TextEncoder().encode(text);
  const src=makeCover(128,128,true), spreadId=clone(src);
  const payload=api.buildPayload(bytes,api.MODE_B);
  api.embedLSB(spreadId,payload,api.MODE_B,'',false,false,4,true);
  assert((payload[5]&api.FLAG_STC)!==0 && (payload[5]&0x80)===0,
    'novo STC deve manter 0x80 reservado no mode byte');
  assert(gotWByte(spreadId,api)===api.packStcWByte(4,true),
    'novo STC não sinalizou spread no w-byte');
  const got=api.extractLSBStudio(await reopen(spreadId),'');
  assert(got instanceof Uint8Array,'decoder passwordless não reconheceu STC spread');
  assert(new TextDecoder().decode(got)===text,'round-trip passwordless spread divergiu');
  for(let p=0;p<src.width*src.height;p++) if(src.data[p*4+3]!==255){
    assert(spreadId.data[p*4]===src.data[p*4] && spreadId.data[p*4+1]===src.data[p*4+1] &&
           spreadId.data[p*4+2]===src.data[p*4+2] && spreadId.data[p*4+3]===src.data[p*4+3],
      `pixel transparente ${p} foi tocado`);
  }

  // Compatibilidade: o wire STC sequencial antigo continua decodificando.
  const oldId=clone(src), oldPayload=api.buildPayload(bytes,api.MODE_B);
  api.embedLSB(oldId,oldPayload,api.MODE_B,'',false,false,4,false);
  assert((oldPayload[5]&api.FLAG_STC)!==0 && (oldPayload[5]&0x80)===0,
    'wire STC legado alterou o mode byte reservado');
  assert(gotWByte(oldId,api)===4,'wire STC sequencial legado alterou o w-byte');
  const oldGot=api.extractLSBStudio(await reopen(oldId),'');
  assert(new TextDecoder().decode(oldGot)===text,'round-trip STC sequencial legado regrediu');

  // F21: flag autenticado e seleção reconstruída somente depois de abrir header.
  const pwd='P1A-F21-2414';
  const f21Id=makeCover(128,128,false);
  const flags=api.f21ModeFlagsForEmbed(api.MODE_B,false,false,4);
  assert((flags&0x80)===0,'F21 não deve consumir o bit reservado 0x80 do mode byte');
  const packet=await api.f21CreatePacket(bytes,pwd,{modeFlags:flags,stcW:4,stcSpread:true,
    structuralSalt:fixed(16,41),contentIv:fixed(12,93)});
  await api.embedLSBV3(f21Id,packet,api.MODE_B,false,4);
  const f21Got=await api.extractLSBStudioV3(await reopen(f21Id),pwd);
  assert(f21Got?.headerMatched && f21Got?.bodyAuthenticated,'F21 spread não autenticou');
  assert(new TextDecoder().decode(f21Got.plainBytes)===text,'F21 spread round-trip divergiu');

  // F1 deliberadamente mantém STC contíguo: uma cauda desconhecida pelo decoder
  // não pode participar da seleção espacial da mensagem principal.
  let boundaryRejected=false;
  try{api.f21TailReservationBoundary(flags,4,bytes.length*8,true)}catch(e){boundaryRejected=/stc-spread/.test(e.message)}
  assert(boundaryRejected,'F1 aceitou fronteira contígua falsa para STC spread');
  const files=fs.readFileSync(path.join(ROOT,'src','files.js'),'utf8');
  assert(/const\s+stcSpread\s*=\s*useStc\s*&&\s*!decoyRequested\s*;/.test(files),
    'produção deixou de desativar spread quando há mensagem alternativa');
  const decoyDecl=files.indexOf("const decoyRequested = !!document.getElementById('enc-decoy-toggle')?.checked;");
  const spreadDecl=files.indexOf('const stcSpread = useStc && !decoyRequested;');
  assert(decoyDecl>=0 && spreadDecl>=0 && decoyDecl<spreadDecl,
    'produção consulta decoyRequested antes da inicialização (TDZ no encode)');
  assert(/const\s+robustPayload\s*=\s*\(cipher\s*\|\|\s*stcSpread\)/.test(files) &&
         /await\s+buildRobustPayload\(bodyBytes,\s*key/.test(files),
    'flag lossless STC spread pode vazar para o payload interno do JPEG robusto');

  process.stdout.write(`O1-E1 STC spread OK — ${count} estratos cobrem ${(span*100).toFixed(1)}%; passwordless/F21 round-trip; STC antigo + F1 preservados`);
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
