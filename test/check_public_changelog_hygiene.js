#!/usr/bin/env node
'use strict';

// CHECK 31 — public changelog content hygiene.
// Version History is curated to product/usage changes (CHECK 30 validates that
// every public entry maps to a real build and keeps chronology). Audit methodology, harness details,
// mutation diaries, release-process notes and repository-maintenance narrative
// belong in the internal technical changelog / review briefing instead.

const fs=require('fs');
const path=require('path');
function assert(c,m){ if(!c) throw new Error(m); }
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
const md=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8');

const a=ui.indexOf('const CHANGELOG = [');
const b=ui.indexOf('function renderChangelog', a);
assert(a>=0 && b>a, 'public Version History arrays not found');
const site=ui.slice(a,b);

const forbidden=[
  [/\bCHECK\s*\d+\b/i, 'CHECK number / harness implementation detail'],
  [/\bharness\b/i, 'harness implementation detail'],
  [/self[- ]audit|self[- ]review|autoauditoria|auto-auditoria|auto-revis(?:ão|ao)/i, 'self-audit process'],
  [/adversarial (?:review|audit)|revis(?:ão|ao) adversarial|auditoria adversarial/i, 'adversarial review process'],
  [/independent review|revis(?:ão|ao) independente/i, 'independent-review process'],
  [/external audit|auditoria externa|audit process|processo de auditoria|review process|processo de revisão|release process|processo de release|smoke test|\bsmoke\b|\bQA\b|quality assurance|garantia de qualidade|test suite|suíte de testes|unit tests?|testes unitários/i, 'audit/smoke/QA/release process'],
  [/pre[- ]audit|pr[eé][ -]?auditoria/i, 'pre-audit process'],
  [/mutation (?:test|probe|counter-test)|counter-tests? by mutation|mutaç(?:ão|ões).{0,30}(?:teste|contra)|contra-testes? por muta/i, 'mutation-test diary'],
  [/regression gate|catraca (?:de regressão|estrutural|de sinks|de markup)/i, 'regression-gate internals'],
  [/\broadmap\b/i, 'roadmap/process reference'],
  [/RELEASE_SELF_AUDIT|MAINTAINERS\.md|REVISAO_v|SMOKE_v|internal\//i, 'internal document reference'],
  [/public source comments?|comentários? (?:do|de) código-fonte público|repository-facing|private development(?:-process)?|processo privado de desenvolvimento/i, 'repository/source-maintenance narrative'],
  [/verified module by module|verified engine by engine|verificado módulo a módulo|verificado motor a motor/i, 'verification diary'],
  [/validated (?:on|against) \d+|validado (?:em|contra) \d+|proven by equivalence|provado por equivalência/i, 'test-validation diary'],
  [/future F9|futura (?:expansão|mudança).*F9|F9.*(?:review|revis)/i, 'internal roadmap identifier'],
  [/(?:Version History|Histórico de versões).{0,100}(?:descriptions?|entries?|preserves?|real builds?|deployment|published|product and usage|mudanças de produto|builds? reais?|publicad)|public history|histórico público|evolution log|histórico de evolução/i, 'meta-commentary about changelog maintenance'],
  [/closed upstream|upstream closed|closed set(?:s)?|produtores? anteriores fechados|conjuntos? fechados? anteriores/i, 'internal producer/closed-set jargon'],
  [/implicit render defense|render safety stays independent|defesa implícita de renderização|segurança de renderização permanece independente/i, 'internal render-architecture jargon'],
];

for (const [re,label] of forbidden) {
  const ms=site.match(re);
  assert(!ms, `site Version History contains ${label}: ${ms && ms[0]}`);
  const mm=md.match(re);
  assert(!mm, `CHANGELOG.md contains ${label}: ${mm && mm[0]}`);
}

// An internal-only build does not need a filler card in a user-facing changelog.
for (const neutral of [
  'No user-facing behavior changed in this build.',
  'Nenhum comportamento visível ao usuário mudou neste build.',
]) {
  assert(!site.includes(neutral), `Version History contains empty maintenance filler: ${neutral}`);
  assert(!md.includes(neutral), `CHANGELOG.md contains empty maintenance filler: ${neutral}`);
}

console.log('public changelog hygiene OK — concrete product/usage changes only; internal process stays internal');
