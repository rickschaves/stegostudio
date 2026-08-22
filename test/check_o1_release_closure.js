#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
function assert(c,m){if(!c)throw new Error(m);}
const main=read('src/main.js');
const ui=read('src/ui.js');
const i18n=read('src/i18n.js');
const changelog=read('CHANGELOG.md');
const compat=read('docs/COMPATIBILITY.md');
const build=read('build.js');
const tpl=read('template.html');
const acorn=require(path.join(ROOT,'tools','vendor','acorn.js'));

// Contrato semântico do fechamento: medições O1-LAB podem continuar existindo
// para diagnóstico explícito no console, mas nenhum valor derivado delas pode
// alcançar os sinks do terminal. Não dependemos do texto "LAB ...": seguimos
// funções/variáveis simples na AST, então renomear o formatter não cria falso verde.
const ast=acorn.parse(main,{ecmaVersion:'latest',sourceType:'script'});
const fnMap=new Map();
(function indexFunctions(node){
  if(!node||typeof node!=='object') return;
  if(node.type==='FunctionDeclaration'&&node.id) fnMap.set(node.id.name,node);
  if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&
     (node.init?.type==='ArrowFunctionExpression'||node.init?.type==='FunctionExpression')) fnMap.set(node.id.name,node.init);
  for(const [k,v] of Object.entries(node)){
    if(k==='start'||k==='end'||k==='loc') continue;
    if(Array.isArray(v)) v.forEach(indexFunctions); else if(v&&typeof v==='object') indexFunctions(v);
  }
})(ast);
const labRoots=new Set(['analysisLab','lastAnalysisLabTiming','getStegoAnalysisTiming']);
function referencesLab(node,seen=new Set()){
  if(!node||typeof node!=='object') return false;
  if(node.type==='Identifier'){
    if(labRoots.has(node.name)||/^analysisLab/i.test(node.name)||/^lastAnalysisLabTiming$/i.test(node.name)) return true;
    if(seen.has(node.name)) return false;
    const fn=fnMap.get(node.name);
    if(fn){ const next=new Set(seen); next.add(node.name); return referencesLab(fn,next); }
    return false;
  }
  for(const [k,v] of Object.entries(node)){
    if(k==='start'||k==='end'||k==='loc') continue;
    if(Array.isArray(v)){ if(v.some(x=>referencesLab(x,new Set(seen)))) return true; }
    else if(v&&typeof v==='object'&&referencesLab(v,new Set(seen))) return true;
  }
  return false;
}
let terminalCalls=0;
(function scanTerminal(node){
  if(!node||typeof node!=='object') return;
  if(node.type==='CallExpression'&&node.callee?.type==='Identifier'&&['termWrite','setStatus','setStatusWorking'].includes(node.callee.name)){
    terminalCalls++;
    assert(!node.arguments.some(arg=>referencesLab(arg)),`timing laboratorial alcança o terminal via ${node.callee.name}()`);
  }
  for(const [k,v] of Object.entries(node)){
    if(k==='start'||k==='end'||k==='loc') continue;
    if(Array.isArray(v)) v.forEach(scanTerminal); else if(v&&typeof v==='object') scanTerminal(v);
  }
})(ast);
assert(terminalCalls>0,'nenhum sink de terminal encontrado para validar o contrato O1-LAB');

// Release-facing version identifiers.
assert(build.includes("const VERSION = '2.44.0';"),'VERSION de release não é 2.44.0');
assert(main.includes("_tool:'STEGO·STUDIO v2.44.0'"),'_tool não foi bumpeado para 2.44.0');
assert(tpl.includes('v2.44.0 // ENCODER · ANALYZER · DECODER'),'logo não foi bumpeado para 2.44.0');

// O1-LAB must be gone from public UI/runtime, while explicit console diagnostics stay available.
for(const label of ['LAB PERF · ','LAB FORENSICS · ','LAB JPEG · ','LAB RECOVERY · '])
  assert(!main.includes(label),`linha temporária voltou ao runtime: ${label}`);
assert(!main.includes('analysisLabTerminalLines'),'formatter O1-LAB ainda existe no runtime público');
assert(main.includes('function getStegoAnalysisTiming()'),'snapshot de diagnóstico local foi removido junto com a UI laboratorial');
assert(main.includes('lastAnalysisLabTiming=analysisLab'),'snapshot interno não recebe a medição final');

// Cumulative release is visible, but local history stays bounded.
const hist=ui.slice(ui.indexOf('const CHANGELOG = ['),ui.indexOf('function renderChangelog()'));
const local=[...hist.matchAll(/ver:'v([^']+)'/g)].map(m=>m[1]);
assert(local.length===10,`janela local deveria ter 10 releases, tem ${local.length}`);
assert(local[0]==='2.44.0','v2.44.0 não é a primeira release da janela local');
assert(changelog.includes('## v2.44.0 — 2026-08-21'),'CHANGELOG.md não contém a release cumulativa v2.44.0');

// Public compatibility text must describe spread as current, not upcoming laboratory work.
assert(compat.includes('The current release, v2.44.0, uses STC **spread** selection'),'COMPATIBILITY não descreve o wire corrente v2.44.0');
assert(!/upcoming STC \*\*spread\*\*/i.test(compat),'COMPATIBILITY ainda chama spread de futuro');

// Ordinary users see Capacity first; advanced pressure detail remains opt-in.
assert(i18n.includes('The capacity meter shows whether the current message fits the selected image'),'ticker ainda promove a métrica técnica em vez do fluxo simples');
assert(i18n.includes('O medidor de capacidade mostra se a mensagem atual cabe na imagem escolhida'),'ticker PT não acompanha o fluxo simples');
assert(i18n.includes('small information icon beside <b>Capacity</b> opens optional technical details'),'ajuda EN perdeu o detalhe técnico opt-in');
assert(i18n.includes('pequeno ícone de informação ao lado de <b>Capacidade</b> abre detalhes técnicos opcionais'),'ajuda PT perdeu o detalhe técnico opt-in');

console.log('O1 release closure OK — v2.44.0 cumulative release, O1-LAB removed from UI, diagnostics kept console-only, history/compatibility/guidance aligned');
