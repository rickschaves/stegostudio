#!/usr/bin/env node
'use strict';

// CHECK 29 — interactive mobile tab swipe.
// Contract: the panels follow the finger after clear horizontal intent; reversing
// reverses the visual position; release below threshold returns, release beyond
// threshold or a short fast flick settles on the neighbour. Vertical intent stays native until lock.

const fs = require('fs');
const path = require('path');
const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function functionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} not found`);
  const open = src.indexOf('{', start);
  let depth=0, quote=null, esc=false, line=false, block=false;
  for (let i=open; i<src.length; i++) {
    const c=src[i], n=src[i+1] || '';
    if (line) { if (c==='\n') line=false; continue; }
    if (block) { if (c==='*' && n==='/') { block=false; i++; } continue; }
    if (quote) {
      if (esc) { esc=false; continue; }
      if (c==='\\') { esc=true; continue; }
      if (c===quote) quote=null;
      continue;
    }
    if (c==='/' && n==='/') { line=true; i++; continue; }
    if (c==='/' && n==='*') { block=true; i++; continue; }
    if (c==="'" || c==='"' || c==='`') { quote=c; continue; }
    if (c==='{') depth++;
    else if (c==='}') { depth--; if (depth===0) return src.slice(start,i+1); }
  }
  throw new Error(`${name} unterminated`);
}

const cfg = /const MOBILE_TAB_SWIPE = Object\.freeze\(\{[\s\S]*?\}\);/.exec(ui);
assert(cfg, 'MOBILE_TAB_SWIPE config not found');
const switchTabSrc = functionSource(ui, 'switchTab');
const blockedSrc = functionSource(ui, 'mobileSwipeBlockedTarget');
const dirSrc = functionSource(ui, 'mobileSwipeDirection');
const evalSrc = functionSource(ui, 'evaluateMobileSwipeMotion');
const commitSrc = functionSource(ui, 'shouldCommitMobileSwipe');
const bindSrc = functionSource(ui, 'bindMobileTabSwipe');
const moveSrc = functionSource(ui, 'move');
const pure = new Function(`${cfg[0]}\n${dirSrc}\n${evalSrc}\n${commitSrc}\nreturn {evaluateMobileSwipeMotion,shouldCommitMobileSwipe};`)();
const evaluate = pure.evaluateMobileSwipeMotion;
const shouldCommit = pure.shouldCommitMobileSwipe;

// Pure gesture boundary.
assert(evaluate(180,200,174,201,'enc',360,false,false).state==='pending', 'tiny movement locked too early');
assert(evaluate(180,200,176,226,'enc',360,false,false).state==='cancelled', 'vertical intent did not cancel');
let m=evaluate(180,200,120,205,'enc',360,false,false);
assert(m.state==='locked' && m.offsetX===-60, 'Encode left drag did not lock/follow displacement');
m=evaluate(180,200,250,195,'dec',360,false,false);
assert(m.state==='locked' && m.offsetX===70, 'Decode right drag did not lock/follow displacement');
assert(evaluate(180,200,240,200,'enc',360,false,false).state==='pending', 'wrong direction locked before crossing origin');
assert(evaluate(180,200,240,200,'enc',360,true,false).offsetX===0, 'locked reverse did not clamp back to origin');
assert(evaluate(20,200,100,200,'dec',360,false,false).state==='cancelled', 'system edge start was accepted');
// A borda também precisa de um controle positivo: uma posição útil próxima da
// lateral deve continuar iniciando o gesto. Isto detecta edge alargado demais.
assert(evaluate(80,200,40,200,'enc',360,false,false).state==='locked', 'normal near-edge start stopped being accepted');
// E a dominância precisa dos dois lados do limite: diagonal quase vertical
// continua scroll; diagonal um pouco mais horizontal ainda pode travar o swipe.
assert(evaluate(180,300,170,309,'enc',360,false,false).state==='pending', 'diagonal scroll intent became horizontal swipe');
assert(evaluate(180,300,170,308,'enc',360,false,false).state==='locked', 'clear horizontal diagonal stopped locking');
assert(evaluate(180,200,100,200,'enc',800,false,false).state==='cancelled', 'desktop width was accepted');
assert(shouldCommit(-100,360)===false, 'normal-distance release committed one pixel too early');
assert(shouldCommit(-101,360)===true, '28% normal drag did not commit');
assert(shouldCommit(101,360)===true, 'normal commit threshold was direction-dependent');
assert(shouldCommit(-84,240)===false && shouldCommit(-85,240)===true, 'minimum commit floor changed on a narrow phone');
assert(shouldCommit(179,700)===false && shouldCommit(180,700)===true, 'large-phone/tablet threshold cap changed');
assert(shouldCommit(-60,360,100)===true, 'short fast flick did not commit');
assert(shouldCommit(-60,360,180)===false, 'short slow drag was mistaken for a flick');
assert(shouldCommit(-54,360,50)===false, 'tiny movement committed only because it was fast');

function classList(initial=[]) {
  const set=new Set(initial);
  return {
    add(...xs){ xs.forEach(x=>set.add(x)); }, remove(...xs){ xs.forEach(x=>set.delete(x)); },
    contains(x){ return set.has(x); }, toArray(){ return [...set]; }
  };
}
function panel(id, active=false) {
  const attrs=new Map();
  return {
    id, listeners:new Map(), classList:classList(active?['panel','active']:['panel']), style:{}, dataset:{}, scrollTop:0,
    addEventListener(type, fn, options){ this.listeners.set(type,{fn,options}); },
    getBoundingClientRect(){ return {top:130,left:0,width:360,height:500}; },
    hasAttribute(name){ return attrs.has(name); }, getAttribute(name){ return attrs.get(name) ?? null; },
    setAttribute(name,val){ attrs.set(name,String(val)); }, removeAttribute(name){ attrs.delete(name); }
  };
}
const encPanel=panel('panel-enc',true), decPanel=panel('panel-dec',false), panels=[encPanel,decPanel];
let active='enc', reduced=false;
const activeEl={classList:{contains(name){ return name===active; }}};
const documentStub={
  documentElement:{clientWidth:360}, activeElement:null,
  querySelectorAll(sel){ return sel==='.panel' ? panels : []; },
  querySelector(sel){ return sel==='.tab.active' ? activeEl : null; },
  getElementById(id){ return id==='panel-enc'?encPanel:id==='panel-dec'?decPanel:null; },
};
const windowListeners=new Map(), visualViewportListeners=new Map();
const windowStub={
  innerWidth:360, visualViewport:{width:360,addEventListener(type,fn,opts){visualViewportListeners.set(type,{fn,opts});}},
  requestAnimationFrame(fn){ fn(); return 1; },
  matchMedia(){ return {matches:reduced}; },
  addEventListener(type,fn,opts){ windowListeners.set(type,{fn,opts}); }
};
const switched=[];
function switchTabStub(next){
  switched.push(next); active=next;
  encPanel.classList.remove('active'); decPanel.classList.remove('active');
  (next==='enc'?encPanel:decPanel).classList.add('active');
}
const timers=[];
function setTimeoutStub(fn){ timers.push(fn); return timers.length; }
function clearTimeoutStub(){}
function flushTimers(){ while(timers.length) timers.shift()(); }

const harness = new Function('document','window','switchTab','setTimeout','clearTimeout',
  `let tabSwitchGeneration=0;\nlet mobileSwipeAbortForTabSwitch=null;\n${cfg[0]}\n${blockedSrc}\n${dirSrc}\n${evalSrc}\n${commitSrc}\n${bindSrc}\nreturn {bind:bindMobileTabSwipe,explicitTabSwitch(next){ if(typeof mobileSwipeAbortForTabSwitch==='function') mobileSwipeAbortForTabSwitch(); tabSwitchGeneration++; switchTab(next); }};`
)(documentStub,windowStub,switchTabStub,setTimeoutStub,clearTimeoutStub);
const bind = harness.bind;
bind();

for (const p of panels) {
  for (const type of ['touchstart','touchmove','touchend','touchcancel']) {
    const reg=p.listeners.get(type);
    assert(reg && typeof reg.fn==='function', `${type} listener missing`);
    const expected = (type==='touchmove' || type==='touchend') ? false : true;
    assert(reg.options && reg.options.passive===expected, `${type} passive contract changed`);
  }
}
assert(windowListeners.get('resize')?.opts?.passive===true, 'window resize cancellation listener missing/passive contract changed');
assert(visualViewportListeners.get('resize')?.opts?.passive===true, 'visual viewport resize listener missing/passive contract changed');

function touch(x,y,identifier=1){ return {clientX:x,clientY:y,identifier}; }
const plain={closest(){ return null; }};
function makeTarget(kind) {
  const t={kind,contains(node){ return node===this; }};
  t.closest=(sel)=>{
    if (kind==='drop' && (sel.includes('.drop-zone') || sel.includes('[tabindex]'))) return t;
    if (kind==='button' && sel.includes('button')) return t;
    if (kind==='module' && (sel.includes('.module-header') || sel.includes('[role="button"]'))) return t;
    if (kind==='range' && sel.includes('input[type="range"]')) return t;
    if (kind==='select' && (sel.includes('select') || sel.includes('option'))) return t;
    if (kind==='textarea' && (sel.includes('textarea') || sel.includes('input, textarea'))) return t;
    if (kind==='input' && (sel.includes('input:not(') || sel.includes('input,'))) return t;
    return null;
  };
  return t;
}
const dropTarget=makeTarget('drop'), buttonTarget=makeTarget('button'), moduleTarget=makeTarget('module');
const rangeTarget=makeTarget('range'), selectTarget=makeTarget('select'), textareaTarget=makeTarget('textarea');
function fire(type, data={}, which=0) {
  const reg=panels[which].listeners.get(type);
  let prevented=false;
  const event={target:plain,touches:[],changedTouches:[],cancelable:true,preventDefault(){prevented=true;},...data};
  reg.fn(event);
  return {event,prevented};
}
function reset(tab='enc', width=360) {
  flushTimers(); switched.length=0; active=tab; reduced=false; documentStub.activeElement=null; windowStub.innerWidth=width; windowStub.visualViewport.width=width; documentStub.documentElement.clientWidth=width;
  encPanel.classList.remove('active'); decPanel.classList.remove('active');
  (tab==='enc'?encPanel:decPanel).classList.add('active');
  for (const p of panels) {
    p.classList.remove('swipe-current','swipe-preview','swipe-animating');
    Object.keys(p.style).forEach(k=>p.style[k]='');
    Object.keys(p.dataset).forEach(k=>delete p.dataset[k]);
    p.removeAttribute('aria-hidden');
  }
}

// Direct manipulation: two panels must follow the finger together.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
let ev=fire('touchmove',{touches:[touch(170,203)]});
assert(ev.prevented, 'horizontal lock did not prevent native movement after intent was clear');
assert(encPanel.style.transform.includes('-30px'), 'current panel did not follow finger');
assert(decPanel.style.transform.includes('330px'), 'next panel did not enter proportionally');
assert(decPanel.classList.contains('swipe-preview'), 'next panel was not exposed during drag');
assert(decPanel.style.top==='130px' && decPanel.style.left==='0px' && decPanel.style.width==='360px' && decPanel.style.height==='500px', 'preview panel did not inherit current panel geometry');
assert(decPanel.getAttribute('aria-hidden')==='true' && decPanel.style.pointerEvents==='none', 'preview panel is not inert to accessibility/pointer input during drag');
assert(switched.length===0, 'tab state changed before release');

// User changes their mind without lifting: interface must follow back to origin.
ev=fire('touchmove',{touches:[touch(230,202)]});
assert(ev.prevented, 'locked reverse stopped owning horizontal movement');
assert(encPanel.style.transform.includes('0px'), 'reversing past origin did not return current panel');
assert(decPanel.style.transform.includes('360px'), 'reversing past origin did not return next panel');
fire('touchmove',{touches:[touch(185,201)]});
assert(encPanel.style.transform.includes('-15px'), 'small return displacement did not follow finger');
fire('touchend',{changedTouches:[touch(185,201)]});
flushTimers();
assert(active==='enc' && switched.length===0, 'sub-threshold release changed tab');
assert(!decPanel.classList.contains('swipe-preview') && encPanel.style.transform==='', 'cancel settle did not clean preview styles');

// Commit only after enough physical travel; switch occurs after settle, not during drag.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(30,202)]});
assert(switched.length===0, 'drag committed before touchend');
fire('touchend',{changedTouches:[touch(30,202)]});
assert(switched.length===0, 'tab switched before settle completed');
flushTimers();
assert(active==='dec' && switched.length===1 && switched[0]==='dec', 'left drag did not settle on Decode');
assert(encPanel.style.transform==='' && decPanel.style.transform==='', 'commit settle left inline transforms behind');

// A short, feed-like flick commits by speed; the same distance dragged slowly returns.
reset('enc');
fire('touchstart',{touches:[touch(200,200)],timeStamp:1000});
fire('touchmove',{touches:[touch(150,201)],timeStamp:1050});
fire('touchend',{changedTouches:[touch(140,201)],timeStamp:1100});
flushTimers();
assert(active==='dec', 'short fast flick did not change tabs');
reset('enc');
fire('touchstart',{touches:[touch(200,200)],timeStamp:1000});
fire('touchmove',{touches:[touch(150,201)],timeStamp:1150});
fire('touchend',{changedTouches:[touch(140,201)],timeStamp:1300});
flushTimers();
assert(active==='enc', 'short slow drag changed tabs as if it were a flick');

reset('dec');
fire('touchstart',{touches:[touch(160,200)]},1);
fire('touchmove',{touches:[touch(330,198)]},1);
fire('touchend',{changedTouches:[touch(330,198)]},1);
flushTimers();
assert(active==='enc' && switched[0]==='enc', 'right drag did not settle on Encode');

// Vertical path stays native and never prepares the neighbour.
reset('enc');
fire('touchstart',{touches:[touch(180,200)]});
ev=fire('touchmove',{touches:[touch(184,230)]});
assert(!ev.prevented, 'vertical intent was prevented before horizontal lock');
assert(!decPanel.classList.contains('swipe-preview'), 'vertical intent exposed next panel');
fire('touchend',{changedTouches:[touch(100,230)]});
flushTimers();
assert(switched.length===0, 'cancelled vertical gesture later committed');

// Swipe should start over normal interactive surfaces, but not over controls
// whose own horizontal/editing gesture must win.
for (const target of [dropTarget,buttonTarget,moduleTarget]) {
  reset('enc');
  fire('touchstart',{target,touches:[touch(200,200)]});
  fire('touchmove',{target,touches:[touch(150,200)]});
  assert(decPanel.classList.contains('swipe-preview'), `${target.kind} did not allow swipe start`);
  fire('touchcancel'); flushTimers();
}
reset('enc');
documentStub.activeElement=textareaTarget;
fire('touchstart',{target:textareaTarget,touches:[touch(200,200)]});
fire('touchmove',{target:textareaTarget,touches:[touch(100,200)]});
assert(!decPanel.classList.contains('swipe-preview'), 'focused textarea lost its editing gesture to swipe');
reset('enc');
fire('touchstart',{target:rangeTarget,touches:[touch(200,200)]});
fire('touchmove',{target:rangeTarget,touches:[touch(100,200)]});
assert(!decPanel.classList.contains('swipe-preview'), 'range slider lost its horizontal gesture to swipe');
reset('enc');
fire('touchstart',{target:selectTarget,touches:[touch(200,200)]});
fire('touchmove',{target:selectTarget,touches:[touch(100,200)]});
assert(!decPanel.classList.contains('swipe-preview'), 'select control started a swipe');
// The same textarea is swipeable while it is not actively being edited.
reset('enc');
fire('touchstart',{target:textareaTarget,touches:[touch(200,200)]});
fire('touchmove',{target:textareaTarget,touches:[touch(150,200)]});
assert(decPanel.classList.contains('swipe-preview'), 'unfocused textarea could not start swipe');
fire('touchcancel'); flushTimers();

// Horizontal drags cancel only their own synthetic click at the touch layer.
// A plain tap and vertical movement remain native immediately.
reset('enc');
let endEv=fire('touchstart',{target:buttonTarget,touches:[touch(200,200)]});
let moveEv=fire('touchmove',{target:buttonTarget,touches:[touch(30,200)]});
endEv=fire('touchend',{target:buttonTarget,changedTouches:[touch(30,200)]});
assert(moveEv.prevented && endEv.prevented, 'swipe on button did not cancel its own native/synthetic click sequence');
flushTimers();
reset('enc');
fire('touchstart',{target:buttonTarget,touches:[touch(200,200)]});
endEv=fire('touchend',{target:buttonTarget,changedTouches:[touch(200,200)]});
assert(!endEv.prevented, 'plain button tap was suppressed without a swipe');
// Wrong-direction horizontal drag cannot change tabs, but must still cancel click.
reset('enc');
fire('touchstart',{target:buttonTarget,touches:[touch(180,200)]});
moveEv=fire('touchmove',{target:buttonTarget,touches:[touch(230,201)]});
endEv=fire('touchend',{target:buttonTarget,changedTouches:[touch(230,201)]});
assert(moveEv.prevented && endEv.prevented, 'wrong-direction horizontal drag did not cancel its own click sequence');
flushTimers();
// Vertical movement stays fully native.
reset('enc');
fire('touchstart',{target:buttonTarget,touches:[touch(180,200)]});
moveEv=fire('touchmove',{target:buttonTarget,touches:[touch(183,240)]});
endEv=fire('touchend',{target:buttonTarget,changedTouches:[touch(183,240)]});
assert(!moveEv.prevented && !endEv.prevented, 'vertical control movement was incorrectly cancelled');

// Edge gestures, desktop, multitouch remain excluded.
reset('enc');
fire('touchstart',{touches:[touch(20,200)]});
fire('touchmove',{touches:[touch(120,200)]});
assert(!decPanel.classList.contains('swipe-preview'), 'edge gesture started visual swipe');
reset('enc',800);
fire('touchstart',{touches:[touch(300,200)]});
fire('touchmove',{touches:[touch(180,200)]});
assert(!decPanel.classList.contains('swipe-preview'), 'desktop width started visual swipe');
reset('enc');
fire('touchstart',{touches:[touch(180,200),touch(220,200)]});
fire('touchmove',{touches:[touch(80,200)]});
assert(!decPanel.classList.contains('swipe-preview'), 'multitouch started visual swipe');

// Transient window.innerWidth changes must not cancel when the visual/client width is stable.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(150,200)]});
windowStub.innerWidth=670; // observed in real Chromium touch emulation; visual/client width remains 360
fire('touchmove',{touches:[touch(190,200)]});
assert(encPanel.style.transform.includes('-10px') && !encPanel.classList.contains('swipe-animating'),
  'unstable window.innerWidth cancelled a gesture despite stable visual viewport width');
fire('touchend',{changedTouches:[touch(190,200)]}); flushTimers();

// touchcancel and resize must visibly roll back an in-flight drag.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(100,200)]});
fire('touchcancel');
flushTimers();
assert(active==='enc' && encPanel.style.transform==='' && decPanel.style.transform==='', 'touchcancel did not restore panels');
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(100,200)]});
windowStub.innerWidth=640; windowStub.visualViewport.width=640; documentStub.documentElement.clientWidth=640;
visualViewportListeners.get('resize').fn();
flushTimers();
assert(active==='enc' && encPanel.style.transform==='' && decPanel.style.transform==='', 'resize did not restore panels');

// The final touch coordinate, not the last move, decides snap/commit.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(150,200)]}); // below threshold
fire('touchend',{changedTouches:[touch(30,200)]}); // final point crosses threshold
flushTimers();
assert(active==='dec', 'touchend final coordinate was ignored after the last touchmove');

// A different finger may not inherit an in-flight gesture.
reset('enc');
fire('touchstart',{touches:[touch(200,200,11)]});
fire('touchmove',{touches:[touch(100,200,12)]});
flushTimers();
assert(active==='enc' && !decPanel.classList.contains('swipe-preview'), 'different touch identifier inherited gesture state');

// Any explicit tab navigation during settle wins immediately — state and visuals.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(30,200)]});
fire('touchend',{changedTouches:[touch(30,200)]});
assert(decPanel.classList.contains('swipe-preview'), 'commit settle was not visually pending before explicit navigation');
harness.explicitTabSwitch('enc');
assert(active==='enc' && switched.length===1 && switched[0]==='enc', 'explicit tab navigation did not become canonical immediately');
assert(!decPanel.classList.contains('swipe-preview') && encPanel.style.transform==='' && decPanel.style.transform==='',
  'explicit tab navigation left pending swipe visuals alive');
flushTimers();
assert(active==='enc' && switched.length===1, 'old settle timer overrode explicit tab navigation later');

// A first horizontal move that is already non-cancelable belongs to the browser.
reset('enc');
fire('touchstart',{touches:[touch(200,200)]});
ev=fire('touchmove',{touches:[touch(100,200)],cancelable:false});
assert(!ev.prevented && !decPanel.classList.contains('swipe-preview'), 'late non-cancelable browser gesture was stolen by swipe');

// Reduced motion: direct drag remains, only the release animation is removed.
reset('enc'); reduced=true;
fire('touchstart',{touches:[touch(200,200)]});
fire('touchmove',{touches:[touch(30,200)]});
fire('touchend',{changedTouches:[touch(30,200)]});
assert(active==='dec', 'reduced-motion settle waited for an animation that should not exist');

// Static contract: state changes only during final settle; transforms drive visual motion.
assert((bindSrc.match(/switchTab\(g\.nextTab, \{fromSwipe:true\}\)/g)||[]).length===1, 'internal swipe commit must call switchTab exactly once with fromSwipe');
assert(ui.includes('let tabSwitchGeneration = 0;') && ui.includes('let mobileSwipeAbortForTabSwitch = null;') && bindSrc.includes('g.tabGeneration'), 'tab navigation generation/abort guard missing');
assert(switchTabSrc.includes("!options.fromSwipe") && switchTabSrc.includes('mobileSwipeAbortForTabSwitch()'), 'explicit switchTab no longer cancels pending swipe visuals');
assert(bindSrc.includes('mobileSwipeAbortForTabSwitch = abortForExplicitTabSwitch') && bindSrc.includes('if (settlingGesture !== g) return;'), 'settle cancellation is not protected against stale RAF/timer work');
assert(bindSrc.includes("transitionDuration = duration+'ms'"), 'settle duration is no longer driven by the JS config');
assert(bindSrc.includes('window.visualViewport') && bindSrc.indexOf('window.visualViewport') < bindSrc.indexOf('window.innerWidth'), 'mobile width no longer prefers stable visual/client viewport');
assert(bindSrc.includes('viewportWidth() !== gesture.viewportWidth'), 'resize cancellation became broader than width changes');
assert(/translate3d\(/.test(bindSrc), 'interactive swipe lost transform-based direct manipulation');
assert(moveSrc.indexOf('e.preventDefault()') > moveSrc.indexOf("state.state !== 'locked'"), 'preventDefault moved before horizontal lock');
assert(!/scrollTop|scrollTo\s*\(|touchAction|touch-action/.test(`${blockedSrc}\n${evalSrc}\n${bindSrc}`), 'swipe code manipulates scroll position/touch-action');
assert(css.includes('.panel.swipe-preview') && css.includes('.panel.swipe-animating'), 'interactive swipe CSS hooks missing');
assert(/\.panel\.swipe-preview\s*\{[\s\S]*?position\s*:\s*fixed\s*;/.test(css), 'preview panel is not fixed into the current viewport');
for (const token of ['input[type="range"]','select','[contenteditable]']) {
  assert(blockedSrc.includes(token), `true gesture-conflict surface ${token} disappeared from swipe exclusion set`);
}
assert(bindSrc.includes('MOBILE_TAB_SWIPE.clickSuppressX') && bindSrc.includes('e.preventDefault()'), 'horizontal click suppression moved away from the touch sequence');
assert(commitSrc.includes('flickMinX') && commitSrc.includes('flickVelocity') && bindSrc.includes('startTime'), 'speed-aware flick commit disappeared');
assert(!bindSrc.includes('clickGuardTimer') && !bindSrc.includes('guardSyntheticClick'), 'temporal click guard reappeared; it can swallow the next legitimate tap');
assert(!switchTabSrc.includes('resetStatus('), 'tab navigation restarted terminal typing animation');
assert(/\.panel\.active\s*\{[\s\S]*?touch-action\s*:\s*pan-y pinch-zoom\s*;/.test(css), 'mobile panel no longer declares vertical-native touch action');
assert((main.match(/bindMobileTabSwipe\(\);/g)||[]).length===1, 'bindMobileTabSwipe must be wired exactly once');

console.log('mobile swipe OK — broad start area/short flick + shorter drag/direct manipulation/touch click suppression/vertical/edge');
