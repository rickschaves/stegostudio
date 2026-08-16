#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
function assert(c,m){if(!c)throw new Error(m);}
const i18nSrc=fs.readFileSync(path.join(ROOT,'src','i18n.js'),'utf8');
const ctx={navigator:{language:'en'},console}; vm.createContext(ctx);
vm.runInContext(i18nSrc+'\nthis.__I18N=I18N; this.__translateMode=translateMode; this.__setLang=(x)=>LANG=x;',ctx);
const I=ctx.__I18N;
const results=fs.readFileSync(path.join(ROOT,'src','results.js'),'utf8');
const styles=fs.readFileSync(path.join(ROOT,'src','styles.css'),'utf8');

// Internal mode enums stay stable, but every visible use must be localized.
assert(results.includes("row(t('rowExtractionMode'), translateMode(r.studio.genericMode))"),'Protocol exposes raw internal extraction mode');
ctx.__setLang('en');
assert(ctx.__translateMode('canal R')==='Channel R','EN canal R not translated to Channel R');
assert(ctx.__translateMode('canal B')==='Channel B','EN canal B not translated to Channel B');
ctx.__setLang('pt');
assert(ctx.__translateMode('canal R')==='Canal R','PT canal R not sentence-cased');

// Human-readable categorical values shown after row labels use sentence case.
const keys=['payloadRecovered','headerFoundNoContent','valCandidateNotValidated','valNo','valPresent','valAbsent','valNormal','valNatural','jdctChiAnomaly','jdctChiNoAnomaly','decStatusNoStudio','decStatusDecryptedKey','decStatusOpenStego','decStatusSteghide','decStatusOutGuess','decStatusPlainKeyIgnored','decStatusCipherWrongKey','decStatusPlainNoCipher','decStatusCipherFound','decStatusKeyNoText','decStatusNoReadable','deepInvestText'];
for(const lang of ['en','pt']){
  for(const k of keys){
    const v=I[lang][k];
    assert(typeof v==='string' && v.length,`${lang}.${k} missing`);
    const m=v.match(/^[^A-Za-zÀ-ÖØ-öø-ÿ]*([A-Za-zÀ-ÖØ-öø-ÿ])/u);
    assert(!m || m[1]===m[1].toUpperCase(),`${lang}.${k} does not start in sentence case: ${v}`);
  }
}

// The English dictionary should not contain obvious Portuguese UI residues.
const ptResidue=/\b(canal|senha|mensagem|cabeçalho|codificação|decodificação|criptografad[oa]|recuperad[oa]|encontrad[oa]|presente|ausente|possível|nenhum|nenhuma|texto puro)\b/i;
for(const [k,v] of Object.entries(I.en)){
  if(typeof v==='string') assert(!ptResidue.test(v),`EN i18n contains Portuguese residue at ${k}: ${v}`);
}
// The Portuguese dictionary should not expose the raw English channel label.
for(const [k,v] of Object.entries(I.pt)){
  if(typeof v==='string') assert(!/\bchannel [RGBA]\b/i.test(v),`PT i18n contains English channel residue at ${k}: ${v}`);
}

// English UI must not expose the Portuguese internal channel word on this row.
assert(!results.includes("row(t('rowExtractionMode'), r.studio.genericMode)"),'raw extraction mode renderer regressed');

// EXIF GPS keeps the language-neutral export token, but the visible module has one canonical GPS row.
const forensics=fs.readFileSync(path.join(ROOT,'src','forensics.js'),'utf8');
assert(forensics.includes("result.fields['GPS'] = 'present'"),'EXIF GPS producer is not language-neutral');
assert(!forensics.includes("result.fields['GPS'] = 'presente'"),'Portuguese GPS token leaked back into exported reports');
assert(results.includes("if(k==='GPS') continue"),'generic EXIF field loop can duplicate the canonical GPS row');
assert(results.includes("row(t('rowGPS'),r.exif.hasGPS?t('valPresent'):t('valAbsent'))"),'canonical localized GPS row missing');

// Both Carrier Preflight actions must visibly react to hover.
assert(/\.carrier-preflight-btn:hover\s*\{[^}]*background/s.test(styles),'primary preflight hover missing');
assert(/\.carrier-preflight-btn\.secondary:hover\s*\{[^}]*background/s.test(styles),'secondary preflight hover missing');

process.stdout.write('accordion display polish gate OK — localized channel modes + sentence-case values + symmetric preflight hover');
