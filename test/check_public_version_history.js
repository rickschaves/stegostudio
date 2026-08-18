#!/usr/bin/env node
'use strict';

// CHECK 30 — public Version History is a curated product-evolution history.
// Internal technical changelog records every build. Public entries are a subset:
// each one must appear only once and keep the same chronological order.
//
// In a full development checkout, the private/internal technical changelog adds a
// stronger provenance check: every public card must correspond to a real documented
// build. In a public GitHub checkout `internal/` is intentionally absent, so CI keeps
// the public self-consistency checks without pretending it can validate private data.

const fs=require('fs');
const path=require('path');
function assert(c,m){ if(!c) throw new Error(m); }
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
const md=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8');
const techPath=path.join(root,'internal','STEGO_STUDIO_CHANGELOG_TECNICO.md');

const publicLabels=[...ui.matchAll(/ver:'v([^']+)'/g)].map(m=>m[1]);
const mdLabels=[...md.matchAll(/^## v(.+?)\s+[—–-]\s+\d{4}/gm)].map(m=>m[1]);

function semverEra(label){
  const m=/^(\d+)\.(\d+)/.exec(label);
  return !!m && (+m[1]>2 || (+m[1]===2 && +m[2]>=10));
}
const actual=publicLabels.filter(semverEra);
const mdActual=mdLabels.filter(semverEra);

assert(new Set(actual).size===actual.length,'Version History has duplicate semver-era entries');
assert(new Set(mdActual).size===mdActual.length,'CHANGELOG.md has duplicate semver-era entries');

// CHANGELOG.md is the shorter public release/product log; every entry it carries
// must also exist in the in-app history and keep the same relative order.
const missingOnSite=mdActual.filter(v=>!actual.includes(v));
assert(!missingOnSite.length,`CHANGELOG.md contains public version(s) missing from site history: ${missingOnSite.join(', ')}`);
const sitePositions=mdActual.map(v=>actual.indexOf(v));
assert(sitePositions.every((p,i)=>i===0 || p>sitePositions[i-1]),
  'CHANGELOG.md order diverged from in-app Version History');

let provenance='public checkout: internal provenance unavailable by design';
if(fs.existsSync(techPath)){
  const tech=fs.readFileSync(techPath,'utf8');
  const technicalLabels=[...tech.matchAll(/^## v(.+?)\s+[—–-]\s+\d{4}/gm)].map(m=>m[1]);
  const technical=technicalLabels.filter(semverEra);

  const unknown=actual.filter(v=>!technical.includes(v));
  assert(!unknown.length,`Version History contains build(s) absent from technical changelog: ${unknown.join(', ')}`);
  const unknownMd=mdActual.filter(v=>!technical.includes(v));
  assert(!unknownMd.length,`CHANGELOG.md contains build(s) absent from technical changelog: ${unknownMd.join(', ')}`);

  const positions=actual.map(v=>technical.indexOf(v));
  assert(positions.every((p,i)=>i===0 || p>positions[i-1]),
    'Version History order diverged from internal technical chronology');
  provenance='full checkout: internal provenance verified';
}

console.log(`public version history OK — ${actual.length} curated semver-era product entries; ${provenance}`);
