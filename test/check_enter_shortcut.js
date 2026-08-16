#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function functionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} não encontrada`);
  const open = src.indexOf('{', start);
  let depth = 0, quote = null, esc = false;
  for (let i=open; i<src.length; i++) {
    const c=src[i];
    if (quote) {
      if (esc) { esc=false; continue; }
      if (c==='\\') { esc=true; continue; }
      if (c===quote) quote=null;
      continue;
    }
    if (c==="'" || c==='"' || c==='`') { quote=c; continue; }
    if (c==='{') depth++;
    else if (c==='}') { depth--; if (depth===0) return src.slice(start,i+1); }
  }
  throw new Error(`${name} sem fechamento`);
}

const input = {
  listener:null,
  addEventListener(type, fn){ if(type==='keydown') this.listener=fn; }
};
const button = {
  disabled:false,
  aria:'false',
  clicks:0,
  getAttribute(name){ return name==='aria-disabled' ? this.aria : null; },
  click(){ this.clicks++; }
};
const document = { getElementById(id){ return id==='input' ? input : id==='button' ? button : null; } };
const source = functionSource(ui, 'bindEnterToEnabledAction');
const bind = new Function('document', `${source}; return bindEnterToEnabledAction;`)(document);
bind('input','button');
assert(typeof input.listener==='function', 'listener keydown não foi ligado');

function fire(overrides={}) {
  let prevented=0;
  const e={key:'Enter', repeat:false, isComposing:false, keyCode:13,
    preventDefault(){ prevented++; }, ...overrides};
  input.listener(e);
  return prevented;
}

button.clicks=0; button.disabled=false; button.aria='false';
assert(fire()===1 && button.clicks===1, 'Enter válido não acionou exatamente um clique');
assert(fire({key:'a'})===0 && button.clicks===1, 'tecla comum acionou a ação');
button.disabled=true; assert(fire()===0 && button.clicks===1, 'Enter ignorou disabled');
button.disabled=false; button.aria='true'; assert(fire()===0 && button.clicks===1, 'Enter ignorou aria-disabled');
button.aria='false'; assert(fire({isComposing:true})===0 && button.clicks===1, 'Enter disparou durante IME');
assert(fire({keyCode:229})===0 && button.clicks===1, 'Enter disparou durante keyCode 229');
assert(fire({repeat:true})===0 && button.clicks===1, 'Enter repetido disparou ação');

console.log('ENTER shortcut OK — enabled/disabled/ARIA/IME/repeat');
