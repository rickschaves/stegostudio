#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const results=fs.readFileSync(path.join(root,'src/results.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }

assert(!/slice\(0\s*,\s*5000\)/.test(main), 'limite silencioso de 5000 caracteres reapareceu no Decoder');
assert(main.includes('decodedMsg = new TextDecoder().decode(opened.plain);'), 'rota robusta voltou a truncar/transformar conteúdo');
for(const needle of ['shRes.text','ogRes.text','osRes.text'])
  assert(main.includes(needle), 'rota confirmada de terceiro perdeu a visão textual: '+needle);
assert(results.includes("text.textContent = hasText ? decodedMsg"), 'mensagem recuperada deixou de usar textContent');
assert(/\.decoded-text\s*\{[\s\S]*?white-space\s*:\s*pre-wrap[\s\S]*?max-height\s*:\s*300px[\s\S]*?overflow\s*:\s*auto/.test(css), 'área longa deixou de preservar formatação com limite visual/scroll');
assert(!tpl.includes('id="decoded-expand"'), 'botão Expandir voltou ao Decoder');
assert(!results.includes('toggleDecodedExpanded') && !results.includes('scrollHeight'), 'Decoder voltou a expandir/forçar medição síncrona de layout');
for(const id of ['decoded-copy','decoded-save']) assert(tpl.includes(`id="${id}"`), `controle ${id} ausente`);
assert(results.includes("new Blob([text], {type:'text/plain;charset=utf-8'})"), 'Salvar TXT não preserva o texto integral');
assert(/\.decoded-text::-webkit-scrollbar-thumb\s*\{[^}]*background\s*:\s*var\(--dec\)/.test(css), 'scrollbar da mensagem não segue a linguagem visual do Analyzer');
console.log('long message UI OK — trusted extraction stays complete; formatted bounded view + styled scroll/copy/save');
