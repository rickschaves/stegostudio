#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const term=fs.readFileSync(path.join(ROOT,'src/terminal.js'),'utf8');
const i18n=fs.readFileSync(path.join(ROOT,'src/i18n.js'),'utf8');
const security=fs.readFileSync(path.join(ROOT,'SECURITY.md'),'utf8');
const audit=fs.readFileSync(path.join(ROOT,'internal','RELEASE_SELF_AUDIT.md'),'utf8');
const attrs=fs.readFileSync(path.join(ROOT,'.gitattributes'),'utf8').replace(/\r\n/g,'\n').trim();
function assert(c,m){if(!c)throw new Error(m);}

assert(attrs==="* text=auto eol=lf\nHTML_PRODUCAO/** -text",'.gitattributes não preserva LF nas fontes + bytes em HTML_PRODUCAO');
assert(security.includes("img-src 'self' data: blob:"),'SECURITY não documenta o allowance img-src self/data/blob');
assert(security.includes('same origin could still carry data') || security.includes('same origin could still'), 'SECURITY não declara o canal residual same-origin');
assert(audit.includes('O que esta versão passa a tornar fatal que antes era tolerado?'),'pergunta de fatalidade nova ausente da autoauditoria');

const m=main.match(/function resolveJpegPasswordFeedback\([^]*?\n\}/);
assert(m,'helper resolveJpegPasswordFeedback não encontrado');
const box={}; vm.createContext(box); vm.runInContext(m[0]+';this.f=resolveJpegPasswordFeedback;',box);
const f=box.f;
assert(f({keyProvided:false})==='none','sem senha não deve alertar');
assert(f({keyProvided:true,decodedMsg:'ok'})==='none','recuperação textual não deve alertar');
assert(f({keyProvided:true,recoveredFile:{}})==='none','arquivo recuperado não deve alertar');
assert(f({keyProvided:true,robustState:'locked'})==='wrong','robust locked deve manter alerta forte');
assert(f({keyProvided:true,robustState:'damaged'})==='none','robust danificado já tem diagnóstico próprio');
assert(f({keyProvided:true,robustState:'content-error'})==='none','erro interno robusto já tem diagnóstico próprio');
assert(f({keyProvided:true,toolprint:[{level:'confirmado'}]})==='none','ferramenta confirmada sem extração não deve virar falso aviso de senha');
assert(f({keyProvided:true})==='inconclusive','JPEG sem recuperação com senha deve gerar feedback inconclusivo');

assert(main.includes("flashKey('jpeg')"),'produção não usa o novo feedback JPEG');
assert(term.includes("keyFlashReason === 'jpeg' ? 'decKeyFlashJpegInconclusive'"),'terminal não resolve o novo estado JPEG');
assert(i18n.includes('decKeyFlashJpegInconclusive: "The supplied password did not open a compatible JPEG payload.'),'copy EN do feedback JPEG ausente');
assert(i18n.includes('decKeyFlashJpegInconclusive: "A senha informada não abriu um payload JPEG compatível.'),'copy PT do feedback JPEG ausente');
assert(!/decKeyFlashJpegInconclusive[^\n]*(wrong password|senha incorreta)/i.test(i18n),'copy inconclusiva virou afirmação categórica de senha errada');

assert(term.includes("const flashMs = reason === 'jpeg' ? 8000 : 5000;"),'duração do feedback JPEG não está em 8 s com demais flashes preservados em 5 s');

console.log('post-F19 hardening OK — gitattributes + residual CSP + release question + honest JPEG password feedback');
