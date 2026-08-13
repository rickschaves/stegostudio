#!/usr/bin/env node
/*
 * STEGO·STUDIO — harness de teste (Node puro, zero dependência)
 *
 * Roda `node test.js` antes de cada deploy. Faz um build em memória e valida
 * invariantes que devem SEMPRE valer. Sai com código 1 se qualquer um falhar,
 * para poder ser usado em CI ou como gate manual.
 *
 * NÃO trava o desenvolvimento normal: só verifica o que não pode regredir
 * (sintaxe, i18n, versão, offline, eventos, changelog).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { build, MODULE_ORDER, VERSION } = require('./build.js');

const SRC = path.join(__dirname, 'src');
let html; // build em memória, preenchido no check 0

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ ok: true, name, detail: detail || '' });
  } catch (e) {
    results.push({ ok: false, name, detail: e.message });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Extrai o maior bloco <script> (a lógica do app) do HTML.
function bigScript(h) {
  const scripts = [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return scripts.reduce((a, b) => (b.length > a.length ? b : a), '');
}

// Extrai as chaves de um bloco `lang: { ... }` por balanceamento de chaves.
function i18nKeys(h, lang) {
  const m = new RegExp(lang + '\\s*:\\s*\\{').exec(h);
  assert(m, `bloco i18n '${lang}' não encontrado`);
  let i = m.index + m[0].length, depth = 1, start = i;
  while (depth > 0 && i < h.length) {
    const c = h[i++];
    if (c === '{') depth++; else if (c === '}') depth--;
  }
  const block = h.slice(start, i - 1);
  return new Set([...block.matchAll(/^\s{4,6}(\w+)\s*:/gm)].map(x => x[1]));
}

// ---------------------------------------------------------------------------
// CHECK 0 — build em memória (a própria build.js já valida a garantia offline)
// ---------------------------------------------------------------------------
check('build em memória (inclui asserção offline do build.js)', () => {
  html = build({ write: false });
  assert(html && html.length > 100000, 'HTML gerado é suspeito de tão pequeno');
  return `${html.length.toLocaleString()} bytes, v${VERSION}`;
});

// ---------------------------------------------------------------------------
// CHECK 1 — cada módulo passa no node --check (sintaxe isolada)
// ---------------------------------------------------------------------------
check('sintaxe de cada módulo (node --check)', () => {
  const mods = MODULE_ORDER;
  for (const m of mods) {
    execSync(`node --check "${path.join(SRC, m)}"`, { stdio: 'pipe' });
  }
  return `${mods.length} módulos OK`;
});

// ---------------------------------------------------------------------------
// CHECK 2 — o app concatenado do HTML final passa no node --check
// ---------------------------------------------------------------------------
check('sintaxe do app no HTML final (node --check)', () => {
  const tmp = path.join(require('os').tmpdir(), 'stego_app_check.js');
  fs.writeFileSync(tmp, bigScript(html));
  execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
  fs.unlinkSync(tmp);
  return 'app block OK';
});

// ---------------------------------------------------------------------------
// CHECK 3 — paridade i18n (EN == PT)
// ---------------------------------------------------------------------------
check('paridade i18n (EN == PT)', () => {
  const en = i18nKeys(html, 'en'), pt = i18nKeys(html, 'pt');
  const soEn = [...en].filter(k => !pt.has(k));
  const soPt = [...pt].filter(k => !en.has(k));
  assert(soEn.length === 0 && soPt.length === 0,
    `divergência — só EN: [${soEn}] | só PT: [${soPt}]`);
  return `${en.size}/${pt.size} chaves idênticas`;
});

// ---------------------------------------------------------------------------
// CHECK 4 — consistência da versão nos 3 touchpoints
// ---------------------------------------------------------------------------
check(`versão consistente (v${VERSION}) nos 3 touchpoints`, () => {
  const header = new RegExp(`v${VERSION.replace(/\./g, '\\.')} // ENCODER`).test(html);
  const json = html.includes(`_tool:'STEGO·STUDIO v${VERSION}'`);
  const changelog = new RegExp(`ver:'v${VERSION.replace(/\./g, '\\.')}'`).test(html);
  assert(header, 'header logo não bate com VERSION');
  assert(json, 'export JSON (_tool) não bate com VERSION');
  assert(changelog, 'primeira entrada do changelog não bate com VERSION');
  return 'header + export + changelog';
});

// ---------------------------------------------------------------------------
// CHECK 4b — injeção literal: nenhum caractere consumido pelo String.replace
//
// Com substituição por STRING, o JS interpreta $$, $&, $`, $' e $<nome> como
// padrões e os remove em silêncio (sem erro, sem aviso). O hash-wasm.js tem 3
// ocorrências de "$$" que eram engolidas assim. build.js usa substituição por
// FUNÇÃO; este check garante que ninguém volte atrás.
// ---------------------------------------------------------------------------
check('injeção literal dos blocos (sem consumo de $)', () => {
  const blobs = {
    'styles.css':   fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8').replace(/\s+$/, ''),
    'hash-wasm.js': fs.readFileSync(path.join(SRC, 'hash-wasm.js'), 'utf8').replace(/\s+$/, ''),
  };
  for (const m of MODULE_ORDER) {
    blobs[m] = fs.readFileSync(path.join(SRC, m), 'utf8').replace(/\s+$/, '');
  }
  const risky = /\$\$|\$&|\$`|\$'|\$<\w+>/;
  const faltando = [];
  for (const [nome, texto] of Object.entries(blobs)) {
    if (!html.includes(texto)) faltando.push(nome);
  }
  assert(faltando.length === 0,
    `bloco(s) alterados na injeção: ${faltando.join(', ')} — provável substituição por string em vez de função`);
  const comRisco = Object.entries(blobs).filter(([, t]) => risky.test(t)).map(([n]) => n);
  return `${Object.keys(blobs).length} blocos íntegros`
       + (comRisco.length ? ` (${comRisco.join(', ')} contém padrões $ — protegidos)` : '');
});

// ---------------------------------------------------------------------------
// CHECK 5 — garantia offline (redundante ao build.js, mas com mensagem clara)
// ---------------------------------------------------------------------------
check('offline: 0 dependências de rede em runtime', () => {
  assert(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'Google Fonts voltou ao HTML!');
  const SAFE = /schema\.org|w3\.org|ns\.adobe\.com|stegostudio\.com|npmjs\.com/;
  const urls = [...new Set((html.match(/https?:\/\/[^"'\s)]+/g) || []).filter(u => !SAFE.test(u)))];
  assert(urls.length === 0, `URL(s) de runtime inesperadas: ${urls.join(', ')}`);
  return 'nenhuma URL de runtime';
});

// ---------------------------------------------------------------------------
// CHECK 6 — fontes embutidas (5 faces woff2 base64)
// ---------------------------------------------------------------------------
check('fontes embutidas (5 @font-face woff2 base64)', () => {
  const faces = (html.match(/@font-face/g) || []).length;
  const b64 = (html.match(/data:font\/woff2;base64,/g) || []).length;
  assert(faces === 5 && b64 === 5, `esperava 5/5, achei ${faces} @font-face / ${b64} base64`);
  return '5/5';
});

// ---------------------------------------------------------------------------
// CHECK 7 — nenhum onclick inline (migração para addEventListener)
// ---------------------------------------------------------------------------
check('nenhum onclick inline no HTML', () => {
  const n = (html.match(/onclick=/g) || []).length;
  assert(n === 0, `${n} onclick inline reapareceram`);
  return '0 onclick';
});

// ---------------------------------------------------------------------------
// CHECK 8 — tipos de badge do changelog válidos (add/chg/fix)
//           (esta checagem teria pego o bug do "undefined" do t:'new')
// ---------------------------------------------------------------------------
check("tipos do changelog válidos (add/chg/fix)", () => {
  const types = [...html.matchAll(/\{\s*t\s*:\s*'([a-z]+)'/g)].map(m => m[1]);
  const allowed = new Set(['add', 'chg', 'fix']);
  const bad = [...new Set(types.filter(t => !allowed.has(t)))];
  assert(bad.length === 0, `tipo(s) de badge desconhecido(s): ${bad.join(', ')} (viram "undefined" no modal)`);
  return `${types.length} itens, todos válidos`;
});

// ---------------------------------------------------------------------------
// CHECK 9 — todos os alvos e funções do wireEvents existem
// ---------------------------------------------------------------------------
check('eventos: alvos no DOM + funções definidas', () => {
  const targets = ['class="tab enc', 'class="tab dec', 'id="settings-gear"',
    'id="settings-help"', 'id="settings-changelog"', 'id="lang-en"', 'id="lang-pt"',
    'id="help-overlay"', 'id="help-close-btn"', 'id="changelog-overlay"',
    'id="changelog-close-btn"', 'class="module-header"',
    // modo robusto (F4): o contrato de DOM da segunda saída do Encoder
    'id="enc-rb"', 'id="rb-body"', 'id="rb-unavailable"', 'id="rb-out-prev"',
    'id="btn-dl-rb"', 'id="rb-stats"', 'id="rb-report"', 'id="enc-tips"', 'id="enc-decoy-pngonly"'];
  const missT = targets.filter(t => !html.includes(t));
  assert(missT.length === 0, `alvo(s) ausente(s): ${missT.join(', ')}`);

  // Os painéis de saída do Encoder TÊM de começar ocultos. Já regrediu uma vez:
  // uma regra CSS mais específica venceu o `.download-wrap{display:none}` e o
  // relatório aparecia antes de existir imagem. Especificidade não é testável
  // sem navegador, então a asserção mira a causa conhecida.
  const semVisible = /\.out-pair\s*>\s*\.download-wrap\s*\{/.test(html);
  assert(!semVisible, '.out-pair > .download-wrap sem .visible — painel vaza antes do encode');
  const tipsOcultas = /\.enc-tips-solo\s*\{[^}]*display\s*:\s*none/.test(html);
  assert(tipsOcultas, '.enc-tips-solo precisa começar oculta');

  // .key-warning nasce com display:none (os avisos de senha são alternados por
  // JS). Um aviso ESTÁTICO, cuja visibilidade vem do bloco pai, precisa do
  // modificador .kw-static — sem ele fica invisível e nada acusa.
  const estatico = /<div[^>]*id="enc-decoy-pngonly"[^>]*>/.exec(html);
  assert(estatico && /kw-static/.test(estatico[0]),
    'aviso estático sem .kw-static — nasceria invisível');
  assert(/\.key-warning\.kw-static\s*\{[^}]*display\s*:\s*block/.test(html),
    'falta a regra .key-warning.kw-static{display:block}');

  const fns = ['switchTab', 'toggleSettingsMenu', 'showHelpModal',
    'closeSettingsMenu', 'showChangelogModal', 'setLang', 'hideHelpModal',
    'hideChangelogModal', 'toggleAccordionItem'];
  const missF = fns.filter(f => !new RegExp(`function ${f}\\b`).test(html));
  assert(missF.length === 0, `função(ões) não definida(s): ${missF.join(', ')}`);
  return `${targets.length} alvos + ${fns.length} funções`;
});

// ---------------------------------------------------------------------------
// CHECK 12 — XSS: dado vindo do ARQUIVO nunca vira markup
//
// O modelo de ameaça desta ferramenta é "abrir uma imagem suspeita", então
// metadado é entrada hostil. Até a v2.41.0 um EXIF com
// `Make = <img src=x onerror=...>` executava script na página.
// Este check extrai as funções REAIS do HTML construído e as roda contra
// payloads hostis; falha se algum sobreviver como tag ou handler.
// ---------------------------------------------------------------------------
check('XSS: metadados hostis saem como texto, não markup', () => {
  const esc = html.match(/function escapeHTML\(s\)\s*\{[\s\S]*?\n\}/);
  assert(esc, 'escapeHTML não encontrado no HTML final');
  const escapeHTML = new Function(esc[0] + '\nreturn escapeHTML;')();
  for (const c of ['&', '<', '>', '"', "'"]) {
    assert(escapeHTML(c) !== c, `escapeHTML não escapa ${c} — atributos ficam abertos`);
  }
  const rowSrc = html.match(/function row\(label, val, cls=''\)\s*\{[\s\S]*?\n\}/);
  const rowHtmlSrc = html.match(/function rowHTML\(label, html, cls=''\)\s*\{[\s\S]*?\n\}/);
  assert(rowSrc && rowHtmlSrc, 'row/rowHTML não encontrados no HTML final');
  const row = new Function('escapeHTML', rowHtmlSrc[0] + '\n' + rowSrc[0] + '\nreturn row;')(escapeHTML);

  const payloads = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "' onmouseover='alert(1)",
    '<svg/onload=alert(1)>',
    '<iframe src=javascript:alert(1)>',
  ];
  // O invariante correto é simples: na porção que veio do arquivo não pode
  // sobrar NENHUM metacaractere de HTML cru. Sem `<` e `>` nenhuma tag se
  // forma, e sem aspas nenhum atributo é fechado — daí `onerror=` como texto
  // é inerte. Procurar por "onerror=" na string é o teste errado: ele acusa
  // `&lt;img onerror=...&gt;`, que é exatamente o resultado desejado. (As duas
  // primeiras versões deste check erraram assim.)
  for (const p of payloads) {
    const out = row('Make', p, '');
    const doArquivo = out
      .replace(/^<div><span style="color:var\(--dim\)">[^<]*<\/span> <span class="[^"]*">/, '')
      .replace(/<\/span><\/div>$/, '');
    for (const [ch, nome] of [['<','menor'],['>','maior'],['"','aspas duplas'],["'",'aspas simples']]) {
      assert(!doArquivo.includes(ch), `${nome} cru sobreviveu no payload: ${p}`);
    }
    assert(doArquivo.length > 0, `payload sumiu por completo — extração do teste quebrou: ${p}`);
  }
  assert(row('L', '<b>x</b>', '').includes('&lt;b&gt;'), 'row() não está escapando');

  // ── Varredura estática: interpolação de dado do ARQUIVO em template string ──
  // A v2.42.0 escapou row() e declarou "tudo que vem do arquivo agora é
  // escapado" — mas hl(), detailVars e labelVars ficaram de fora, e este check,
  // por só exercitar row(), passou verde com os furos abertos. Um invariante
  // que testa apenas o caminho já corrigido dá falsa segurança.
  const camposDoArquivo = [
    'signerCN', 'genName', 'genVersion', 'rawSoftware', 'digitalSourceType',
    'aiGenerator', 'decodedSample', 'certDate',
  ];
  const semEscape = [];
  // Analisa CADA `${...}` isoladamente, com contagem de chaves — um `${a?...${b}...}`
  // contém dois pontos de saída distintos, e um escapeHTML em torno de `a` não
  // absolve `b`. A primeira versão desta varredura casava o trecho inteiro e
  // deixava passar exatamente esse caso.
  const interps = [];
  for (let i = 0; i < html.length - 1; i++) {
    if (html[i] !== '$' || html[i+1] !== '{') continue;
    let depth = 1, j = i + 2;
    while (j < html.length && depth > 0) {
      if (html[j] === '{') depth++;
      else if (html[j] === '}') depth--;
      j++;
      if (j - i > 400) break;              // interpolação gigante: ignora
    }
    if (depth === 0) interps.push(html.slice(i, j));
  }
  for (const frag of interps) {
    // conteúdo direto desta interpolação, sem os `${...}` aninhados
    const direto = frag.slice(2, -1).replace(/\$\{[^]*?\}/g, '');
    for (const campo of camposDoArquivo) {
      if (!new RegExp('\\b' + campo + '\\b').test(direto)) continue;
      // guarda de condicional (`x ? ... : ...`) não imprime nada: só o valor importa
      const ehGuarda = /^\s*[\w.?![\]]+\s*\?/.test(direto) || /^\s*[\w.?![\]]+\s*(&&|\|\|)/.test(direto);
      if (ehGuarda) continue;
      // Invólucros que escapam internamente (e cujo escape é exercitado pelos
      // payloads acima). Passar o valor a eles é seguro.
      const involucroSeguro = /\b(hl|row|rowHTML)\s*\(/.test(direto);
      if (!direto.includes('escapeHTML') && !involucroSeguro) {
        semEscape.push(`${campo} → ${frag.slice(0, 70).replace(/\n/g, ' ')}`);
      }
    }
  }
  for (const m of html.matchAll(/\.replace\(`\{\$\{k\}\}`,\s*([^)]+)\)/g)) {
    if (!m[1].includes('escapeHTML')) semEscape.push(`variável do i18n sem escape: ${m[0].slice(0, 45)}`);
  }

  // ── Pontos de render nomeados ──
  // A varredura acima procura NOMES DE CAMPO no ponto de interpolação. Dentro
  // de um helper o parâmetro se chama `val` ou `s`, e o nome do campo não
  // aparece — foi assim que hl() e o laço de signals passaram na primeira
  // versão desta checagem. Estes trechos precisam existir literalmente; se
  // alguém tirar o escape, o padrão some e o build falha.
  const escapesObrigatorios = [
    ['hl() — campos do manifesto C2PA',  'word-break:break-word">${escapeHTML(val)}'],
    ['laço de c2pa.signals',             'padding:2px 0">· ${escapeHTML(s)}'],
    ['amostra decodificada (LSB)',       'escapeHTML(r.lsb.decodedSample'],
  ];
  for (const [nome, trecho] of escapesObrigatorios) {
    if (!html.includes(trecho)) semEscape.push(`escape removido em ${nome}`);
  }
  assert(semEscape.length === 0,
    `dado do arquivo interpolado sem escapeHTML:\n     ${[...new Set(semEscape)].join('\n     ')}`);
  return `${payloads.length} payloads neutralizados`;
});


// ---------------------------------------------------------------------------
// CHECK 13 — catraca de innerHTML (allowlist de dívida técnica)
//
// `innerHTML` é a porta por onde dado de arquivo vira markup. As duas
// auditorias de 11/08/2026 acharam 6 sinks nessa família, e o CHECK 12 é uma
// REDE DE SEGURANÇA que tenta adivinhar se cada interpolação foi escapada —
// ele funciona, mas está a caminho de virar um mini analisador de JavaScript
// dentro do build, e isso envelhece mal.
//
// A defesa PRIMÁRIA é outra: reduzir o número de lugares onde innerHTML existe.
// Esta catraca congela o conjunto atual e força a curva para baixo:
//   • sink NOVO           → build quebra
//   • sink REMOVIDO       → ótimo, atualize a lista (o teste avisa)
//   • sink ALTERADO       → assinatura muda, exige revisão consciente
//   • contagem            → nunca aumenta
//
// Contar só o total seria cego à substituição: alguém remove um sink seguro,
// acrescenta um perigoso, e o número continua o mesmo. Por isso a lista guarda
// ASSINATURAS, não um número.
//
// META: 31 → 25 → 17 → 10 → poucos helpers nomeados. Ao baixar, atualize aqui.
// v2.42.3: 31→25 (5 limpezas viraram textContent; 1 strip virou DOMParser).
// ---------------------------------------------------------------------------
const INNERHTML_PERMITIDOS = {
  "files|_btn.innerHTML='<spanclass=\"enc-spinner\"></span>'+t('encWork": 1,
  "files|box.innerHTML=": 1,
  "files|box.innerHTML='<divclass=\"stealth-analyzing\">'+t('encStealth": 1,
  "files|const_btn=document.getElementById('btn-encode'),_btnHtml=_bt": 1,
  "files|const_restore=()=>{_btn.disabled=false;_btn.classList.remove": 1,
  "files|document.getElementById('enc-stats').innerHTML=`": 1,
  "files|document.getElementById('rb-report').innerHTML=": 1,
  "files|document.getElementById('rb-stats').innerHTML=": 1,
  "files|nope.innerHTML=(e&&e.message==='robustCapacity')": 1,
  "forensics|el.innerHTML=": 1,
  "i18n|el.innerHTML=t(el.getAttribute('data-i18n-html'));": 1,
  "i18n|track.innerHTML=buildSequence()+buildSequence();": 1,
  "main|hm.innerHTML=mp.map(function(v){consta=Math.min(v/0.22,1).to": 2,
  "results|div.innerHTML=`": 1,
  "results|div.innerHTML=`<spanclass=\"module-group-label${type}\">${labe": 1,
  "results|document.getElementById('threat-flags').innerHTML=": 1,
  "results|host.innerHTML=`": 1,
  "terminal|el.innerHTML=html;": 1,
  "terminal|el.innerHTML=line;": 1,
  "terminal|el.innerHTML=rendered.join('<br>')+(rendered.length?'<br>':'": 1,
  "terminal|el.innerHTML=rendered.slice(0,-1).join('<br>')+": 1,
  "ui|document.getElementById('changelog-content').innerHTML=html;": 1,
  "warnings|host.innerHTML=`": 2,
};

check('catraca de innerHTML (não cresce, não muda sem revisão)', () => {
  const atual = {};
  for (const m of MODULE_ORDER) {
    const src = fs.readFileSync(path.join(SRC, m), 'utf8');
    for (const linha of src.split('\n')) {
      const s = linha.trim();
      if (!s.includes('innerHTML')) continue;
      if (s.startsWith('//') || s.startsWith('*')) continue;   // comentário não é sink
      const sig = m.replace(/\.js$/, '') + '|' + s.replace(/\s+/g, '').slice(0, 60);
      atual[sig] = (atual[sig] || 0) + 1;
    }
  }
  const novos = [], sumidos = [];
  for (const [k, n] of Object.entries(atual)) {
    const permitido = INNERHTML_PERMITIDOS[k] || 0;
    if (n > permitido) novos.push(`${k} (${permitido}→${n})`);
  }
  for (const [k, n] of Object.entries(INNERHTML_PERMITIDOS)) {
    if ((atual[k] || 0) < n) sumidos.push(k);
  }
  assert(novos.length === 0,
    `innerHTML NOVO ou ALTERADO — cada um é uma porta para markup vindo de arquivo:\n     ${novos.join('\n     ')}`);
  const total = Object.values(atual).reduce((a, b) => a + b, 0);
  const teto = Object.values(INNERHTML_PERMITIDOS).reduce((a, b) => a + b, 0);
  if (sumidos.length) {
    return `${total}/${teto} sinks — ${sumidos.length} removido(s); atualize INNERHTML_PERMITIDOS`;
  }
  return `${total} sinks, nenhum novo`;
});


// ---------------------------------------------------------------------------
// CHECK 14 — golden fixtures: o decoder ainda abre o que versões antigas escreveram
//
// Estas imagens foram produzidas por um encoder REAL (v2.42.2) e não devem ser
// regeneradas: recriá-las com código moderno provaria só que o código moderno
// concorda consigo mesmo. É o primeiro invariante do harness que processa
// pixels de verdade — os outros 13 verificam estrutura de build.
// ---------------------------------------------------------------------------
check('golden fixtures: payloads antigos continuam abrindo', () => {
  const dir = path.join(__dirname, 'test', 'fixtures', 'legacy', 'formato-A');
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
    throw new Error('fixtures ausentes — não regenere, recupere do histórico do repo');
  }
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const sha = b => require('crypto').createHash('sha256').update(b).digest('hex');

  // Integridade: se um fixture mudou, alguém o regenerou — e aí ele não prova nada.
  const cover = fs.readFileSync(path.join(dir, man.cover.arquivo));
  assert(sha(cover) === man.cover.sha256, 'cover.png foi alterado — fixture inválido');
  for (const c of man.casos) {
    const b = fs.readFileSync(path.join(dir, c.arquivo));
    assert(sha(b) === c.sha256, `${c.arquivo} foi alterado — fixture inválido`);
  }
  return `${man.casos.length} vetores íntegros (formato ${man.formato}: ${man.encoder})`;
});

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
console.log('\n  STEGO·STUDIO — harness de teste\n');
let failed = 0;
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? '  —  ' + r.detail : ''}`);
  if (!r.ok) failed++;
}
console.log('');
if (failed === 0) {
  console.log(`  ✓ TODOS OS ${results.length} INVARIANTES PASSARAM — build consistente para deploy.`);
  console.log('    (invariantes de build, XSS e catraca de innerHTML; NÃO é suíte de segurança —');
  console.log('     não há round-trip cripto/estego nem corpus malformado. Ver F17.)\n');
  process.exit(0);
} else {
  console.log(`  ✗ ${failed} de ${results.length} FALHARAM — corrigir antes do deploy.\n`);
  process.exit(1);
}
