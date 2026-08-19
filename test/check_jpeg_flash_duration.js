#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const terminal=fs.readFileSync(path.join(root,'src','terminal.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m);}
assert(terminal.includes("const flashMs = reason === 'jpeg' ? 8000 : 5000;"),
  'flash JPEG deve durar 8000 ms e wrong/missing devem continuar em 5000 ms');
assert(!terminal.includes('setTimeout(clearKeyFlash, 8000)'),
  'timeout global de 8 s detectado; extensão deve valer só para reason=jpeg');
console.log('JPEG flash duration OK — jpeg=8000 ms; wrong/missing=5000 ms');
