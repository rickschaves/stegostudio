#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');
function assert(c,m){if(!c)throw new Error(m)}
const root=path.join(__dirname,'..');
const f=path.join(root,'.github','workflows','regression.yml');
assert(fs.existsSync(f),'GitHub Actions regression workflow missing');
const y=fs.readFileSync(f,'utf8');
for(const needle of ["actions/checkout@v4","actions/setup-node@v4","node-version: '22'","node unpack_assets.js --check","node build.js --check","node test.js"])
  assert(y.includes(needle),`CI workflow missing: ${needle}`);
assert(/pull_request\s*:/.test(y)&&/push\s*:/.test(y),'CI must run on push and pull_request');
assert(/permissions:\s*\n\s*contents:\s*read/.test(y),'CI permissions are not read-only');
assert(/timeout-minutes:\s*15/.test(y),'CI timeout guard missing');
process.stdout.write('F17 CI contract OK — Node 22 rebuild + full regression on push/PR');
