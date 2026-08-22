'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'..');
const files=fs.readFileSync(path.join(root,'src/files.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/ui.js'),'utf8');
const i18n=fs.readFileSync(path.join(root,'src/i18n.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }

// Superfícies: uma no Encoder e uma no resultado do Analyzer/Decoder.
for(const id of ['enc-processing-time','dec-processing-time']){
  assert(tpl.includes(`id="${id}"`),`superfície ${id} ausente`);
}
assert((tpl.match(/data-i18n="processingTime"/g)||[]).length===2,'rótulo traduzível de tempo precisa existir nas duas superfícies');
assert((tpl.match(/class="processing-time-sep"[^>]*>·<\/span>/g)||[]).length===2,'separador · precisa existir nas duas superfícies de tempo');
assert(i18n.includes('processingTime: "// processing time"'),'copy EN do tempo ausente');
assert(i18n.includes('processingTime: "// tempo de processamento"'),'copy PT do tempo ausente');

// Destaque visual em âmbar próprio, sem reaproveitar a semântica de sucesso/alerta.
assert(css.includes('--perf: #d99b45'),'cor âmbar específica de performance ausente');
assert(/\.processing-time\s*\{[\s\S]*?color:var\(--perf\)/.test(css),'tempo não usa a cor própria de performance');
assert(/\.processing-time\.visible\s*\{\s*display:inline-flex/.test(css),'tempo não nasce oculto/torna-se visível explicitamente');
assert(/\.processing-time-label\s*\{[^}]*text-transform:uppercase;[^}]*\}/s.test(css),'rótulo de timing deve continuar em caixa alta');
assert(/\.processing-time-value\s*\{[^}]*text-transform:none;[^}]*\}/s.test(css),'valor/unidade do timing deve preservar s minúsculo');
assert(!/\.processing-time\s*\{[^}]*text-transform:uppercase;[^}]*\}/s.test(css),'container inteiro não pode forçar S maiúsculo no valor');

// Formatação real: ms abaixo de 1 s; segundos com 2 casas a partir de 1 s;
// separador acompanha o idioma ativo.
const fmt=files.match(/function formatProcessingTime\(ms\) \{[\s\S]*?\n\}/);
assert(fmt,'formatProcessingTime não encontrada');
const ctx={Number,Math,LANG:'pt'};
vm.createContext(ctx); vm.runInContext(fmt[0],ctx);
assert(ctx.formatProcessingTime(428.4)==='428 ms','tempo sub-segundo deve usar ms inteiro');
assert(ctx.formatProcessingTime(2084)==='2,08 s','tempo PT >=1s deve usar duas casas e vírgula');
ctx.LANG='en';
assert(ctx.formatProcessingTime(2084)==='2.08 s','tempo EN >=1s deve usar duas casas e ponto');

// Encoder: nova operação apaga o valor anterior e só publica o total quando as
// duas saídas assíncronas (self-analysis + JPEG robusto, sucesso ou erro) fecharam.
assert(files.includes("clearProcessingTime('enc-processing-time');"),'Encoder não limpa tempo anterior ao resetar saídas');
assert(files.includes('let _selfDone=false, _robustDone=false;'),'coordenador das duas saídas do Encoder ausente');
assert(files.includes("if (!_selfDone || !_robustDone) return;"),'Encoder pode publicar tempo antes de ambas as saídas terminarem');
assert(files.includes("showProcessingTime('enc-processing-time', processingNow() - processingStartedAt);"),'Encoder não publica o tempo total visível');
assert((files.match(/_markSelfDone\(\)/g)||[]).length>=2,'self-analysis não fecha timing em sucesso e falha');
assert(files.includes('_markRobustDone();'),'JPEG robusto não fecha timing em sucesso/falha');

// Analyzer/Decoder: cronômetro nasce depois da guarda de reentrância, é limpo
// por operação e só publica depois do portão de geração obsoleta e do render.
const start=main.indexOf('const processingStartedAt = processingNow();');
const stale=main.indexOf('if (obsoleta()) return;',start);
const render=main.indexOf('renderResults(report,decodedMsg,decodeStatus,{passwordIgnored,recoveredFile});',stale);
const publish=Math.max(
  main.indexOf("showProcessingTime('dec-processing-time', processingNow() - processingStartedAt);",render),
  main.indexOf("showProcessingTime('dec-processing-time', analysisLab.total);",render)
);
assert(start>=0 && stale>start && render>stale && publish>render,'ordem segura do timing do Analyzer/Decoder foi quebrada');
assert(main.slice(start-180,start).includes('_analisando = true'),'cronômetro do Analyzer começa antes da guarda de reentrância');
assert(main.includes("clearProcessingTime('dec-processing-time');"),'Analyzer não limpa tempo anterior no início');
assert(files.includes("clearProcessingTime('dec-processing-time');") && ui.includes("clearProcessingTime('dec-processing-time');"),'troca/limpeza de imagem não remove timing antigo');

// Troca EN/PT preserva o valor e apenas reformata o separador decimal.
assert(i18n.includes("if (typeof refreshProcessingTimes === 'function') refreshProcessingTimes();"),'troca de idioma não reformata tempo já visível');

// Contrato de escopo: performance é UI local. Não entra no relatório público.
const pubStart=main.indexOf('function createPublicLastReport');
const pubEnd=main.indexOf('// PUBLIC REPORT ALLOWLIST — END',pubStart);
assert(pubStart>=0 && pubEnd>pubStart,'bloco do relatório público não localizado');
const pubBlock=main.slice(pubStart,pubEnd);
assert(!/processing|performance|timing/i.test(pubBlock),'tempo vazou para forensic-report-v2');
assert(!/localStorage[^\n]*(processing|timing)|(?:processing|timing)[^\n]*localStorage/i.test(files+main),'tempo foi persistido em localStorage');

process.stdout.write('processing time UI OK — local-only, total por operação, EN/PT e protegido contra estado obsoleto');
