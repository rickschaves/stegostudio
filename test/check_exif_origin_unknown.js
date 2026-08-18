#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/forensics.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
function extractFunction(name){
  const start=src.indexOf(`function ${name}(`); assert(start>=0,`função ${name} ausente`);
  const brace=src.indexOf('{',start); let depth=0,end=-1;
  for(let i=brace;i<src.length;i++){ if(src[i]==='{') depth++; else if(src[i]==='}' && --depth===0){end=i+1;break;} }
  assert(end>brace,`função ${name} truncada`); return src.slice(start,end);
}
const computeOrigin=new Function(extractFunction('computeOrigin')+'; return computeOrigin;')();
const base={
  gradients:{sharpRatio:'10',suspicious:false}, chroma:{uniformChroma:false,oversaturated:false},
  entropy:{uniqueColors:60000,avgNoise:'5'}, color:{}, ai:{score:0,digitalRenderVeto:false},
  metadata:{width:1920}, c2pa:{manifestDetected:false}, _regionalEntropyVar:2
};
const absent=computeOrigin({...base,exif:{available:true,found:false,hasCamera:false,hasGPS:false,aiSoftware:null}},null,{ext:'PNG'});
const unreadable=computeOrigin({...base,exif:{available:false,found:false,hasCamera:false,hasGPS:false,aiSoftware:null}},null,{ext:'PNG'});
const camera=computeOrigin({...base,exif:{available:true,found:true,hasCamera:true,hasGPS:true,aiSoftware:null}},null,{ext:'PNG'});
const keys=o=>Object.values(o.signals).flat().map(x=>x.labelKey);
const absentKeys=keys(absent), unreadableKeys=keys(unreadable), cameraKeys=keys(camera);
assert(absentKeys.includes('sigPNGNoCamera') && absentKeys.includes('sigPNGNoMeta'),'ausência real deixou de contribuir para origem');
assert(!unreadableKeys.includes('sigPNGNoCamera') && !unreadableKeys.includes('sigPNGNoMeta'),'falha de leitura ainda é rotulada como ausência');
assert(cameraKeys.includes('sigPhysicalEXIF') && cameraKeys.includes('sigGPS'),'EXIF legível positivo deixou de contribuir');
assert(unreadable.screenshot < absent.screenshot && unreadable.arte_digital < absent.arte_digital,'estado desconhecido continua recebendo pesos negativos de EXIF');
process.stdout.write('EXIF origin unknown OK — parser failure is unknown, not missing metadata/camera');
