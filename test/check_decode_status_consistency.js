#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
const i18n=fs.readFileSync(path.join(root,'src','i18n.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function extract(name){const st=main.indexOf(`function ${name}(`);assert(st>=0,`${name} ausente`);const b=main.indexOf('{',st);let d=0;for(let i=b;i<main.length;i++){if(main[i]==='{')d++;else if(main[i]==='}'&&--d===0)return main.slice(st,i+1)}throw new Error('truncada')}
const fn=new Function(extract('resolveRecoveredStatusKind')+';return resolveRecoveredStatusKind;')();
assert(fn('x',{},true,false)==='recovered','nativo direto não normaliza como recuperação');
assert(fn('x',{robust:true},false,false)==='recovered','robusto direto não normaliza como recuperação');
assert(fn('x',{thirdParty:'OutGuess'},false,false)==='recovered','OutGuess direto não normaliza como recuperação');
assert(fn('x',{thirdParty:'Steghide'},false,false)==='recovered','Steghide direto não normaliza como recuperação');
assert(fn('x',{thirdParty:'OpenStego'},false,false)==='recovered','OpenStego direto não normaliza como recuperação');
assert(fn('x',{thirdParty:'OutGuess',foreignTruncated:true},false,false)==='partial','OutGuess parcial perdeu estado parcial');
assert(fn(null,{thirdParty:'OutGuess'},false,false,false)==='none','método sem texto/arquivo virou sucesso');
assert(fn(null,{thirdParty:'OutGuess'},false,false,true)==='file','arquivo binário recuperado não ganhou estado próprio');
assert(main.includes("recoveredStatusKind==='file' ? t('decStatusFileRecovered')") && main.includes("recoveredStatusKind==='recovered' ? t('decStatusRecovered')") && main.includes("t('decStatusRecoveredPartial')"),'handler não converte estados lógicos para copy comum');
assert(i18n.includes('decStatusRecovered: "Mensagem recuperada ✓"') && i18n.includes('decStatusRecovered: "Message recovered ✓"'),'copy comum de sucesso não existe nos dois idiomas');
assert(i18n.includes('decStatusFileRecovered: "Arquivo recuperado ✓"') && i18n.includes('decStatusFileRecovered: "File recovered ✓"'),'copy de arquivo recuperado não existe nos dois idiomas');
process.stdout.write('Decode Status semantics OK — result text is method-independent; method/protection remain separate evidence');
