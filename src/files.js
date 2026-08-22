function extractImageFromClipboard(data) {
  if (!data) return null;
  const items = data.items || [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  if (data.files) {
    for (const f of data.files) if (f.type.startsWith('image/')) return f;
  }
  return null;
}

function flashDrop(id) {
  const dz = document.getElementById(id);
  dz.classList.add('over');
  setTimeout(() => dz.classList.remove('over'), 400);
}

function setupDrop(dId, fId, onFile) {
  const dz = document.getElementById(dId);
  const fi = document.getElementById(fId);

  dz.addEventListener('click', () => {
    fi.click();
    // Devolve foco ao anchor após fechar o picker
    fi.addEventListener('cancel', () => {
      document.getElementById('paste-anchor').focus({preventScroll:true});
    }, {once:true});
  });

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    const f = e.dataTransfer.files[0] || extractImageFromClipboard(e.dataTransfer);
    if (f) onFile(f);
  });

  fi.addEventListener('change', e => {
    if (e.target.files[0]) {
      onFile(e.target.files[0]);
      document.getElementById('paste-anchor').focus({preventScroll:true});
    }
  });

  // Paste direto na drop zone quando estiver em foco
  dz.setAttribute('tabindex', '0');
  dz.addEventListener('paste', e => {
    const f = extractImageFromClipboard(e.clipboardData);
    if (f) { e.preventDefault(); onFile(f); }
  });
}

// ── PASTE GLOBAL (Ctrl+V em qualquer lugar) ──
window.addEventListener('load', () => {
  document.getElementById('paste-anchor').focus({preventScroll:true});
  setLang(LANG);
  resetStatus('enc-status', true);
  resetStatus('dec-status');
});

document.addEventListener('paste', async e => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  const f = extractImageFromClipboard(e.clipboardData);
  if (!f) return;
  e.preventDefault();

  const encActive = document.getElementById('panel-enc').classList.contains('active');
  if (encActive) {
    flashDrop('enc-drop');
    const fmt = classifyFormat(f);
    resetCarrierPreflight();
    encID=null; encFormatOk=false; checkEncReady();
    loadToCanvas(f, (id, w, h, src, hadAlpha) => {
      onEncCarrierLoaded(id, w, h, src, hadAlpha, fmt, f);
    }, r => showLoadError('enc', r));
  } else {
    flashDrop('dec-drop');
    await loadDecoderFile(f);   // mesmo ingresso do drop: bump + busy-state
  }
});

// ── ENCODE DROP ──
let encID=null, encW=0, encH=0, encOpaque=0, encFormatOk=false;
let encPreflightBlocked=false;
let encPreflightResult={checked:false,suspicious:false,signals:[]};
let encPreflightAcknowledged=false;

function renderCarrierPreflight() {
  const wrap=document.getElementById('enc-preflight');
  const ok=document.getElementById('enc-preflight-ok');
  const warn=document.getElementById('enc-preflight-warn');
  const actions=document.querySelector('#enc-preflight-warn .carrier-preflight-actions');
  const continued=document.getElementById('enc-preflight-continued');
  const use=document.getElementById('enc-preflight-use');
  if(!wrap||!ok||!warn) return;

  if(!encPreflightResult.checked){
    wrap.style.display='none';
    ok.style.display='none';
    warn.style.display='none';
    return;
  }

  wrap.style.display='block';
  ok.style.display=encPreflightResult.suspicious?'none':'block';
  warn.style.display=encPreflightResult.suspicious?'block':'none';
  if(actions) actions.style.display=(encPreflightResult.suspicious&&!encPreflightAcknowledged)?'flex':'none';
  if(continued) continued.style.display=(encPreflightResult.suspicious&&encPreflightAcknowledged)?'block':'none';
  if(use) use.disabled=encPreflightAcknowledged;
}

function resetCarrierPreflight() {
  encPreflightBlocked=false;
  encPreflightAcknowledged=false;
  encPreflightResult={checked:false,suspicious:false,signals:[]};
  renderCarrierPreflight();
}

function evaluateCarrierPreflight(imageData, fmt) {
  encPreflightResult=inspectCarrierPreflight(imageData, fmt);
  encPreflightAcknowledged=false;
  encPreflightBlocked=!!encPreflightResult.suspicious;
  renderCarrierPreflight();
}

// Preferência MANUAL do usuário para "Modo de Alta Capacidade" — separada do estado
// forçado (quando a mensagem é grande demais para o furtivo). Permite reverter.
let encMaxcapManual=false;

// Pós-carregamento da portadora, compartilhado por colar e arrastar. Aceita
// qualquer imagem que o navegador decodifique; a saída é sempre um PNG novo,
// portanto o formato lossy de entrada é aceitável. Apenas avisamos que
// será convertido. O gate do botão usa o estado persistente `encFormatOk`;
// mudanças na senha não podem reabilitar Encode se a imagem falhou.
function onEncCarrierLoaded(id, w, h, src, hadAlpha, fmt, file) {
  encOutputGeneration++; // uma saída robusta pendente pertence à portadora anterior
  encID=id; encW=w; encH=h; encOpaque=opaquePixels(id.data).length; encFormatOk=true;
  document.getElementById('enc-prev').src=src;
  document.getElementById('enc-pw').style.display='block';
  document.getElementById('enc-hint').style.display='none';
  document.getElementById('enc-info').textContent=`${w}×${h} · ${fmtBytes(file.size)}`;
  document.getElementById('enc-alpha-note').style.display = hadAlpha ? 'block' : 'none';
  document.getElementById('enc-cover-tip').style.display = isLowTextureCover(id.data) ? 'block' : 'none';
  const willConvert = fmt.cat!=='lossless'; // entrada não-PNG → será convertida
  const b=document.getElementById('enc-fbadge');
  b.textContent = fmt.ext;
  const col = willConvert ? '255,179,0' : '0,255,179';
  const txt = willConvert ? '#ffb300' : 'var(--enc)';
  b.style.cssText=`background:rgba(${col},0.15);color:${txt};border:1px solid rgba(${col},0.3)`;
  evaluateCarrierPreflight(id, fmt);
  updateCap();
  encStatusLoaded(fmt, w, h, file.size, file);
  checkEncReady();
}

setupDrop('enc-drop','enc-file', file=>{
  const fmt=classifyFormat(file);
  resetCarrierPreflight();
  encID=null; encFormatOk=false; checkEncReady(); // decode falho → botão fica travado
  loadToCanvas(file,(id,w,h,src,hadAlpha)=>{
    onEncCarrierLoaded(id,w,h,src,hadAlpha,fmt,file);
  }, r => showLoadError('enc', r));
});

(function setupCarrierPreflightActions(){
  const use=document.getElementById('enc-preflight-use');
  const choose=document.getElementById('enc-preflight-choose');
  if(use) use.addEventListener('click',()=>{
    encPreflightAcknowledged=true;
    encPreflightBlocked=false;
    renderCarrierPreflight();
    checkEncReady();
  });
  if(choose) choose.addEventListener('click',()=>{
    document.getElementById('enc-file')?.click();
  });
})();

// ── DECODE DROP ──
// ── BUSY-STATE EXPLÍCITO DO ANALYZER ─────────────────────────────────────────
// O bloqueio é deliberado: durante a análise, controles que poderiam substituir
// ou re-renderizar o estado ficam indisponíveis. Isso preserva o mesmo contrato
// mesmo se o pipeline futuramente ceder a thread ou migrar para um Worker.
//
// `analysisGeneration` e os snapshots continuam necessários como defesa de estado:
// a trava de UI e a validação da operação corrente resolvem problemas diferentes.
let _analysisBusy = false;
function isAnalysisBusy(){ return _analysisBusy; }
function setAnalysisBusy(v) {
  _analysisBusy = !!v;
  const alvos = ['dec-file','dec-key','btn-analyze','dec-clear','lang-en','lang-pt'];
  for (const id of alvos) {
    const el = document.getElementById(id);
    if (el) { el.disabled = _analysisBusy; el.setAttribute('aria-disabled', String(_analysisBusy)); }
  }
  const dz = document.getElementById('dec-drop');
  if (dz) {
    dz.classList.toggle('busy', _analysisBusy);
    dz.setAttribute('aria-busy', String(_analysisBusy));
  }
  const painel = document.getElementById('panel-dec');
  if (painel) painel.setAttribute('aria-busy', String(_analysisBusy));
  if (!_analysisBusy) checkDecReady();
}

let decID=null, decFile=null, decFmt=null;
// ── IDENTIDADE DA OPERAÇÃO ───────────────────────────────────────────────────
// A análise é assíncrona e longa. `decID`/`decFile`/`decFmt` podem mudar antes
// de a execução terminar; por isso cada troca de imagem incrementa esta geração.
// A análise trabalha sobre um snapshot e publica somente se ainda for a operação
// corrente. A guarda `_analisando` evita reentrância, mas não substitui esta regra.
let analysisGeneration = 0;
function bumpAnalysisGeneration(){ analysisGeneration++; }

// ── INGRESSO ÚNICO DE IMAGEM NO DECODER ──────────────────────────────────────
// Drop, seletor de arquivo e paste precisam passar pelo mesmo ponto de entrada
// para atualizar a geração e o snapshot de forma consistente. Qualquer novo
// caminho de carregamento deve reutilizar esta função.
async function loadDecoderFile(file) {
  if (isAnalysisBusy()) return;
  bumpAnalysisGeneration();
  clearProcessingTime('dec-processing-time');
  decFile = file;
  // sniff de magic bytes → detecção robusta (pega .jfif, MIME errado, etc.)
  let magic=null; try{ magic=new Uint8Array(await file.slice(0,16).arrayBuffer()); }catch(_){}
  decFmt = classifyFormat(file, magic);
  loadToCanvas(file,(id,w,h,src)=>{
    decID=id;
    document.getElementById('dec-prev').src=src;
    document.getElementById('dec-pw').style.display='block';
    document.getElementById('dec-hint').style.display='none';
    document.getElementById('dec-info').textContent=`${w}×${h} · ${fmtBytes(file.size)}`;
    const b=document.getElementById('dec-fbadge');
    b.textContent=decFmt.ext;
    const colors={lossless:'255,107,53',lossy:'255,179,0',palette:'100,180,255'};
    const c=colors[decFmt.cat];
    b.style.cssText=`background:rgba(${c},0.15);color:rgb(${c});border:1px solid rgba(${c},0.3)`;
    decStatusLoaded(decFmt,w,h,file.size);
    checkDecReady();
    clearDecKey();
  }, r => showLoadError('dec', r));
}
setupDrop('dec-drop','dec-file', loadDecoderFile);

// ── BOTÃO LIMPAR SENHA + LIMPEZA AUTOMÁTICA (Decoder) ──
// O "x" só aparece quando há senha digitada (campo vazio fica limpo). Ao
// carregar uma nova imagem, a senha é zerada para não influenciar a próxima
// análise (evita decode errado ou falso "chave incorreta").
function clearDecKey() {
  const k = document.getElementById('dec-key');
  if (k) { k.value = ''; updateDecKeyClear(); }
  if (typeof clearKeyFlash === 'function') clearKeyFlash();
}
// ── INSTRUMENTAÇÃO DO ENCODE ────────────────────────────────────────────────
// Mede os estágios do Encoder sem alterar o fluxo. Os dados permitem localizar
// gargalos antes de qualquer otimização. Ver no console: window.__encTimings
const __encT = { marcas: [], t0: 0 };
function encMark(nome) {
  const agora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (!__encT.marcas.length) __encT.t0 = agora;
  __encT.marcas.push({ nome, ms: +(agora - __encT.t0).toFixed(1) });
}
function encTimingsReset(){ __encT.marcas = []; __encT.t0 = 0; }
// `coreTotal` termina quando o PNG fica pronto; `uiReadyTotal` acompanha o ponto
// em que o botão principal é liberado. A saída JPEG robusta termina de forma
// independente e o tempo TOTAL visível usa o fechamento das duas saídas.
function encTimingsFlush(final) {
  const m = __encT.marcas;
  if (m.length < 2) return null;
  const fases = m.slice(1).map((x, i) => ({ fase: x.nome, ms: +(x.ms - m[i].ms).toFixed(1) }));
  const png = m.find(x => x.nome === 'png:out');
  const out = {
    coreTotal:    png ? png.ms : null,
    uiReadyTotal: final ? m[m.length-1].ms : null,
    total: m[m.length-1].ms, fases,
  };
  try {
    window.__encTimings = out;
    if (final) console.info('[encode] core ' + out.coreTotal + 'ms · ui-ready ' + out.uiReadyTotal + 'ms', fases);
  } catch(_) {}
  return out;
}

// ── TEMPO DE PROCESSAMENTO VISÍVEL ──────────────────────────────────────────
// Informação local de UX/diagnóstico. Nunca entra no payload, no relatório JSON,
// no localStorage nem em qualquer cálculo forense.
function processingNow() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now() : Date.now();
}
function formatProcessingTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1000) return Math.round(n) + ' ms';
  const raw = (n / 1000).toFixed(2);
  return (typeof LANG !== 'undefined' && LANG === 'pt' ? raw.replace('.', ',') : raw) + ' s';
}
function showProcessingTime(id, ms) {
  const el = document.getElementById(id);
  if (!el || !Number.isFinite(Number(ms)) || Number(ms) < 0) return;
  el.dataset.ms = String(Number(ms));
  const val = el.querySelector('.processing-time-value');
  if (val) val.textContent = formatProcessingTime(Number(ms));
  el.classList.add('visible');
}
function clearProcessingTime(id) {
  const el = document.getElementById(id);
  if (!el) return;
  delete el.dataset.ms;
  const val = el.querySelector('.processing-time-value');
  if (val) val.textContent = '';
  el.classList.remove('visible');
}
function refreshProcessingTimes() {
  document.querySelectorAll('.processing-time.visible[data-ms]').forEach(el => {
    const val = el.querySelector('.processing-time-value');
    if (val) val.textContent = formatProcessingTime(Number(el.dataset.ms));
  });
}

function updateDecKeyClear() {
  const k = document.getElementById('dec-key');
  const x = document.getElementById('dec-key-clear');
  if (k && x) x.style.display = k.value.length > 0 ? 'flex' : 'none';
}
(function setupDecKeyClear(){
  const k = document.getElementById('dec-key');
  const x = document.getElementById('dec-key-clear');
  if (k) k.addEventListener('input', () => { updateDecKeyClear(); if (typeof clearKeyFlash === 'function') clearKeyFlash(); });
  if (x) x.addEventListener('click', () => { clearDecKey(); document.getElementById('dec-key').focus(); });
})();

// Botão "x" da senha do Encoder (mesmo padrão; aparece só quando há texto).
// No Encoder NÃO limpamos ao trocar imagem — faz sentido manter a senha entre
// tentativas de codificação da mesma mensagem.
function updateEncKeyClear() {
  const k = document.getElementById('enc-key');
  const x = document.getElementById('enc-key-clear');
  if (k && x) x.style.display = k.value.length > 0 ? 'flex' : 'none';
}
(function setupEncKeyClear(){
  const k = document.getElementById('enc-key');
  const x = document.getElementById('enc-key-clear');
  if (k) k.addEventListener('input', () => { updateEncKeyClear(); updateEncPwStrength(); });
  if (x) x.addEventListener('click', () => { k.value=''; updateEncKeyClear(); updateEncPwStrength(); k.focus(); });
})();

// Medidor de força de senha — heurística própria leve (sem zxcvbn/dependência).
// Estima entropia por (comprimento × log2(tamanho do alfabeto)) e penaliza
// padrões fracos (senhas comuns, caractere repetido, sequências de teclado).
function pwStrength(pw){
  if(!pw) return {level:0, bits:0};
  const len = pw.length, lower = pw.toLowerCase();
  let pool=0;
  if(/[a-z]/.test(pw)) pool+=26;
  if(/[A-Z]/.test(pw)) pool+=26;
  if(/[0-9]/.test(pw)) pool+=10;
  if(/[^a-zA-Z0-9]/.test(pw)) pool+=33;
  let bits = len * Math.log2(pool||1);
  const COMMON=['password','passwd','123456','12345678','123456789','qwerty',
    'qwertyuiop','senha','admin','iloveyou','letmein','welcome','abc123','000000',
    '111111','monkey','dragon','football','master','sunshine','superman','princess'];
  let weak=false;
  if(COMMON.some(c=>lower.includes(c))) weak=true;
  if(/^(.)\1*$/.test(pw)) weak=true;
  if(/0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|asdf|zxcv/.test(lower)) weak=true;
  if(weak) bits = Math.min(bits, 20);
  let level;
  if(bits < 28) level=1; else if(bits < 50) level=2; else if(bits < 72) level=3; else level=4;
  return {level, bits:Math.round(bits)};
}
function updateEncPwStrength(){
  const k=document.getElementById('enc-key');
  const box=document.getElementById('enc-pw-strength');
  const fill=document.getElementById('enc-pw-fill');
  const lbl=document.getElementById('enc-pw-label');
  if(!k||!box||!fill||!lbl) return;
  const {level}=pwStrength(k.value);
  if(level===0){ box.style.display='none'; return; }
  box.style.display='block';
  const map={1:['pwWeak','#ff6464','25%'],2:['pwMedium','#ffb300','50%'],
             3:['pwStrong','#3ddc84','80%'],4:['pwExcellent','#00d4aa','100%']};
  const [key,color,width]=map[level];
  fill.style.width=width; fill.style.background=color;
  lbl.textContent=`${t('pwStrengthLabel')}: ${t(key)}`;
  lbl.style.color=color;
}

// Barra de força da senha da ISCA (negação plausível) — espelha updateEncPwStrength.
function updateDecoyPwStrength(){
  const k=document.getElementById('enc-decoy-key');
  const box=document.getElementById('enc-decoy-pw-strength');
  const fill=document.getElementById('enc-decoy-pw-fill');
  const lbl=document.getElementById('enc-decoy-pw-label');
  if(!k||!box||!fill||!lbl) return;
  const {level}=pwStrength(k.value);
  if(level===0){ box.style.display='none'; return; }
  box.style.display='block';
  const map={1:['pwWeak','#ff6464','25%'],2:['pwMedium','#ffb300','50%'],
             3:['pwStrong','#3ddc84','80%'],4:['pwExcellent','#00d4aa','100%']};
  const [key,color,width]=map[level];
  fill.style.width=width; fill.style.background=color;
  lbl.textContent=`${t('pwStrengthLabel')}: ${t(key)}`;
  lbl.style.color=color;
}


// Seleção AUTOMÁTICA do modo de embedding: o MAIS FURTIVO que couber.
// Escada de furtividade (menos detectável → mais): Adaptativo (HILL, só B, menor
// capacidade) → Padrão (B, 1 bit/px) → RGB (3 bits/px, maior capacidade). O flag
// 'maxcap' (Modo de Alta Capacidade) inverte: vai direto ao RGB. As capacidades
// batem EXATAMENTE com as do embedLSB. Retorna {mode, adaptive} ou null se nem o
// RGB couber. bodyBits = data.length*8 (corpo, sem o header de 80 bits).
function selectEmbedMode(bodyBits, opaqueCount, headerBits, maxcap) {
  // opaqueCount = pixels OPACOS (os únicos utilizáveis). avail = pixels para o corpo.
  const avail = opaqueCount - headerBits;
  if (avail <= 0) return null;
  // Modo de Alta Capacidade: RGB (3 bits/px opaco).
  if (maxcap) return bodyBits <= avail*3 ? { mode: MODE_RGB, adaptive: false, stc: false } : null;
  // Furtividade (padrão): STC (custo HILL ótimo + decode robusto). w=1 cabe sempre
  // que o adaptativo cabia, então o teto de capacidade é o mesmo (1 bit/px opaco).
  return bodyBits <= avail ? { mode: MODE_B, adaptive: false, stc: true } : null;
}

// P1B / O1-E2 — prepara o MESMO corpo que será usado pelo encode e pelo
// medidor de pressão. O texto chega já normalizado por getEncNormalizedMessage().
// A compressão continua oportunista: só vale quando reduz bytes. `mark` é usado
// apenas pelo encode para manter o profiling laboratorial; o medidor não mede tempo.
async function prepareEncMainBody(msg, cipher, mark=null) {
  let bodyBytes = new TextEncoder().encode(msg);
  let compressed = false;
  try {
    if (mark) mark('deflate:in');
    const comp = await deflateBytes(bodyBytes);
    if (mark) mark('deflate:out');
    if (comp.length < bodyBytes.length) { bodyBytes = comp; compressed = true; }
  } catch(_) { /* sem CompressionStream → segue sem comprimir, como o encode */ }
  const bodyStoredBytes = cipher ? (bodyBytes.length + F21_GCM_TAG_BYTES) : bodyBytes.length;
  return { bodyBytes, compressed, bodyStoredBytes, bodyBits: bodyStoredBytes * 8 };
}

// Métrica estrutural, não detector. "Pressão" descreve quanta liberdade física o
// encoder tem para o corpo atual. Em STC o dado central é w (= carriers candidatos
// por bit da mensagem); em RGB mostramos a ocupação objetiva dos slots disponíveis.
// Não usa RS/WS, não estima probabilidade e não altera o wire.
function computeEmbeddingPressure(bodyBits, opaqueCount, cipher, maxcap, decoyBits=0) {
  if (!Number.isFinite(bodyBits) || bodyBits <= 0 || !Number.isFinite(opaqueCount) || opaqueCount <= 0) return null;
  const prefixPx = cipher ? F21_PREFIX_CARRIER_PIXELS : HEADER_BYTES*8;
  const sel = selectEmbedMode(bodyBits, opaqueCount, prefixPx, maxcap);
  if (!sel) return { fits:false, payloadBpp: bodyBits / opaqueCount };

  const payloadBpp = bodyBits / opaqueCount;
  if (sel.stc) {
    const stcPrefixPx = cipher ? F21_PREFIX_CARRIER_PIXELS : (HEADER_BYTES+1)*8;
    const availBodyPx = Math.max(0, opaqueCount - stcPrefixPx);
    const stcW = pickStcW(bodyBits, availBodyPx);
    if (stcW < 1) return { fits:false, payloadBpp };
    const candidatePx = bodyBits * stcW;
    const poolPct = availBodyPx > 0 ? Math.min(100, candidatePx / availBodyPx * 100) : 100;
    const totalCarrierPct = Math.min(100, (stcPrefixPx + candidatePx + Math.max(0,decoyBits)) / opaqueCount * 100);
    const tier = stcW >= 8 ? 'low' : stcW >= 4 ? 'moderate' : stcW >= 2 ? 'high' : 'max';
    return { fits:true, path:'stc', payloadBpp, stcW, poolPct, totalCarrierPct, decoyBits:Math.max(0,decoyBits), tier };
  }

  const availSlots = Math.max(0, opaqueCount - prefixPx) * 3;
  const slotPct = availSlots > 0 ? Math.min(100, bodyBits / availSlots * 100) : 100;
  const totalCarrierPct = Math.min(100, (prefixPx + Math.ceil(bodyBits/3) + Math.max(0,decoyBits)) / opaqueCount * 100);
  return { fits:true, path:'rgb', payloadBpp, slotPct, totalCarrierPct, decoyBits:Math.max(0,decoyBits), tier:'rgb' };
}

let encPressureGeneration = 0;
let encPressureTimer = null;
let encPressureOpen = false;
let encPressureLast = null;

function refreshEmbeddingPressureToggleLabel() {
  const btn=document.getElementById('enc-pressure-toggle');
  if(!btn) return;
  const label=t(encPressureOpen?'encPressureClose':'encPressureOpen');
  btn.setAttribute('aria-label',label);
  btn.setAttribute('title',label);
  btn.setAttribute('aria-expanded',encPressureOpen?'true':'false');
}
function hideEmbeddingPressure() {
  encPressureOpen=false;
  encPressureLast=null;
  encPressureGeneration++;
  if(encPressureTimer){ clearTimeout(encPressureTimer); encPressureTimer=null; }
  const box=document.getElementById('enc-pressure');
  if(box) box.style.display='none';
  const warn=document.getElementById('enc-fill-warn');
  if(warn) warn.style.display='none';
  refreshEmbeddingPressureToggleLabel();
}
function formatPressureBpp(v) {
  if (!Number.isFinite(v)) return '—';
  return (v < 0.1 ? v.toFixed(4) : v.toFixed(3)) + ' bpp';
}
function renderEmbeddingPressure(m) {
  const box=document.getElementById('enc-pressure');
  const tier=document.getElementById('enc-pressure-tier');
  const metrics=document.getElementById('enc-pressure-metrics');
  const warn=document.getElementById('enc-fill-warn');
  if(!box||!tier||!metrics) return;
  if(!encPressureOpen){ box.style.display='none'; return; }
  box.style.display='block';
  if(!m){
    tier.textContent='—'; tier.dataset.tier='';
    metrics.textContent=t('encPressureNeedInput');
    if(warn) warn.style.display='none';
    return;
  }
  if(!m.fits){
    tier.textContent=t('encPressureOver'); tier.dataset.tier='max';
    metrics.textContent=t('encPressurePayloadRate')+': '+formatPressureBpp(m.payloadBpp);
    if(warn){ warn.textContent=t('encPressureDoesNotFit'); warn.style.color='#ff6464'; warn.style.display='block'; }
    return;
  }
  const tierKey = m.path==='rgb' ? 'encPressureRgb' :
    (m.tier==='low'?'encPressureLow':m.tier==='moderate'?'encPressureModerate':m.tier==='high'?'encPressureHigh':'encPressureMax');
  tier.textContent=t(tierKey); tier.dataset.tier=m.tier;
  const parts=[t('encPressurePayloadRate')+': '+formatPressureBpp(m.payloadBpp)];
  if(m.path==='stc'){
    parts.push('STC w='+m.stcW);
    parts.push(t('encPressurePool')+': '+m.poolPct.toFixed(1)+'%');
  }else{
    parts.push(t('encPressureRgbSlots')+': '+m.slotPct.toFixed(1)+'%');
  }
  if(m.decoyBits>0) parts.push(t('encPressureAlt').replace('{bits}',m.decoyBits.toLocaleString()));
  metrics.textContent=parts.join(' · ');
  if(warn){
    if(m.path==='stc' && (m.tier==='high'||m.tier==='max')){
      warn.textContent=t('encFillHigh'); warn.style.color='#ffb300'; warn.style.display='block';
    }else if(m.path==='stc' && m.tier==='moderate'){
      warn.textContent=t('encFillCaution'); warn.style.color='var(--dim)'; warn.style.display='block';
    }else{
      warn.style.display='none';
    }
  }
}
function refreshEmbeddingPressureLanguage() {
  refreshEmbeddingPressureToggleLabel();
  if(encPressureOpen) renderEmbeddingPressure(encPressureLast);
}
function toggleEmbeddingPressure() {
  encPressureOpen=!encPressureOpen;
  refreshEmbeddingPressureToggleLabel();
  const box=document.getElementById('enc-pressure');
  if(!encPressureOpen){
    encPressureGeneration++;
    // Com o painel fechado a medição não acompanha mensagem/portadora/senha.
    // Guardar o último valor faria a reabertura pintar o número da entrada
    // anterior até o recálculo chegar.
    encPressureLast=null;
    if(encPressureTimer){ clearTimeout(encPressureTimer); encPressureTimer=null; }
    if(box) box.style.display='none';
    return;
  }
  if(box) box.style.display='block';
  if(encPressureLast){
    renderEmbeddingPressure(encPressureLast);
  }else if(encID && getEncNormalizedMessage('enc-msg').length){
    const tier=document.getElementById('enc-pressure-tier');
    const metrics=document.getElementById('enc-pressure-metrics');
    const warn=document.getElementById('enc-fill-warn');
    if(tier){ tier.textContent='…'; tier.dataset.tier=''; }
    if(metrics) metrics.textContent=t('encPressureCalculating');
    if(warn) warn.style.display='none';
  }else{
    renderEmbeddingPressure(null);
  }
  scheduleEmbeddingPressure(true);
}
function scheduleEmbeddingPressure(immediate=false) {
  // P1B R2: a medição é deliberadamente opt-in. Enquanto o ícone não for aberto,
  // digitar não normaliza, não comprime e não prepara payload algum para este painel.
  if(!encPressureOpen) return;
  const run=++encPressureGeneration;
  if(encPressureTimer){ clearTimeout(encPressureTimer); encPressureTimer=null; }
  const msg=getEncNormalizedMessage('enc-msg');
  if(!encID || !msg.length){ encPressureLast=null; renderEmbeddingPressure(null); return; }
  encPressureTimer=setTimeout(async()=>{
    try{
      const cipher=(document.getElementById('enc-key')?.value||'').length>0;
      const cap=getEncCapacitySnapshot();
      const prepared=await prepareEncMainBody(msg,cipher);
      if(run!==encPressureGeneration || !encPressureOpen) return;
      const decoyOn=!!document.getElementById('enc-decoy-toggle')?.checked;
      const decoyMsg=decoyOn?getEncNormalizedMessage('enc-decoy-msg'):'';
      // F1 usa dois envelopes GCM: len=32 B e mensagem=28 B+plaintext.
      const decoyBits=decoyMsg.length ? (60 + new TextEncoder().encode(decoyMsg).length) * 8 : 0;
      encPressureLast=computeEmbeddingPressure(prepared.bodyBits, encOpaque, cipher, cap.effective, decoyBits);
      renderEmbeddingPressure(encPressureLast);
    }catch(_){
      if(run===encPressureGeneration && encPressureOpen){ encPressureLast=null; renderEmbeddingPressure(null); }
    }
  },immediate?0:650);
}

// O Encoder remove whitespace apenas nas bordas antes de codificar. Toda
// superfície que mostra/mede a mensagem deve usar esta mesma representação para
// que capacidade, gate e estatísticas nunca contem textos diferentes.
function getEncNormalizedMessage(id) {
  return (document.getElementById(id)?.value || '').trim();
}

let encMessageEditorTargetId='enc-msg';
function getEncMessageEditorTarget(){
  return document.getElementById(encMessageEditorTargetId) || document.getElementById('enc-msg');
}

// Uma única fonte para o medidor principal e para o editor expandido. O modal
// pode existir antes de a cover ser escolhida; nesse caso ele mostra apenas a
// contagem atual. Quando há cover, mostra o uso contra a capacidade do modo
// efetivo. Com segunda mensagem ligada, o total compartilhado também fica claro.
function getEncCapacitySnapshot(){
  const realChars = getEncNormalizedMessage('enc-msg').length;
  const decoyOn = !!document.getElementById('enc-decoy-toggle')?.checked;
  const decoyChars = decoyOn ? getEncNormalizedMessage('enc-decoy-msg').length : 0;
  const used = realChars + decoyChars;
  if(!encID) return {hasImage:false, realChars, decoyChars, decoyOn, used, max:null, forced:false, effective:false};

  const protectedV3 = (document.getElementById('enc-key')?.value || '').length > 0;
  const f21PlainMax = F21_BODY_MAX - F21_GCM_TAG_BYTES;
  const stealthMax = protectedV3
    ? Math.min(f21PlainMax, Math.max(0, Math.floor(Math.max(0,encOpaque-F21_PREFIX_CARRIER_PIXELS)/8)-F21_GCM_TAG_BYTES))
    : Math.floor(encOpaque/8)-11;
  const rgbMax = protectedV3
    ? Math.min(f21PlainMax, Math.max(0, Math.floor(Math.max(0,encOpaque-F21_PREFIX_CARRIER_PIXELS)*3/8)-F21_GCM_TAG_BYTES))
    : Math.floor((encOpaque*3)/8)-10;
  const forced = used > stealthMax;
  const effective = encMaxcapManual || forced;
  const max = Math.max(0, effective ? rgbMax : stealthMax);
  return {hasImage:true, realChars, decoyChars, decoyOn, used, max, forced, effective, stealthMax, rgbMax};
}

function updateEncMessageModalCount() {
  const count=document.getElementById('enc-message-modal-count');
  if(!count) return;
  const current=getEncNormalizedMessage(encMessageEditorTargetId).length;
  const cap=getEncCapacitySnapshot();
  if(!cap.hasImage){
    count.textContent=t('encMessageCountOnly').replace('{n}',current.toLocaleString());
    return;
  }
  if(cap.decoyOn){
    count.textContent=t('encMessageCapacityShared')
      .replace('{used}',cap.used.toLocaleString())
      .replace('{max}',cap.max.toLocaleString())
      .replace('{current}',current.toLocaleString());
  } else {
    count.textContent=t('encMessageCapacity')
      .replace('{used}',cap.used.toLocaleString())
      .replace('{max}',cap.max.toLocaleString());
  }
}
function syncEncMessageModalFromTarget() {
  const overlay=document.getElementById('enc-message-overlay');
  const modal=document.getElementById('enc-message-modal-text');
  const target=getEncMessageEditorTarget();
  if(!modal||!target) return;
  if(overlay?.classList.contains('visible') && modal.value!==target.value) modal.value=target.value;
  updateEncMessageModalCount();
}
function syncEncMessageTargetFromModal() {
  const modal=document.getElementById('enc-message-modal-text');
  const target=getEncMessageEditorTarget();
  if(!modal||!target||target.value===modal.value) { updateEncMessageModalCount(); return; }
  target.value=modal.value;
  target.dispatchEvent(new Event('input',{bubbles:true}));
  updateEncMessageModalCount();
}
function openEncMessageEditor(targetId='enc-msg') {
  if(targetId!=='enc-msg' && targetId!=='enc-decoy-msg') targetId='enc-msg';
  encMessageEditorTargetId=targetId;
  const overlay=document.getElementById('enc-message-overlay');
  const modal=document.getElementById('enc-message-modal-text');
  const target=getEncMessageEditorTarget();
  if(!overlay||!modal||!target) return;
  modal.value=target.value;
  modal.placeholder=target.placeholder||'';
  updateEncMessageModalCount();
  overlay.classList.add('visible');
  requestAnimationFrame(()=>{
    modal.focus();
    const end=modal.value.length;
    try{ modal.setSelectionRange(end,end); }catch(_){}
  });
}
function closeEncMessageEditor() {
  document.getElementById('enc-message-overlay')?.classList.remove('visible');
}

function updateCap() {
  const cap=getEncCapacitySnapshot();
  // Mesmo sem cover, o editor grande continua contando o que foi digitado.
  if (!cap.hasImage) { scheduleEmbeddingPressure(); updateEncMessageModalCount(); return; }
  const box = document.getElementById('enc-maxcap');
  const note = document.getElementById('enc-mode-note');
  if (box) { box.checked = cap.effective; box.disabled = cap.forced; }
  if (note) note.style.display = (cap.forced && !encMaxcapManual) ? 'block' : 'none';
  const max=cap.max, used=cap.used;
  const pct = max > 0 ? Math.min(used/max*100,100) : (used > 0 ? 100 : 0);
  document.getElementById('cap-used').textContent=used.toLocaleString()+' '+t('chars');
  document.getElementById('cap-total').textContent=max.toLocaleString()+' '+t('capAvailable');
  const f=document.getElementById('cap-fill');
  f.style.width=pct+'%';
  f.style.background=pct>90?'#ff6464':pct>70?'#ffb300':'var(--enc)';
  // P1B R2 só recalcula se o usuário abriu os detalhes técnicos. Fechado,
  // este caminho retorna antes de preparar/comprimir qualquer payload.
  scheduleEmbeddingPressure();
  updateEncMessageModalCount();
}
document.getElementById('enc-msg').addEventListener('input', updateCap);
document.getElementById('enc-msg').addEventListener('input', syncEncMessageModalFromTarget);
// "Modo de Alta Capacidade" só afeta a auto-seleção (teto é sempre RGB), mas
// atualizamos o medidor por consistência.
document.getElementById('enc-maxcap').addEventListener('change', function(){
  // Só registra como preferência MANUAL (o estado forçado trava o botão, então
  // 'change' só dispara quando o usuário realmente clica em modo não-forçado).
  encMaxcapManual = this.checked;
  updateCap();
});

// ════════════════════════════════════════
//  READY CHECKS
// ════════════════════════════════════════
function checkEncReady() {
  // Gate persistente: imagem decodificada com sucesso (encFormatOk) + mensagem.
  // O gate depende do estado persistente da imagem; digitar/apagar a senha
  // não re-habilita o botão num estado inválido.
  const hasImg=encID&&encFormatOk, hasMsg=getEncNormalizedMessage('enc-msg').length>0;
  const key=document.getElementById('enc-key').value;
  // Negação plausível: se a 2ª mensagem está LIGADA e preenchida, ela EXIGE senha
  // própria (a isca é sempre cifrada). Sem a senha, o botão fica desabilitado e um
  // alerta explica. Também bloqueia se a senha da isca for igual à da real.
  const decoyOn=document.getElementById('enc-decoy-toggle')?.checked;
  const decoyMsg=getEncNormalizedMessage('enc-decoy-msg');
  const decoyKey=(document.getElementById('enc-decoy-key')?.value||'');
  const decoyNeedsMsg = decoyOn && decoyMsg.length===0;
  const decoyNeedsKey = decoyOn && decoyMsg.length>0 && decoyKey.length===0;
  const decoySameKey = decoyOn && decoyMsg.length>0 && decoyKey.length>0 && decoyKey===key;
  const decoyBlocked = decoyNeedsMsg || decoyNeedsKey || decoySameKey;
  const needMsgAlert=document.getElementById('enc-decoy-needmsg-warn');
  const needKeyAlert=document.getElementById('enc-decoy-needkey-warn');
  // The gate blocks immediately, but the missing-message warning waits until the
  // user actually enters an alternate password. This avoids showing an error the
  // moment the second layer is enabled, before there has been a chance to type.
  const showNeedMsgAlert = decoyNeedsMsg && decoyKey.length>0;
  if(needMsgAlert) needMsgAlert.style.display = showNeedMsgAlert ? 'block' : 'none';
  if(needKeyAlert) needKeyAlert.style.display = decoyNeedsKey ? 'block' : 'none';
  document.getElementById('btn-encode').disabled=!(hasImg&&hasMsg&&!decoyBlocked&&!encPreflightBlocked);
  const warn=document.getElementById('enc-key-warn');
  const hint=document.getElementById('enc-key-hint');
  if(key.length===0&&hasMsg){warn.style.display='block';hint.style.display='none';}
  else{warn.style.display='none';hint.style.display='block';}
}
function checkDecReady(ok=true) {
  document.getElementById('btn-analyze').disabled=!(decID&&ok);
}
document.getElementById('enc-msg').addEventListener('input',()=>checkEncReady());
document.getElementById('enc-key').addEventListener('input',()=>{ updateCap(); checkEncReady(); });

// ════════════════════════════════════════
//  ENCODE
// ════════════════════════════════════════
let encOutURL=null, encOutBlob=null, rbOutURL=null;
let encOutputGeneration=0; // invalida resultados assíncronos da segunda saída robusta

// Centraliza a limpeza de toda a área de saída do Encoder para que encode e
// troca de portadora restaurem exatamente o mesmo conjunto de elementos.
function resetEncOutputs() {
  encOutputGeneration++;
  clearProcessingTime('enc-processing-time');
  const hide = id => { const e = document.getElementById(id); if (e) e.classList.remove('visible'); };
  ['enc-dl','enc-rb','enc-tips','rb-body','rb-unavailable','enc-stealth'].forEach(hide);
  const vazio = id => { const e = document.getElementById(id); if (e) e.textContent = ''; };
  ['enc-stats','rb-stats','rb-report','rb-unavailable','enc-stealth'].forEach(vazio);
  const semSrc = id => { const e = document.getElementById(id); if (e) e.src = ''; };
  semSrc('enc-out-prev'); semSrc('rb-out-prev');
  if (encOutURL && encOutURL.startsWith('blob:')) URL.revokeObjectURL(encOutURL);
  if (rbOutURL && rbOutURL.startsWith('blob:')) URL.revokeObjectURL(rbOutURL);
  encOutURL = null; encOutBlob = null; rbOutURL = null;
  const hm = document.getElementById('enc-heatmap');
  if (hm) { hm.classList.remove('on'); hm.dataset.built = ''; }
  const hb = document.getElementById('btn-enc-heatmap');
  // O primeiro clique no heatmap desabilita o botão enquanto decodifica o PNG.
  // Se um novo encode invalidar a geração no meio disso, o `finally` de
  // toggleEncOverlay() não reabilita — este reset é o único ponto que fecha
  // esse caminho, senão o botão fica morto até recarregar a página.
  if (hb) { hb.textContent = t('encMapShow'); hb.disabled = false; }
  const ph = document.getElementById('enc-placeholder');
  if (ph) ph.style.display = 'block';
}

document.getElementById('btn-encode').addEventListener('click',async ()=>{
  const _btn=document.getElementById('btn-encode'), _btnHtml=_btn.innerHTML;
  const processingStartedAt = processingNow();
  let _stopWork=()=>{};
  let _selfDone=false, _robustDone=false;
  const _finishVisibleTiming=()=>{
    if (!_selfDone || !_robustDone) return;
    if (encOutputRun !== encOutputGeneration) return;
    showProcessingTime('enc-processing-time', processingNow() - processingStartedAt);
  };
  const _markSelfDone=()=>{ _selfDone=true; _finishVisibleTiming(); };
  const _markRobustDone=()=>{ _robustDone=true; _finishVisibleTiming(); };
  const _restore=()=>{ encMark('ui-ready'); encTimingsFlush(true);
    _btn.disabled=false; _btn.classList.remove('working'); _btn.innerHTML=_btnHtml; _stopWork(); };
  _btn.disabled=true; _btn.classList.add('working');
  _btn.innerHTML='<span class="enc-spinner"></span>'+t('encWorking');
  encTimingsReset();
  // Feedback imediato ao clicar: ampulheta animada no terminal e rolagem
  // até a área de saída ANTES do bloco pesado. Rola para uma âncora SEMPRE VISÍVEL:
  // no primeiro encode é o placeholder; ao recodificar a mesma imagem o placeholder
  // já está escondido (foi substituído pela saída), então rola para a imagem gerada.
  _stopWork = setStatusWorking('enc-status', t('encWorking'));
  // Limpa a saída ANTES de qualquer trabalho: sem isto as imagens do encode
  // anterior ficam na tela até as novas nascerem, e parecem ser o resultado novo.
  resetEncOutputs();
  const encOutputRun = encOutputGeneration;
  // Snapshot por referência do cover limpo usado neste clique. `encID` pode ser
  // trocado enquanto a derivação do JPEG robusto aguarda; esta referência mantém
  // a segunda saída presa à mesma portadora que gerou o PNG principal.
  const robustCoverData = encID?.data;
  const robustCoverW = encW, robustCoverH = encH;
  {
    const _dl=document.getElementById('enc-dl');
    const _ph=document.getElementById('enc-placeholder');
    const _anchor = (_dl && _dl.classList.contains('visible')) ? _dl
                  : (_ph && _ph.style.display!=='none') ? _ph
                  : document.getElementById('enc-status');
    if(_anchor) _anchor.scrollIntoView({behavior:'smooth', block:'center'});
  }
  // 2 frames para o spinner PINTAR antes do bloco pesado (embedLSB) começar.
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const msg=getEncNormalizedMessage('enc-msg');
  const key=document.getElementById('enc-key').value;
  const cipher=key.length>0;
  const maxcap=document.getElementById('enc-maxcap').checked;
  try {
    // P1B: medidor e encode compartilham a MESMA preparação física do corpo.
    // O medidor roda isso de forma debounced; aqui repetimos na operação real para
    // manter o profiling e não depender de cache/estado assíncrono da UI.
    const preparedMain = await prepareEncMainBody(msg, cipher, encMark);
    let bodyBytes = preparedMain.bodyBytes;
    const compressed = preparedMain.compressed;
    const bodyStoredBytes = preparedMain.bodyStoredBytes;
    // O wire v3 limita ciphertext+tag a 5 MB. Falhar aqui mantém a UI e o
    // contrato lógico alinhados e evita executar Argon para um packet impossível.
    if (cipher && bodyStoredBytes > F21_BODY_MAX) throw new Error(t('msgTooLong'));
    const prefixBits = cipher ? F21_PREFIX_CARRIER_PIXELS : HEADER_BYTES*8;
    const bodyBits = bodyStoredBytes * 8;
    // AUTO-SELEÇÃO: o modo MAIS FURTIVO que couber (ou RGB se priorizar capacidade).
    const sel = selectEmbedMode(bodyBits, encOpaque, prefixBits, maxcap);
    if (!sel) {
      if (!maxcap && bodyBits <= Math.max(0, encOpaque-prefixBits)*3) throw new Error(t('msgTooLongStealth'));
      throw new Error(t('msgTooLong'));
    }
    const mode = sel.mode, adaptive = sel.adaptive, useStc = sel.stc;
    // A decisão F1 precisa existir antes de derivar o modo STC: acessar uma const
    // ainda não inicializada aqui cairia na temporal dead zone e abortaria todo encode.
    const decoyRequested = !!document.getElementById('enc-decoy-toggle')?.checked;
    // P1A: novas escritas STC sem camada alternativa espalham o pool candidato
    // por toda a cover. Com F1/decoy mantemos o wire contíguo antigo: a camada
    // alternativa cresce do fim e o decoder da mensagem real não conhece o seu
    // tamanho para excluir dinamicamente essa cauda.
    const stcSpread = useStc && !decoyRequested;
    // STC: escolhe a maior largura w (=1/α) que cabe → máxima furtividade.
    let stcW = 0;
    if (useStc) {
      const availForStc = encOpaque - (cipher ? F21_PREFIX_CARRIER_PIXELS : (HEADER_BYTES+1)*8);
      stcW = pickStcW(bodyBits, availForStc);
      if (stcW < 1) throw new Error(t('msgTooLong'));
    }

    // Embedding e ESCRITA sem canvas: clona o cover limpo, embute, e remonta o
    // PNG na mão. Evita o farbling do toDataURL/getImageData (vide Brave Shields).
    const work = new ImageData(new Uint8ClampedArray(encID.data), encW, encH);
    inheritOpaquePixels(encID.data, work.data);
    let payload = null, f21Packet = null, realUsedPx = 0, mainSlotsUsed = 0, encodedPayloadBytes = 0;
    encMark('crypto:in');
    if (cipher) {
      const modeFlags = f21ModeFlagsForEmbed(mode, compressed, adaptive, stcW);
      f21Packet = await f21CreatePacket(bodyBytes, key, {modeFlags, stcW, stcSpread});
      encodedPayloadBytes = F21_PREFIX_BYTES + f21Packet.body.length;
    } else {
      payload = buildPayload(bodyBytes, compressed ? (mode | FLAG_COMPRESSED) : mode);
      encodedPayloadBytes = payload.length;
    }
    encMark('crypto:out');

    encMark('embed:in');
    if (cipher) {
      await embedLSBV3(work, f21Packet, mode, adaptive, stcW);
      realUsedPx = decoyRequested
        ? f21TailReservationBoundary(f21Packet.modeFlags, stcW, f21Packet.body.length*8, f21Packet.stcSpread)
        : f21UsedOpaquePixels(f21Packet.modeFlags, stcW, f21Packet.body.length*8);
      mainSlotsUsed = useStc
        ? F21_PREFIX_CARRIER_PIXELS + f21Packet.body.length*8*stcW
        // Bootstrap usa somente B mesmo no modo RGB; contar ×3 inflaria o
        // percentual de impacto visual sem corresponder a slots tocados.
        : F21_PREFIX_CARRIER_PIXELS + f21Packet.body.length*8;
    } else {
      embedLSB(work, payload, mode, '', adaptive, false, stcW, stcSpread);
      realUsedPx = useStc
        ? ((HEADER_BYTES+1)*8 + (payload.length-HEADER_BYTES)*8*stcW)
        : (mode===MODE_RGB ? HEADER_BYTES*8 + Math.ceil((payload.length-HEADER_BYTES)*8/3) : payload.length*8);
      mainSlotsUsed = useStc
        ? ((HEADER_BYTES+1)*8 + (payload.length-HEADER_BYTES)*8*stcW)
        : payload.length*8;
    }
    encMark('embed:out');
    // ── NEGAÇÃO PLAUSÍVEL: se ativa, embute a mensagem alternativa no fim do pool. ──
    const decoyOn = decoyRequested;
    const decoyMsg = getEncNormalizedMessage('enc-decoy-msg');
    const decoyKey = document.getElementById('enc-decoy-key')?.value || '';
    let decoyBitsUsed = 0, decoyChars = 0; // para as estatísticas refletirem as DUAS mensagens
    if (decoyOn && decoyMsg.length > 0) {
      if (!decoyKey.length) throw new Error(t('decoyKeyRequired'));
      if (decoyKey === key) throw new Error(t('decoySameKeyWarn'));
      // Reserva os pixels opacos efetivamente ocupados pela camada principal.
      decoyBitsUsed = await embedDecoyTail(work, decoyMsg, decoyKey, realUsedPx);
      decoyChars = decoyMsg.length;
    }
    encMark('png:in');
    const pngBytes = await pngEncodeRGBA(encW, encH, work.data);
    encMark('png:out');
    encTimingsFlush(false);
    if (encOutURL && encOutURL.startsWith('blob:')) URL.revokeObjectURL(encOutURL);
    encOutBlob = new Blob([pngBytes], { type: 'image/png' });
    encOutURL = URL.createObjectURL(encOutBlob);
    document.getElementById('enc-out-prev').src=encOutURL;
    document.getElementById('enc-dl').classList.add('visible');
    document.getElementById('enc-tips').classList.add('visible');
    document.getElementById('enc-placeholder').style.display='none';
    document.getElementById('enc-rb').classList.remove('visible');
    // Ao terminar, rola até a imagem gerada para o usuário ver onde ela ficou
    // disponível (no desktop a coluna de opções é longa e o resultado fica acima).
    requestAnimationFrame(() => {
      document.getElementById('enc-dl').scrollIntoView({behavior:'smooth', block:'center'});
    });
    const bitsUsed = mainSlotsUsed + decoyBitsUsed;
    const totalBits=mode===MODE_RGB?encOpaque*3:encOpaque;
    // Rótulo do modo escolhido pela auto-seleção (STC / RGB / Padrão).
    const modeLabel = useStc ? t('encModeStc') : (adaptive ? t('encModeAdaptive') : (mode===MODE_RGB ? t('encModeRGB') : t('encModeB')));
    const modeClass = (mode===MODE_RGB) ? 'sv-warn' : 'sv-enc';
    const hasDecoy = decoyChars > 0;
    // Layout em DUAS COLUNAS empilhadas: Mensagem Real | Mensagem Alternativa.
    // Linhas: caracteres, proteção, modo. A alternativa (isca) é SEMPRE cifrada
    // (AES-256-GCM) e SEMPRE LSB (âncora no fim) — valores fixos por construção.
    // Sem isca, a coluna direita mostra "não informada" / N/A (nunca fica vazia).
    const col = (title, chars, prot, protCls, modeTxt, modeCls) => `
      <div class="stat-col">
        <div class="stat-col-head">${title}</div>
        <div class="stat-item"><div class="stat-key">${t('encStatSize')}</div><div class="stat-val ${chars===null?'sv-dim':'sv-enc'}">${chars===null?t('encDecoyNone'):chars+' '+t('chars')}</div></div>
        <div class="stat-item"><div class="stat-key">${t('encStatProtection')}</div><div class="stat-val ${protCls}">${prot}</div></div>
        <div class="stat-item"><div class="stat-key">${t('encStatMode')}</div><div class="stat-val ${modeCls}">${modeTxt}</div></div>
      </div>`;
    const realCol = col(t('encColReal'), msg.length,
      cipher?t('encProtCipher'):t('encProtPlain'), cipher?'sv-enc':'sv-warn',
      modeLabel, modeClass);
    const decoyCol = hasDecoy
      ? col(t('encColDecoy'), decoyChars, t('encProtCipher'), 'sv-enc', t('encModeDecoyLsb'), 'sv-enc')
      : col(t('encColDecoy'), null, t('encNA'), 'sv-dim', t('encNA'), 'sv-dim');
    document.getElementById('enc-stats').innerHTML=`
      <div class="stat-cols">${realCol}${decoyCol}</div>
      <div class="stat-impact"><span class="stat-key">${t('encStatVisualImpact')}</span><span class="stat-val sv-enc">${(bitsUsed/totalBits*100).toFixed(4)}%</span></div>`;
    _stopWork(); // para a ampulheta ANTES de escrever o sucesso (senão o timer sobrescreve)
    setStatus('enc-status', t('encSuccess').replace('{bytes}',encodedPayloadBytes)+(cipher?t('encSuffixCipher'):t('encSuffixPlain')), 'ok');
    // Autoavaliação de furtividade: mede a saída com o mesmo arsenal estatístico.
    // Deferido para a imagem/infos aparecerem na hora; nunca quebra o encode.
    (function(){
      const box=document.getElementById('enc-stealth');
      box.innerHTML='<div class="stealth-analyzing">'+t('encStealthAnalyzing')+'</div>';
      box.classList.add('visible');
      const px=work.data, w=encW, h=encH;
      setTimeout(function(){ try{
        const st=analyzeOutputStealth(px,w,h);
        const FLOOR=15, SCALE=30;
        const COL={lo:'#00ffb3',mid:'#ffb300',hi:'#ff6464'};
        const tierV=pv=>pv>FLOOR?'hi':(pv>8?'mid':'lo');
        const vCol=COL[st.verdict==='detect'?'hi':(st.verdict==='weak'?'mid':'lo')];
        const barPct=v=>Math.min(v/SCALE*100,100);
        const badgeKey=st.verdict==='detect'?'encStealthBadgeDetect':(st.verdict==='weak'?'encStealthBadgeWeak':'encStealthBadgeClean');
        const vKey=st.verdict==='detect'?'encStealthVerdictDetect':(st.verdict==='weak'?'encStealthVerdictWeak':'encStealthVerdictClean');
        const vMark=st.verdict==='detect'?'⚠':(st.verdict==='clean'?'✓':'~');
        const row=(label,val,reliable)=>{
          if(!reliable) return '<div class="sr-row"><div class="sr-label">'+label+'</div><div class="sr-na">'+t('encStealthWsNA')+'</div></div>';
          const pv=val*100, c=COL[tierV(pv)];
          return '<div class="sr-row"><div class="sr-label">'+label+'</div>'
            +'<div class="sr-track"><div class="sr-fill" style="width:'+barPct(pv).toFixed(1)+'%;background:'+c+'"></div>'
            +'<div class="sr-floor" style="left:'+(FLOOR/SCALE*100).toFixed(1)+'%"></div></div>'
            +'<div class="sr-val" style="color:'+c+'">'+pv.toFixed(1)+'%</div></div>';
        };
        box.innerHTML=
          '<div class="sr-head"><span class="stealth-title">'+t('encStealthTitle')+'</span>'
          +'<span class="sr-badge" style="color:'+vCol+'">'+vMark+' '+t(badgeKey)+'</span></div>'
          +'<div class="sr-explain">'+t('encStealthExplain')+'</div>'
          +row(t('encStealthRs'),st.rs,true)
          +row(t('encStealthWs'),st.ws,st.wsReliable)
          +'<div class="sr-floornote">'+t('encStealthFloor')+': ~'+FLOOR+'%</div>'
          +'<div class="stealth-verdict'+(st.verdict==='detect'?' sr-alarm':'')+'" style="color:'+vCol+'">'+vMark+' '+t(vKey)+'</div>'
          +'<div class="stealth-caveat">'+t('encStealthCaveat')+'</div>';
        _restore(); _markSelfDone();
      }catch(_){ box.classList.remove('visible'); box.textContent=''; _restore(); _markSelfDone(); } }, 30);
    })();

    // ── SEGUNDA SAÍDA: versão mais resistente (JPEG/DCT) ─────────────────
    // Gerada a partir da capa LIMPA, não da imagem com LSB: são duas imagens
    // independentes carregando a MESMA mensagem, com trocas diferentes.
    // Deferida para o PNG aparecer na hora; nunca derruba o encode.
    (function(){
      const wrap=document.getElementById('enc-rb');
      const body=document.getElementById('rb-body');
      const nope=document.getElementById('rb-unavailable');
      const fmt=n=> n>=1024 ? (n/1024).toFixed(1)+' KB' : n+' bytes';
      setTimeout(async function(){
        try{
          if(encOutputRun !== encOutputGeneration) return;
          // F21 só muda o PNG/lossless protegido. O JPEG robusto continua no
          // wire anterior, portanto precisa do seu próprio payload clássico.
          // Com senha isto executa a derivação legada do conteúdo uma segunda
          // vez, deliberadamente, em vez de reutilizar o packet F21 e mudar o
          // formato robusto por acidente.
          const robustPayload = (cipher || stcSpread)
            ? await buildRobustPayload(bodyBytes, key, {mode, compressed, adaptive, stcW})
            : payload;
          if(encOutputRun !== encOutputGeneration) return;
          const r=robustEmbed(robustCoverData, robustCoverW, robustCoverH, robustPayload, key);
          if(rbOutURL && rbOutURL.startsWith('blob:')) URL.revokeObjectURL(rbOutURL);
          rbOutURL=URL.createObjectURL(new Blob([r.jpeg],{type:'image/jpeg'}));
          document.getElementById('rb-out-prev').src=rbOutURL;
          const dim = r.redimensionada
            ? r.width+'×'+r.height+' <span class="sv-dim">('+t('rbStatResized').replace('{orig}',robustCoverW+'×'+robustCoverH)+')</span>'
              +'<div class="stat-note">'+t('rbStatWhyResize')+'</div>'
            : r.width+'×'+r.height+' <span class="sv-dim">('+t('rbStatUnchanged')+')</span>';
          document.getElementById('rb-stats').innerHTML=
             '<div class="stat-item"><div class="stat-key">'+t('rbStatDims')+'</div><div class="stat-val sv-enc">'+dim+'</div></div>'
            +'<div class="stat-item"><div class="stat-key">'+t('rbStatCapacity')+'</div><div class="stat-val sv-enc">'+fmt(r.bytesUsados)+' / '+fmt(r.capacidade)+'</div></div>'
            +'<div class="stat-item"><div class="stat-key">'+t('rbStatEcc')+'</div><div class="stat-val sv-enc">'+t('rbStatEccVal')+'</div></div>'
            +(hasDecoy?'<div class="stat-impact"><span class="sv-dim">'+t('rbDecoyNote')+'</span></div>':'');
          // Relatório de DOIS EIXOS: nenhuma nota única, para as duas saídas não
          // serem comparadas na mesma régua.
          const eixo=(nome,nivel,pct,cor,nota)=>
             '<div class="rb-axis"><div class="rb-axis-top">'
            +'<span class="rb-axis-name">'+nome+'</span>'
            +'<span class="rb-axis-level" style="color:'+cor+'">'+nivel+'</span></div>'
            +'<div class="sr-track"><div class="sr-fill" style="width:'+pct+'%;background:'+cor+'"></div></div>'
            +'<div class="rb-axis-note">'+nota+'</div></div>';
          document.getElementById('rb-report').innerHTML=
             '<div class="sr-head"><span class="stealth-title">'+t('rbReportTitle')+'</span></div>'
            +eixo(t('rbAxisResist'),t('rbAxisResistLevel'),80,'#00ffb3',t('rbAxisResistNote'))
            +eixo(t('rbAxisDiscretion'),t('rbAxisDiscretionLevel'),20,'#ffb300',t('rbAxisDiscretionNote'))
            +'<div class="stealth-caveat">'+t('rbExplain')+'</div>';
          body.classList.add('visible'); nope.classList.remove('visible');
        }catch(e){
          if(encOutputRun !== encOutputGeneration) return;
          body.classList.remove('visible');
          nope.innerHTML = (e && e.message==='robustCapacity')
            ? t('rbUnavailTooBig').replace('{need}',fmt(e.necessario)).replace('{cap}',fmt(e.capacidade))
            : t('rbUnavailError');
          nope.classList.add('visible');
        }
        wrap.classList.add('visible');
        _markRobustDone();
      }, 60);
    })();
  } catch(e) { _stopWork(); setStatus('enc-status','✗ '+e.message,'err'); _restore(); }
});

document.getElementById('btn-dl-rb').addEventListener('click',()=>{
  if(!rbOutURL) return;
  const a=document.createElement('a');
  a.href=rbOutURL; a.download='stego_resistente_'+Date.now()+'.jpg'; a.click();
});

document.getElementById('btn-dl-enc').addEventListener('click',()=>{
  if(!encOutURL) return;
  const a=document.createElement('a');
  a.href=encOutURL; a.download='stego_encoded_'+Date.now()+'.png'; a.click();
});

// ════════════════════════════════════════
//  FORENSIC MODULES
// ════════════════════════════════════════
let lastReport=null;
// Guarda os argumentos da última renderização de resultados, para re-render ao trocar idioma
let lastRenderArgs=null;

// ════════════════════════════════════════
//  C2PA / CONTENT AUTHENTICITY PARSER
// ════════════════════════════════════════
// Geradores conhecidos pelo campo digitalsourcetype ou strings de software
