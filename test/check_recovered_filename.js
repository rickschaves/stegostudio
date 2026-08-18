#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const res=fs.readFileSync(path.join(root,'src','results.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function extract(text,name){
 const st=text.indexOf(`function ${name}(`);assert(st>=0,`${name} ausente`);const b=text.indexOf('{',st);let d=0,q=null,e=false,ln=false,bl=false;
 for(let i=b;i<text.length;i++){const c=text[i],n=text[i+1]||'';if(ln){if(c==='\n')ln=false;continue}if(bl){if(c==='*'&&n==='/'){bl=false;i++}continue}if(q){if(e){e=false;continue}if(c==='\\'){e=true;continue}if(c===q)q=null;continue}if(c==='/'&&n==='/'){ln=true;i++;continue}if(c==='/'&&n==='*'){bl=true;i++;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return text.slice(st,i+1)}throw new Error(`${name} truncada`);
}
const safe=new Function(extract(res,'safeRecoveredDownloadName')+';return safeRecoveredDownloadName;')();

for(const ext of ['.zip','.png','.pdf']){
 const out=safe('x'.repeat(300)+ext);
 assert(out.length<=120,`nome ${ext} excedeu 120 (${out.length})`);
 assert(out.endsWith(ext),`extensão ${ext} foi perdida: ${out.slice(-20)}`);
 assert(out.length===120,`nome longo ${ext} não ocupou limite de forma determinística (${out.length})`);
}
assert(safe('../../etc/passwd')==='passwd','travessia POSIX não foi reduzida ao leaf');
assert(safe('a/b\\c.txt')==='c.txt','separadores mistos não foram reduzidos ao leaf');
assert(safe('..')==='payload.bin' && safe('.')==='payload.bin' && safe('   ')==='payload.bin','nomes vazios/pontos/espaços não caíram no fallback');
assert(safe('\u0000evil.sh')==='_evil.sh','byte nulo/caractere hostil não foi neutralizado');
assert(safe('.htaccess')==='htaccess','ponto inicial não foi removido');
assert(safe('a\u202Egnp.exe')==='a_gnp.exe','override RTL não foi neutralizado');
assert(safe('😀.png')==='_.png','Unicode não permitido não foi sanitizado preservando extensão');

const absurd=safe('a.'+'z'.repeat(200));
assert(absurd.length===120,'sufixo absurdo deve ser tratado como basename e truncado');
assert(!absurd.endsWith('.'+'z'.repeat(200)),'sufixo absurdo foi tratado como extensão preservável');

process.stdout.write('recovered filename OK — hostile names sanitized, 120-char cap, final extension preserved');
