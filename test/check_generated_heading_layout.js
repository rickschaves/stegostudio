'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const i18n=fs.readFileSync(path.join(root,'src/i18n.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }

// Encoder and Analyzer/Decoder must share the same primary heading typography.
assert((tpl.match(/class="result-main-title"/g)||[]).length===2,'Encoder e Decoder precisam compartilhar result-main-title');
assert(/<span class="result-main-title" data-i18n="fieldGenerated">IMAGEM GERADA<\/span>/.test(tpl),'IMAGEM GERADA não usa o heading principal compartilhado');
assert(/<span class="result-main-title" data-i18n="resultTitle">RESULTADO<\/span>/.test(tpl),'RESULTADO não usa o heading principal compartilhado');
assert(/\.result-main-title\s*\{[\s\S]*?font-family:var\(--display\)[\s\S]*?font-size:1\.1rem[\s\S]*?letter-spacing:5px[\s\S]*?text-transform:uppercase/.test(css),'tipografia compartilhada do heading principal divergiu');

// The Encoder heading deliberately loses the old // prefix, while timing keeps it.
assert(i18n.includes('fieldGenerated: "Generated image"'),'fieldGenerated EN deve estar sem //');
assert(i18n.includes('fieldGenerated: "Imagem gerada"'),'fieldGenerated PT deve estar sem //');
assert(!i18n.includes('fieldGenerated: "// generated image"') && !i18n.includes('fieldGenerated: "// imagem gerada"'),'prefixo // legado reapareceu em IMAGEM GERADA');
assert(i18n.includes('processingTime: "// processing time"') && i18n.includes('processingTime: "// tempo de processamento"'),'timing deve manter // como marcador técnico');

// Both global headings keep the same trailing rule so the two tabs feel intentional.
const enc=tpl.match(/<div class="processing-head">([\s\S]*?)<\/div>\s*<div class="out-pair">/);
const dec=tpl.match(/<div class="result-title-row">([\s\S]*?)<\/div>\s*\n\s*<!-- Aviso de calibração -->/);
assert(enc && enc[1].includes('class="result-title-line"'),'cabeçalho do Encoder perdeu a linha estrutural');
assert(dec && dec[1].includes('class="result-title-line"'),'cabeçalho do Decoder perdeu a linha estrutural');

process.stdout.write('generated heading layout OK — IMAGEM GERADA e RESULTADO compartilham hierarquia, timing mantém //');
