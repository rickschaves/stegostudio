#!/usr/bin/env node
/*
 * Complemento ao CHECK 76 (O1-S1) — a compactação de build é semanticamente inerte.
 *
 * O CHECK 2 roda `node --check` sobre o app do HTML final: prova SINTAXE.
 * Este check prova EQUIVALÊNCIA: a AST de cada módulo antes e depois de
 * compactJsForBuild() precisa ser idêntica, com posições removidas.
 * `node --check` aceitaria uma compactação que mudasse semântica sem quebrar
 * sintaxe; esta não aceita.
 *
 * Inclui um corpus de armadilhas fixo: ASI, regex vs divisão, template,
 * hashbang, comentário separando tokens.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const acorn = require(path.join(ROOT, 'tools', 'vendor', 'acorn.js'));
const { compactJsForBuild, MODULE_ORDER } = require(path.join(ROOT, 'build.js'));
function assert(c, m) { if (!c) throw new Error(m); }

function ast(code) {
  const tree = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
  return JSON.stringify(tree, (k, v) => {
    if (typeof v === 'bigint') return 'bigint:' + v;
    if (k === 'start' || k === 'end' || k === 'loc' || k === 'range') return undefined;
    return v;
  });
}

let saved = 0;
for (const name of MODULE_ORDER) {
  const raw = fs.readFileSync(path.join(ROOT, 'src', name), 'utf8').replace(/\s+$/, '');
  const out = compactJsForBuild(raw);
  assert(ast(raw) === ast(out), `compactação alterou a AST de src/${name}`);
  saved += raw.length - out.length;
}

const TRAPS = {
  'ASI após return com bloco multilinha': 'function f(){ return /* a\nb */ 1; }',
  'comentário separando tokens': 'var a=1,b=2; var c=a/*x*/+b;',
  // Colar dois tokens que só o comentário separava ainda produz código válido:
  // `typeof a` viraria o identificador `typeofa`. Sintaxe passa, semântica não.
  'comentário separando palavra-chave de operando': 'var a=1; var t=typeof/*x*/a;',
  'comentário separando instanceof': 'var a={},B=Object; var r=a instanceof/*x*/B;',
  'regex contendo sequência de comentário': 'var r=/\\/\\*nao e comentario\\*\\//g; var s=1;',
  'divisão que parece regex': 'var a=4,b=2,c=a/b/*com*/;',
  'template com sequência de comentário': 'var t=`/* nao e comentario */ ${1/2} // nem isso`;',
  'string com //': 'var s="http://x//y"; // real',
  'hashbang': '#!/usr/bin/env node\n// c\nvar a=1;',
  'comentário no fim sem newline': 'var a=1; // fim',
  'bloco inline sem espaço': 'if(a)/*c*/b();',
  'ASI antes de parêntese': 'var a=1\n/* c */\n(function(){})()',
  'getter entre comentários': 'var o={/*a*/get x(){return 1}/*b*/};',
  'continue com label': 'l: for(;;){ continue /* x */ l; }',
  'template aninhado': 'var t=`a${`b/*x*/${1}`}c`;',
  'regex depois de parêntese': 'if(1)/a\\/b/.test("x");',
  'comentário dentro de expressão de template': 'var t=`${ 1 /* c */ + 2 }`;',
  // Produções restritas: são os únicos pontos em que o \n depois de um
  // comentário de LINHA é semanticamente carregado. Sem elas, uma compactação
  // que engolisse esse \n passaria despercebida.
  // Comentário de bloco com CR isolado também contém LineTerminator pela
  // ECMA-262. O compactador precisa preservá-lo como tal, não virar espaço.
  'return restrito por bloco com CR isolado': 'function f(){ return /* c\rb */ 1; }',
  'return restrito por comentário de linha': 'function f(){ return // c\n1; }',
  'postfix restrito por comentário de linha': 'var a=1,b=2;\na // c\n++b;',
  'menos unário depois de comentário de linha': 'var a=1,b=2,c=3;\na = b // c\n-c;',
};
for (const [label, src] of Object.entries(TRAPS)) {
  assert(ast(src) === ast(compactJsForBuild(src)), `compactação alterou a AST no caso: ${label}`);
}

console.log(`build compaction AST OK — ${MODULE_ORDER.length} módulos + ${Object.keys(TRAPS).length} armadilhas com AST idêntica; -${saved.toLocaleString('pt-BR')} B de comentários`);
