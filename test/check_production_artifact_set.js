#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..');
const {VERSION}=require(path.join(root,'build.js'));
function assert(c,m){if(!c)throw new Error(m)}
const prod=path.join(root,'HTML_PRODUCAO');
const htmls=fs.readdirSync(prod).filter(n=>n.toLowerCase().endsWith('.html')).sort();
const expected=`stego_studio_v${VERSION}.html`;
assert(htmls.length===1,`HTML_PRODUCAO deve conter 1 HTML corrente; encontrou ${htmls.length}: ${htmls.join(', ')}`);
assert(htmls[0]===expected,`HTML_PRODUCAO contém ${htmls[0]} em vez de ${expected}`);
const dist=path.join(root,'dist',expected),pub=path.join(prod,expected);
assert(fs.existsSync(dist),`dist corrente ausente: ${expected}`);
const a=fs.readFileSync(dist),b=fs.readFileSync(pub);
assert(a.equals(b),'HTML_PRODUCAO não é byte-idêntico ao build corrente em dist');
const h=x=>crypto.createHash('sha256').update(x).digest('hex');
process.stdout.write(`production artifact set OK — one current HTML, byte-identical SHA-256 ${h(a).slice(0,12)}…`);
