#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const {build}=require(path.join(ROOT,'build.js'));
function assert(c,m){ if(!c) throw new Error(m); }
const i18n=fs.readFileSync(path.join(ROOT,'src/i18n.js'),'utf8');
const results=fs.readFileSync(path.join(ROOT,'src/results.js'),'utf8');
const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const tpl=fs.readFileSync(path.join(ROOT,'template.html'),'utf8');
const html=build({write:false});

// Heurística estatística não pode ser rotulada como prova/evidência direta.
assert(i18n.includes('protoBadgeEmbedding: "LSB EMBEDDING INDICATION"'), 'badge EN ainda chama indicação estatística de evidence');
assert(i18n.includes('protoBadgeEmbedding: "INDÍCIO DE EMBEDDING LSB"'), 'badge PT ainda chama indicação estatística de evidência');
assert(!i18n.includes('protoBadgeEmbedding: "LSB EMBEDDING EVIDENCE"'), 'copy EN antiga voltou');
assert(!i18n.includes('protoBadgeEmbedding: "EVIDÊNCIA DE EMBEDDING LSB"'), 'copy PT antiga voltou');
assert(results.includes('const embeddingIndication ='), 'estado interno ainda usa nome que sugere evidência direta');

// PNG e JPEG mantêm feedback diferente por capacidade diagnóstica diferente.
assert(i18n.includes('decKeyFlashWrong: "A senha informada não abriu a mensagem criptografada."'), 'feedback conclusivo de PNG/cripto mudou');
assert(i18n.includes('decKeyFlashJpegInconclusive: "A senha informada não abriu um payload JPEG compatível. Ela pode estar incorreta, ou esta imagem pode não conter um payload protegido por senha compatível."'), 'feedback JPEG inconclusivo mudou');
assert(main.includes("if (jpegKeyFeedback === 'wrong') flashKey('wrong');") && main.includes("else if (jpegKeyFeedback === 'inconclusive') flashKey('jpeg');"), 'distinção de feedback JPEG deixou de ser explícita');

// RESULTADO deve existir antes do contêiner que só aparece após análise.
const titlePos=tpl.indexOf('<div class="result-title-row">');
const placeholderPos=tpl.indexOf('id="dec-placeholder"');
const areaPos=tpl.indexOf('id="results-area"');
assert(titlePos>=0 && placeholderPos>titlePos && areaPos>placeholderPos, 'RESULTADO não fica permanentemente acima do placeholder e da área condicional');
assert(/<span class="result-main-title" data-i18n="resultTitle">RESULTADO<\/span>/.test(tpl), 'título RESULTADO ausente');
assert(/id="dec-placeholder"[^>]*data-i18n="decPlaceholder"[^>]*>Carregue uma imagem e clique em Analisar para ver os resultados\.<\/div>/.test(tpl), 'placeholder inicial do Decoder mudou');

// Prova no artefato final, não só nos fontes.
const hTitle=html.indexOf('<div class="result-title-row">');
const hPlaceholder=html.indexOf('id="dec-placeholder"');
const hArea=html.indexOf('id="results-area"');
assert(hTitle>=0 && hPlaceholder>hTitle && hArea>hPlaceholder, 'ordem permanente RESULTADO→placeholder→results não sobreviveu ao build');

console.log('v2.43.23 smoke semantics OK — embedding=indicação; PNG/JPEG preservam semântica própria; RESULTADO sempre visível');
