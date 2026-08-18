#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const r=fs.readFileSync(path.join(root,'src/results.js'),'utf8');
const i=fs.readFileSync(path.join(root,'src/i18n.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
assert(r.includes("const exifUnavailable=r.exif.available===false;"), 'falha de leitura EXIF voltou a ser confundida com ausência');
assert(r.includes("const exifPartial=!!r.exif.cameraPartial;"), 'estado parcial de câmera não é considerado');
assert(r.includes("metadataNoCamera=!exifUnavailable && !r.exif.noExif && !!r.exif.found"), 'metadados presentes sem câmera não têm estado próprio');
assert(r.includes("t('exifBadgePartial')") && r.includes("t('exifBadgeMetadataNoCamera')"), 'badges textuais de atenção EXIF ausentes');
assert(r.includes("t('exifInterpUnavailable')"), 'UI não explica que falha de leitura não prova ausência');
assert(i.includes('exifBadgeMetadataNoCamera: "ID DE CÂMERA AUSENTE"'), 'badge PT não sinaliza a anomalia em texto');
assert(i.includes('isoladamente não prova remoção de metadados nem origem sintética'), 'copy parcial voltou a acusar causa sem prova');
console.log('EXIF badge semantics OK — unavailable/partial/metadata-without-camera are distinct textual states');
