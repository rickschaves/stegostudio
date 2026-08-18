#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const targets=['src/i18n.js','template.html','README.md','SECURITY.md','docs/COMPATIBILITY.md'];
const text=targets.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');
function assert(c,m){ if(!c) throw new Error(m); }

// Ratchet: only formulations already corrected are banned here. This is not a
// semantic truth engine; human review is still required for new public claims.
const banned=[
  /For definitive confirmation/i,
  /full spectral analysis/i,
  /confirmação definitiva/i,
  /análise espectral completa/i,
  /Adaptive methods \(LSB Matching, HILL\)/i,
  /Métodos adaptativos \(LSB Matching, HILL\)/i,
  /this tool does not detect them/i,
  /esta ferramenta não os detecta/i,
  /pass them clean/i,
  /passam limpas/i,
  /Camera JPEGs always have EXIF/i,
  /JPEGs de câmera sempre têm EXIF/i,
  /cameras always produce noise/i,
  /câmeras sempre produzem ruído/i,
  /statistically impossible in real photography/i,
  /estatisticamente impossível em fotografia real/i,
  /Clear diffusion-model signature/i,
  /Assinatura clara de modelo de difusão/i,
  /Origin probability/i,
  /Probabilidade de origem/i,
  /most definitive indicator/i,
  /indicador mais definitivo/i,
  /Low probability of hidden content/i,
  /Baixa probabilidade de conteúdo oculto/i,
  /Below the detection threshold — statistically indistinguishable from noise/i,
  /Abaixo do limite de detecção — estatisticamente indistinguível de ruído/i,
];
for(const r of banned) assert(!r.test(text),`stale corrected public wording found: ${r}`);

const i18n=fs.readFileSync(path.join(ROOT,'src/i18n.js'),'utf8');
assert(!i18n.includes('termOriginProbable: "Likely origin"'), 'old likely-origin label returned in EN');
assert(!i18n.includes('termOriginProbable: "Origem provável"'), 'old likely-origin label returned in PT');
const pairs=[
  [
    'LSB Matching, and separately content-adaptive methods such as HILL, UNIWARD and J-UNIWARD, may evade detection',
    'LSB Matching e, separadamente, métodos adaptativos ao conteúdo como HILL, UNIWARD e J-UNIWARD podem escapar da detecção',
    'LSBM/content-adaptive limitation'
  ],
  [
    'Known STEGO·STUDIO payloads may still be recognised or decoded by their format',
    'Payloads conhecidos do STEGO·STUDIO ainda podem ser reconhecidos ou decodificados pelo próprio formato',
    'native-format nuance'
  ],
  [
    'cryptographically verified Content Credentials',
    'Content Credentials verificadas criptograficamente',
    'C2PA provenance wording'
  ],
  [
    'No single detector can conclusively establish AI origin in every case',
    'Nenhum detector isolado consegue estabelecer de forma conclusiva a origem por IA em todos os casos',
    'AI non-certainty wording'
  ],
  [
    'Origin compatibility score',
    'Índice de compatibilidade com origem',
    'origin compatibility framing'
  ],
  [
    'NO SIGNALS',
    'SEM SINAIS',
    'zero-Threat label'
  ],
  [
    'Software metadata reports generation by {software}. Metadata can be edited or copied, so treat this as supporting evidence, not confirmation.',
    'O metadado de software relata geração por {software}. Metadados podem ser editados ou copiados; trate isto como evidência de apoio, não como confirmação.',
    'EXIF software evidence wording'
  ],
  [
    'No LSB Replacement signal was detected in this channel; this does not rule out LSB Matching or content-adaptive embedding.',
    'Nenhum sinal de LSB Replacement foi detectado neste canal; isso não descarta LSB Matching nem embedding adaptativo ao conteúdo.',
    'quiet LSB wording'
  ],
  [
    'It may miss password-protected or content-adaptively placed payloads, including some STEGO·STUDIO outputs.',
    'Ela pode não detectar payloads protegidos por senha ou inseridos de forma adaptativa ao conteúdo, incluindo algumas saídas do STEGO·STUDIO.',
    'Carrier Preflight visible limitation'
  ]
];
for(const [en,pt,label] of pairs){
  assert(i18n.includes(en),`${label} lost in EN`);
  assert(i18n.includes(pt),`${label} lost in PT`);
}

// v2.43.0: the Encoder's own self-check reports only what this tool measured.
assert(i18n.includes('Below this tool’s detection threshold — no strong signal was found in the checks used here.'),
  'Encoder self-check lost scoped non-overclaim wording in EN');
assert(i18n.includes('Abaixo do limite de detecção desta ferramenta — nenhum sinal forte foi encontrado nas verificações usadas aqui.'),
  'Encoder self-check lost scoped non-overclaim wording in PT');


// v2.42.29: the lowest AI bucket must not revert to probability/likelihood vocabulary.
assert(i18n.includes('aiBadgeUnlikely: "VERY LOW SUSPICION"'), 'very-low AI badge lost in EN');
assert(i18n.includes('aiBadgeUnlikely: "SUSPEITA MUITO BAIXA"'), 'very-low AI badge lost in PT');
assert(i18n.includes('aiLevelUnlikely: "VERY LOW"'), 'very-low AI level lost in EN');
assert(i18n.includes('aiLevelUnlikely: "MUITO BAIXA"'), 'very-low AI level lost in PT');
assert(!i18n.includes('aiBadgeUnlikely: "UNLIKELY"') && !i18n.includes('aiBadgeUnlikely: "IMPROVÁVEL"'),
  'AI badge regressed to likelihood/probability vocabulary');
assert(!i18n.includes('aiLevelUnlikely: "UNLIKELY"') && !i18n.includes('aiLevelUnlikely: "IMPROVÁVEL"'),
  'AI verdict level regressed to likelihood/probability vocabulary');
assert(i18n.includes('a compatibility signal with synthetic or code-generated imagery, not a verdict on origin'),
  'entropy/noise interpretation lost the compatibility-only framing in EN');
assert(i18n.includes('um sinal de compatibilidade com imagem sintética ou gerada por código, não um veredito sobre a origem'),
  'entropy/noise interpretation lost the compatibility-only framing in PT');
assert(!/interpEntNoise:[^\n]*(?:probably synthetic|provavelmente sintética|facilitates controlled steganography|facilita esteganografia controlada)/i.test(i18n),
  'entropy/noise interpretation regressed to origin or causal overclaim');

// v2.42.30: short signal labels must not turn heuristics into origin verdicts.
assert(i18n.includes('aiLblVectorArt: "Vector/icon art pattern (flat design)"'),
  'vector-art label lost compatibility-pattern framing in EN');
assert(i18n.includes('aiLblVectorArt: "Padrão de arte vetorial/ícone (flat design)"'),
  'vector-art label lost compatibility-pattern framing in PT');
assert(i18n.includes('aiLblDigitalRender: "Digital-graphic pattern (AI score capped)"'),
  'digital-render label lost non-verdict framing in EN');
assert(i18n.includes('aiLblDigitalRender: "Padrão de gráfico digital (score de IA limitado)"'),
  'digital-render label lost non-verdict framing in PT');
assert(!/aiLbl(?:VectorArt|DigitalRender):[^\n]*(?:Likely|Provável|not an AI image|não imagem de IA)/i.test(i18n),
  'AI signal label regressed to likelihood or negative-origin verdict');

process.stdout.write('public claim regression gate OK');
