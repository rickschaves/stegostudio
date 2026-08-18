#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const r=fs.readFileSync(path.join(root,'src/results.js'),'utf8');
const i=fs.readFileSync(path.join(root,'src/i18n.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
assert(r.includes("const robustRecovered=robustState===true;"), 'JPEG voltou a tratar estado robusto truthy como recuperação confirmada');
assert(r.includes("if(robustRecovered) methods.push(t('jpegMethodStudioRobust'));"), 'STEGO·STUDIO resistente não alimenta Método identificado');
assert(r.includes("if(thirdParty) methods.push(thirdParty);"), 'método de terceiro não alimenta Método identificado');
assert(r.includes("row(t('rowJpegMethod')"), 'linha Método identificado ausente do accordion JPEG');
assert(r.includes("row(t('rowDecodeStatus')"), 'Decode Status não aparece na superfície JPEG');
assert(r.includes("row(t('rowJpegStructure')"), 'estrutura baseline/progressive ausente do accordion JPEG');
assert(r.includes("row(t('rowJpegRsCorrections')"), 'correções Reed-Solomon ausentes do accordion JPEG');
assert(r.includes("t('jpegEvidenceConfirmedNote')"), 'justificativa visível do robust:true ausente');
assert(!r.includes("t('rowJpegThirdParty')"), 'rótulo antigo Motor de terceiro reapareceu');
assert(i.includes('modJpegDCT: "JPEG / DCT"'), 'título do módulo JPEG ausente');
assert(i.includes('rowJpegMethod: "Método identificado"'), 'rótulo público PT de método divergente');
assert(i.includes('jpegMethodStudioRobust: "STEGO·STUDIO Resistente"'), 'método nativo robusto não está nomeado publicamente');
assert(!i.includes('qui-quadrado abaixo parece normal'), 'copy ainda depende de posição visual com "abaixo"');
assert(i.includes('O método identificado aparece acima; as estatísticas DCT continuam sendo apenas evidência de apoio.'), 'aviso de terceiro não acompanha o novo rótulo Método identificado');
assert(i.includes('jdctBandLow: "Baixa"') && i.includes('jdctBandMid: "Média"') && i.includes('jdctBandHigh: "Alta"'), 'bandas DCT não seguem capitalização pública combinada');
console.log('JPEG evidence UI OK — method/decode/statistics/direct extraction share one JPEG surface');
