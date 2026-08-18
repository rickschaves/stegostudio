#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const files=fs.readFileSync(path.join(root,'src/files.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }
function extractFunction(name){
  const start=files.indexOf(`function ${name}(`); assert(start>=0,`função ${name} ausente`);
  const brace=files.indexOf('{',start); let depth=0,end=-1;
  for(let i=brace;i<files.length;i++){ if(files[i]==='{') depth++; else if(files[i]==='}' && --depth===0){end=i+1;break;} }
  assert(end>brace,`função ${name} truncada`); return files.slice(start,end);
}
for(const id of ['enc-message-expand','enc-decoy-message-expand','enc-message-overlay','enc-message-close','enc-message-modal-text','enc-message-modal-count'])
  assert(tpl.includes(`id="${id}"`),`DOM do editor expandido perdeu ${id}`);
assert(!tpl.includes('data-i18n="encMessageFormatHint"'),'explicação técnica de \\n voltou ao modal');
assert((tpl.match(/class="enc-t enc-message-field"/g)||[]).length===2,'mensagem real e alternativa não compartilham o mesmo componente rolável');
for(const fn of ['getEncNormalizedMessage','getEncMessageEditorTarget','getEncCapacitySnapshot','updateEncMessageModalCount','syncEncMessageModalFromTarget','syncEncMessageTargetFromModal','openEncMessageEditor','closeEncMessageEditor'])
  assert(files.includes(`function ${fn}(`),`helper ${fn} ausente`);
assert(main.includes("openEncMessageEditor('enc-msg')") && main.includes("openEncMessageEditor('enc-decoy-msg')"),'os dois campos não abrem o mesmo editor com alvo explícito');
assert(main.includes("syncEncMessageTargetFromModal()"),'modal não sincroniza em tempo real com o campo ativo');
assert(/\.enc-message-expand\s*\{[\s\S]*?right\s*:\s*16px[\s\S]*?border\s*:\s*0/.test(css),'ícone de expandir não está compacto/sem moldura e separado da scrollbar');
assert(/textarea\s*\{[\s\S]*?resize\s*:\s*none/.test(css) && /\.enc-message-modal-text\s*\{[\s\S]*?resize\s*:\s*none/.test(css),'resize manual voltou a competir com o editor expandido');
assert(/\.enc-message-field::-webkit-scrollbar-thumb\s*,\s*\.enc-message-modal-text::-webkit-scrollbar-thumb\s*\{[^}]*background\s*:\s*var\(--enc\)/.test(css),'scrollbar dos dois campos/editor não usa identidade do Encoder');

class Classes{constructor(){this.s=new Set()}add(x){this.s.add(x)}remove(x){this.s.delete(x)}contains(x){return this.s.has(x)}}
const els={
  'enc-msg':{value:'  A\nB  ',placeholder:'main',dispatchEvent(e){this.last=e}},
  'enc-decoy-msg':{value:' ISCA ',placeholder:'decoy',dispatchEvent(e){this.last=e}},
  'enc-decoy-toggle':{checked:false}, 'enc-key':{value:''}, 'enc-maxcap':{checked:false},
  'enc-message-modal-text':{value:'',placeholder:'',focus(){},setSelectionRange(){}},
  'enc-message-modal-count':{textContent:''},
  'enc-message-overlay':{classList:new Classes()}
};
const document={getElementById:id=>els[id]||null};
class Ev{constructor(type,opts){this.type=type;Object.assign(this,opts)}}
const names=['getEncNormalizedMessage','getEncMessageEditorTarget','getEncCapacitySnapshot','updateEncMessageModalCount','syncEncMessageModalFromTarget','syncEncMessageTargetFromModal','openEncMessageEditor','closeEncMessageEditor'];
let body=names.map(extractFunction).join('\n');
body='let encMessageEditorTargetId="enc-msg";'+body;
const t=k=>({encMessageCountOnly:'{n} caracteres',encMessageCapacity:'Capacidade: {used} de {max} caracteres',encMessageCapacityShared:'Capacidade: {used} de {max} caracteres · Esta mensagem: {current}'}[k]||k);
const api=new Function('document','Event','requestAnimationFrame','t','encID','encOpaque','encMaxcapManual','F21_BODY_MAX','F21_GCM_TAG_BYTES','F21_PREFIX_CARRIER_PIXELS',body+`; return {${names.join(',')}};`)(document,Ev,fn=>fn(),t,null,10000,false,5_000_000,16,1792);
api.openEncMessageEditor('enc-msg');
assert(els['enc-message-overlay'].classList.contains('visible'),'editor não abriu');
assert(els['enc-message-modal-text'].value==='  A\nB  ','modal alterou formatação do campo principal ao abrir');
assert(els['enc-message-modal-count'].textContent.includes('3 caracteres'),'sem cover o modal não conta somente o texto normalizado');
els['enc-message-modal-text'].value='  '+String.raw`X\nY 😄`+'  ';
api.syncEncMessageTargetFromModal();
assert(els['enc-msg'].value==='  '+String.raw`X\nY 😄`+'  ','modal interpretou/alterou/normalizou o texto bruto ao sincronizar');
assert(els['enc-msg'].last?.type==='input','sincronização não dispara os gates existentes do Encoder');
api.closeEncMessageEditor();
assert(!els['enc-message-overlay'].classList.contains('visible'),'editor não fechou');

// O mesmo modal precisa editar a isca, sem tocar a mensagem real.
const apiCap=new Function('document','Event','requestAnimationFrame','t','encID','encOpaque','encMaxcapManual','F21_BODY_MAX','F21_GCM_TAG_BYTES','F21_PREFIX_CARRIER_PIXELS',body+`; return {${names.join(',')}};`)(document,Ev,fn=>fn(),t,{width:1},10000,false,5_000_000,16,1792);
els['enc-decoy-toggle'].checked=true;
const mainBefore=els['enc-msg'].value;
apiCap.openEncMessageEditor('enc-decoy-msg');
assert(els['enc-message-modal-text'].value===' ISCA ','editor da isca abriu o texto errado');
assert(/Capacidade: .* de .* caracteres · Esta mensagem: 4/.test(els['enc-message-modal-count'].textContent),'com cover + isca o modal não mostra uso compartilhado e tamanho da mensagem ativa');
els['enc-message-modal-text'].value='  ISCA NOVA  '; apiCap.syncEncMessageTargetFromModal();
assert(els['enc-decoy-msg'].value==='  ISCA NOVA  ' && els['enc-msg'].value===mainBefore,'editor da isca contaminou a mensagem principal');
process.stdout.write('encoder message editor OK — compact in-field controls + shared main/decoy modal + contextual capacity + exact text state');
