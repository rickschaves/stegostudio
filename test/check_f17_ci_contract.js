#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const os=require('os');const cp=require('child_process');
function assert(c,m){if(!c)throw new Error(m)}
const root=path.join(__dirname,'..');
const f=path.join(root,'.github','workflows','regression.yml');
assert(fs.existsSync(f),'GitHub Actions regression workflow missing');
const y=fs.readFileSync(f,'utf8');
for(const needle of ["actions/checkout@v7","actions/setup-node@v6","node-version: '22'","node unpack_assets.js","node build.js","node test.js"])
  assert(y.includes(needle),`CI workflow missing: ${needle}`);
assert(!y.includes('node unpack_assets.js --check'),'CI must reconstruct ignored binary assets, not only verify base64');
assert(!y.includes('node build.js --check'),'CI must write dist/ before the production-artifact invariant');
assert(/pull_request\s*:/.test(y)&&/push\s*:/.test(y),'CI must run on push and pull_request');
assert(/permissions:\s*\n\s*contents:\s*read/.test(y),'CI permissions are not read-only');
assert(/timeout-minutes:\s*15/.test(y),'CI timeout guard missing');

// Instrument check: reproduce the parts that differ between our full package and a
// clean public GitHub checkout. The public repository intentionally omits internal/,
// dist/, deploy/ and src/fonts/. Reconstruct assets, build dist, then execute the two
// invariants that previously depended on those omitted paths.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'stego-ci-public-'));
try{
  const excluded=new Set(['internal','dist','deploy']);
  fs.cpSync(root,tmp,{recursive:true,filter:(src)=>{
    const rel=path.relative(root,src).replace(/\\/g,'/');
    if(!rel)return true;
    if(excluded.has(rel)||[...excluded].some(d=>rel.startsWith(d+'/')))return false;
    if(rel==='src/fonts'||rel.startsWith('src/fonts/'))return false;
    return true;
  }});
  const run=(args)=>cp.execFileSync(process.execPath,args,{cwd:tmp,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const unpack=run(['unpack_assets.js']);
  assert(/15\/15 íntegros e gravados/.test(unpack),'clean public checkout did not reconstruct all embedded assets');
  run(['build.js']);
  const history=run(['test/check_public_version_history.js']);
  assert(history.includes('public version history OK'),'public-history invariant fails without internal/');
  const artifact=run(['test/check_production_artifact_set.js']);
  assert(artifact.includes('production artifact set OK'),'production-artifact invariant fails after clean public rebuild');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
process.stdout.write('F17 CI contract OK — public-checkout reconstruction + Node 22 workflow contract');
