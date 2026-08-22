const fs=require('fs'), path=require('path');
function assert(c,m){ if(!c) throw new Error(m); }
const root=path.join(__dirname,'..');
const files=fs.readFileSync(path.join(root,'src','files.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');

// O1-X/M5: a saída PNG não pode manter o RGBA completo apenas para o heatmap opcional.
assert(!/\bencOutID\b/.test(files+main+ui),'raster encOutID voltou a ser retido no runtime');
assert(files.includes('let encOutURL=null, encOutBlob=null, rbOutURL=null;'),'estado da saída não guarda Blob PNG explícito');
assert(files.includes("encOutBlob = new Blob([pngBytes], { type: 'image/png' });"),'PNG final não é preservado como Blob para uso lazy');
assert(files.includes('encOutURL = URL.createObjectURL(encOutBlob);'),'preview/download não compartilham o mesmo Blob');
assert(files.includes('encOutURL = null; encOutBlob = null; rbOutURL = null;'),'reset não libera referência JS do Blob');

// O mapa opcional deve pagar o custo de decode somente no clique e pelo codec PNG puro.
assert(main.includes('async function toggleEncOverlay()'),'heatmap lazy precisa aceitar decode assíncrono');
assert(main.includes('if(!hm||!btn||!encOutBlob) return;'),'heatmap não está gated pelo Blob disponível');
assert(main.includes('await encOutBlob.arrayBuffer()'),'heatmap não lê bytes do Blob sob demanda');
assert(main.includes('await pngDecodeRGBA('),'heatmap lazy não reutiliza o codec PNG lossless');
assert(main.includes('const run=encOutputGeneration;') && main.includes('if(run!==encOutputGeneration) return;'),'decode lazy não está protegido contra saída obsoleta');
assert(main.includes('btn.disabled=true;') && main.includes('btn.disabled=false;'),'clique repetido pode disputar construção do heatmap');
assert(/if \(hb\) \{ hb\.textContent = t\('encMapShow'\); hb\.disabled = false; \}/.test(files),
  'resetEncOutputs não reabilita o botão do heatmap após decode obsoleto');

// O botão Limpar deve deixar resetEncOutputs revogar a object URL antes de nulá-la.
const clearLine='encID = null; encW = 0; encH = 0; encFormatOk = false;';
assert(ui.includes(clearLine),'limpeza do Encoder mudou de forma inesperada');
assert(!ui.includes('encOutURL = null; encFormatOk = false;'),'Limpar ainda zera a URL antes de resetEncOutputs revogá-la');
assert(ui.includes('resetEncOutputs();'),'Limpar não delega a liberação da saída ao reset central');

process.stdout.write('O1-X lazy output raster OK — full RGBA released after encode; PNG Blob retained; heatmap decodes losslessly on demand; clear revokes URL');
