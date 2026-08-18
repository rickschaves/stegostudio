'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const dec=fs.readFileSync(path.join(root,'src/decoder.js'),'utf8');
const res=fs.readFileSync(path.join(root,'src/results.js'),'utf8');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
const i18n=fs.readFileSync(path.join(root,'src/i18n.js'),'utf8');
function assert(c,m){ if(!c) throw new Error(m); }

assert(main.includes('let passwordIgnored=false'), 'estado local passwordIgnored ausente');
assert(dec.includes('payload.passwordUsedForFraming = password.length > 0 && (stealth || shuffled);'), 'decoder legado não informa uso de senha no framing');
assert(main.includes('const studioUsedPasswordForFraming = !!studioPayload.passwordUsedForFraming;'), 'main não consome metadado de framing protegido');
assert((main.match(/if\(!studioUsedPasswordForFraming\) passwordIgnored=true;/g)||[]).length===2, 'os dois produtores nativos plaintext/comprimido precisam respeitar uso de senha no framing');
assert((main.match(/passwordIgnored=true/g)||[]).length>=5, 'rotas de fallback sem senha deixaram de sinalizar passwordIgnored');
assert(/decodeStatus=t\('decStatusPlainKeyIgnored'\);[\s\S]{0,120}if\(!studioUsedPasswordForFraming\) passwordIgnored=true;[\s\S]{0,80}nativePayloadRecovered=true;/.test(main), 'payload nativo comprimido não distingue framing com senha');
assert(/decodeStatus=t\('decStatusPlainKeyIgnored'\);if\(!studioUsedPasswordForFraming\) passwordIgnored=true;nativePayloadRecovered=true;/.test(main), 'fallback nativo plaintext não distingue framing com senha');
assert(main.includes("if(key.length>0 && rb.status==='none')") && main.includes("robustExtract(bytes, '')"), 'JPEG robusto não tenta fallback sem senha');
assert(main.includes('if(robustUsedEmptyPassword && !opened.passwordUsed) passwordIgnored=true;'), 'robusto não distingue senha estrutural de senha realmente usada no conteúdo');
assert(main.includes('if(key.length>0 && shRes.usedEmptyPassword) passwordIgnored=true;'), 'Steghide fallback vazio não sinaliza senha ignorada');
assert(main.includes('if(key.length>0 && ogRes.usedDefaultKey) passwordIgnored=true;'), 'OutGuess fallback default não sinaliza senha ignorada');
assert(main.includes('if(key.length>0 && osRes.usedEmptyPassword) passwordIgnored=true;'), 'OpenStego fallback vazio não sinaliza senha ignorada');
assert(dec.includes("usedEmptyPassword:pw===''"), 'decoder não informa fallback de senha vazia');
assert(dec.includes('usedDefaultKey:k===OG_DEFAULT_KEY'), 'OutGuess não informa uso da chave default');
assert(main.includes("return {state, plain, passwordUsed:state==='ok' && aesBody && key.length>0}"), 'helper robusto não informa uso real da senha interna');
assert(main.includes('lastRenderArgs = {report, decodedMsg, decodeStatus, passwordIgnored, recoveredFile, gen: run}'), 'rerender não preserva o contexto de senha ignorada');
assert(main.includes('renderResults(report,decodedMsg,decodeStatus,{passwordIgnored,recoveredFile});'), 'primeiro render não recebe o contexto de senha ignorada');
assert(i18n.includes('passwordIgnored:!!lastRenderArgs.passwordIgnored'), 'troca de idioma perde o aviso de senha ignorada');
assert(tpl.includes('id="decoded-password-note"'), 'superfície visual do aviso ausente');
assert(i18n.includes('Password ignored — the message was recovered without a password.') && i18n.includes('Senha ignorada — a mensagem foi recuperada sem senha.'), 'copy EN/PT de senha ignorada ausente');
assert(res.includes("passwordNote.textContent = passwordIgnored ? t('decStatusPlainKeyIgnored') : ''"), 'aviso não usa textContent');
assert(!/passwordNote\.innerHTML\s*=/.test(res), 'aviso de senha usa innerHTML');

// Vetor legado construído: corpo plaintext, mas senha necessária para framing
// (header furtivo + ordem embaralhada). É justamente o caso encontrado na .8.
{
  const enc=fs.readFileSync(path.join(root,'src/encoder.js'),'utf8');
  const stc=fs.readFileSync(path.join(root,'src/stc.js'),'utf8');
  const api=new Function('t', enc+'\n'+stc+'\n'+dec+'\nreturn {buildPayload,embedLSB,extractLSBStudio,MODE_B};')(k=>k);
  const w=96,h=96,data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){ data[i*4]=(i*17+11)&255; data[i*4+1]=(i*29+31)&255; data[i*4+2]=(i*43+73)&255; data[i*4+3]=255; }
  const id={data,width:w,height:h};
  const original='FRAMING COM SENHA, CORPO PURO';
  api.embedLSB(id,api.buildPayload(new TextEncoder().encode(original),api.MODE_B),api.MODE_B,'2414',false,true,0);
  const got=api.extractLSBStudio(id,'2414');
  assert(got instanceof Uint8Array && new TextDecoder().decode(got)===original,'vetor legado furtivo/plain não fez round-trip');
  assert(got.passwordUsedForFraming===true && got.stealth===true && got.shuffled===true,'decoder não registra uso real da senha no framing');
  assert(api.extractLSBStudio(id,'')===null,'payload furtivo/plain abriu sem a senha estrutural');
}

// Executa a função real de apresentação com um DOM mínimo para prender a semântica.
const m=res.match(/function prepareDecodedMessageView\(decodedMsg, passwordIgnored=false, recoveredFile=null\) \{[\s\S]*?\n\}/);
assert(m,'prepareDecodedMessageView não localizada');
const els={
  'decoded-box':{classList:{state:false,add(){this.state=true},remove(){this.state=false}}},
  'decoded-text':{textContent:''},
  'decoded-password-note':{textContent:'',style:{display:'none'}},
  'decoded-label':{textContent:''}, 'decoded-copy':{style:{display:''}}, 'decoded-save':{textContent:'',style:{}}
};
const ctx={Uint8Array,fmtBytes:n=>n+' B',document:{getElementById:id=>els[id]||null}, t:k=>k==='decStatusPlainKeyIgnored'?'Senha ignorada — a mensagem foi recuperada sem senha.':k};
vm.createContext(ctx); vm.runInContext(m[0],ctx);
ctx.prepareDecodedMessageView('SEGREDO',true);
assert(els['decoded-text'].textContent==='SEGREDO','mensagem foi alterada ao exibir aviso');
assert(els['decoded-password-note'].style.display==='block','aviso não aparece quando senha foi ignorada');
assert(els['decoded-password-note'].textContent.startsWith('Senha ignorada'), 'copy do aviso incorreta');
ctx.prepareDecodedMessageView('SEGREDO',false);
assert(els['decoded-password-note'].style.display==='none','aviso aparece quando senha participou ou não foi informada');

process.stdout.write('password ignored notice OK — fallback sem senha é explícito sem alterar Decode Status');
