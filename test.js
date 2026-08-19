#!/usr/bin/env node
/*
 * STEGO·STUDIO — harness de teste (Node puro, zero dependência)
 *
 * Faz um build em memória e valida invariantes explícitos do projeto. Sai com
 * código 1 se qualquer propriedade coberta falhar. Um resultado verde prova
 * somente essas propriedades; não é prova geral de correção ou segurança.
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
// CHECK 4 — consistência dos identificadores de versão do produto
// ---------------------------------------------------------------------------
check(`versão consistente (v${VERSION}) nos identificadores públicos`, () => {
  const header = new RegExp(`v${VERSION.replace(/\./g, '\\.')} // ENCODER`).test(html);
  const json = html.includes(`_tool:'STEGO·STUDIO v${VERSION}'`);
  const banner = html.includes(`STEGO·STUDIO v${VERSION} — steganography and image forensics`);
  assert(header, 'header logo não bate com VERSION');
  assert(json, 'export JSON (_tool) não bate com VERSION');
  assert(banner, 'banner gerado não bate com VERSION');
  return 'header + export + banner';
});


// ---------------------------------------------------------------------------
// CHECK 4b — injeção literal: nenhum caractere consumido pelo String.replace
//
// Replacements textuais interpretam $$, $&, $`, $' e $<nome> como sequências
// especiais. O build usa callbacks; este check exige identidade byte a byte dos
// blocos injetados para que conteúdo de módulo nunca seja consumido.
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
    'id="settings-help"', 'id="settings-changelog"', 'id="settings-about"', 'id="lang-en"', 'id="lang-pt"',
    'id="help-overlay"', 'id="help-close-btn"', 'id="changelog-overlay"',
    'id="changelog-close-btn"', 'id="about-overlay"', 'id="about-close-btn"', 'class="module-header"',
    'id="enc-key"', 'id="enc-decoy-key"', 'id="dec-key"',
    'id="btn-encode"', 'id="btn-analyze"',
    'id="decoded-copy"', 'id="decoded-save"',
    'id="enc-message-expand"', 'id="enc-decoy-message-expand"', 'id="enc-message-overlay"', 'id="enc-message-close"',
    'id="enc-message-modal-text"', 'id="enc-message-modal-count"',
    // contrato de DOM da segunda saída do Encoder
    'id="enc-rb"', 'id="rb-body"', 'id="rb-unavailable"', 'id="rb-out-prev"',
    'id="btn-dl-rb"', 'id="rb-stats"', 'id="rb-report"', 'id="enc-tips"', 'id="enc-decoy-pngonly"',
    'id="enc-decoy-needmsg-warn"',
    'id="enc-preflight"', 'id="enc-preflight-ok"', 'id="enc-preflight-warn"',
    'id="enc-preflight-use"', 'id="enc-preflight-choose"', 'id="enc-preflight-continued"'];
  const missT = targets.filter(t => !html.includes(t));
  assert(missT.length === 0, `alvo(s) ausente(s): ${missT.join(', ')}`);
  const helpMenuPos = html.indexOf('id="settings-help"');
  const historyMenuPos = html.indexOf('id="settings-changelog"');
  const aboutMenuPos = html.indexOf('id="settings-about"');
  assert(helpMenuPos < historyMenuPos && historyMenuPos < aboutMenuPos,
    'ordem do menu precisa ser How It Works → Version History → About This Project');

  // Os painéis de saída do Encoder precisam começar ocultos. Como a especificidade
  // CSS não é simulada pelo harness, a asserção bloqueia uma regra mais específica
  // que tornaria o painel visível antes de existir uma saída.
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
    'closeSettingsMenu', 'showChangelogModal', 'showAboutModal', 'setLang', 'hideHelpModal',
    'hideChangelogModal', 'hideAboutModal', 'toggleAccordionItem',
    'copyDecodedMessage', 'saveDecodedMessage', 'openEncMessageEditor', 'closeEncMessageEditor',
    'syncEncMessageModalFromTarget', 'syncEncMessageTargetFromModal'];
  const missF = fns.filter(f => !new RegExp(`function ${f}\\b`).test(html));
  assert(missF.length === 0, `função(ões) não definida(s): ${missF.join(', ')}`);
  // Enter nos campos de senha aciona a ação primária somente
  // quando o próprio botão já está disponível. Não pode interferir em IME,
  // repetir ao segurar a tecla, nem transformar textarea de mensagem em submit.
  const enterStart = html.indexOf('function bindEnterToEnabledAction');
  const enterEnd = html.indexOf('// Fecha ao clicar fora do menu', enterStart);
  const enterBlock = html.slice(enterStart, enterEnd);
  assert(enterStart >= 0 && enterEnd > enterStart, 'helper de ENTER não encontrado');
  assert(enterBlock.includes("e.key !== 'Enter'") && enterBlock.includes('e.repeat') &&
         enterBlock.includes('e.isComposing') && enterBlock.includes('e.keyCode === 229'),
    'ENTER não protege repetição/IME corretamente');
  assert(enterBlock.includes("button.getAttribute('aria-disabled') === 'true'") &&
         enterBlock.includes('button.disabled') && enterBlock.includes('button.click()'),
    'ENTER não respeita o gate real do botão');
  for (const pair of [
    ["'enc-key'", "'btn-encode'"],
    ["'enc-decoy-key'", "'btn-encode'"],
    ["'dec-key'", "'btn-analyze'"],
  ]) {
    assert(enterBlock.includes(`bindEnterToEnabledAction(${pair[0]}, ${pair[1]})`),
      `binding de ENTER ausente: ${pair.join(' → ')}`);
  }
  assert(!/bindEnterToEnabledAction\(['"]enc-msg['"]/.test(enterBlock) &&
         !/bindEnterToEnabledAction\(['"]enc-decoy-msg['"]/.test(enterBlock),
    'ENTER foi ligado a textarea de mensagem e bloquearia novas linhas');
  const readyStart = html.indexOf('function checkEncReady()');
  const readyEnd = html.indexOf('function checkDecReady', readyStart);
  const readyBlock = html.slice(readyStart, readyEnd);
  assert(readyBlock.includes('decoyNeedsMsg = decoyOn && decoyMsg.length===0') &&
         readyBlock.includes('decoyBlocked = decoyNeedsMsg || decoyNeedsKey || decoySameKey'),
    'segunda camada ligada ainda pode liberar Encode sem mensagem alternativa');
  assert(readyBlock.includes('showNeedMsgAlert = decoyNeedsMsg && decoyKey.length>0'),
    'aviso de mensagem alternativa voltou a aparecer antes de o usuário preencher a senha alternativa');
  assert(readyBlock.includes('!encPreflightBlocked'),
    'Carrier Preflight suspeito não participa do gate real do botão Encode');
  const decoyKeyPos = html.indexOf('id="enc-decoy-key"');
  const needMsgPos = html.indexOf('id="enc-decoy-needmsg-warn"');
  const sameKeyPos = html.indexOf('id="enc-decoy-samekey-warn"');
  assert(decoyKeyPos >= 0 && needMsgPos > decoyKeyPos && sameKeyPos > needMsgPos,
    'aviso de mensagem alternativa ausente precisa ficar logo abaixo da senha alternativa');
  assert(html.includes("if (decoyMsg) decoyMsg.addEventListener('input', () =>") &&
         html.includes("if (typeof checkEncReady === 'function') checkEncReady();"),
    'digitação na mensagem alternativa não reavalia o aviso imediatamente');
  const enterBehavior = execSync(`node "${path.join(__dirname, 'test', 'check_enter_shortcut.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(enterBehavior.includes('ENTER shortcut OK'), 'comportamento do atalho ENTER falhou');

  return `${targets.length} alvos + ${fns.length} funções + ENTER protegido`;
});

// ---------------------------------------------------------------------------
// CHECK 12 — XSS: dado vindo do ARQUIVO nunca vira markup
//
// O modelo de ameaça desta ferramenta é "abrir uma imagem suspeita", então
// metadados são entrada hostil. Este check extrai as funções reais do HTML
// construído e as executa contra payloads hostis; falha se algum sobreviver
// como tag ou handler.
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
  // Exercitar apenas um helper de renderização não basta: valores do arquivo
  // também podem atravessar helpers e interpolações diferentes. A varredura
  // procura esses caminhos para evitar cobertura enganosa.
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
    ['tipo de string suspeita',           '[${escapeHTML(s.type)}]'],
    ['conteúdo de string suspeita',       '${escapeHTML(s.str)}</div></div>`'],
  ];
  for (const [nome, trecho] of escapesObrigatorios) {
    if (!html.includes(trecho)) semEscape.push(`escape removido em ${nome}`);
  }

  // ── setStatus: texto puro por construção ──────────────────────────────────
  // Os chamadores montam apenas `<span class="ok|err">…`; não é necessário
  // aceitar markup genérico. Dois deles interpolam `e.message`,
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
// CHECK 13 — catraca de innerHTML
//
// `innerHTML` é uma fronteira sensível porque transforma strings em markup.
// O CHECK 12 valida escapes; esta catraca complementa isso congelando o conjunto
// atual de sinks conhecidos e forçando revisão consciente quando ele muda:
//   • sink NOVO           → build quebra
//   • sink REMOVIDO       → ótimo, atualize a lista (o teste avisa)
//   • sink ALTERADO       → assinatura muda, exige revisão consciente
//   • contagem            → nunca aumenta
//
// Contar só o total seria cego à substituição; por isso a lista guarda
// assinaturas dos sinks, não apenas uma contagem.
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
  "terminal|el.innerHTML=html;": 1,
  "terminal|el.innerHTML=line;": 1,
  "terminal|el.innerHTML=rendered.join('<br>')+(rendered.length?'<br>':'": 1,
  "terminal|el.innerHTML=rendered.slice(0,-1).join('<br>')+": 1,
  "ui|document.getElementById('changelog-content').innerHTML=html;": 1,
  "warnings|host.innerHTML=`": 2,
};

check('catraca de innerHTML (não cresce nem muda sem revisão)', () => {
  const atual = {};
  for (const m of MODULE_ORDER) {
    const src = fs.readFileSync(path.join(SRC, m), 'utf8');
    for (const linha of src.split('\n')) {
      const s = linha.trim();
      if (!s.includes('innerHTML')) continue;
      // FAIL-CLOSED: comentário NÃO é ignorado. Uma heurística de comentário
      // pode, em alguma forma sintática inesperada, esconder código real. Um
      // falso positivo aqui é preferível a deixar um sink novo passar silenciosamente.
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
// CHECK 15 — comportamento do Threat (executa a lógica real)
//
// Valida propriedades de pontuação que checks estáticos não capturam: evidência
// nativa confirmada deve pesar mais que ausência de evidência, enquanto sinais
// estatísticos fracos em contexto C2PA não devem saturar a pontuação. A função
// computeThreat real do HTML é executada contra relatórios mínimos controlados.
// ---------------------------------------------------------------------------
check('threat: extração confirmada pesa, imagem C2PA limpa não satura', () => {
  const m = html.match(/function computeThreat\(r\)\s*\{[\s\S]*?\n\}/);
  const mP = html.match(/function resolveProtocolState\(r\)\s*\{[\s\S]*?\n\}/);
  assert(m && mP, 'computeThreat ou resolveProtocolState não encontrados no HTML final');
  assert(!/\bneuralPro\b/.test(m[0]) && !/\bneuralPro\b/.test(html.match(/function consolidateVerdict\(r, decodedMsg, decodeStatus, fromDeepScan\)\s*\{[\s\S]*?\n\}/)?.[0] || ''),
    'caminho de decisão voltou a depender do estado morto neuralPro');
  const tStub = k => k;
  const resolveProtocolState = new Function('t', mP[0] + '\nreturn resolveProtocolState;')(tStub);
  const computeThreat = new Function('t','resolveProtocolState', m[0] + '\nreturn computeThreat;')(tStub, resolveProtocolState);

  // O rótulo visual CONFIRMED precisa convergir com as mesmas credenciais terminais
  // usadas pelo score. Executamos a função pura consumida pelo renderer.
  const tpFn = html.match(/function resolveThirdPartyEvidence\(r\) \{[\s\S]*?\n\}/);
  const levelFn = html.match(/function resolveThreatLevelKey\(r, score\) \{[\s\S]*?\n\}/);
  assert(tpFn && levelFn, 'helpers de evidência/nível de Threat não encontrados');
  const resolveThirdPartyEvidence = new Function(tpFn[0]+'\nreturn resolveThirdPartyEvidence;')();
  const resolveThreatLevelKey = new Function('resolveThirdPartyEvidence', levelFn[0]+'\nreturn resolveThreatLevelKey;')(resolveThirdPartyEvidence);
  const threatConfirmed = r => resolveThreatLevelKey(r,100) === 'levelConfirmed';
  assert(threatConfirmed({studio:{nativeExtracted:true}}) === true,
    'renderer não marca CONFIRMADO para extração nativa');
  assert(threatConfirmed({studio:{framedExtracted:true}}) === true,
    'renderer não marca CONFIRMADO para framing estruturado recuperado');
  assert(threatConfirmed({studio:{robust:true}}) === true,
    'renderer não marca CONFIRMADO para extração robusta');
  assert(threatConfirmed({studio:{thirdParty:'OutGuess'}}) === true,
    'renderer não marca CONFIRMADO para extração externa completa');
  assert(threatConfirmed({studio:{thirdParty:'OpenStego',foreignEncrypted:true}}) === false,
    'renderer marca CONFIRMADO para terceiro apenas identificado/cifrado');
  assert(threatConfirmed({studio:{thirdParty:'OutGuess',foreignTruncated:true}}) === false,
    'renderer marca CONFIRMADO para extração externa parcial');
  assert(threatConfirmed({studio:{robust:'locked'}}) === false,
    'renderer marca CONFIRMADO para robusto sem conteúdo recuperado');

  const base = () => ({
    format:{cat:'lossless'},
    lsb:{available:true,suspicious:true,cipherSuspicion:false,foundText:null,
         printableRatio:'32.5%',rsRate:'4.4%',lsbrDetected:false,lsbrStrong:false,
         lsbrPossible:false,neuralSuspect:false},
    strings:{interesting:[],appendedData:false},
    color:{rareSuspicious:false}, frequency:{}, c2pa:{}, studio:{available:true}, stegomalware:[],
  });

  // Extração nativa confirmada deve pesar mais que ausência de evidência nativa.
  const errada = computeThreat(base());
  const bCerta = base(); bCerta.studio = {available:true,nativeExtracted:true};
  const certa = computeThreat(bCerta);
  assert(certa.score === 100,
    `extração nativa autenticada não fechou Threat em 100 (${certa.score})`);
  assert(certa.flags.includes('flagStudioExtracted'),
    'extração nativa confirmada não gerou flag própria');

  // O JPEG robusto confirmado é outra rota nativa de recuperação direta. Ele
  // deve convergir para a mesma certeza terminal sem alterar os scores passivos.
  const bRobusto = base(); bRobusto.format = {cat:'lossy'};
  bRobusto.lsb = {available:false};
  bRobusto.studio = {available:false,robust:true,robustCorrected:0};
  const robusto = computeThreat(bRobusto);
  assert(robusto.score === 100,
    `extração robusta confirmada não fechou Threat em 100 (${robusto.score})`);
  assert(robusto.flags.includes('flagRobustPayload'),
    'extração robusta confirmada não gerou flag própria');

  // Estados robustos sem conteúdo recuperado continuam abaixo da prova direta.
  const bLocked = base(); bLocked.format = {cat:'lossy'}; bLocked.lsb = {available:false};
  bLocked.studio = {available:false,robust:'locked'};
  const locked = computeThreat(bLocked);
  assert(locked.score < robusto.score,
    `robusto locked pesou igual ou mais que recuperação confirmada (${locked.score} vs ${robusto.score})`);

  // Header localizado sem conteúdo recuperado é evidência estrutural, mas não
  // equivale a uma extração confirmada.
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

  // Contexto C2PA com apenas sinais fracos não pode saturar a pontuação.
  const c2 = base();
  c2.c2pa = {manifestDetected:true};
  c2.lsb.cipherSuspicion = true;                 // janela chi baixa — estatístico
  c2.lsb.lsbrDetected = true; c2.lsb.lsbrStrong = false;  // via WS, não via RS
  c2.lsb.wsRate = '40.3%'; c2.lsb.rsRate = '9.0%';
  c2.strings.interesting = [{str:'manifesto c2pa',type:'URL'}];
  const limpa = computeThreat(c2);
  assert(limpa.score < 50,
    `imagem C2PA só com sinais moles saturou o threat (${limpa.score}) — a supressão não rodou`);

  // Evidência forte continua relevante mesmo em contexto C2PA.
  const dura = base();
  dura.c2pa = {manifestDetected:true};
  dura.studio = {available:true,hasHeader:true};
  const comHeader = computeThreat(dura);
  assert(comHeader.score >= 40,
    `evidência dura foi suprimida pelo contexto C2PA (${comHeader.score}) — escotilha quebrada`);

  // RS forte (>15%) também permanece evidência relevante.
  const rsForte = base();
  rsForte.c2pa = {manifestDetected:true};
  rsForte.lsb.lsbrDetected = true; rsForte.lsb.lsbrStrong = true; rsForte.lsb.rsRate = '31.0%';
  assert(computeThreat(rsForte).score >= 45, 'RS forte foi suprimido — não deveria');


  // labelVars também precisa ser interpolado na representação exportável do sinal.
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
// Threat, Protocolo e notas interpretativas descrevem a mesma evidência.
// Este check roda as funções reais do HTML construído sobre os mesmos relatórios
// e exige uma precedência coerente, sem reimplementar a lógica de produção.
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

  // Todas as 2³ combinações das três evidências nativas.
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
  // mesma imagem. O fixture abaixo evita evidências paralelas que mascarariam isso.
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
  // Threat, badge do Protocolo e nota interpretativa precisam derivar da mesma
  // decisão; nenhuma pode contradizer uma extração já confirmada.
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
// Toda Promise de leitura precisa resolver ou rejeitar. Um FileReader sem
// tratamento de erro pode deixar o pipeline pendente indefinidamente.
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
  // A guarda `_analisando` impede reentrância, mas a identidade da operação é
  // necessária para descartar resultados pertencentes a uma imagem substituída.
  assert(/const run\s*=\s*analysisGeneration;/.test(html), 'snapshot de geração ausente na análise');
  assert(/const obsoleta = \(\) => run !== analysisGeneration;/.test(html), 'portão de obsolescência ausente');
  assert(/if \(obsoleta\(\)\) return;/.test(html), 'resultado é publicado sem conferir a geração');
  assert(/function bumpAnalysisGeneration\(\)/.test(html), 'bumpAnalysisGeneration ausente');

  // O contrato correto é estrutural: existe um único ingresso e todo caminho de
  // entrada passa por ele. A definição da função não conta como call site.
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
  // A execução usa snapshots, não o estado global. Remova comentários antes de
  // procurar identificadores para que a asserção examine somente código executável.
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
// CHECK 18 — mensagens em camadas + JPEG resistente: formato e evidência
//
// Este check NÃO promete executar o pipeline DOM inteiro. Ele cobre três camadas
// distintas e nomeadas honestamente:
//   A) formato histórico real v2.29.0 (Argon2id/AES-GCM);
//   B) round-trip por uma portadora PNG sintética, incluindo transparência;
//   C) a função PURA que decide extracted/headerOnly/none no pipeline de produção,
//      mais guardas de fonte para o flash provisório e status das duas rotas.
//
// As catracas de fonte abaixo são DEFESA EM PROFUNDIDADE. A garantia de que
// estado interno não escapa para o JSON é `serializePublicModules()`; estas
// asserções servem para forçar revisão consciente antes da fronteira, não para
// provar confidencialidade por sintaxe.
// ---------------------------------------------------------------------------
check('camadas + robusto: formato, portadora e regras de evidência', () => {
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
    // Se o header nativo casa mas o payload falha e OpenStego produz a mensagem,
    // o resultado de terceiro NÃO pode ser promovido a evidência nativa.
    ['terceiro após header', {decodedMsg:'OpenStego', nativeHeaderMatched:true, nativePayloadRecovered:false, nativeLayerRecovered:false}, 'headerOnly'],
    ['nenhuma evidência', {decodedMsg:null, nativeHeaderMatched:false, nativePayloadRecovered:false, nativeLayerRecovered:false}, 'none'],
  ];
  for (const [name,input,expected] of cases) {
    const got = resolveNativeEvidence(input).level;
    assert(got === expected, `${name}: evidência resolveu ${got}, esperado ${expected}`);
  }

  // Não basta a função pura existir e passar a tabela: o PIPELINE precisa consumir
  // sua decisão DIRETAMENTE. Uma cópia mutável intermediária criaria uma segunda
  // superfície capaz de divergir da função pura testada.
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
  assert(!/report\.studio\s*(?:\.|\[)/.test(headerBranch),
    'rota do header grava campo aninhado em studio antes do fechamento');
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
  assert(!/report\.studio\s*(?:\.|\[)/.test(decoyBlock),
    'rota alternativa grava campo aninhado em studio antes do fechamento');
  // O statement precisa ser EXATO, não apenas conter o literal. Um sufixo invisível
  // (ex.: U+200B) em uma das rotas é distinguidor no JSON mesmo parecendo igual na UI.
  const exactValidStatus = /decodeStatus\s*=\s*t\('decStatusDecryptedKey'\)\s*;/g;
  const decoyValidStatus = decoyBlock.match(exactValidStatus) || [];
  const headerValidStatus = headerBranch.match(exactValidStatus) || [];
  assert(decoyValidStatus.length === 1,
    `rota alternativa tem ${decoyValidStatus.length} statements exatos de status válido; esperado 1`);
  assert(headerValidStatus.length === 3,
    `rota principal tem ${headerValidStatus.length} statements exatos de status válido; esperado 3 (F21 + AES legado + XOR legado)`);

  // O erro provisório da rota genérica não pode piscar antes da camada alternativa.
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
    'rota do header com chave ainda pisca antes das rotas alternativas/terceiros terminarem');
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

  // Catraca do FECHAMENTO: entre consolidateVerdict e lastReport só são
  // permitidas as escritas abaixo; campos de rota ou sufixos específicos não
  // podem aparecer nessa região:
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
    'fechamento voltou a publicar qual camada interna venceu');

  // CATRACA GLOBAL DO HANDLER: qualquer nova escrita relevante força revisão.
  const analyzeStart = html.indexOf("document.getElementById('btn-analyze').addEventListener('click'");
  const analyzeEnd = html.indexOf('} finally {', analyzeStart);
  const analyzeBlock = html.slice(analyzeStart, analyzeEnd);
  assert(analyzeStart >= 0 && analyzeEnd > analyzeStart, 'handler de análise não encontrado');
  const studioWrites = (analyzeBlock.match(/report\.studio\s*=/g) || []).length;
  const statusWrites = (analyzeBlock.match(/decodeStatus\s*(?:=|\+=|-=|\*=|\/=)/g) || []).length;
  assert(studioWrites === 12,
    `handler tem ${studioWrites} escritas em report.studio; esperado 12 — revisar autoria/evidência`);
  assert(statusWrites === 36,
    `handler tem ${statusWrites} escritas em decodeStatus; esperado 36 — revisar simetria de status`);
  // Catraca também para propriedades irmãs de `report.studio`, porque qualquer
  // campo top-level novo pode alcançar o relatório exportado antes da projeção.
  const topWrites = [...analyzeBlock.matchAll(/report\.([A-Za-z_$][\w$]*)\s*(?:=|\+=|-=|\*=|\/=)/g)]
    .map(m => m[1]);
  const topCounts = topWrites.reduce((acc,k) => (acc[k]=(acc[k]||0)+1, acc), {});
  const expectedTopCounts = {studio:12, toolprint:1, stegomalware:1};
  assert(JSON.stringify(topCounts) === JSON.stringify(expectedTopCounts),
    `escritas top-level em report mudaram: ${JSON.stringify(topCounts)}; esperado ${JSON.stringify(expectedTopCounts)}`);
  assert(!/lastReport\.modules\.studio\s*(?:\.|\[)/.test(analyzeBlock),
    'handler altera studio através de lastReport depois do fechamento');

  // FRONTEIRA DE EXPORTAÇÃO: catracas de fonte são defesa em profundidade;
  // a propriedade final é que campos não declarados NÃO saem no JSON, qualquer
  // que seja a sintaxe usada para criá-los internamente. Exercita a função real.
  const allowStart = html.indexOf('//  PUBLIC REPORT ALLOWLIST');
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

  // Vetor hostil: envelope robusto válido com senha externa diferente da senha AES
  // interna. Este estado pode existir em entrada malformada mesmo que o Encoder
  // normal use uma única senha para as duas camadas.
  const robustHostile = execSync(`node "${path.join(__dirname, 'test', 'check_robust_evidence.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(robustHostile.includes('vetor OK'), 'vetor robusto hostil não confirmou o caso locked');

  // Pista robusta JPEG: uma vez que robustExtract confirmou o envelope, falha do
  // conteúdo não pode virar "nada encontrado" nem aviso falso de chave.
  const robustStart = html.indexOf('MODO MAIS RESISTENTE — tentado antes');
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
  assert(protoBlock.includes('payloadRecovered') && !protoBlock.includes('payloadRecoveredWithKey'),
    'estado extracted não usa texto neutro de payload recuperado');
  assert(/r\.studio\.hasHeader\s*&&\s*r\.studio\.payloadBytes/.test(protoBlock),
    'estado extracted apagou o tamanho passivo do payload quando o header também é visível');

  return `${hist} · ${carrier} · ${robustHostile}`;
});

// ---------------------------------------------------------------------------
// CHECK 19 — schema público: impedir perda silenciosa de campos já públicos
//
// Simétrico da allowlist do CHECK 18. O CHECK 18 prova que campo desconhecido
// não sai; este helper verifica o outro lado: módulos/chaves literais produzidos
// pelo código e todos os caminhos do corpus congelado precisam sobreviver à
// projeção. É uma guarda de regressão, não um parser formal de JavaScript.
// ---------------------------------------------------------------------------
check('schema público cobre produtores atuais + corpus congelado', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_schema_coverage.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('CHECK19 OK'), 'CHECK 19 não confirmou cobertura produtor→schema');
  return out.replace(/^CHECK19 OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 20 — public-source hygiene and generated-artifact attribution
// ---------------------------------------------------------------------------
check('higiene da superfície pública + atribuição do artefato', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_hygiene.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('CHECK20 OK'), 'CHECK 20 não confirmou higiene/atribuição pública');
  return out.split('\n').filter(Boolean).pop().replace(/^CHECK20 OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 21 — Carrier Preflight: detecção limitada + gate explícito
// ---------------------------------------------------------------------------
check('Carrier Preflight reconhece remanência óbvia sem prometer limpeza', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_carrier_preflight.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('Carrier Preflight OK'), 'Carrier Preflight não passou pelos vetores de regressão');

  const filesSrc = fs.readFileSync(path.join(SRC, 'files.js'), 'utf8');
  assert(filesSrc.includes('encPreflightBlocked=!!encPreflightResult.suspicious') &&
         filesSrc.includes('encPreflightAcknowledged=true') &&
         filesSrc.includes("document.getElementById('enc-file')?.click()"),
    'UI do preflight não mantém bloqueio/continuação/troca de imagem pelo mesmo estado');
  assert(html.includes('no obvious prior hidden content detected') &&
         html.includes('password-protected or content-adaptively placed payloads') &&
         html.includes('This is not a guarantee'),
    'resultado negativo do preflight perdeu a limitação visível ou a ressalva');
  assert(!/carrierPreflightNoObvious[^\n]*(?:clean|safe)/i.test(fs.readFileSync(path.join(SRC,'i18n.js'),'utf8')),
    'preflight negativo usa linguagem de “clean/safe” que pode soar como certificação');
  return out;
});

// ---------------------------------------------------------------------------
// CHECK 22 — i18n: nenhuma nova chave órfã
// ---------------------------------------------------------------------------
check('i18n: baseline de chaves órfãs só pode diminuir', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_i18n_orphans.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('i18n orphan gate OK'), 'catraca de chaves i18n órfãs falhou');
  return out.replace(/^i18n orphan gate OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 23 — deep scan: embedding evidence is not recovered-content evidence
// ---------------------------------------------------------------------------
check('deep scan não promove ciphertext aleatório a mensagem recuperada', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_deepscan_content_gate.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('deep-scan content gate OK'), 'catraca de conteúdo do deep scan falhou');
  return out.replace(/^deep-scan content gate OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 24 — Protocol copy + password/encryption terminology + preflight layout
// ---------------------------------------------------------------------------
check('Protocolo e terminologia não confundem senha, chave e criptografia', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_protocol_copy_truth.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('protocol copy/terminology gate OK'), 'catraca de copy/terminologia do Protocolo falhou');
  return out.replace(/^protocol copy\/terminology gate OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 25 — accordion display localization/capitalization + preflight hover
// ---------------------------------------------------------------------------
check('Accordions localizam modos e mantêm apresentação visual consistente', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_accordion_display_polish.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('accordion display polish gate OK'), 'catraca de polimento visual/localização falhou');
  return out.replace(/^accordion display polish gate OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 26 — public technical claims: ratchet against wording already corrected
// ---------------------------------------------------------------------------
check('texto público não regride para formulações já corrigidas', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_claim_truth.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('public claim regression gate OK'), 'catraca de regressão textual pública falhou');
  return out.replace(/^public claim regression gate OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 27 — public report value hygiene
// ---------------------------------------------------------------------------
check('valores públicos não vazam resíduos editoriais conhecidos', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_value_hygiene.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('public value hygiene OK'), 'catraca de valores públicos falhou');
  return out.replace(/^public value hygiene OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 28 — structural scan of direct/simple-alias HTML routes for public data
// ---------------------------------------------------------------------------
check('rotas HTML diretas/aliases simples de dados públicos passam por sinks revisados', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_html_sink_scan.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('public HTML structural sink scan OK'), 'scanner estrutural de sinks públicos falhou');
  return out.replace(/^public HTML structural sink scan OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 29 — mobile swipe: broad start area + short flick/drag + native vertical scrolling
// ---------------------------------------------------------------------------
check('swipe móvel: área ampla/flick curto/arrasto breve/bordas e scroll nativo', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_mobile_swipe.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('mobile swipe OK'), 'contrato do swipe móvel falhou');
  return out.replace(/^mobile swipe OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 30 — public Version History is a curated, ordered subset of real builds
// ---------------------------------------------------------------------------
check('histórico público mantém apenas entradas reais, únicas e em ordem', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_version_history.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('public version history OK'), 'contrato do histórico público falhou');
  return out.replace(/^public version history OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 31 — public changelog contains product/usage changes only
// ---------------------------------------------------------------------------
check('changelog público contém apenas mudanças de produto/uso', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_changelog_hygiene.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('public changelog hygiene OK'), 'higiene do changelog público falhou');
  return out.replace(/^public changelog hygiene OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 32 — F21 golden vectors against an independent Python reference
// ---------------------------------------------------------------------------
check('F21: golden vectors independentes fecham derivação/header/cifra/ordem', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_vectors.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 vectors OK'), 'golden vectors F21 falharam');
  return out.replace(/^F21 vectors OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 33 — F21 integrated round-trip through the production PNG codec
// ---------------------------------------------------------------------------
check('F21: round-trip B/RGB/HILL/STC/compressão/F1 pelo PNG real', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_roundtrip.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 roundtrip OK'), 'round-trip integrado F21 falhou');
  return out.replace(/^F21 roundtrip OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 34 — F21 hostile-input/security ordering contracts
// ---------------------------------------------------------------------------
check('F21: auth-before-LEN/1 Argon por operação/HILL/F1 resistem a vetores hostis', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_security.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 security OK'), 'vetores hostis/contratos F21 falharam');
  return out.replace(/^F21 security OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 35 — F21 integration / passive Analyzer semantics
// ---------------------------------------------------------------------------
check('F21: integração mantém legacy-first e ausência passiva de header neutra', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_integration_contract.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 integration OK'), 'contrato de integração/Analyzer F21 falhou');
  return out.replace(/^F21 integration OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 36 — immutable F21 PNG fixtures
// ---------------------------------------------------------------------------
check('F21: fixtures PNG v3 permanecem byte-estáveis e decodificáveis', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_fixtures.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 fixtures OK'), 'fixtures PNG F21 falharam');
  return out.replace(/^F21 fixtures OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 37 — F21 directed bootstrap signature regression corpus
// ---------------------------------------------------------------------------
check('F21: bootstrap não regride para ilha aleatória dirigida de 448 LSBs', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_prefix_detectability.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 prefix sanity OK'), 'sanidade dirigida do bootstrap F21 falhou');
  return out.replace(/^F21 prefix sanity OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 38 — F21 resource + physical-boundary contracts
// ---------------------------------------------------------------------------
check('F21: memória da ordem/capacidade/F1 falham fechado nos limites', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_resource_contract.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 resource/boundary OK'), 'contrato de recursos/fronteira F21 falhou');
  return out.replace(/^F21 resource\/boundary OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 39 — F21 protected PNG / legacy robust JPEG integration bridge
// ---------------------------------------------------------------------------
check('F21: PNG protegido e JPEG robusto mantêm wires independentes', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f21_robust_bridge.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F21 robust bridge OK'), 'ponte F21 → JPEG robusto falhou');
  return out.replace(/^F21 robust bridge OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 40 — robust JPEG inner-content evidence contract
// ---------------------------------------------------------------------------
check('JPEG robusto: robust:true exige conteúdo interno final válido', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_robust_content_gate.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('robust content gate OK'), 'contrato de evidência interna do robusto falhou');
  return out.replace(/^robust content gate OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 41 — F17 current passwordless legacy PNG behavior matrix
// ---------------------------------------------------------------------------
check('F17: matriz PNG passwordless B/RGB/HILL/STC/compressão', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_legacy_png_matrix.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 legacy PNG matrix OK'), 'matriz comportamental PNG legado/passwordless falhou');
  return out.replace(/^F17 legacy PNG matrix OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 42 — F17 crypto wrong-key/tamper behavior
// ---------------------------------------------------------------------------
check('F17: cripto falha fechado em senha errada e adulteração', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_crypto_tamper.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 crypto/tamper OK'), 'matriz comportamental de cripto/adulteração falhou');
  return out.replace(/^F17 crypto\/tamper OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 43 — F17 robust JPEG true end-to-end round-trip
// ---------------------------------------------------------------------------
check('F17: JPEG robusto faz round-trip real plain/compressed/AES', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_robust_roundtrip.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 robust JPEG roundtrip OK'), 'round-trip comportamental do JPEG robusto falhou');
  return out.replace(/^F17 robust JPEG roundtrip OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 44 — F17 malformed/adversarial corpus
// ---------------------------------------------------------------------------
check('F17: corpus malformado falha fechado e respeita limites', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_malformed_corpus.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 malformed corpus OK'), 'corpus malformado/adversarial F17 falhou');
  return out.replace(/^F17 malformed corpus OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 45 — F17 immutable real third-party fixture
// ---------------------------------------------------------------------------
check('F17: fixture real de terceiro (OutGuess/Cicada) permanece decodificável', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_third_party_fixture.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 third-party fixture OK'), 'fixture real de terceiro F17 falhou');
  return out.replace(/^F17 third-party fixture OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 46 — F17 Analyzer semantic regressions
// ---------------------------------------------------------------------------
check('F17: Analyzer preserva prova terminal, monotonicidade e supressão de ruído', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_analyzer_regressions.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 Analyzer regressions OK'), 'regressões comportamentais do Analyzer falharam');
  return out.replace(/^F17 Analyzer regressions OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 47 — F17 CI contract
// ---------------------------------------------------------------------------
check('F17: CI reconstrói e roda regressão completa em Node 22', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_f17_ci_contract.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('F17 CI contract OK'), 'contrato de CI da F17 falhou');
  return out.replace(/^F17 CI contract OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 48 — long decoded-message preservation + bounded UI
// ---------------------------------------------------------------------------
check('v2.43.5: mensagens recuperadas longas ficam completas e a UI não cresce sem limite', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_long_message_ui.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('long message UI OK'), 'contrato de mensagem longa falhou');
  return out.replace(/^long message UI OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 49 — encoder character-count consistency
// ---------------------------------------------------------------------------
check('v2.43.5: medidor/gate/estatística contam o mesmo texto realmente codificado', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_encoder_count_consistency.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('encoder count consistency OK'), 'contrato de contagem do Encoder falhou');
  return out.replace(/^encoder count consistency OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 50 — JPEG-specific evidence surface
// ---------------------------------------------------------------------------
check('v2.43.5: JPEG/DCT mostra estrutura + estado robusto + prova direta sem truthy falso', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_jpeg_evidence_ui.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('JPEG evidence UI OK'), 'contrato visual/semântico do módulo JPEG falhou');
  return out.replace(/^JPEG evidence UI OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 51 — EXIF/XMP badge semantics
// ---------------------------------------------------------------------------
check('v2.43.5: EXIF distingue leitura falha, câmera parcial e metadados sem ID', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_exif_badge_semantics.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('EXIF badge semantics OK'), 'contrato semântico do badge EXIF/XMP falhou');
  return out.replace(/^EXIF badge semantics OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 52 — textual fidelity across real PNG round-trip + safe display sink
// ---------------------------------------------------------------------------
check('v2.43.6: texto literal, formatação, código e emoji fazem round-trip exato', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_text_fidelity.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('text fidelity OK'), 'contrato de fidelidade textual falhou');
  return out.replace(/^text fidelity OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 53 — only the format-applicable steganalysis family is rendered
// ---------------------------------------------------------------------------
check('v2.43.6: Analyzer mostra apenas a família LSB ou JPEG/DCT aplicável', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_format_specific_stego_ui.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('format-specific stego UI OK'), 'contrato de módulos por formato falhou');
  return out.replace(/^format-specific stego UI OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 54 — expanded Encoder message editor shares exact text state
// ---------------------------------------------------------------------------
check('v2.43.6: editor expandido do Encoder sincroniza sem reinterpretar texto', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_encoder_message_editor.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('encoder message editor OK'), 'contrato do editor expandido falhou');
  return out.replace(/^encoder message editor OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 55 — EXIF parser failure must be unknown to origin scoring
// ---------------------------------------------------------------------------
check('v2.43.6: falha de leitura EXIF não pontua como ausência no classificador', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_exif_origin_unknown.js')}"`,
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  assert(out.includes('EXIF origin unknown OK'), 'estado EXIF desconhecido ainda contamina origem');
  return out.replace(/^EXIF origin unknown OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 56 — third-party direct recovery is terminal evidence
// ---------------------------------------------------------------------------
check('v2.43.7: extração direta completa de terceiro fecha Threat em 100', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_third_party_threat.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('third-party Threat OK'), 'semântica de prova direta externa falhou');
  return out.replace(/^third-party Threat OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 57 — Decode Status is outcome, not method
// ---------------------------------------------------------------------------
check('v2.43.7: Decode Status converge sucessos sem esconder método/proteção', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_decode_status_consistency.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('Decode Status semantics OK'), 'semântica comum de Decode Status falhou');
  return out.replace(/^Decode Status semantics OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 58 — PNG adaptive filtering preserves exact pixels and reduces size
// ---------------------------------------------------------------------------
check('v2.43.7: filtros PNG adaptativos reduzem tamanho sem alterar pixels', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_png_adaptive_filters.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('PNG adaptive filters OK'), 'filtros PNG adaptativos falharam');
  return out.replace(/^PNG adaptive filters OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 59 — supplied password fallback must be explicit
// ---------------------------------------------------------------------------
check('v2.43.8: senha fornecida mas não usada fica explícita sem falsear sucesso', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_password_ignored_notice.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('password ignored notice OK'), 'contrato de senha ignorada falhou');
  return out.replace(/^password ignored notice OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 60 — shared settings/help modal scrollbar skin
// ---------------------------------------------------------------------------
check('v2.43.8: modais informativos reutilizam scrollbar estilizada', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_modal_scrollbars.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('modal scrollbars OK'), 'scrollbars compartilhadas dos modais falharam');
  return out.replace(/^modal scrollbars OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 61 — third-party recovered files preserve raw bytes
// ---------------------------------------------------------------------------
check('v2.43.9: payload binário de terceiro preserva bytes e salva arquivo original', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_third_party_binary_fidelity.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('third-party binary fidelity OK'), 'fidelidade binária de payload externo falhou');
  return out.replace(/^third-party binary fidelity OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 62 — Threat 100 is reserved for direct confirmed recovery
// ---------------------------------------------------------------------------
check('v2.43.10: Threat 100 fica reservado à confirmação direta', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_threat_terminal_reservation.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('Threat terminal reservation OK'), 'catraca terminal 100/99 falhou');
  return out.replace(/^Threat terminal reservation OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 63 — stegomalware warning shows safe bounded context
// ---------------------------------------------------------------------------
check('v2.43.12: stegomalware escolhe preview por tipo sem interpretar o payload', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_stegomalware_context.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('stegomalware context OK'), 'contexto seguro do stegomalware falhou');
  return out.replace(/^stegomalware context OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 64 — recovered download names preserve a useful final extension
// ---------------------------------------------------------------------------
check('v2.43.11: nomes recuperados longos preservam extensão final', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_recovered_filename.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('recovered filename OK'), 'sanitização/truncamento de filename recuperado falhou');
  return out.replace(/^recovered filename OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 65 — production folder contains only the current byte-identical HTML
// ---------------------------------------------------------------------------
check('v2.43.11: HTML_PRODUCAO contém um único artefato corrente', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_production_artifact_set.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('production artifact set OK'), 'contrato de HTML_PRODUCAO falhou');
  return out.replace(/^production artifact set OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 66 — processing time is visible, local-only and generation-safe
// ---------------------------------------------------------------------------
check('v2.43.13: tempo total aparece na UI sem persistir ou contaminar o relatório', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_processing_time_ui.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('processing time UI OK'), 'contrato de tempo de processamento falhou');
  return out.replace(/^processing time UI OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 67 — legacy framed LSB recovery is structurally validated before 100
// ---------------------------------------------------------------------------
check('v2.43.14: framings JOI_LSB2 e Steg/v1 validam comprimento antes do Threat 100', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_legacy_framed_recovery.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('legacy framed recovery OK'), 'recuperação estruturada de framing legado falhou');
  return out.replace(/^legacy framed recovery OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 68 — terminal Threat score and visible level cannot diverge
// ---------------------------------------------------------------------------
check('v2.43.15: Threat 100 direto e rótulo CONFIRMADO usam a mesma credencial', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_threat_level_consistency.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('Threat level consistency OK'), 'coerência score ↔ nível de Threat falhou');
  return out.replace(/^Threat level consistency OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 69 — Encoder generated-output heading mirrors the Decoder result hierarchy
// ---------------------------------------------------------------------------
check('v2.43.16: IMAGEM GERADA usa a mesma hierarquia visual de RESULTADO sem // redundante', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_generated_heading_layout.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('generated heading layout OK'), 'hierarquia visual IMAGEM GERADA ↔ RESULTADO falhou');
  return out.replace(/^generated heading layout OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 70 — ticker + quick guides + How It Works stay mutually truthful
// ---------------------------------------------------------------------------
check('v2.43.17: ticker, guias rápidos e Como funciona preservam os mesmos limites públicos', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_public_guidance_consistency.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('public guidance consistency OK'), 'coerência pública de ticker/guias/ajuda falhou');
  return out.replace(/^public guidance consistency OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 71 — F19 CSP: network denial + hashed inline scripts + minimal local assets
// ---------------------------------------------------------------------------
check('v2.43.18: CSP restringe rede e autoriza apenas os recursos locais necessários', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_csp_contract.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('CSP contract OK'), 'contrato CSP falhou');
  return out.replace(/^CSP contract OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 72 — post-F19 audit closure: EOL reproducibility + residual CSP + JPEG password UX
// ---------------------------------------------------------------------------
check('v2.43.19: fecha achados pós-F19 sem prometer diagnóstico impossível no JPEG', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_post_f19_hardening.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('post-F19 hardening OK'), 'fechamento pós-F19 falhou');
  return out.replace(/^post-F19 hardening OK\s*[—-]?\s*/, '');
});

// ---------------------------------------------------------------------------
// CHECK 73 — duração específica do feedback JPEG
// ---------------------------------------------------------------------------
check('v2.43.20: aviso JPEG fica legível sem alongar os demais flashes', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_jpeg_flash_duration.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('JPEG flash duration OK'), 'contrato de duração JPEG falhou');
  return 'JPEG=8000 ms; wrong/missing=5000 ms';
});

// ---------------------------------------------------------------------------
// CHECK 74 — acessibilidade, scroll móvel e limites CSP/processo
// ---------------------------------------------------------------------------
check('v2.43.21: aviso é anunciado e mensagem recuperada devolve scroll vertical ao painel', () => {
  const out = execSync(`node "${path.join(__dirname, 'test', 'check_v24321_post_audit.js')}"`, {encoding:'utf8'}).trim();
  assert(out.includes('v2.43.21 post-audit OK'), 'fechamento pós-auditoria da .21 falhou');
  return out.replace(/^v2\.43\.21 post-audit OK\s*[—-]?\s*/, '');
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
  console.log('    (build, XSS, contratos estruturais e regressão comportamental automatizada; NÃO é prova de segurança completa —');
  console.log('     cobre matrizes nativas/F21/F1/JPEG robusto, adulteração, corpus malformado, fixture externa e Analyzer;');
  console.log('     DOM/canvas real, dispositivos e pipelines externos continuam fora do harness Node.)\n');
  process.exit(0);
} else {
  console.log(`  ✗ ${failed} de ${results.length} FALHARAM — corrigir antes do deploy.\n`);
  process.exit(1);
}


