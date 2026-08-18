#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const dec=fs.readFileSync(path.join(root,'src','decoder.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
const res=fs.readFileSync(path.join(root,'src','results.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function extract(text,name){
  const st=text.indexOf(`function ${name}(`);assert(st>=0,`${name} ausente`);
  const b=text.indexOf('{',st);let d=0,q=null,e=false,ln=false,bl=false;
  for(let i=b;i<text.length;i++){
    const c=text[i],n=text[i+1]||'';
    if(ln){if(c==='\n')ln=false;continue}
    if(bl){if(c==='*'&&n==='/'){bl=false;i++}continue}
    if(q){if(e){e=false;continue}if(c==='\\'){e=true;continue}if(c===q)q=null;continue}
    if(c==='/'&&n==='/'){ln=true;i++;continue}if(c==='/'&&n==='*'){bl=true;i++;continue}
    if(c==='"'||c==="'"||c==='`'){q=c;continue}
    if(c==='{')d++;else if(c==='}'&&--d===0)return text.slice(st,i+1);
  }
  throw new Error(`${name} truncada`);
}
const classify=new Function(extract(dec,'classifyThirdPartyPayload')+';return classifyThirdPartyPayload;')();
const te=new TextEncoder();
const text=te.encode('Olá 😄\n<script>texto literal</script>');
const tv=classify(text,'nota.txt','Steghide');
assert(tv.binary===false && tv.text==='Olá 😄\n<script>texto literal</script>','UTF-8 textual foi degradado ou marcado como binário');
assert(tv.bytes===text,'classificador copiou/transformou bytes textuais em vez de preservá-los');
const pgp=te.encode('-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nTeste');
assert(classify(pgp,'','OutGuess').text!==null,'PGP textual deixou de ser exibível como texto');
const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0xff,0x00,0x7f]);
const pv=classify(png,'','OutGuess');
assert(pv.binary===true && pv.text===null,'PNG recuperado foi convertido em mojibake');
assert(pv.bytes===png && pv.fileName.endsWith('.png') && pv.mime==='image/png','PNG binário perdeu bytes/nome/MIME inferidos');
const zipAscii=te.encode('PK not really binary-looking text');
const zv=classify(zipAscii,'segredo.zip','Steghide');
assert(zv.binary===true && zv.text===null,'extensão binária conhecida foi tratada como TXT lossy');
const invalid=new Uint8Array([0xff,0xfe,0xfd,0x00,0x01,0x02,0x03,0x04]);
assert(classify(invalid,'blob.bin','OpenStego').binary===true,'bytes UTF-8 inválidos não foram preservados como binário');

// OpenStego comprimido só vira arquivo/mensagem depois de gunzip íntegro. Se a
// descompressão falhar, não podemos salvar o stream gzip sob o nome do arquivo
// original e chamá-lo de recuperação byte-exata.
const osDecode=extract(dec,'osDecodeMessage');
assert(/if\(res\.useCompression\)[\s\S]{0,500}catch\(_\)\{ return null; \}/.test(osDecode),
  'OpenStego comprimido pode publicar bytes do wire após falha de gunzip como se fossem o arquivo original');

// Os três motores entregam os bytes crus ao main; o caminho de UI mantém esse estado local.
for(const needle of [
  'data:payload.bytes, binary:payload.binary',
  'shRes.data instanceof Uint8Array && shRes.data.length>0',
  'ogRes.data instanceof Uint8Array && ogRes.data.length>0',
  'osRes.data instanceof Uint8Array && osRes.data.length>0',
  'lastRenderArgs = {report, decodedMsg, decodeStatus, passwordIgnored, recoveredFile, gen: run}',
  'renderResults(report,decodedMsg,decodeStatus,{passwordIgnored,recoveredFile})'
]) assert((dec+'\n'+main).includes(needle),`wiring de bytes recuperados ausente: ${needle}`);
assert((main.match(/if\(!decodedMsg && !recoveredFile\)/g)||[]).length===2, 'gates JPEG precisam proteger tanto o OutGuess quanto o pós-scan após arquivo recuperado');
assert(/if\(!decodedMsg && !recoveredFile\)\{\s*const ogRes=ogDecodeJpeg/.test(main), 'OutGuess pode sobrescrever arquivo binário já recuperado pelo Steghide');

// Download binário usa os bytes originais; nunca reencoda a visão textual.
assert(res.includes("new Blob([lastRecoveredFile.bytes], {type:lastRecoveredFile.mime||'application/octet-stream'})"),'Salvar arquivo não usa bytes crus recuperados');
assert(res.includes("download=safeRecoveredDownloadName(lastRecoveredFile.fileName, 'payload.bin')"),'nome recuperado não passa por sanitização de download');
assert(res.includes("text.textContent = hasText ? decodedMsg"),'apresentação textual/binária deixou de usar textContent');
assert(!/lastRecoveredFile[^\n]{0,120}innerHTML|decodedBinaryRecovered[^\n]{0,120}innerHTML/.test(res),'arquivo recuperado alcança innerHTML');

// Bytes são deliberadamente LOCAIS: o schema público continua sem payload bruto.
const schema=main.slice(main.indexOf('const PUBLIC_REPORT_SCHEMA = {'),main.indexOf('function projectPublicReportValue'));
assert(!schema.includes('recoveredFile') && !schema.includes('foreignBytes') && !schema.includes('rawPayload'),'bytes locais vazaram para forensic-report-v2');
assert(main.includes("recoveredStatusKind==='file' ? t('decStatusFileRecovered')"),'arquivo binário recuperado não ganha Decode Status próprio');

process.stdout.write('third-party binary fidelity OK — raw bytes preserved locally; text stays text; binary saves byte-exact without schema leak');
