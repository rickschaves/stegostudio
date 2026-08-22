#!/usr/bin/env node
'use strict';

// CHECK 30 — the in-app Version History is a bounded window over the canonical
// public CHANGELOG.md. The Markdown keeps the complete public product history;
// the standalone app keeps exactly its ten newest public releases.
//
// In a full development checkout, the private technical changelog adds a
// provenance check. Public GitHub checkouts intentionally omit internal/.

const fs=require('fs');
const path=require('path');
function assert(c,m){ if(!c) throw new Error(m); }
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
const md=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8');
const techPath=path.join(root,'internal','STEGO_STUDIO_CHANGELOG_TECNICO.md');

const a=ui.indexOf('const CHANGELOG = [');
const b=ui.indexOf('function renderChangelog()',a);
assert(a>=0 && b>a,'bounded Version History not found');
const site=ui.slice(a,b);
const local=[...site.matchAll(/ver:'v([^']+)'/g)].map(m=>m[1]);
const completeCount=(md.match(/^## v/gm)||[]).length;
const complete=[...md.matchAll(/^## v([^\n]+?)\s+—\s+\d{4}-\d{2}-\d{2}\s*$/gm)].map(m=>m[1]).slice(0,10);

assert(local.length===10,`Version History should contain exactly 10 releases, found ${local.length}`);
assert(new Set(local).size===local.length,'Version History has duplicate entries');
assert(completeCount>=local.length,'CHANGELOG.md is shorter than local history window');
assert(JSON.stringify(local)===JSON.stringify(complete.slice(0,10)),
  'local Version History diverged from the ten newest canonical CHANGELOG.md releases');

let provenance='public checkout: internal provenance unavailable by design';
if(fs.existsSync(techPath)){
  const tech=fs.readFileSync(techPath,'utf8');
  const technical=[...tech.matchAll(/^## v(.+?)\s+[—–-]\s+\d{4}/gm)].map(m=>m[1]);
  const unknown=local.filter(v=>!technical.includes(v));
  assert(!unknown.length,`Version History contains build(s) absent from technical changelog: ${unknown.join(', ')}`);
  const positions=local.map(v=>technical.indexOf(v));
  assert(positions.every((p,i)=>i===0||p>positions[i-1]),
    'Version History order diverged from internal technical chronology');
  provenance='full checkout: internal provenance verified';
}

console.log(`public version history OK — 10/${completeCount} canonical releases local; ${provenance}`);
