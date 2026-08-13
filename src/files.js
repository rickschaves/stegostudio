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
  // Aplica idioma detectado e marca o botão ativo
  setLang(LANG);
  // Encoder é a aba de entrada — começa com boas-vindas
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
    encID=null; encFormatOk=false; checkEncReady();
    loadToCanvas(f, (id, w, h, src, hadAlpha) => {
      onEncCarrierLoaded(id, w, h, src, hadAlpha, fmt, f);
    }, r => showLoadError('enc', r));
  } else {
    flashDrop('dec-drop');
    decFile = f;
    let magic=null; try{ magic=new Uint8Array(await f.slice(0,16).arrayBuffer()); }catch(_){}
    decFmt = classifyFormat(f, magic);
    loadToCanvas(f, (id, w, h, src) => {
      decID = id;
      document.getElementById('dec-prev').src = src;
      document.getElementById('dec-pw').style.display = 'block';
      document.getElementById('dec-hint').style.display = 'none';
      document.getElementById('dec-info').textContent = `${w}×${h} · ${fmtBytes(f.size)}`;
      const b = document.getElementById('dec-fbadge');
      b.textContent = decFmt.ext;
      const colors = {lossless:'255,107,53', lossy:'255,179,0', palette:'100,180,255'};
      const c = colors[decFmt.cat];
      b.style.cssText = `background:rgba(${c},0.15);color:rgb(${c});border:1px solid rgba(${c},0.3)`;
      decStatusLoaded(decFmt,w,h,f.size);
      document.getElementById('btn-analyze').disabled = false;
      clearDecKey();
    }, r => showLoadError('dec', r));
  }
});

// ── ENCODE DROP ──
let encID=null, encW=0, encH=0, encOpaque=0, encFormatOk=false;
// Preferência MANUAL do usuário para "Modo de Alta Capacidade" — separada do estado
// forçado (quando a mensagem é grande demais para o furtivo). Permite reverter.
let encMaxcapManual=false;

// Pós-carregamento da portadora (compartilhado por colar e arrastar). #17: aceita
// QUALQUER imagem que o navegador decodifica — a saída é SEMPRE um PNG novo (a gente
// remonta o PNG na mão), então formato lossy de ENTRADA é seguro; só avisamos que
// será convertido. O gate do botão passa a ser o estado PERSISTENTE encFormatOk
// (não mais um parâmetro transitório), o que conserta o bug de re-habilitar o botão
// ao digitar/apagar a senha num formato antes bloqueado.
function onEncCarrierLoaded(id, w, h, src, hadAlpha, fmt, file) {
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
  const col = willConvert ? '255,179,0' : '0,255,179';        // âmbar (aviso) vs verde
  const txt = willConvert ? '#ffb300' : 'var(--enc)';
  b.style.cssText=`background:rgba(${col},0.15);color:${txt};border:1px solid rgba(${col},0.3)`;
  updateCap();
  encStatusLoaded(fmt, w, h, file.size, file);
  checkEncReady();
}

setupDrop('enc-drop','enc-file', file=>{
  const fmt=classifyFormat(file);
  encID=null; encFormatOk=false; checkEncReady(); // decode falho → botão fica travado
  loadToCanvas(file,(id,w,h,src,hadAlpha)=>{
    onEncCarrierLoaded(id,w,h,src,hadAlpha,fmt,file);
  }, r => showLoadError('enc', r));
});

// ── DECODE DROP ──
let decID=null, decFile=null, decFmt=null;
setupDrop('dec-drop','dec-file', async file=>{
  decFile=file;
  // sniff de magic bytes → detecção robusta (pega .jfif, MIME errado, etc.)
  let magic=null; try{ magic=new Uint8Array(await file.slice(0,16).arrayBuffer()); }catch(_){}
  decFmt=classifyFormat(file, magic);
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
    document.getElementById('btn-analyze').disabled=false;
    clearDecKey();
  }, r => showLoadError('dec', r));
});

// ── BOTÃO LIMPAR SENHA + LIMPEZA AUTOMÁTICA (Decoder) ──
// O "x" só aparece quando há senha digitada (campo vazio fica limpo). Ao
// carregar uma nova imagem, a senha é zerada para não influenciar a próxima
// análise (evita decode errado ou falso "chave incorreta").
function clearDecKey() {
  const k = document.getElementById('dec-key');
  if (k) { k.value = ''; updateDecKeyClear(); }
}
function updateDecKeyClear() {
  const k = document.getElementById('dec-key');
  const x = document.getElementById('dec-key-clear');
  if (k && x) x.style.display = k.value.length > 0 ? 'flex' : 'none';
}
(function setupDecKeyClear(){
  const k = document.getElementById('dec-key');
  const x = document.getElementById('dec-key-clear');
  if (k) k.addEventListener('input', updateDecKeyClear);
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
  if(/^(.)\1*$/.test(pw)) weak=true;                                   // 1 char repetido
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

function updateCap() {
  if (!encID) return;
  const box = document.getElementById('enc-maxcap');
  const note = document.getElementById('enc-mode-note');
  // Capacidade usada = mensagem real + mensagem-isca (quando ligada), pois as
  // duas dividem o mesmo pool de pixels opacos (negação plausível, Opção C).
  const realChars = document.getElementById('enc-msg').value.length;
  const decoyOn = document.getElementById('enc-decoy-toggle')?.checked;
  const decoyChars = decoyOn ? (document.getElementById('enc-decoy-msg')?.value.length || 0) : 0;
  const used = realChars + decoyChars;
  // Capacidade (chars) conta SÓ pixels OPACOS (os transparentes não guardam dados).
  const stealthMax = Math.floor(encOpaque/8)-11; // header(10)+w-byte(1) do STC
  const rgbMax = Math.floor((encOpaque*3)/8)-10;
  // A mensagem excede o furtivo? (estimativa por chars, conservadora — não conta
  // a compressão). Se sim, FORÇA o modo capacidade e trava o botão ligado.
  const forced = used > stealthMax;
  const effective = encMaxcapManual || forced;
  if (box) { box.checked = effective; box.disabled = forced; }
  // Aviso sob o campo de mensagem SÓ quando a ferramenta ligou sozinha.
  if (note) note.style.display = (forced && !encMaxcapManual) ? 'block' : 'none';
  // Teto exibido segue o modo efetivo.
  const max = effective ? rgbMax : stealthMax;
  const pct = Math.min(used/max*100,100);
  document.getElementById('cap-used').textContent=used.toLocaleString()+' '+t('chars');
  document.getElementById('cap-total').textContent=max.toLocaleString()+' '+t('capAvailable');
  const f=document.getElementById('cap-fill');
  f.style.width=pct+'%';
  f.style.background=pct>90?'#ff6464':pct>70?'#ffb300':'var(--enc)';
  // Aviso de DETECTABILIDADE: contra o teto do modo efetivo.
  const fw=document.getElementById('enc-fill-warn');
  if (used>0 && pct>50) {
    fw.textContent=t('encFillHigh'); fw.style.color='#ff6464'; fw.style.display='block';
  } else if (used>0 && pct>25) {
    fw.textContent=t('encFillCaution'); fw.style.color='#ffb300'; fw.style.display='block';
  } else {
    fw.style.display='none';
  }
}
document.getElementById('enc-msg').addEventListener('input', updateCap);
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
  // #17: não depende mais de um parâmetro transitório, então digitar/apagar a senha
  // não re-habilita o botão num estado inválido.
  const hasImg=encID&&encFormatOk, hasMsg=document.getElementById('enc-msg').value.trim().length>0;
  const key=document.getElementById('enc-key').value;
  // Negação plausível: se a 2ª mensagem está LIGADA e preenchida, ela EXIGE senha
  // própria (a isca é sempre cifrada). Sem a senha, o botão fica desabilitado e um
  // alerta explica. Também bloqueia se a senha da isca for igual à da real.
  const decoyOn=document.getElementById('enc-decoy-toggle')?.checked;
  const decoyMsg=(document.getElementById('enc-decoy-msg')?.value.trim()||'');
  const decoyKey=(document.getElementById('enc-decoy-key')?.value||'');
  const decoyNeedsKey = decoyOn && decoyMsg.length>0 && decoyKey.length===0;
  const decoySameKey = decoyOn && decoyMsg.length>0 && decoyKey.length>0 && decoyKey===key;
  const decoyBlocked = decoyNeedsKey || decoySameKey;
  const needKeyAlert=document.getElementById('enc-decoy-needkey-warn');
  if(needKeyAlert) needKeyAlert.style.display = decoyNeedsKey ? 'block' : 'none';
  document.getElementById('btn-encode').disabled=!(hasImg&&hasMsg&&!decoyBlocked);
  const warn=document.getElementById('enc-key-warn');
  const hint=document.getElementById('enc-key-hint');
  if(key.length===0&&hasMsg){warn.style.display='block';hint.style.display='none';}
  else{warn.style.display='none';hint.style.display='block';}
}
function checkDecReady(ok=true) {
  document.getElementById('btn-analyze').disabled=!(decID&&ok);
}
document.getElementById('enc-msg').addEventListener('input',()=>checkEncReady());
document.getElementById('enc-key').addEventListener('input',()=>checkEncReady());

// ════════════════════════════════════════
//  ENCODE
// ════════════════════════════════════════
let encOutURL=null, encOutID=null, rbOutURL=null;

// Limpa a área de saída do Encoder. Usada em DOIS caminhos — ao clicar em
// codificar e ao trocar a imagem portadora — de propósito: eram duas listas
// paralelas antes, e listas paralelas divergem na primeira coisa que se adiciona.
function resetEncOutputs() {
  const hide = id => { const e = document.getElementById(id); if (e) e.classList.remove('visible'); };
  ['enc-dl','enc-rb','enc-tips','rb-body','rb-unavailable','enc-stealth'].forEach(hide);
  const vazio = id => { const e = document.getElementById(id); if (e) e.textContent = ''; };
  ['enc-stats','rb-stats','rb-report','rb-unavailable','enc-stealth'].forEach(vazio);
  const semSrc = id => { const e = document.getElementById(id); if (e) e.src = ''; };
  semSrc('enc-out-prev'); semSrc('rb-out-prev');
  if (encOutURL && encOutURL.startsWith('blob:')) URL.revokeObjectURL(encOutURL);
  if (rbOutURL && rbOutURL.startsWith('blob:')) URL.revokeObjectURL(rbOutURL);
  encOutURL = null; rbOutURL = null; encOutID = null;
  const hm = document.getElementById('enc-heatmap');
  if (hm) { hm.classList.remove('on'); hm.dataset.built = ''; }
  const hb = document.getElementById('btn-enc-heatmap');
  if (hb) hb.textContent = t('encMapShow');
  const ph = document.getElementById('enc-placeholder');
  if (ph) ph.style.display = 'block';
}

document.getElementById('btn-encode').addEventListener('click',async ()=>{
  const _btn=document.getElementById('btn-encode'), _btnHtml=_btn.innerHTML;
  let _stopWork=()=>{};
  const _restore=()=>{ _btn.disabled=false; _btn.classList.remove('working'); _btn.innerHTML=_btnHtml; _stopWork(); };
  _btn.disabled=true; _btn.classList.add('working');
  _btn.innerHTML='<span class="enc-spinner"></span>'+t('encWorking');
  // Item 6: feedback IMEDIATO ao clicar — ampulheta animada no terminal e rolagem
  // até a área de saída ANTES do bloco pesado. Rola para uma âncora SEMPRE VISÍVEL:
  // no primeiro encode é o placeholder; ao recodificar a mesma imagem o placeholder
  // já está escondido (foi substituído pela saída), então rola para a imagem gerada.
  _stopWork = setStatusWorking('enc-status', t('encWorking'));
  // Limpa a saída ANTES de qualquer trabalho: sem isto as imagens do encode
  // anterior ficam na tela até as novas nascerem, e parecem ser o resultado novo.
  resetEncOutputs();
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
  const msg=document.getElementById('enc-msg').value.trim();
  const key=document.getElementById('enc-key').value;
  const cipher=key.length>0;
  const maxcap=document.getElementById('enc-maxcap').checked;
  // STEALTH automático: cifra o header sempre que houver senha (sem downside).
  const stealth=cipher;
  try {
    // (área de saída já foi limpa por resetEncOutputs() no início do clique)
    // Comprime o corpo (deflate-raw) ANTES de cifrar; usa só se realmente encolher.
    let bodyBytes = new TextEncoder().encode(msg);
    let compressed = false;
    try {
      const comp = await deflateBytes(bodyBytes);
      if (comp.length < bodyBytes.length) { bodyBytes = comp; compressed = true; }
    } catch(_) { /* sem CompressionStream → segue sem comprimir */ }
    const data = cipher ? await aesEncryptBytes(bodyBytes, key) : bodyBytes;
    // AUTO-SELEÇÃO: o modo MAIS FURTIVO que couber (ou RGB se priorizar capacidade).
    const sel = selectEmbedMode(data.length*8, encOpaque, HEADER_BYTES*8, maxcap);
    if (!sel) {
      // Não coube no furtivo, mas caberia no RGB? Oriente a ligar a capacidade,
      // em vez de só dizer "muito longa".
      if (!maxcap && data.length*8 <= (encOpaque-HEADER_BYTES*8)*3) throw new Error(t('msgTooLongStealth'));
      throw new Error(t('msgTooLong'));
    }
    const mode = sel.mode, adaptive = sel.adaptive, useStc = sel.stc;
    // STC: escolhe a maior largura w (=1/α) que cabe → máxima furtividade.
    let stcW = 0;
    if (useStc) {
      stcW = pickStcW(data.length*8, encOpaque - (HEADER_BYTES+1)*8);
      if (stcW < 1) throw new Error(t('msgTooLong'));
    }
    const payload = buildPayload(data, compressed ? (mode | FLAG_COMPRESSED) : mode);
    // Embedding e ESCRITA sem canvas: clona o cover limpo, embute, e remonta o
    // PNG na mão. Evita o farbling do toDataURL/getImageData (vide Brave Shields).
    const work = new ImageData(new Uint8ClampedArray(encID.data), encW, encH);
    embedLSB(work, payload, mode, key, adaptive, stealth, stcW);
    // ── NEGAÇÃO PLAUSÍVEL: se ativa, embute a mensagem-isca no FIM (Opção C). ──
    const decoyOn = document.getElementById('enc-decoy-toggle')?.checked;
    const decoyMsg = document.getElementById('enc-decoy-msg')?.value.trim() || '';
    const decoyKey = document.getElementById('enc-decoy-key')?.value || '';
    let decoyBitsUsed = 0, decoyChars = 0; // para as estatísticas refletirem as DUAS mensagens
    if (decoyOn && decoyMsg.length > 0) {
      if (!decoyKey.length) throw new Error(t('decoyKeyRequired'));
      if (decoyKey === key) throw new Error(t('decoySameKeyWarn'));
      // pixels usados pela real a partir do início (para a checagem de colisão)
      const realUsedPx = useStc
        ? ((HEADER_BYTES+1)*8 + (payload.length-HEADER_BYTES)*8*stcW)
        : payload.length*8;
      decoyBitsUsed = await embedDecoyTail(work, decoyMsg, decoyKey, realUsedPx);
      decoyChars = decoyMsg.length;
    }
    const pngBytes = await pngEncodeRGBA(encW, encH, work.data);
    if (encOutURL && encOutURL.startsWith('blob:')) URL.revokeObjectURL(encOutURL);
    encOutURL = URL.createObjectURL(new Blob([pngBytes], { type: 'image/png' }));
    document.getElementById('enc-out-prev').src=encOutURL;
    encOutID = work;
    document.getElementById('enc-dl').classList.add('visible');
    document.getElementById('enc-tips').classList.add('visible');
    document.getElementById('enc-placeholder').style.display='none';
    document.getElementById('enc-rb').classList.remove('visible');
    // Ao terminar, rola até a imagem gerada para o usuário ver onde ela ficou
    // disponível (no desktop a coluna de opções é longa e o resultado fica acima).
    requestAnimationFrame(() => {
      document.getElementById('enc-dl').scrollIntoView({behavior:'smooth', block:'center'});
    });
    const bitsUsed = (useStc ? ((HEADER_BYTES+1)*8 + (payload.length-HEADER_BYTES)*8*stcW) : payload.length*8) + decoyBitsUsed;
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
    setStatus('enc-status','<span class="ok">'+t('encSuccess').replace('{bytes}',payload.length)+(cipher?t('encSuffixCipher'):t('encSuffixPlain'))+'</span>');
    // #21 — auto-report de furtividade: mede a saída com o próprio arsenal.
    // Deferido para a imagem/infos aparecerem na hora; nunca quebra o encode.
    (function(){
      const box=document.getElementById('enc-stealth');
      box.innerHTML='<div class="stealth-analyzing">'+t('encStealthAnalyzing')+'</div>';
      box.classList.add('visible');
      const px=work.data, w=encW, h=encH;
      setTimeout(function(){ try{
        const st=analyzeOutputStealth(px,w,h);
        const FLOOR=15, SCALE=30;                              // limite (%) e escala da barra (%)
        const COL={lo:'#00ffb3',mid:'#ffb300',hi:'#ff6464'};   // furtivo / no limite / detectável
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
        _restore();
      }catch(_){ box.classList.remove('visible'); box.textContent=''; _restore(); } }, 30);
    })();

    // ── SEGUNDA SAÍDA: a versão mais resistente (modo robusto, F4) ──────────
    // Gerada a partir da capa LIMPA, não da imagem com LSB: são duas imagens
    // independentes carregando a MESMA mensagem, com trocas diferentes.
    // Deferida para o PNG aparecer na hora; nunca derruba o encode.
    (function(){
      const wrap=document.getElementById('enc-rb');
      const body=document.getElementById('rb-body');
      const nope=document.getElementById('rb-unavailable');
      const fmt=n=> n>=1024 ? (n/1024).toFixed(1)+' KB' : n+' bytes';
      setTimeout(function(){
        try{
          const r=robustEmbed(encID.data, encW, encH, payload, key);
          if(rbOutURL && rbOutURL.startsWith('blob:')) URL.revokeObjectURL(rbOutURL);
          rbOutURL=URL.createObjectURL(new Blob([r.jpeg],{type:'image/jpeg'}));
          document.getElementById('rb-out-prev').src=rbOutURL;
          const dim = r.redimensionada
            ? r.width+'×'+r.height+' <span class="sv-dim">('+t('rbStatResized').replace('{orig}',encW+'×'+encH)+')</span>'
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
          body.classList.remove('visible');
          nope.innerHTML = (e && e.message==='robustCapacity')
            ? t('rbUnavailTooBig').replace('{need}',fmt(e.necessario)).replace('{cap}',fmt(e.capacidade))
            : t('rbUnavailError');
          nope.classList.add('visible');
        }
        wrap.classList.add('visible');
      }, 60);
    })();
  } catch(e) { _stopWork(); setStatus('enc-status','<span class="err">✗ '+e.message+'</span>'); _restore(); }
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
