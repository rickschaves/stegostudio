#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const decoder=fs.readFileSync(path.join(root,'src','decoder.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
const forensics=fs.readFileSync(path.join(root,'src','forensics.js'),'utf8');
const results=fs.readFileSync(path.join(root,'src','results.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
function extract(src,name){
  const st=src.indexOf(`function ${name}(`); assert(st>=0,`${name} ausente`);
  const b=src.indexOf('{',st); let d=0,q=null,e=false,ln=false,bl=false;
  for(let i=b;i<src.length;i++){
    const c=src[i],n=src[i+1]||'';
    if(ln){ if(c==='\n')ln=false; continue; }
    if(bl){ if(c==='*'&&n==='/'){bl=false;i++;} continue; }
    if(q){ if(e){e=false;continue;} if(c==='\\'){e=true;continue;} if(c===q)q=null; continue; }
    if(c==='/'&&n==='/'){ln=true;i++;continue;} if(c==='/'&&n==='*'){bl=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;} if(c==='{')d++; else if(c==='}'&&--d===0)return src.slice(st,i+1);
  }
  throw new Error(`${name} truncada`);
}
const parserSrc=extract(decoder,'parseLegacyFramedLSB');
const parse=new Function(parserSrc+'\nreturn parseLegacyFramedLSB;')();
const enc=new TextEncoder();
function be32(n){ return Uint8Array.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]); }
function cat(...parts){ const n=parts.reduce((a,p)=>a+p.length,0),o=new Uint8Array(n); let at=0; for(const p of parts){o.set(p,at);at+=p.length;} return o; }
function joi(text, header='JOI_LSB2'){ const b=enc.encode(text); return cat(enc.encode(header),be32(b.length),b,Uint8Array.of(0x6d,0xff,0x81)); }
function steg(text, version=1){ const b=enc.encode(text); return cat(enc.encode('Steg'),be32(version),be32(b.length),b,Uint8Array.of(0x6d,0xff,0x81)); }

// Dois framings medidos nos relatórios de campo que abriram esta regressão.
const rain='THE RAIN REMEMBERS MORE THAN PEOPLE DO.';
const r1=parse(joi(rain));
assert(r1 && r1.text===rain,'JOI_LSB2 não recuperou o texto exato');
assert(r1.headerName==='JOI_LSB2' && r1.payloadBytes===39,'JOI_LSB2 não validou header/LEN observado');
const dev='Testando ferramenta de terceiros:\r\nhttps://www.devglan.com/online-tools/image-steganography-online';
const r2=parse(steg(dev));
assert(r2 && r2.text===dev,'Steg/v1 não recuperou texto+CRLF exatos');
assert(r2.headerName==='Steg' && r2.framingVersion===1 && r2.payloadBytes===98,'Steg/v1 não validou version/LEN observados');

// UTF-8 real deve sobreviver pelo LEN em bytes, não por contagem JS de caracteres.
const uni='Mensagem 😄 íntegra — ação';
assert(parse(joi(uni)).text===uni,'framing estruturado quebrou Unicode válido');

// Fail-closed: versão desconhecida, truncamento ou UTF-8 inválido não promovem.
assert(parse(steg(dev,2))===null,'Steg com versão desconhecida ganhou confiança');
const trunc=joi(rain); trunc[8]=0; trunc[9]=0; trunc[10]=1; trunc[11]=0; // LEN 256 > buffer
assert(parse(trunc)===null,'LEN fora do buffer foi aceito');
const bad=cat(enc.encode('JOI_LSB2'),be32(2),Uint8Array.of(0xC3,0x28));
assert(parse(bad)===null,'UTF-8 inválido foi aceito como recuperação direta');

// Integração: parser precisa alimentar o caminho direto, não a limpeza heurística.
assert(decoder.includes('c.framed = parseLegacyFramedLSB(c.bytes);'),'extractLSBRaw não consulta parser estrutural');
assert(decoder.includes('if (bestFramed) best = bestFramed;'),'framing validado não tem precedência sobre deep scan');
assert(main.includes('if(generic.framed){'),'main não despacha framing estruturado antes das heurísticas');
assert(main.includes('framedExtracted:true, framedPayloadBytes:generic.framed.payloadBytes'),'evidência estruturada não é publicada no estado de trabalho');
assert(main.includes("studio?.framedExtracted===true"),'Decode Status não reconhece recuperação estruturada');

// Threat 100 continua reservado a recuperação direta; apenas a nova credencial entra.
const resolveProto=extract(results,'resolveProtocolState');
const api=new Function('t','escapeHTML',resolveProto+'\n'+forensics+'\nreturn {computeThreat};')((k)=>k,(v)=>String(v));
const direct={format:{cat:'lossless'},studio:{framedExtracted:true,headerName:'JOI_LSB2',framedPayloadBytes:39},strings:{interesting:[]},stegomalware:[],lsb:{available:true,suspicious:true,foundText:rain,headerName:'JOI_LSB2',printableRatio:'38%',lsbrDetected:false},c2pa:{}};
assert(api.computeThreat(direct).score===100,'recuperação estruturada direta não fechou Threat 100');
const headerOnly=JSON.parse(JSON.stringify(direct)); delete headerOnly.studio.framedExtracted;
assert(api.computeThreat(headerOnly).score<100,'header/texto sem framing validado virou confirmação terminal');

// Relatório público carrega a justificativa do 100; não pode virar número sem evidência.
const schemaBlock=main.slice(main.indexOf('const PUBLIC_REPORT_SCHEMA = {'),main.indexOf('function projectPublicReportValue'));
assert(schemaBlock.includes('framedExtracted:true') && schemaBlock.includes('framedPayloadBytes:true'),'forensic-report-v2 omite a evidência que justifica 100');
assert(results.includes("if (st.framedExtracted)"),'painel Protocolo não distingue recuperação estruturada');

process.stdout.write('legacy framed recovery OK — JOI_LSB2 + Steg/v1 parsed by declared length; invalid framing stays below 100');
