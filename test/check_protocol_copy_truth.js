#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m);}
const i18nSrc=fs.readFileSync(path.join(ROOT,'src','i18n.js'),'utf8');
const ctx={navigator:{language:'en'},console}; vm.createContext(ctx);
vm.runInContext(i18nSrc+'\nthis.__I18N=I18N;',ctx); const I=ctx.__I18N;
const results=fs.readFileSync(path.join(ROOT,'src','results.js'),'utf8');
const styles=fs.readFileSync(path.join(ROOT,'src','styles.css'),'utf8');
const template=fs.readFileSync(path.join(ROOT,'template.html'),'utf8');
assert(results.includes("t('payloadRecovered')"),'neutral payloadRecovered not used');
assert(!results.includes('payloadRecoveredWithKey'),'renderer still encodes password assumption');
assert(I.en.payloadRecovered==='Recovered'&&I.pt.payloadRecovered==='Recuperado','payload recovery copy not neutral');
for(const [lang,word] of [['en','password'],['pt','senha']]){
  assert(!I[lang].interpStudioExtracted.toLowerCase().includes(word),lang+' extracted copy claims password');
  assert(!I[lang].headerFoundNoContent.toLowerCase().includes(word),lang+' header copy claims password');
  assert(!I[lang].interpStudioHeaderOnly.toLowerCase().includes(word),lang+' header interpretation claims password');
}
const expected={en:{fieldKeyEnc:'// encoding password',fieldKeyDec:'// decoding password',decStatusDecryptedKey:'Decrypted with password ✓',decStatusCipherWrongKey:'Encrypted message — wrong password ✗',decStatusPlainNoCipher:'Plaintext — no encryption'},pt:{fieldKeyEnc:'// senha de codificação',fieldKeyDec:'// senha de decodificação',decStatusDecryptedKey:'Descriptografado com senha ✓',decStatusCipherWrongKey:'Mensagem criptografada — senha incorreta ✗',decStatusPlainNoCipher:'Texto puro — sem criptografia'}};
for(const lang of ['en','pt'])for(const [k,v] of Object.entries(expected[lang]))assert(I[lang][k]===v,lang+'.'+k+' terminology drift');
assert(I.en.helpProtA.includes('cryptographic key derived from the password'),'EN password/derived-key distinction missing');
assert(I.pt.helpProtA.includes('chave criptográfica derivada da senha'),'PT password/derived-key distinction missing');
const credentialKeys=['encAutoNote','termClickAnalyze','termTypeMsg'];
for(const k of credentialKeys){
  assert(!/\bkey\b/i.test(I.en[k]),'EN '+k+' regressed from password to key');
  assert(!/\bchave\b/i.test(I.pt[k]),'PT '+k+' regressed from senha to chave');
}
assert(I.pt.encAutoNote.includes('proteção do cabeçalho'),'PT auto note no longer describes automatic header protection');
assert(!/\bcifra\b/i.test(I.pt.encAutoNote),'PT auto note regressed to ambiguous cifra terminology');
assert(!/senha desta imagem/i.test(I.pt.decoyToggleHint),'PT second-layer copy assigns a password to the image instead of the hidden message');
assert(!/image['’]s password/i.test(I.en.decoyToggleHint),'EN second-layer copy assigns a password to the image instead of the hidden message');
assert(I.en.carrierPreflightUseAnyway==='Use anyway'&&I.en.carrierPreflightChooseAnother==='Choose another','EN preflight buttons not compact');
assert(I.pt.carrierPreflightUseAnyway==='Usar mesmo assim'&&I.pt.carrierPreflightChooseAnother==='Trocar imagem','PT preflight buttons not compact');
assert(/\.carrier-preflight-actions\s*\{[^}]*flex-wrap\s*:\s*nowrap/s.test(styles),'preflight actions can stack');
assert(/\.carrier-preflight-btn\s*\{[^}]*flex\s*:\s*1\s+1\s+0/s.test(styles),'preflight buttons do not share row');
assert(template.indexOf('id="enc-preflight-use"')<template.indexOf('id="enc-preflight-choose"'),'preflight action order changed');
process.stdout.write('protocol copy/terminology gate OK — neutral recovery + password/encryption vocabulary + horizontal preflight actions');
