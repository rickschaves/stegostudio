'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }

for(const id of ['help-overlay','changelog-overlay','about-overlay']){
  const idx=tpl.indexOf(`id="${id}"`);
  assert(idx>=0,`modal ${id} ausente`);
  const block=tpl.slice(idx, idx+1800);
  assert(block.includes('help-content'),`modal ${id} não usa a superfície rolável compartilhada`);
}
assert(/\.help-content\s*\{[^}]*scrollbar-width\s*:\s*thin[^}]*scrollbar-color\s*:\s*var\(--scan\)/s.test(css),'Firefox scrollbar dos modais não está estilizada');
assert(/\.help-content::-webkit-scrollbar\s*\{[^}]*width\s*:\s*6px/s.test(css),'WebKit scrollbar dos modais sem largura padronizada');
assert(/\.help-content::-webkit-scrollbar-track\s*\{[^}]*background\s*:\s*rgba\(0,0,0,0\.3\)/s.test(css),'trilho dos modais não segue terminal');
assert(/\.help-content::-webkit-scrollbar-thumb\s*\{[^}]*background\s*:\s*var\(--scan\)[^}]*border-radius\s*:\s*4px/s.test(css),'thumb dos modais não segue identidade visual');
process.stdout.write('modal scrollbars OK — Como Funciona, Histórico e Sobre compartilham o estilo interno');
