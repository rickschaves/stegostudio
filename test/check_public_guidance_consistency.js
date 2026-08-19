#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=process.env.STEGO_ROOT ? path.resolve(process.env.STEGO_ROOT) : path.join(__dirname,'..');
function read(rel){ return fs.readFileSync(path.join(ROOT,rel),'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }

const i18nSrc=read('src/i18n.js');
const cut=i18nSrc.indexOf('// Detecta idioma');
assert(cut>0,'marcador final do objeto I18N não encontrado');
const I18N=vm.runInNewContext(i18nSrc.slice(0,cut)+'\nI18N',{});
assert(I18N && I18N.en && I18N.pt,'I18N EN/PT não pôde ser avaliado');
const tpl=read('template.html');

// Superfícies que o usuário encontra como orientação primária. O fallback PT do
// template precisa dizer a mesma coisa que a string efetiva carregada pelo i18n;
// isso impede que o HTML fonte/prepaint carregue uma verdade antiga.
const auditedKeys=`
encGuideSummary encGuide1 encGuide4 encGuide2 encGuide3 encGuideDecoy encGuide5 encGuideTip encGuideWa

decGuideSummary decGuide1 decGuide2 decGuide3 decGuide4 decGuide5 decGuideAdaptive decGuideTip dropHintDec2

helpTitle helpS1Title helpS1a helpS1b helpS2Title helpS2a helpS2b helpS2c helpS2d
helpRbTitle helpRbA helpRbB helpRbC helpRbD helpRbE
helpSecProtTitle helpProtA helpProtB helpProtD helpProtC helpProtStc helpProtE
helpSecDecTitle helpDecA helpDecB helpDecC helpDecD
helpS3Title helpS3a helpS3b helpS3c helpS3d
helpS4Title helpS4a helpS4b helpS4c helpS5Title helpS5a helpS5b helpS5c helpS5d
helpS6Title helpS6a helpS6b helpS6c`.trim().split(/\s+/);

function templateFallback(key){
  const safe=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const rx=new RegExp('<(?<tag>[A-Za-z0-9]+)\\b(?=[^>]*\\bdata-i18n(?:-html)?="'+safe+'")[^>]*>(?<body>[\\s\\S]*?)<\\/\\k<tag>>');
  const m=rx.exec(tpl);
  assert(m,`fallback do template não encontrado para ${key}`);
  return m.groups.body.trim();
}

for(const key of auditedKeys){
  assert(Object.prototype.hasOwnProperty.call(I18N.en,key),`chave auditada ausente em EN: ${key}`);
  assert(Object.prototype.hasOwnProperty.call(I18N.pt,key),`chave auditada ausente em PT: ${key}`);
  const fallback=templateFallback(key);
  assert(fallback===String(I18N.pt[key]).trim(),`fallback PT divergiu do i18n em ${key}`);
}

assert(Array.isArray(I18N.en.ticker) && Array.isArray(I18N.pt.ticker),'ticker EN/PT não é array');
assert(I18N.en.ticker.length===I18N.pt.ticker.length,'ticker EN/PT com contagens diferentes');
assert(I18N.en.ticker.length>=10,'ticker perdeu cobertura demais');

// Ratchet de overclaims públicos já conhecidos. Não tenta substituir
// leitura semântica humana; impede apenas o retorno destas formulações específicas.
const guidedEn=[...I18N.en.ticker,...auditedKeys.map(k=>I18N.en[k])].join('\n');
const guidedPt=[...I18N.pt.ticker,...auditedKeys.map(k=>I18N.pt[k])].join('\n');
const banned=[
  [guidedEn,/\bany format\b/i,'blanket any-format claim EN'],
  [guidedPt,/\bqualquer formato\b(?!\s+que\b)/i,'blanket qualquer-formato PT'],
  [guidedEn,/Encrypted messages become statistical noise/i,'chi-square encryption proof EN'],
  [guidedPt,/Mensagens criptografadas viram ruído estatístico/i,'chi-square encryption proof PT'],
  [guidedEn,/Anything locked behind someone else's password/i,'third-party password blanket EN'],
  [guidedPt,/Qualquer coisa trancada pela senha de outra ferramenta/i,'third-party password blanket PT'],
  [guidedEn,/STEGO·STUDIO uses <b>LSBM<\/b>/i,'whole-product LSBM claim EN'],
  [guidedPt,/STEGO·STUDIO usa <b>LSBM<\/b>/i,'whole-product LSBM claim PT'],
  [guidedEn,/Every encode produces <b>two images<\/b>/i,'unconditional two-output claim EN'],
  [guidedPt,/Todo encode gera <b>duas imagens<\/b>/i,'unconditional two-output claim PT'],
  [guidedEn,/survives being posted and, in exchange, anyone looking/i,'absolute robust detectability/survival EN'],
  [guidedPt,/sobrevive à publicação e, em troca, quem procurar/i,'absolute robust detectability/survival PT'],
  [guidedEn,/Both images are generated fresh/i,'unconditional both-images metadata claim EN'],
  [guidedPt,/As duas imagens são geradas do zero/i,'unconditional both-images metadata claim PT'],
  [guidedEn,/PNG, BMP, TIFF/i,'TIFF presented as routine browser-decodable input EN'],
  [guidedPt,/PNG, BMP, TIFF/i,'TIFF presented as routine browser-decodable input PT'],
  [guidedEn,/HEIC\/HEIF is not supported in this build/i,'absolute HEIC support claim EN'],
  [guidedPt,/HEIC\/HEIF não é suportado nesta build/i,'absolute HEIC support claim PT'],
];
for(const [text,rx,label] of banned) assert(!rx.test(text),`stale guidance returned: ${label}`);

// Positive contracts: the corrected nuance itself must remain visible.
assert(I18N.en.encGuideWa.includes('platform pipelines can change') &&
       I18N.pt.encGuideWa.includes('plataformas podem mudar'),
  'measured social-platform boundary lost from Encoder quick guide');
assert(I18N.en.helpRbD.includes('Platform behaviour can change') &&
       I18N.pt.helpRbD.includes('plataformas podem mudar'),
  'measured social-platform boundary lost from How It Works');
assert(I18N.en.decGuide3.includes('compatibility limits') && I18N.pt.decGuide3.includes('limites de compatibilidade'),
  'third-party compatibility boundary lost from quick guide');
assert(I18N.en.decGuide1.includes('HEIC/HEIF') && I18N.en.decGuide1.includes('browser-dependent') &&
       I18N.pt.decGuide1.includes('HEIC/HEIF') && I18N.pt.decGuide1.includes('depende do navegador'),
  'browser-dependent HEIC/HEIF boundary lost from quick guide');
assert(I18N.en.helpS2c.includes('more than one LSB-writing strategy') && I18N.pt.helpS2c.includes('mais de uma estratégia'),
  'mixed LSB-writing strategy explanation lost');
assert(I18N.en.helpS6a.includes('Directly recovered valid payloads') && I18N.pt.helpS6a.includes('Payloads válidos recuperados diretamente'),
  'heuristic-vs-direct-evidence distinction lost');

// Este check é público e roda em checkout limpo do GitHub: ele prende apenas
// contratos verificáveis nos arquivos públicos. A obrigação de revisão humana vive
// em internal/RELEASE_SELF_AUDIT.md e não pode virar dependência do CI público.

process.stdout.write(`public guidance consistency OK — ${auditedKeys.length} fallbacks + ${I18N.en.ticker.length} ticker claims`);
