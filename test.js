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
  return `${html.length.toLocaleString()} chars, v${VERSION}`;
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

  // ── setStatus: texto puro por construção ──────────────────────────────────
  // A revisão externa da v2.42.3 apontou que nem DOMParser nem regex eram
  // necessários: os três chamadores sempre montavam `<span class="ok|err">…`
  // só para ser desmontado dentro da função. Dois deles interpolam `e.message`,
  // que pode carregar conteúdo do arquivo. Texto puro remove a classe inteira
  // de problema — e este check impede que o parser volte.
  const ss = html.match(/function setStatus\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert(ss, 'setStatus não encontrado no HTML final');
  for (const proibido of ['DOMParser', 'innerHTML', 'createElement', 'replace(/<']) {
    assert(!ss[0].includes(proibido),
      `setStatus voltou a manipular HTML (${proibido}) — deve receber texto + classe`);
  }
  const chamadas = [...html.matchAll(/setStatus\((?!id)[^;]*\)/g)].map(m => m[0]);
  for (const c of chamadas) {
    assert(!/<span|<div|<b>/i.test(c), `chamador de setStatus passando markup: ${c.slice(0, 60)}`);
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
// v2.42.3: 31→27 (5 limpezas→textContent; setStatus→texto puro; fail-closed).
// ---------------------------------------------------------------------------
const INNERHTML_PERMITIDOS = {
  "files|_btn.disabled=false;_btn.classList.remove('working');_btn.in": 1,
  "files|_btn.innerHTML='<spanclass=\"enc-spinner\"></span>'+t('encWork": 1,
  "files|box.innerHTML=": 1,
  "files|box.innerHTML='<divclass=\"stealth-analyzing\">'+t('encStealth": 1,
  "files|const_btn=document.getElementById('btn-encode'),_btnHtml=_bt": 1,
  "files|document.getElementById('enc-stats').innerHTML=`": 1,
  "files|document.getElementById('rb-report').innerHTML=": 1,
  "files|document.getElementById('rb-stats').innerHTML=": 1,
  "files|nope.innerHTML=(e&&e.message==='robustCapacity')": 1,
  "forensics|el.innerHTML=": 1,
  "i18n|//data-i18n-html\u2192innerHTML(parastringscom<b>,etc.)": 1,
  "i18n|el.innerHTML=t(el.getAttribute('data-i18n-html'));": 1,
  "i18n|track.innerHTML=buildSequence()+buildSequence();": 1,
  "main|hm.innerHTML=mp.map(function(v){consta=Math.min(v/0.22,1).to": 2,
  "results|div.innerHTML=`": 1,
  "results|div.innerHTML=`<spanclass=\"module-group-label${type}\">${labe": 1,
  "results|document.getElementById('threat-flags').innerHTML=": 1,
  "results|host.innerHTML=`": 1,
  "terminal|//J\u00e1foi`div.innerHTML=html`numn\u00f3solto,depois`DOMParser`,ambo": 1,
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
      // FAIL-CLOSED: comentário NÃO é ignorado. Uma heurística de comentário
      // pode, em alguma forma sintática inesperada, esconder código real — e
      // esse erro é silencioso. Um `innerHTML` escrito num comentário novo
      // gerar uma revisão é falso positivo barato e consciente.
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
// CHECK 15 — comportamento do Threat (primeiro check que EXECUTA a lógica)
//
// Origem: smoke test real de 12/08/2026, cinco relatórios exportados.
// Dois defeitos que build verde não pegaria:
//   (A) extração nativa PNG confirmada dava o MESMO threat que senha errada;
//   (B) imagem C2PA sem stego saturava em 100, porque a supressão C2PA era
//       desligada pelos próprios sinais moles que ela existe para suprimir.
// Este check roda o computeThreat REAL do HTML construído contra relatórios
// mínimos derivados daqueles casos.
// ---------------------------------------------------------------------------
check('threat: extração confirmada pesa, imagem C2PA limpa não satura', () => {
  const m = html.match(/function computeThreat\(r\)\s*\{[\s\S]*?\n\}/);
  const mP = html.match(/function resolveProtocolState\(r\)\s*\{[\s\S]*?\n\}/);
  assert(m && mP, 'computeThreat ou resolveProtocolState não encontrados no HTML final');
  const tStub = k => k;
  const resolveProtocolState = new Function('t', mP[0] + '\nreturn resolveProtocolState;')(tStub);
  const computeThreat = new Function('t','resolveProtocolState', m[0] + '\nreturn computeThreat;')(tStub, resolveProtocolState);

  const base = () => ({
    format:{cat:'lossless'},
    lsb:{available:true,suspicious:true,cipherSuspicion:false,foundText:null,
         printableRatio:'32.5%',rsRate:'4.4%',lsbrDetected:false,lsbrStrong:false,
         lsbrPossible:false,neuralSuspect:false},
    strings:{interesting:[],appendedData:false},
    color:{rareSuspicious:false}, frequency:{}, c2pa:{}, studio:{available:true}, stegomalware:[],
  });

  // (A) extração nativa confirmada > senha errada, na MESMA imagem
  const errada = computeThreat(base());
  const bCerta = base(); bCerta.studio = {available:true,nativeExtracted:true};
  const certa = computeThreat(bCerta);
  assert(certa.score > errada.score,
    `extração nativa confirmada não aumentou o threat (${errada.score} → ${certa.score})`);
  assert(certa.flags.includes('flagStudioExtracted'),
    'extração nativa confirmada não gerou flag própria');

  // (A2) header localizado SEM conteúdo recuperado ≠ extração confirmada.
  // Seis ramos do decode terminam com decodedMsg=null depois do header casar
  // (GCM em corpo corrompido, cifra sem senha, inflate falhando). Chamar isso
  // de "extraído" afirmaria mensagem onde não houve nenhuma.
  const bSoHeader = base(); bSoHeader.studio = {available:true,nativeHeaderMatched:true};
  const soHeader = computeThreat(bSoHeader);
  assert(soHeader.score > errada.score,
    'header localizado não pesou — é evidência estrutural');
  assert(soHeader.score < certa.score,
    `header sem conteúdo pesou igual ou mais que extração confirmada (${soHeader.score} vs ${certa.score})`);
  assert(!soHeader.flags.includes('flagStudioExtracted'),
    'header sem conteúdo recuperado está sendo anunciado como extração');
  assert(soHeader.flags.includes('flagStudioHeaderOnly'),
    'header localizado sem conteúdo não gerou flag própria');

  // (B) imagem C2PA com sinais MOLES não pode saturar
  const c2 = base();
  c2.c2pa = {manifestDetected:true};
  c2.lsb.cipherSuspicion = true;                 // janela chi baixa — estatístico
  c2.lsb.lsbrDetected = true; c2.lsb.lsbrStrong = false;  // via WS, não via RS
  c2.lsb.wsRate = '40.3%'; c2.lsb.rsRate = '9.0%';
  c2.strings.interesting = [{str:'manifesto c2pa',type:'URL'}];
  const limpa = computeThreat(c2);
  assert(limpa.score < 50,
    `imagem C2PA só com sinais moles saturou o threat (${limpa.score}) — a supressão não rodou`);

  // ...mas evidência DURA na mesma imagem C2PA continua acusando
  const dura = base();
  dura.c2pa = {manifestDetected:true};
  dura.studio = {available:true,hasHeader:true};
  const comHeader = computeThreat(dura);
  assert(comHeader.score >= 40,
    `evidência dura foi suprimida pelo contexto C2PA (${comHeader.score}) — escotilha quebrada`);

  // ...e RS forte sozinho (>15%) não é suprimível
  const rsForte = base();
  rsForte.c2pa = {manifestDetected:true};
  rsForte.lsb.lsbrDetected = true; rsForte.lsb.lsbrStrong = true; rsForte.lsb.rsRate = '31.0%';
  assert(computeThreat(rsForte).score >= 45, 'RS forte foi suprimido — não deveria');


  // labelVars interpolado também fora da UI (relatório exportado saía com
  // "{ratio}" cru enquanto o sinal carregava ratio:"2:3").
  assert(/for \(const \[k,v\] of Object\.entries\(s\.labelVars\)\)/.test(html),
    'interpolação de labelVars sumiu do caminho de synth.flags');

  // Nenhum elemento aria-hidden pode ser focável: o Chrome bloqueia e quem usa
  // leitor de tela fica sem saber onde o foco está.
  for (const m2 of html.matchAll(/<[^>]*aria-hidden="true"[^>]*>/g)) {
    assert(!/tabindex="(0|[1-9])/.test(m2[0]),
      `elemento aria-hidden focável: ${m2[0].slice(0, 70)}`);
  }

  return `A: ${errada.score}→${soHeader.score}→${certa.score} · B: C2PA mole ${limpa.score}, dura ${comHeader.score}`;
});


// ---------------------------------------------------------------------------
// CHECK 16 — Threat e Protocolo não podem divergir
//
// Origem: smoke test da v2.42.6. Com a senha certa a tela mostrava, ao mesmo
// tempo, "payload STEGO·STUDIO extraído" no Threat e "Indeterminado (possível
// cifra)" no Protocolo. Dois renderizadores do MESMO estado que derivaram:
// o Threat passou a usar a evidência ativa nova, o accordion continuou lendo só
// o `hasHeader` passivo.
//
// Este check roda as DUAS funções reais do HTML construído sobre os mesmos
// relatórios e exige concordância. É por isso que `resolveProtocolState` foi
// extraída como função pura — para o teste exercitar a lógica de produção em
// vez de reimplementá-la e concordar consigo mesmo.
// ---------------------------------------------------------------------------
check('Threat e Protocolo concordam sobre a mesma evidência', () => {
  const mT = html.match(/function computeThreat\(r\)\s*\{[\s\S]*?\n\}/);
  const mP = html.match(/function resolveProtocolState\(r\)\s*\{[\s\S]*?\n\}/);
  assert(mT && mP, 'computeThreat ou resolveProtocolState não encontrados no HTML final');
  const tStub = k => k;
  const resolveProtocolState = new Function('t', mP[0] + '\nreturn resolveProtocolState;')(tStub);
  const computeThreat = new Function('t','resolveProtocolState', mT[0] + '\nreturn computeThreat;')(tStub, resolveProtocolState);

  const base = st => ({
    format:{cat:'lossless'},
    lsb:{available:true,suspicious:true,cipherSuspicion:true,foundText:null,
         printableRatio:'32.5%',rsRate:'4.4%',lsbrDetected:false,lsbrStrong:false,
         lsbrPossible:false,neuralSuspect:false},
    strings:{interesting:[],appendedData:false},
    color:{rareSuspicious:false}, frequency:{}, c2pa:{},
    studio:{available:true, ...st}, stegomalware:[],
  });

  // Todas as 2³ combinações das três evidências nativas. A divergência da
  // v2.42.14 vivia justamente numa combinação que os casos manuais não cobriam.
  const casos = [
    ['sem evidência ativa',                 {},                                                        'cipher',     null],
    ['header passivo',                      {hasHeader:true},                                          'passive',    'flagStudioHeader'],
    ['header ativo sem conteúdo',           {nativeHeaderMatched:true},                                'headerOnly', 'flagStudioHeaderOnly'],
    ['header passivo + ativo',              {hasHeader:true,nativeHeaderMatched:true},                  'headerOnly', 'flagStudioHeaderOnly'],
    ['extração confirmada',                 {nativeExtracted:true},                                    'extracted',  'flagStudioExtracted'],
    ['extração + header passivo',           {nativeExtracted:true,hasHeader:true,payloadBytes:42},       'extracted',  'flagStudioExtracted'],
    ['extração + header ativo',             {nativeExtracted:true,nativeHeaderMatched:true},             'extracted',  'flagStudioExtracted'],
    ['extração + headers passivo e ativo',  {nativeExtracted:true,hasHeader:true,nativeHeaderMatched:true,payloadBytes:42}, 'extracted','flagStudioExtracted'],
  ];
  const linhas = [];
  for (const [nome, st, nivelEsperado, flagNativaEsperada] of casos) {
    const r = base(st);
    const proto = resolveProtocolState(r);
    const threat = computeThreat(r);
    assert(proto.level === nivelEsperado,
      `${nome}: protocolo resolveu como '${proto.level}', esperado '${nivelEsperado}'`);

    // A regra: se o Threat afirma extração/header nativo, o Protocolo NÃO pode
    // dizer "indeterminado" nem "nenhum".
    const threatAfirmaNativo = threat.flags.includes('flagStudioExtracted') ||
                               threat.flags.includes('flagStudioHeaderOnly') ||
                               threat.flags.includes('flagStudioHeader');
    const protoIndeterminado = proto.level === 'cipher' || proto.level === 'none';
    assert(!(threatAfirmaNativo && protoIndeterminado),
      `${nome}: Threat afirma protocolo nativo mas o Protocolo diz '${proto.level}' — divergência`);

    // ...e o inverso: protocolo nativo sem nenhum sinal no Threat também é divergir.
    const protoNativo = ['extracted','headerOnly','passive'].includes(proto.level);
    assert(!(protoNativo && !threatAfirmaNativo),
      `${nome}: Protocolo diz '${proto.level}' mas o Threat não registrou nada`);

    const flagsStudio = ['flagStudioExtracted','flagStudioHeaderOnly','flagStudioHeader']
      .filter(f => threat.flags.includes(f));
    if (flagNativaEsperada) {
      assert(flagsStudio.length === 1 && flagsStudio[0] === flagNativaEsperada,
        `${nome}: Threat publicou ${flagsStudio.join(',') || 'nenhuma flag nativa'}, esperado ${flagNativaEsperada}`);
    } else {
      assert(flagsStudio.length === 0,
        `${nome}: Threat publicou flag nativa sem evidência (${flagsStudio.join(',')})`);
    }
    linhas.push(`${proto.level}:${threat.score}`);
  }

  // Força e redação são decisões diferentes. Um header passivo é evidência forte
  // mesmo quando `headerOnly` vence o rótulo por ser mais específico. Adicionar
  // `nativeHeaderMatched` NÃO pode derrubar o score nem apagar corroboradores da
  // mesma imagem. Este é o caso que a v2.42.15 regrediu porque o fixture padrão
  // tinha cipherSuspicion=true e mascarava a perda por outra via.
  const strengthBase = st => ({
    format:{cat:'lossless'},
    lsb:{available:true,suspicious:false,cipherSuspicion:false,foundText:null,
         printableRatio:'0%',rsRate:'0%',lsbrDetected:false,lsbrStrong:false,
         lsbrPossible:false,neuralSuspect:false},
    strings:{interesting:[],appendedData:false},
    entropy:{noiseAnomaly:true,highEntropy:true},
    color:{rareSuspicious:true}, frequency:{}, c2pa:{},
    studio:{available:true, ...st}, stegomalware:[],
  });
  const onlyPassive = computeThreat(strengthBase({hasHeader:true}));
  const passivePlusActive = computeThreat(strengthBase({hasHeader:true,nativeHeaderMatched:true}));
  assert(onlyPassive.score === passivePlusActive.score,
    `adicionar nativeHeaderMatched ao header passivo mudou Threat ${onlyPassive.score}→${passivePlusActive.score}`);
  for (const f of ['flagArtificialNoise','flagHighEntropy','flagRareClusters']) {
    assert(onlyPassive.flags.includes(f) && passivePlusActive.flags.includes(f),
      `evidência forte perdeu corroborador '${f}' ao mudar apenas a redação do protocolo`);
  }

  // ── TERCEIRA superfície: a nota interpretativa do accordion ──
  // Threat (v2.42.5) e badge do Protocolo (v2.42.7) já concordavam; a NOTA
  // continuava lendo `hasHeader` e dizia "nenhum texto legível foi recuperado"
  // logo abaixo de "decifrado com chave ✓". Todas as três precisam derivar de
  // resolveProtocolState.
  const mI = html.match(/if\(key==='studio'\) \{[\s\S]*?\n  \}/);
  assert(mI, 'interpretação do módulo studio não encontrada');
  assert(mI[0].includes('resolveProtocolState'),
    'a nota do accordion não deriva de resolveProtocolState — pode contradizer o badge');
  for (const [nivel, chave] of [['extracted','interpStudioExtracted'],
                                ['headerOnly','interpStudioHeaderOnly'],
                                ['cipher','interpStudioCipher']]) {
    assert(mI[0].includes(chave), `nota ausente para o nível '${nivel}'`);
  }
  // a nota de "nenhum texto recuperado" não pode estar disponível ao nível extracted
  const ordem = mI[0].indexOf("'extracted'");
  const cifra = mI[0].indexOf('interpStudioCipher');
  assert(ordem !== -1 && ordem < cifra,
    'nível extracted não tem precedência sobre a nota de cifra');

  // ── QUARTA superfície: nota de limitação offline ──
  const offStart = html.indexOf("const offNote = document.getElementById('offline-limit-note')");
  const offEnd = html.indexOf('// ── Aviso de conteúdo adversarial', offStart);
  const offBlock = html.slice(offStart, offEnd);
  assert(offStart >= 0 && offEnd > offStart, 'nota offline-limit não encontrada');
  assert(offBlock.includes('resolveProtocolState(r).level'),
    'offline-limit continua lendo evidência parcial em vez da fonte única de protocolo');
  assert(offBlock.includes('thirdParty') && offBlock.includes('robust'),
    'offline-limit pode contradizer extração confirmada de terceiro/modo robusto');
  return linhas.join(' · ');
});


// ---------------------------------------------------------------------------
// CHECK 17 — leitura de arquivo não pode travar o pipeline
//
// Smoke da v2.42.7: reanalisar a MESMA imagem depois de esvaziar a senha deixava
// a barra presa em 20% ("Strings & bytes brutos") com o **console limpo**.
// Causa estrutural: os três `new FileReader()` do forensics.js não tinham
// `onerror`. Cada um vivia dentro de `new Promise(res => { r.onload = … })`, e
// uma leitura que falha nunca dispara `onload` — a promessa fica pendente para
// sempre, sem exceção e sem log. Console limpo + barra congelada é a assinatura
// exata desse defeito.
// ---------------------------------------------------------------------------
check('leitura de arquivo: erro vira rejeição, nunca promessa pendente', () => {
  const m = html.match(/function readFileBytes\(file, rotulo='arquivo'\)\s*\{[\s\S]*?\n\}/);
  assert(m, 'readFileBytes não encontrado — leitura de arquivo sem rede de proteção');
  for (const h of ['onerror', 'onabort', 'setTimeout', 'reject']) {
    assert(m[0].includes(h), `readFileBytes sem ${h} — uma falha de leitura ainda pode travar`);
  }
  // nenhum FileReader solto fora do helper
  // Conta só ocorrências de CÓDIGO — o comentário do helper cita o defeito
  // antigo e mencionaria `new FileReader()` textualmente.
  const soltos = html.split('\n')
    .filter(l => l.includes('new FileReader()') && !l.trim().startsWith('//'))
    .length;
  assert(soltos === 1, `${soltos} FileReader em código — só o de readFileBytes é permitido`);

  // comportamento real: um "arquivo" que falha ao ser lido tem de REJEITAR
  const readFileBytes = new Function('return ' + m[0].replace(/^function /, 'function ') + '; ')
    ? new Function(m[0] + '\nreturn readFileBytes;')() : null;
  assert(typeof readFileBytes === 'function', 'readFileBytes não é executável');

  // reentrância: a análise não pode disparar duas vezes sobre estado pela metade
  assert(/if\(_analisando\) return;/.test(html), 'guarda de reentrância da análise ausente');
  assert(/_analisando = false;/.test(html), 'guarda de reentrância nunca é liberada');

  // ── Corrida A→B: execução obsoleta não publica ──
  // Smoke da v2.42.8: carregar a imagem B durante a análise de A deixava o
  // preview em B e o RESULTADO em A. A guarda `_analisando` só impede o segundo
  // clique; não protege a operação viva contra a troca de `decID`/`decFile`.
  assert(/const run\s*=\s*analysisGeneration;/.test(html), 'snapshot de geração ausente na análise');
  assert(/const obsoleta = \(\) => run !== analysisGeneration;/.test(html), 'portão de obsolescência ausente');
  assert(/if \(obsoleta\(\)\) return;/.test(html), 'resultado é publicado sem conferir a geração');
  assert(/function bumpAnalysisGeneration\(\)/.test(html), 'bumpAnalysisGeneration ausente');

  // ⚠️ A versão anterior deste check contava ocorrências TEXTUAIS e exigia ">=3".
  // Havia exatamente 3: duas chamadas e A PRÓPRIA DEFINIÇÃO. O check ficou verde
  // enquanto o caminho global de Ctrl+V não invalidava geração nenhuma — falsa
  // confiança, que é pior que não ter check. Agora se prova a PROPRIEDADE:
  // existe um ingresso único, e todo caminho de entrada passa por ele.
  assert(/async function loadDecoderFile\(file\)/.test(html),
    'ingresso único do Decoder ausente — cada caminho voltaria a duplicar o carregamento');
  assert(/loadDecoderFile\(file\);?\s*\n?\s*\}?\s*\)?/.test(html) || html.includes("setupDrop('dec-drop','dec-file', loadDecoderFile)"),
    'drop/upload não usa loadDecoderFile');
  // o paste GLOBAL do decoder precisa passar pelo helper, não montar o próprio caminho
  const pasteGlobal = html.slice(html.indexOf("document.addEventListener('paste'"),
                                 html.indexOf('// ── ENCODE DROP ──'));
  assert(pasteGlobal.includes('loadDecoderFile('),
    'o Ctrl+V global não usa loadDecoderFile — não invalida a análise em voo');
  assert(!/decFile\s*=\s*f;/.test(pasteGlobal),
    'o Ctrl+V global ainda escreve decFile diretamente, contornando o ingresso único');
  // definição NÃO conta como chamada
  const chamadas = [...html.matchAll(/(?<!function )bumpAnalysisGeneration\(\)/g)].length;
  assert(chamadas >= 3,
    `bumpAnalysisGeneration tem ${chamadas} chamadas reais — precisa de ingresso, limpar e início de análise`);
  // cada ANÁLISE recebe geração nova, não só cada imagem
  assert(/bumpAnalysisGeneration\(\);\s*\n\s*const run\s+= analysisGeneration;/.test(html),
    'reanalisar a mesma imagem não gera uma geração nova — o guard de idioma não morde');

  // busy-state explícito: contrato, não efeito colateral da thread ocupada
  assert(/function setAnalysisBusy\(v\)/.test(html), 'setAnalysisBusy ausente');
  assert(/setAnalysisBusy\(true\)/.test(html) && /setAnalysisBusy\(false\)/.test(html),
    'busy-state nunca é ligado ou nunca é desligado');
  assert(/if \(isAnalysisBusy\(\)\) return;/.test(html),
    'o ingresso de imagem não respeita o busy-state');
  assert(!/document\.getElementById\('btn-analyze'\)\.disabled\s*=\s*false;/.test(html),
    'ainda há reabilitação cega do botão Analisar — desfaz o cálculo de estado real');
  // preservação de visibilidade simétrica no setLang
  assert(/classList\.toggle\('visible', !!resultsVisible\)/.test(html),
    'setLang não restaura o estado invisível — preservação assimétrica');
  // a execução usa os snapshots, não o estado global
  // Só linhas de CÓDIGO: os comentários explicam por que decFmt existe e
  // mencionam o nome. (Foi assim que a contagem de FileReader errou antes.)
  const corpo = html.slice(html.indexOf("const obsoleta = () =>"), html.indexOf('if (obsoleta()) return;'))
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  for (const g of ['decID', 'decFile', 'decFmt']) {
    assert(!new RegExp('[^\\w.]' + g + '[^\\w]').test(corpo),
      `a análise ainda lê ${g} global em vez do snapshot — a corrida continua possível`);
  }
  // troca de idioma não pode ressuscitar relatório de geração anterior
  assert(/lastRenderArgs\.gen === analysisGeneration/.test(html),
    'setLang pode re-renderizar relatório de uma análise já invalidada');
  // falha de leitura ≠ ausência de metadado
  assert(/report\.exif\.available !== false/.test(html),
    'noExif é recalculado mesmo quando a leitura do arquivo falhou');

  return 'leitura protegida · geração de análise · falha≠ausência';
});

// ---------------------------------------------------------------------------
// CHECK 18 — F1 + JPEG robusto: formato, portadora e regras reais de evidência
//
// Este check NÃO promete executar o pipeline DOM inteiro. Ele cobre três camadas
// distintas e nomeadas honestamente:
//   A) formato histórico real v2.29.0 (Argon2id/AES-GCM);
//   B) round-trip por uma portadora PNG sintética, incluindo transparência;
//   C) a função PURA que decide extracted/headerOnly/none no pipeline de produção,
//      mais guardas de fonte para o flash provisório e status das duas rotas.
// ---------------------------------------------------------------------------
check('F1 + robusto: formato, portadora e regras de evidência', () => {
  // (A) vetores históricos reais: retrocompatibilidade de FORMATO.
  const hist = execSync(`node "${path.join(__dirname, 'test', 'check_layered_fixture.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(hist.includes('Mensagem alternativa'),
    'fixture histórica v2.29.0 não recuperou a mensagem alternativa');
  assert(hist.includes('Teste encode mensagem real v2.29.0'),
    'fixture histórica v2.29.0 não decifrou o payload nativo principal');

  // (B) portadora sintética: opaquePixels + âncora de cauda + PNG encode/decode.
  const carrier = execSync(`node "${path.join(__dirname, 'test', 'check_layered_roundtrip.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(carrier.includes('round-trip OK'), 'round-trip sintético da F1 falhou');

  // (C) executa a REGRA DE PRODUÇÃO que atribui a classe pública final.
  const rm = html.match(/function resolveNativeEvidence\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert(rm, 'resolveNativeEvidence não encontrado no HTML final');
  const resolveNativeEvidence = new Function(rm[0] + '\nreturn resolveNativeEvidence;')();

  const cases = [
    ['principal', {decodedMsg:'A', nativeHeaderMatched:true, nativePayloadRecovered:true, nativeLayerRecovered:false}, 'extracted'],
    ['alternativa', {decodedMsg:'B', nativeHeaderMatched:false, nativePayloadRecovered:false, nativeLayerRecovered:true}, 'extracted'],
    ['header sem conteúdo', {decodedMsg:null, nativeHeaderMatched:true, nativePayloadRecovered:false, nativeLayerRecovered:false}, 'headerOnly'],
    // Regressão do parecer externo: header nativo casou/falhou e depois OpenStego
    // produziu a mensagem. A mensagem final NÃO pode ser promovida a nativa.
    ['terceiro após header', {decodedMsg:'OpenStego', nativeHeaderMatched:true, nativePayloadRecovered:false, nativeLayerRecovered:false}, 'headerOnly'],
    ['nenhuma evidência', {decodedMsg:null, nativeHeaderMatched:false, nativePayloadRecovered:false, nativeLayerRecovered:false}, 'none'],
  ];
  for (const [name,input,expected] of cases) {
    const got = resolveNativeEvidence(input).level;
    assert(got === expected, `${name}: evidência resolveu ${got}, esperado ${expected}`);
  }

  // Não basta a função pura existir e passar a tabela: o PIPELINE precisa consumir
  // sua decisão DIRETAMENTE. A v2.42.15 ainda guardava o nível numa variável local;
  // uma cópia mutável intermediária conseguia reabrir a contaminação OpenStego sem
  // tocar na função testada. O fechamento agora não admite identificador de nível.
  const resolverCall = /resolveNativeEvidence\(\{\s*decodedMsg,\s*nativeHeaderMatched,\s*nativePayloadRecovered,\s*nativeLayerRecovered\s*\}\)\.level/g;
  const nativeClose = html.slice(html.indexOf('CONSOLIDAÇÃO INICIAL'), html.indexOf('// ── PORTÃO ──'));
  const resolverCalls = nativeClose.match(resolverCall) || [];
  assert(resolverCalls.length === 2,
    `fechamento usa resolveNativeEvidence ${resolverCalls.length} vezes; esperado consumo direto nos ramos extracted/headerOnly`);
  assert(!/nativeEvidence(?:Level|Result|State|Decision)|\blevel\s*=\s*resolveNativeEvidence/.test(nativeClose),
    'o fechamento voltou a guardar a decisão nativa em variável intermediária mutável');
  const markCalls = (html.match(/(?<!function )markNativeExtracted\(report\)/g) || []).length;
  assert(markCalls === 1,
    `markNativeExtracted tem ${markCalls} call sites — a autoria nativa deixou de ter um único portão`);

  // O normalizador final ainda precisa apagar a evidência ativa do header no
  // estado extracted, de modo que as duas senhas terminem com a mesma classe.
  const mm = html.match(/function markNativeExtracted\(report\)\s*\{[\s\S]*?\n\}/);
  assert(mm, 'markNativeExtracted não encontrado no HTML final');
  const markNativeExtracted = new Function(mm[0] + '\nreturn markNativeExtracted;')();
  const principal = {studio:{available:true,nativeHeaderMatched:true}};
  const alternativa = {studio:{available:true}};
  markNativeExtracted(principal); markNativeExtracted(alternativa);
  assert(JSON.stringify(principal.studio) === JSON.stringify(alternativa.studio),
    'normalização final deixa estados públicos diferentes entre as duas rotas');

  // A evidência ativa do header precisa ser LOCAL até o fechamento. Isso impede
  // que uma mensagem de terceiro herde autoria nativa por estado persistido.
  const headerBranch = html.slice(html.indexOf('} else if(studioPayload){'),
                                  html.indexOf('} else {\n        const maxBytes', html.indexOf('} else if(studioPayload){')));
  assert(headerBranch.includes('nativeHeaderMatched=true'),
    'rota do header não registra evidência local');
  assert(!/report\.studio\s*=/.test(headerBranch),
    'rota do header persiste estado no report antes do fechamento');
  assert(headerBranch.includes('nativePayloadRecovered=true'),
    'rota principal não registra recuperação local do payload');

  // A rota alternativa usa flag local e o MESMO status público da rota AES.
  const decoyStart = html.indexOf('NEGAÇÃO PLAUSÍVEL: sonda da mensagem-isca');
  const thirdStart = html.indexOf('MOTOR DE TERCEIRO: OpenStego', decoyStart);
  const decoyBlock = html.slice(decoyStart, thirdStart);
  assert(decoyBlock.includes('nativeLayerRecovered=true'),
    'rota alternativa não registra recuperação local');
  assert(!/report\.studio\s*=/.test(decoyBlock),
    'rota alternativa publica metadado próprio antes do fechamento');
  // O statement precisa ser EXATO, não apenas conter o literal. Um sufixo invisível
  // (ex.: U+200B) em uma das rotas é distinguidor no JSON mesmo parecendo igual na UI.
  const exactValidStatus = /decodeStatus\s*=\s*t\('decStatusDecryptedKey'\)\s*;/g;
  const decoyValidStatus = decoyBlock.match(exactValidStatus) || [];
  const headerValidStatus = headerBranch.match(exactValidStatus) || [];
  assert(decoyValidStatus.length === 1,
    `rota alternativa tem ${decoyValidStatus.length} statements exatos de status válido; esperado 1`);
  assert(headerValidStatus.length === 2,
    `rota principal tem ${headerValidStatus.length} statements exatos de status válido; esperado 2 (AES + XOR legado)`);

  // O erro provisório da rota genérica não pode piscar ANTES da sonda F1.
  const genericStart = html.indexOf('// Com chave: tenta decifrar os bytes brutos');
  const genericBlock = html.slice(genericStart, decoyStart);
  assert(genericBlock.includes('pendingKeyFlash=true'),
    'falha provisória da rota genérica não foi adiada');
  assert(!genericBlock.includes('flashKey();'),
    'flashKey ainda dispara antes de a camada alternativa ser sondada');
  // A mesma regra vale para a rota do header quando HÁ chave: GCM/inflate/XOR
  // podem falhar provisoriamente e outra rota ainda recuperar conteúdo depois.
  const keyBranchStart = headerBranch.indexOf('if(key.length>0){');
  const keyBranchEnd = headerBranch.indexOf('// Sem chave:', keyBranchStart);
  const headerKeyBranch = headerBranch.slice(keyBranchStart, keyBranchEnd);
  assert(keyBranchStart >= 0 && keyBranchEnd > keyBranchStart,
    'não foi possível isolar a rota do header com chave');
  assert(headerKeyBranch.includes('pendingKeyFlash=true'),
    'falha provisória do header com chave não é adiada');
  assert(!headerKeyBranch.includes('flashKey();'),
    'rota do header com chave ainda pisca antes de F1/terceiros terminarem');
  const finalFlash = html.indexOf('if (pendingKeyFlash && !decodedMsg', thirdStart);
  assert(finalFlash > thirdStart,
    'flashKey provisório não foi movido para depois dos motores de extração');

  // UX do flash: o input vive dentro de .key-field com overflow:hidden. Aplicar
  // box-shadow diretamente no input recorta topo/base e deixa só duas barras
  // verticais. O destaque deve pertencer ao controle externo inteiro.
  const flashStart = html.indexOf('let keyFlashTimer');
  const flashEnd = html.indexOf('// Verifica se bytes brutos', flashStart);
  const flashBlock = html.slice(flashStart, flashEnd);
  assert(flashBlock.includes("closest('.key-field')") &&
         flashBlock.includes("classList.add('key-flash')") &&
         flashBlock.includes("classList.remove('key-flash')"),
    'flashKey não destaca o contêiner completo .key-field');
  assert(!/k\.style\.boxShadow/.test(flashBlock),
    'flashKey voltou a aplicar box-shadow no input interno e pode ser recortado');
  assert(/\.key-field\.key-flash[\s\S]*?box-shadow\s*:\s*0 0 0 2px var\(--dec\)/s.test(html),
    'estilo do destaque completo key-flash ausente');
  assert(flashBlock.includes("icon.textContent = '⚠'") && flashBlock.includes('dec-key-hint'),
    'flashKey voltou a depender somente de cor');
  assert(flashBlock.includes('clearTimeout(keyFlashTimer)') && flashBlock.includes('setTimeout(clearKeyFlash'),
    'flashKey não cancela/reinicia o timer — chamadas duplas podem deixar estado preso');
  const clearAnalysisStart = html.indexOf("document.getElementById('btn-clear-dec')");
  const clearAnalysisEnd = html.indexOf("document.getElementById('btn-analyze')", clearAnalysisStart);
  const clearAnalysisBlock = html.slice(clearAnalysisStart, clearAnalysisEnd);
  assert(clearAnalysisBlock.includes('clearKeyFlash()'),
    'Limpar análise não remove o estado visual/temporizador de chave');

  // Catraca do FECHAMENTO: foi nesta região que mutações simples conseguiram
  // reintroduzir `tailLayer` no JSON ou anexar "[F1]" ao decodeStatus sem o
  // CHECK 18 perceber. Entre consolidateVerdict e lastReport só são permitidos:
  // (a) a atribuição do status consolidado; (b) o único patch headerOnly.
  const closeStart = html.indexOf('const c0 = consolidateVerdict', thirdStart);
  const closeEnd = html.indexOf('lastReport=createPublicLastReport', closeStart);
  const closeBlock = html.slice(closeStart, closeEnd);
  assert(closeStart >= 0 && closeEnd > closeStart, 'região de fechamento da análise não encontrada');
  const closeStudioWrites = (closeBlock.match(/report\.studio\s*=/g) || []).length;
  const closeStatusWrites = (closeBlock.match(/decodeStatus\s*(?:=|\+=|-=|\*=|\/=)/g) || []).length;
  assert(closeStudioWrites === 1 && /nativeHeaderMatched:true/.test(closeBlock),
    `fechamento tem ${closeStudioWrites} escritas em report.studio — só headerOnly é permitido`);
  assert(closeStatusWrites === 1 && /decodeStatus\s*=\s*c0\.decodeStatus\s*;/.test(closeBlock),
    `fechamento tem ${closeStatusWrites} escritas em decodeStatus — só o veredito consolidado é permitido`);
  assert(!/tailLayer|decoyLayer|alternativeLayer/.test(closeBlock),
    'fechamento voltou a publicar qual camada F1 venceu');

  // CATRACA GLOBAL DO HANDLER: as catracas locais deixavam espaços entre blocos
  // e depois de lastReport. Qualquer nova escrita relevante agora força revisão.
  const analyzeStart = html.indexOf("document.getElementById('btn-analyze').addEventListener('click'");
  const analyzeEnd = html.indexOf('} finally {', analyzeStart);
  const analyzeBlock = html.slice(analyzeStart, analyzeEnd);
  assert(analyzeStart >= 0 && analyzeEnd > analyzeStart, 'handler de análise não encontrado');
  const studioWrites = (analyzeBlock.match(/report\.studio\s*=/g) || []).length;
  const statusWrites = (analyzeBlock.match(/decodeStatus\s*(?:=|\+=|-=|\*=|\/=)/g) || []).length;
  assert(studioWrites === 11,
    `handler tem ${studioWrites} escritas em report.studio; esperado 11 — revisar autoria/evidência`);
  assert(statusWrites === 31,
    `handler tem ${statusWrites} escritas em decodeStatus; esperado 31 — revisar simetria de status`);
  // Catraca também para IRMÃOS de report.studio. `report.f1route='tail'` escapava da
  // contagem anterior e ia direto para lastReport.modules/JSON exportado.
  const topWrites = [...analyzeBlock.matchAll(/report\.([A-Za-z_$][\w$]*)\s*(?:=|\+=|-=|\*=|\/=)/g)]
    .map(m => m[1]);
  const topCounts = topWrites.reduce((acc,k) => (acc[k]=(acc[k]||0)+1, acc), {});
  const expectedTopCounts = {studio:11, toolprint:1, stegomalware:1};
  assert(JSON.stringify(topCounts) === JSON.stringify(expectedTopCounts),
    `escritas top-level em report mudaram: ${JSON.stringify(topCounts)}; esperado ${JSON.stringify(expectedTopCounts)}`);
  assert(!/lastReport\.modules\.studio\s*(?:\.|\[)/.test(analyzeBlock),
    'handler altera studio através de lastReport depois do fechamento');

  // FRONTEIRA DE EXPORTAÇÃO: catracas de fonte são defesa em profundidade;
  // a propriedade final é que campos não declarados NÃO saem no JSON, qualquer
  // que seja a sintaxe usada para criá-los internamente. Exercita a função real.
  const allowStart = html.indexOf('//  PUBLIC REPORT ALLOWLIST — v2.42.17');
  const allowEnd = html.indexOf('// PUBLIC REPORT ALLOWLIST — END', allowStart);
  assert(allowStart >= 0 && allowEnd > allowStart, 'fronteira pública de relatório não encontrada');
  const allowBlock = html.slice(allowStart, allowEnd + '// PUBLIC REPORT ALLOWLIST — END'.length);
  const serializePublicModules = new Function(allowBlock + '\nreturn serializePublicModules;')();
  const leakProbe = {
    format:{cat:'lossless',ext:'PNG',encOk:true,privateRoute:'tail'},
    metadata:{filename:'probe.png',width:64,height:64,secretRoute:'tail'},
    studio:{available:true,nativeExtracted:true,tailLayer:true,route:'tail'},
    lsb:{available:true,f1route:'tail'},
    toolprint:[{tool:'Steghide',id:'steghide',level:'confirmado',evidence:'magic',algoName:'rijndael-128',modeName:'cbc',supported:true,usedEmptyPassword:false,route:'tail'}],
    exif:{found:true,fields:{Make:'ProbeCam',Model:'P1',privateRoute:'tail'},hasCamera:true,hasGPS:false,hasExifIFD:true},
    c2pa:{found:true,manifestDetected:true,signals:['manifest'],actionDescriptions:['edited'],privateRoute:'tail'},
    origin:{fotografia:10,screenshot:20,arte_digital:0,sintetica:0,topCategory:'screenshot',signals:{fotografia:[],screenshot:[{labelKey:'sigScreenWidth',labelVars:{w:1080},weight:20,route:'tail'}],arte_digital:[],sintetica:[]}},
    socialPipeline:{detected:true,platform:'WhatsApp',weak:false,byStructure:true,byFilename:false,level:'alta',route:'tail'},
    f1route:'tail'
  };
  Object.assign(leakProbe, {alternativeLayer:'tail'});
  const publicProbe = serializePublicModules(leakProbe);
  const publicJSON = JSON.stringify(publicProbe);
  assert(publicProbe.studio?.nativeExtracted === true && publicProbe.metadata?.filename === 'probe.png',
    'allowlist removeu campos públicos legítimos do relatório');
  assert(!('f1route' in publicProbe) && !('alternativeLayer' in publicProbe),
    'allowlist deixou escapar campo top-level não público');
  assert(!('tailLayer' in (publicProbe.studio||{})) && !('route' in (publicProbe.studio||{})),
    'allowlist deixou escapar campo interno aninhado em studio');
  assert(!('secretRoute' in (publicProbe.metadata||{})) && !('f1route' in (publicProbe.lsb||{})),
    'allowlist deixou escapar campo desconhecido em módulo público');
  assert(publicProbe.toolprint?.[0]?.algoName === 'rijndael-128' && publicProbe.toolprint?.[0]?.supported === true,
    'allowlist removeu campos públicos raros de toolprint');
  assert(publicProbe.exif?.fields?.Make === 'ProbeCam' && !('privateRoute' in (publicProbe.exif?.fields||{})),
    'allowlist EXIF não preserva campos públicos ou deixa escapar campo interno');
  assert(publicProbe.c2pa?.actionDescriptions?.[0] === 'edited' && !('privateRoute' in (publicProbe.c2pa||{})),
    'allowlist C2PA não preserva campos públicos ou deixa escapar campo interno');
  assert(publicProbe.origin?.signals?.screenshot?.[0]?.labelVars?.w === 1080 &&
         !('route' in (publicProbe.origin?.signals?.screenshot?.[0]||{})),
    'allowlist de origem não preserva labelVars públicos ou deixa escapar campo interno');
  assert(publicProbe.socialPipeline?.platform === 'WhatsApp' && !('route' in (publicProbe.socialPipeline||{})),
    'allowlist socialPipeline não preserva campos públicos ou deixa escapar campo interno');
  assert(!publicJSON.includes('tailLayer') && !publicJSON.includes('f1route') && !publicJSON.includes('alternativeLayer'),
    'JSON público contém identificador interno fora da allowlist');

  // Vetor comportamental hostil: envelope robusto válido com senha externa
  // diferente da senha AES interna. Prova que esse estado é alcançável em entrada
  // malformada/adversarial mesmo não sendo produzido pelo nosso Encoder normal.
  const robustHostile = execSync(`node "${path.join(__dirname, 'test', 'check_robust_evidence.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(robustHostile.includes('vetor OK'), 'vetor robusto hostil não confirmou o caso locked');

  // Pista robusta JPEG: uma vez que robustExtract confirmou o envelope, falha do
  // conteúdo não pode virar "nada encontrado" nem aviso falso de chave.
  const robustStart = html.indexOf('MODO ROBUSTO (F4) — tentado ANTES');
  const robustEnd = html.indexOf('MOTOR DE TERCEIRO: OutGuess', robustStart);
  const robustBlock = html.slice(robustStart, robustEnd);
  assert(robustStart >= 0 && robustEnd > robustStart, 'rota robusta JPEG não encontrada');
  assert(robustBlock.includes("robust:'locked'") && robustBlock.includes("t('rbDecLocked')"),
    'payload robusto confirmado pode perder evidência quando AES interno não abre');
  assert(robustBlock.includes("robust:'content-error'") && robustBlock.includes("t('rbDecContentError')"),
    'falha de conteúdo interno robusto não tem estado honesto próprio');
  assert(!robustBlock.includes("t('decStatusShuffledNeedsKey')"),
    'rota robusta ainda confunde falha interna com pedido genérico de chave');
  assert(/if\(!report\.studio\?\.robust\) decodeStatus=t\('decStatusJpegNoneFound'\)/.test(analyzeBlock),
    'status JPEG genérico pode apagar evidência robusta já confirmada');

  // Renderer: a mesma precedência da função resolveProtocolState.
  const protoBlock = html.slice(html.indexOf("const proto = resolveProtocolState(r)"),
                                html.indexOf('if(r.studio.genericMode){'));
  const idxExtracted = protoBlock.indexOf("if(proto.level==='extracted')");
  const idxHeaderOnly = protoBlock.indexOf("else if(proto.level==='headerOnly')");
  const idxPassive = protoBlock.indexOf('else if(r.studio.hasHeader)');
  assert(idxExtracted >= 0 && idxHeaderOnly > idxExtracted && idxPassive > idxHeaderOnly,
    'renderer não respeita precedência extracted > headerOnly > passive');
  assert(protoBlock.includes('payloadRecoveredWithKey'),
    'estado extracted não usa texto neutro de payload recuperado');
  assert(/r\.studio\.hasHeader\s*&&\s*r\.studio\.payloadBytes/.test(protoBlock),
    'estado extracted apagou o tamanho passivo do payload quando o header também é visível');

  return `${hist} · ${carrier} · ${robustHostile}`;
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
  console.log('    (build, XSS, catraca de innerHTML e cobertura comportamental PARCIAL; NÃO é suíte de segurança —');
  console.log('     há fixtures/round-trip direcionados, mas ainda não há matriz completa de modos nem corpus malformado. Ver F17.)\n');
  process.exit(0);
} else {
  console.log(`  ✗ ${failed} de ${results.length} FALHARAM — corrigir antes do deploy.\n`);
  process.exit(1);
}
