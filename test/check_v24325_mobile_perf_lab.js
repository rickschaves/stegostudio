#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m);}
const ui=fs.readFileSync(path.join(ROOT,'src/ui.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'src/styles.css'),'utf8');
const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const forensic=fs.readFileSync(path.join(ROOT,'src/forensics.js'),'utf8');
assert(main.includes("document.querySelector('#panel-dec .result-title-row')"),'auto-scroll não ancora RESULTADO');
assert(main.includes("title.scrollIntoView({ behavior:'smooth', block:'start' })"),'auto-scroll não usa a âncora sem offset mágico');
assert(/\.result-title-row\s*\{[^}]*scroll-margin-top:18px/.test(css),'folga acima de RESULTADO ausente');
assert(ui.includes("if (tab === 'dec') {")&&ui.includes("current.style.willChange = 'transform'"),'prewarm do swipe Decoder→Encoder ausente');
assert(css.includes('html.mobile-swipe-active, body.mobile-swipe-active { overflow-x:hidden; }'),'guarda contra barra horizontal do swipe ausente');
assert(ui.includes('switchTab(g.nextTab, {fromSwipe:true});')&&ui.includes('raf(() => {'),'handoff de settle não é diferido por frame');
assert(main.includes('getStegoAnalysisTiming()'),'snapshot de timing laboratorial ausente');
assert(!main.includes('LAB PERF · ')&&!main.includes('LAB FORENSICS · ')&&!main.includes('LAB JPEG · ')&&!main.includes('LAB RECOVERY · '),'linhas temporárias O1-LAB voltaram ao runtime público');
assert(!main.includes('analysisLabTerminalLines'),'formatter de terminal O1-LAB voltou ao runtime público');
assert(forensic.includes("analysisLabAdd(analysisLab,'entropy',labT,'forensic')"),'timing de entropia não instrumentado');
assert(forensic.includes("analysisLabAdd(analysisLab,'aiOrigin',labT,'forensic')"),'timing AI/origem não instrumentado');
assert(!/modules\s*:\s*[^\n]*analysisLab/.test(main),'timing laboratorial contaminou relatório público');
console.log('v2.43.25 mobile/perf lab OK — RESULTADO com folga, swipe prewarm/overflow guard e timings internos preservados fora da UI');
