function toggleAccordionItem(headerEl) {
  const item = headerEl.parentElement;
  const wasOpen = item.classList.contains('open');
  // Fecha todos os irmãos no mesmo container
  const container = item.parentElement;
  container.querySelectorAll(':scope > .module-item.open').forEach(sib => {
    if (sib !== item) sib.classList.remove('open');
  });
  // Alterna o clicado
  item.classList.toggle('open', !wasOpen);
}

function renderModule(id, icon, name, badge, badgeClass, bodyHTML) {
  const div=document.createElement('div');
  div.className='module-item';
  div.innerHTML=`
    <div class="module-header">
      <span class="module-icon">${icon}</span>
      <span class="module-name">${name}</span>
      <span class="module-badge ${badgeClass}">${badge}</span>
      <span class="module-chevron">▶</span>
    </div>
    <div class="module-body">${bodyHTML}</div>`;
  document.getElementById('modules-wrap').appendChild(div);
}

// Módulo de compatibilidade com origem — mostra as 4 categorias com seus sinais.
// Cada sinal aparece em todas as categorias às quais se aplica.
function renderOriginModule(r) {
  const o = r.origin;
  if (!o) return;
  const cats = [
    {key:'fotografia',   labelKey:'catFotografia',    icon:'📷'},
    {key:'screenshot',   labelKey:'catScreenshot',    icon:'🖥'},
    {key:'arte_digital', labelKey:'catArteFull',      icon:'🎨'},
    {key:'sintetica',    labelKey:'catSinteticaFull', icon:'🤖'},
  ];
  const topKey = o.topCategory;

  let body = '<div class="origin-sub-grid">';
  for (const c of cats) {
    const score = o[c.key] || 0;
    const sigs = (o.signals?.[c.key]) || [];
    const isTop = c.key === topKey;
    const barColor = isTop ? '#a78bfa' : 'var(--neutral)';
    body += `<div class="origin-sub ${isTop?'origin-sub-top':''}">`;
    body += `<div class="origin-sub-head">`;
    body += `<span class="origin-sub-icon">${c.icon}</span>`;
    body += `<span class="origin-sub-name">${t(c.labelKey)}</span>`;
    body += `</div>`;
    // Linha: número grande + barra vertical à direita (igual ao banner superior)
    body += `<div class="origin-sub-row">`;
    body += `<span class="origin-sub-score" style="color:${barColor}">${score}</span>`;
    body += `<div class="origin-sub-vbar"><div class="origin-sub-vbar-fill" style="height:${score}%;background:${barColor}"></div></div>`;
    body += `</div>`;
    if (sigs.length) {
      body += `<div class="origin-sub-sigs">`;
      for (const s of sigs) {
        const w = (s.weight != null) ? `<span class="origin-sig-weight">+${s.weight}</span>` : '';
        // Traduz o rótulo a partir da chave; aplica variáveis (ex.: largura em px)
        let label = s.labelKey ? t(s.labelKey) : escapeHTML(s.label || '');
        if (s.labelVars) {
          for (const [k,v] of Object.entries(s.labelVars)) label = label.replace(`{${k}}`, escapeHTML(v));
        }
        body += `<div class="origin-sig">✓ ${label}${w}</div>`;
      }
      body += `</div>`;
    } else {
      body += `<div class="origin-sub-sigs"><div class="origin-sig origin-sig-none">${t('noStrongSignal')}</div></div>`;
    }
    body += `</div>`;
  }
  body += '</div>';
  // Aviso de pipeline de rede social
  const sp = r.socialPipeline;
  if (sp?.detected) {
    const conf = sp.weak ? t('socialMaybeProcessedBy') : t('socialProcessedBy');
    // A força da evidência fica explícita. Estrutura do arquivo é forte e
    // sobrevive a renomeação; nome de arquivo é frágil e some ao renomear.
    // Primeiro o QUE foi detectado e POR QUE isso importa; só depois COMO foi
    // detectado. A lista de métodos mostra o que de fato disparou — a estrutura
    // sobrevive a renomeação, o nome do arquivo não.
    const ways=[];
    if(sp.byStructure) ways.push(t('socialByStructure'));
    if(sp.byFilename)  ways.push(t('socialByFilename'));
    const list = ways.map((w,i)=>`${i+1}. ${w}`).join('<br>');
    body += `<div class="origin-note origin-note-social">${t('socialPipelinePrefix')} ${conf} <b>${escapeHTML(sp.platform)}</b>. ${t('socialPipelineSuffix')}<br><br><i style="opacity:.8">${t('socialIdentifiedBy')}<br>${list}</i></div>`;
  }
  // Nota sobre indicadores compartilhados
  body += `<div class="origin-note">${t('originNoteShared')}</div>`;
  // Nota genérica sobre a natureza heurística da classificação de origem
  body += `<div class="origin-note origin-note-heuristic">${t('originNoteHeuristic')}</div>`;

  const catLabels={fotografia:t('catFotografia'),screenshot:t('catScreenshot'),arte_digital:t('catArte'),sintetica:t('catSintetica')};
  const topLabel = catLabels[topKey] || '—';
  renderModule('origin','🔍',t('originModuleName'),`${t('originProbable')}: ${topLabel}`,'mb-scan',body);
}

function renderGroupHeader(label, type) {
  const div = document.createElement('div');
  div.className = 'module-group-header';
  div.innerHTML = `<span class="module-group-label ${type}">${label}</span><div class="module-group-line ${type}"></div>`;
  document.getElementById('modules-wrap').appendChild(div);
}

// ⚠️ SEGURANÇA — `val` é escapado SEMPRE.
// Metadados (EXIF, C2PA) e amostras decodificadas vêm de DENTRO do arquivo
// analisado, portanto são entrada hostil. Quem precisa de markup interno usa
// rowHTML(), deixando a decisão explícita no call site.
function row(label, val, cls='') {
  return rowHTML(label, escapeHTML(val), cls);
}
function rowHTML(label, html, cls='') {
  return `<div><span style="color:var(--dim)">${escapeHTML(label)}:</span> <span class="${cls} finding">${html}</span></div>`;
}

function renderLeakModule(r){
  const imgEl=document.getElementById('dec-prev');
  const imgSrc=imgEl?imgEl.src:'';
  const rsMax=parseFloat(r.lsb&&r.lsb.rsRate)||0;
  const susp=rsMax>8;
  const rsCol=rsMax>15?'#ff6464':(rsMax>8?'#ffb300':'#00ffb3');
  const body=
    '<div class="leak-panel">'
    +'<div class="leak-left">'
      +'<div class="leak-img-wrap"><img id="leak-img" class="leak-img" src="'+imgSrc+'" alt=""><div id="leak-heatmap" class="leak-heatmap"></div></div>'
      +'<div class="leak-legend"><div class="leak-legend-bar"></div><div class="leak-legend-labels"><span>'+t('leakLegendClean')+'</span><span>'+t('leakLegendLeak')+'</span></div></div>'
      +'<button class="leak-toggle" id="leak-toggle">'+t('heatmapShow')+'</button>'
    +'</div>'
    +'<div class="leak-right">'
      +'<div class="leak-reading">'+t('encStealthRs')+': <b style="color:'+rsCol+'">'+((r.lsb&&r.lsb.rsRate)||'—')+'</b> <span class="leak-floor">· '+t('encStealthFloor')+' ~15%</span></div>'
      +'<div class="leak-tips-title">'+t('leakReadTitle')+'</div>'
      +'<ul class="leak-tips"><li>'+t('leakRead1')+'</li><li>'+t('leakRead2')+'</li><li>'+t('leakRead3')+'</li><li>'+t('leakRead4')+'</li></ul>'
    +'</div>'
    +'</div>';
  renderModule('leak','\u229e',t('leakModuleName'),susp?t('badgeSuspicious'):t('badgeNormal'),susp?'mb-warn':'mb-ok',body);
}

// A família principal de esteganálise é escolhida pelo formato real. Módulos
// incompatíveis não são renderizados só para dizer N/A: lossless usa pixels/LSB;
// JPEG com coeficientes disponíveis usa a superfície DCT.
function resolveStegoSurface(r) {
  if (r?.format?.cat === 'lossless') return 'lossless-lsb';
  if (r?.jpegDCT) return 'jpeg-dct';
  return 'generic';
}

// ─────────────────────────────────────────────────────────────────────────────
//  ESTADO DO PROTOCOLO — função pura, fonte única para UI e testes
//
//  `hasHeader` é uma evidência passiva e pode não existir em payloads furtivos.
//  Por isso todas as superfícies derivam a decisão desta mesma função, com
//  precedência da evidência mais forte para a mais fraca.
// ─────────────────────────────────────────────────────────────────────────────
function resolveProtocolState(r) {
  const st = r.studio;
  if (!st?.available)        return { level:'na',        name:'—',                       badge:t('badgeNA'),            cls:'mb-scan' };
  if (st.nativeExtracted)    return { level:'extracted', name:'STEGO·STUDIO',            badge:'STEGO·STUDIO',          cls:'mb-crit' };
  if (st.nativeHeaderMatched)return { level:'headerOnly',name:'STEGO·STUDIO',            badge:'STEGO·STUDIO',          cls:'mb-crit' };
  if (st.hasHeader)          return { level:'passive',   name:'STEGO·STUDIO',            badge:'STEGO·STUDIO',          cls:'mb-crit' };

  const printable = parseFloat(r.lsb?.printableRatio) || 0;
  const toolHeader = !!(st.headerName || r.lsb?.headerName);
  const reliableGenericText = !!(st.deepScan && r.lsb?.foundText && (toolHeader || printable > 70));
  if (reliableGenericText)   return { level:'generic',   name:t('protoNameGeneric'),     badge:t('protoBadgeGeneric'),  cls:'mb-crit' };

  if (r.lsb?.cipherSuspicion)return { level:'cipher',    name:t('protoNameUndetermined'),badge:t('protoBadgeCipher'),   cls:'mb-warn' };

  const rsRate = parseFloat(r.lsb?.rsRate) || 0;
  const wsRate = parseFloat(r.lsb?.wsRate) || 0;
  const wsReliable = r.lsb?.wsReliable !== false;
  const embeddingEvidence = !!r.lsb?.lsbrDetected || rsRate >= 25 || (wsRate >= 25 && wsReliable);
  if (embeddingEvidence)     return { level:'embedded',  name:t('protoNameUndetermined'),badge:t('protoBadgeEmbedding'),cls:'mb-warn' };

  return                            { level:'none',      name:t('protoNameNone'),        badge:t('protoBadgeNone'),     cls:'mb-ok' };
}

// ── Impressão digital de ferramenta ───────────────────────────────────────
// CONFIRMADO e INDÍCIO são níveis visivelmente distintos, e a distinção NÃO
// pode depender de cor. Cada item
// carrega ícone, palavra do nível e borda própria — remova a cor e continuam
// separáveis.
//   CONFIRMADO — o magic do Steghide foi lido. Como ele vive em posições
//     derivadas da senha, casar é prova, não palpite.
//   INDÍCIO — o comentário do codificador é compatível com o F5. Sugere a
//     ferramenta; não prova, porque qualquer arquivo salvo por aquela
//     biblioteca traz o mesmo comentário.
// Só aparece quando NENHUM motor extraiu a mensagem: se a extração funcionou,
// ela já é a prova mais forte e repetir aqui seria ruído.
function renderToolprint(r, decodedMsg) {
  const host = document.getElementById('toolprint-panel');
  if (!host) return;
  const items = (!decodedMsg && r.toolprint) ? r.toolprint : [];
  if (!items.length) { host.style.display = 'none'; return; }

  const rows = items.slice(0, 6).map(it => {
    const confirmed = it.level === 'confirmado';
    const mark  = confirmed ? '\u2713' : '?';
    const label = confirmed ? t('tpLevelConfirmed') : t('tpLevelHint');
    let why;
    if (it.id === 'steghide') {
      why = it.supported
        ? t('tpSteghideWhySupported')
        : t('tpSteghideWhyCipher').replace('{cipher}', `<code>${escapeHTML(it.algoName)}/${escapeHTML(it.modeName)}</code>`);
      if (it.usedEmptyPassword) why += ' ' + t('tpSteghideNoPass');
    } else {
      why = t('tpF5Why');
    }
    return `<div class="tp-item ${confirmed ? 'tp-confirmed' : 'tp-hint'}">
      <div class="tp-level"><span class="tp-level-mark">${mark}</span>${label}</div>
      <div class="tp-tool">${escapeHTML(it.tool)}</div>
      <div class="tp-why">${why}</div>
    </div>`;
  }).join('');

  host.innerHTML = `
    <div class="tp-head">
      <span class="tp-icon">\u26b7</span>
      <span class="tp-title">${t('tpTitle')}</span>
    </div>
    <div class="tp-desc">${t('tpDesc')}</div>
    <div class="tp-list">${rows}</div>
  `;
  host.style.display = 'block';
}

let lastRecoveredFile=null;

function prepareDecodedMessageView(decodedMsg, passwordIgnored=false, recoveredFile=null) {
  const box = document.getElementById('decoded-box');
  const text = document.getElementById('decoded-text');
  const label = document.getElementById('decoded-label');
  const passwordNote = document.getElementById('decoded-password-note');
  const copyBtn = document.getElementById('decoded-copy');
  const saveBtn = document.getElementById('decoded-save');
  if (!box || !text) return;

  const hasText=typeof decodedMsg==='string' && decodedMsg.length>0;
  const hasFile=!!(recoveredFile && recoveredFile.bytes instanceof Uint8Array && recoveredFile.bytes.length>0);
  lastRecoveredFile=hasFile ? recoveredFile : null;

  if (hasText || hasFile) {
    // textContent é intencional: código/HTML recuperado deve aparecer como texto,
    // nunca ser interpretado ou executado pelo navegador. white-space:pre-wrap
    // preserva apenas quebras REAIS já presentes na mensagem; sequências literais
    // como "\\n" continuam sendo dois caracteres comuns.
    text.textContent = hasText ? decodedMsg
      : `${t('decodedBinaryRecovered')} ${recoveredFile.fileName} · ${fmtBytes(recoveredFile.bytes.length)}`;
    if(label) label.textContent = (!hasText && hasFile) ? t('decodedFileLabel') : t('decodedLabel');
    if(copyBtn) copyBtn.style.display = hasText ? '' : 'none';
    if(saveBtn) saveBtn.textContent = hasFile ? t('decodedSaveFile') : t('decodedSave');
    if(passwordNote){
      passwordNote.textContent = passwordIgnored ? t('decStatusPlainKeyIgnored') : '';
      passwordNote.style.display = passwordIgnored ? 'block' : 'none';
    }
    box.classList.add('visible');
  } else {
    text.textContent = '';
    lastRecoveredFile=null;
    if(label) label.textContent=t('decodedLabel');
    if(copyBtn) copyBtn.style.display='';
    if(saveBtn) saveBtn.textContent=t('decodedSave');
    if(passwordNote){ passwordNote.textContent=''; passwordNote.style.display='none'; }
    box.classList.remove('visible');
  }
}

async function copyDecodedMessage() {
  const text = document.getElementById('decoded-text')?.textContent || '';
  if (!text) return;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch(_) { /* fallback abaixo */ }
  if (!copied) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly','');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.pointerEvents = 'none';
    document.body.appendChild(ta); ta.select();
    try { copied = !!document.execCommand('copy'); } catch(_) { copied = false; }
    ta.remove();
  }
  const btn = document.getElementById('decoded-copy');
  if (btn && copied) {
    btn.textContent = t('decodedCopied');
    setTimeout(() => { if (btn.isConnected) btn.textContent = t('decodedCopy'); }, 1200);
  }
}

function safeRecoveredDownloadName(name, fallback='payload.bin') {
  const rawLeaf=String(name||'').replace(/\\/g,'/').split('/').pop()||'';
  const leaf=rawLeaf.trim() || fallback;
  const clean=leaf.replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^\.+/,'');
  if (!clean) return fallback;
  if (clean.length <= 120) return clean;
  const dot=clean.lastIndexOf('.');
  // Preserve a plausible final extension while truncating only the basename.
  // Very long dot-suffixes are treated as part of the basename, not as an extension.
  if (dot > 0 && dot < clean.length-1) {
    const ext=clean.slice(dot);
    if (ext.length < 32) return clean.slice(0,120-ext.length) + ext;
  }
  return clean.slice(0,120);
}

function saveDecodedMessage() {
  const a = document.createElement('a');
  let blob=null, download='';
  if(lastRecoveredFile?.bytes instanceof Uint8Array && lastRecoveredFile.bytes.length>0){
    blob=new Blob([lastRecoveredFile.bytes], {type:lastRecoveredFile.mime||'application/octet-stream'});
    download=safeRecoveredDownloadName(lastRecoveredFile.fileName, 'payload.bin');
  } else {
    const text = document.getElementById('decoded-text')?.textContent || '';
    if (!text) return;
    const src = lastReport?.modules?.metadata?.filename || 'imagem';
    const base = src.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,80) || 'imagem';
    blob=new Blob([text], {type:'text/plain;charset=utf-8'});
    download=base + '_mensagem.txt';
  }
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = download;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderResults(r, decodedMsg, decodeStatus, renderMeta={}) {
  // Recalcula stegomalware a partir da mensagem decodificada ATUAL, para que o
  // threat e o banner fiquem consistentes em todo render (inicial, neural, idioma).
  r.stegomalware = decodedMsg ? detectStegomalware(decodedMsg) : [];
  const {score:tScore, flags:tFlags} = computeThreat(r);

  document.getElementById('modules-wrap').textContent='';

  prepareDecodedMessageView(decodedMsg, !!renderMeta.passwordIgnored, renderMeta.recoveredFile||null);

  // Threat Score
  const tColor = tScore>60?'#ff4060':tScore>30?'#ffb300':'var(--enc)';
  const tn=document.getElementById('threat-num');
  tn.textContent=tScore; tn.style.color=tColor; tn.style.textShadow=`0 0 16px ${tColor}`;
  const tl=document.getElementById('threat-level');
  const threatConfirmed = r.studio?.nativeExtracted === true || r.studio?.robust === true || resolveThirdPartyEvidence(r).level==='recovered';
  tl.textContent=threatConfirmed?t('levelConfirmed'):(tScore>60?t('levelHigh'):tScore>30?t('levelMedium'):tScore>0?t('levelLow'):t('levelClean'));
  tl.style.color=tColor;
  document.getElementById('threat-flags').innerHTML=
    tFlags.map(f=>`<span class="score-flag threat">${f}</span>`).join('');

  // ── Nota de limitação do modo offline ──
  // Mostre a ressalva apenas para suspeita parcial sem evidência confirmada; ela
  // seria contraditória ao lado de uma extração ou identificação já estabelecida.
  const offNote = document.getElementById('offline-limit-note');
  if (offNote) {
    const lsbPossible = !!r.lsb?.available;
    const partialSuspicion = !!r.lsb?.suspicious || tScore > 0;
    const protoLevel = resolveProtocolState(r).level;
    const nativeConfirmed = ['extracted','headerOnly','passive'].includes(protoLevel);
    const otherConfirmed = !!r.studio?.thirdParty || !!r.studio?.robust;
    const noConfirmedMsg = !nativeConfirmed && !otherConfirmed;
    if (lsbPossible && partialSuspicion && noConfirmedMsg) {
      offNote.textContent = t('offlineLimitNote');
      offNote.style.display = 'block';
    } else {
      offNote.style.display = 'none';
    }
  }

  // ── Aviso de conteúdo adversarial ──
  renderAdversarialWarning(r);
  renderStegomalwareWarning(r);
  renderToolprint(r, decodedMsg);

  // ── Aviso de contexto C2PA ──
  // Um manifesto C2PA que declara origem sintética pode explicar alguns sinais que
  // também aparecem em heurísticas de esteganografia. A presença do manifesto é
  // exibida como contexto; esta build não valida criptograficamente sua assinatura.
  const c2paNote = document.getElementById('c2pa-fp-note');
  if (c2paNote) {
    if (r.c2pa?.manifestDetected) {
      c2paNote.textContent = t('c2paFPNote');
      c2paNote.style.display = 'block';
    } else {
      c2paNote.style.display = 'none';
    }
  }

  // ── Classificador de origem (4 categorias, barra vertical) ──
  const origin = r.origin || {fotografia:0,screenshot:0,arte_digital:0,sintetica:0,topCategory:'fotografia'};
  const originMap = [
    {key:'fotografia',   num:'orig-foto',   bar:'orig-foto-bar',   cat:'fotografia'},
    {key:'screenshot',   num:'orig-screen', bar:'orig-screen-bar', cat:'screenshot'},
    {key:'arte_digital', num:'orig-art',    bar:'orig-art-bar',    cat:'arte'},
    {key:'sintetica',    num:'orig-synth',  bar:'orig-synth-bar',  cat:'sintetica'},
  ];
  const topCatToData = {fotografia:'fotografia',screenshot:'screenshot',arte_digital:'arte',sintetica:'sintetica'};
  const topData = topCatToData[origin.topCategory];
  originMap.forEach(m => {
    const val = origin[m.key] || 0;
    document.getElementById(m.num).textContent = val;
    document.getElementById(m.bar).style.height = val + '%';
    const cell = document.querySelector(`.origin-cell[data-cat="${m.cat}"]`);
    if (cell) cell.classList.toggle('top', m.cat === topData);
  });

  // ── GRUPO 1: MENSAGEM OCULTA ──
  renderGroupHeader(t('groupSteg'), 'stego');
  const stegoSurface=resolveStegoSurface(r);

  // PNG / LSB — superfície lossless única. Protocolo e estatística continuam
  // separados conceitualmente, mas aparecem no mesmo accordion porque só fazem
  // sentido neste caminho de pixels/LSB. JPEG usa a superfície DCT abaixo.
  if(stegoSurface==='lossless-lsb'){
    const proto = resolveProtocolState(r);
    const protoName = proto.name, protoBadge = proto.badge, protoClass = proto.cls;
    let stBody='';
    if(!r.studio?.available){
      stBody=`<div style="padding:10px;background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.15);border-radius:3px;font-size:0.68rem;color:var(--scan);line-height:1.8">ℹ ${escapeHTML(r.studio?.note||'')}</div>`;
      stBody+=row(t('rowDecodeStatus'), decodeStatus||'—');
    } else {
      const protoForte = proto.level==='extracted'||proto.level==='headerOnly'||proto.level==='passive';
      stBody=row(t('rowProtocolDetected'), protoName, protoForte||r.studio.deepScan?'finding-crit':'');
      if(proto.level==='extracted'){
        const recoveredDetail = r.studio.hasHeader && r.studio.payloadBytes
          ? t('payloadRecovered') + ' · ' + r.studio.payloadBytes + ' bytes'
          : t('payloadRecovered');
        stBody+=row(t('rowPayload'), recoveredDetail, 'finding-crit');
      } else if(proto.level==='headerOnly'){
        stBody+=row(t('rowHeader'), t('headerFoundNoContent'), 'finding-crit');
      } else if(r.studio.hasHeader){
        stBody+=row(t('rowHeader'), t('modeChannelBHeader'), 'finding-crit');
        stBody+=row(t('rowPayload'), r.studio.payloadBytes+' bytes', 'finding-crit');
      }
      if(r.studio.genericMode) stBody+=row(t('rowExtractionMode'), translateMode(r.studio.genericMode));
      const detectedHeader = r.studio.headerName || r.lsb?.headerName;
      if(detectedHeader && !r.studio.hasHeader) stBody+=row(t('rowHeaderIdentified'), `"${detectedHeader}"`, 'finding-crit');
      if(r.lsb?.foundText){
        if(decodedMsg) stBody+=row(t('rowTextRecovered'), t('valYes'), 'finding-crit');
        else stBody+=row(t('rowTextCandidate'), t('valCandidateNotValidated'), 'finding-warn');
      }
      stBody+=row(t('rowDecodeStatus'), decodeStatus||'—');
      stBody+=`<div class="interp">${interpretModule('studio',r)}</div>`;
    }

    const lsbSusp=r.lsb?.available&&r.lsb?.suspicious;
    let lsbBody='';
    if(!r.lsb?.available){
      lsbBody=`<div style="padding:10px;background:rgba(255,179,0,0.05);border:1px solid rgba(255,179,0,0.15);border-radius:3px;font-size:0.68rem;color:#ffb300;line-height:1.8">⚠ ${escapeHTML(r.lsb?.note||'')}</div>`;
    } else {
      lsbBody=row(t('rowChiR'),r.lsb.chiR,lsbSusp?'finding-warn':'finding-ok');
      lsbBody+=row(t('rowChiG'),r.lsb.chiG,lsbSusp?'finding-warn':'finding-ok');
      lsbBody+=row(t('rowChiB'),r.lsb.chiB,lsbSusp?'finding-warn':'finding-ok');
      lsbBody+=rowHTML(t('rowBestMode'),'<span style="color:var(--scan)">'+escapeHTML(translateMode(r.lsb.bestMode))+'</span>');
      lsbBody+=row(t('rowPrintableRatio'),r.lsb.printableRatio,parseFloat(r.lsb.printableRatio)>30?'finding-warn':'');
      lsbBody+=row(t('rowRSAttack'),r.lsb.rsRate,r.lsb.lsbrDetected?'finding-warn':'');
      lsbBody+=row(t('rowWSAttack'),r.lsb.wsRate,r.lsb.lsbrDetected?'finding-warn':'');
      const lsbrVerdict=r.lsb.lsbrDetected?t('lsbrYes'):r.lsb.lsbrPossible?t('lsbrMaybe'):t('lsbrNo');
      lsbBody+=row(t('rowLSBRVerdict'),lsbrVerdict,r.lsb.lsbrDetected?'finding-crit':r.lsb.lsbrPossible?'finding-warn':'finding-ok');
      const neuralVerdict=r.lsb.neuralSuspect?t('neuralMaybe'):t('neuralNo');
      lsbBody+=row(t('rowNeuralStego'),neuralVerdict,r.lsb.neuralSuspect?'finding-warn':'finding-ok');
      if(r.lsb.neuralSuspect){
        lsbBody+=`<div style="margin:6px 0;padding:9px 11px;background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.28);border-radius:3px;font-size:0.63rem;color:var(--scan);line-height:1.75">${t('neuralNote').replace('{ent}',r.lsb.neuralEntSim).replace('{hf}',r.lsb.neuralHfSim)}</div>`;
      }
      lsbBody+=rowHTML(t('rowDecodedSample'),'<span style="font-size:0.62rem;color:var(--dim)">'+escapeHTML(r.lsb.decodedSample.slice(0,80))+'</span>');
      lsbBody+=`<div class="interp">${interpretModule('lsb',r)}</div>`;
    }

    let pngBadge=t('badgeNormal'), pngClass='mb-ok';
    if(protoClass==='mb-crit'){ pngBadge=protoBadge; pngClass='mb-crit'; }
    else if(protoClass==='mb-warn'){ pngBadge=protoBadge; pngClass='mb-warn'; }
    else if(lsbSusp){ pngBadge=t('badgeSuspicious'); pngClass='mb-warn'; }
    const body=`<div class="module-subhead">${t('modProtocol')}</div>${stBody}<div class="module-subhead module-subhead-gap">${t('modLSB')}</div>${lsbBody}`;
    const losslessTitle=(r.format?.ext||'PNG')+' / LSB';
    renderModule('pnglsb','🧬',losslessTitle,pngBadge,pngClass,body);
  }

  // JPEG / DCT — superfície própria para JPEG. Estatística e evidência de
  // extração ficam juntas; Decode Status vive aqui, nunca numa família N/A.
  if(stegoSurface==='jpeg-dct'){
    let dctBody='';
    if(!r.jpegDCT.available){
      const reasonCode = r.jpegDCT.reason||'';
      const reasonKey = {
        'analysis-error':'jdctReasonAnalysisError',
        'decode-failed':'jdctReasonDecodeFailed',
        'linearization-failed':'jdctReasonLinearizationFailed',
        'no-ac-coefficients':'jdctReasonNoAC'
      }[reasonCode];
      const reason = reasonKey ? t(reasonKey) : reasonCode;
      dctBody=`<div class="interp">${t('jdctUnavailable')+(reason?' ('+escapeHTML(reason)+')':'')}</div>`;
      dctBody+=row(t('rowDecodeStatus'), decodeStatus||'—');
      renderModule('jpegdct','🧊',t('modJpegDCT'),t('badgeNA'),'mb-scan',dctBody);
    } else {
      const j=r.jpegDCT;
      const anomaly=!!j.firstOrderAnomaly;
      const robustState=r.studio?.robust;
      const robustRecovered=robustState===true;
      const thirdParty=r.studio?.thirdParty||null;
      const methods=[];
      if(robustRecovered) methods.push(t('jpegMethodStudioRobust'));
      if(thirdParty) methods.push(thirdParty);
      const directRecovered=methods.length>0;

      dctBody+=row(t('rowJpegStructure'),j.progressive?t('jpegProgressive'):t('jpegBaseline'));
      dctBody+=row(t('rowJpegComponents'),j.components);
      dctBody+=row(t('rowJdctNonZero'),`${j.acNonZero.toLocaleString()} / ${j.acTotal.toLocaleString()} (${(j.nonZeroRatio*100).toFixed(1)}%)`);
      dctBody+=row(t('rowJdctDistinct'),j.distinctValues);
      dctBody+=row(t('rowJdctAvgAbs'),j.avgAbsCoeff.toFixed(2));
      dctBody+=row(t('rowJdctBands'),`${t('jdctBandLow')} ${j.bandLow.toLocaleString()} · ${t('jdctBandMid')} ${j.bandMid.toLocaleString()} · ${t('jdctBandHigh')} ${j.bandHigh.toLocaleString()}`);
      const chiVerdict = anomaly ? t('jdctChiAnomaly') : t('jdctChiNoAnomaly');
      dctBody+=row(t('rowJdctChi'),chiVerdict,anomaly?'finding-warn':'finding-ok');

      dctBody+=row(t('rowJpegMethod'),methods.length?methods.join(' · '):t('jpegMethodNone'),directRecovered?'finding-crit':'');
      if(robustState && !robustRecovered){
        let robustText='';
        if(robustState==='locked') robustText=t('jpegRobustLocked');
        else if(robustState==='damaged') robustText=t('jpegRobustDamaged');
        else if(robustState==='content-error') robustText=t('jpegRobustContentError');
        if(robustText) dctBody+=row(t('rowJpegRobustState'),robustText,'finding-warn');
      }
      if(Number.isFinite(r.studio?.robustCorrected)){
        dctBody+=row(t('rowJpegRsCorrections'),t('jpegRsBytes').replace('{n}',String(r.studio.robustCorrected)),robustRecovered?'finding-ok':'');
      }
      dctBody+=row(t('rowDecodeStatus'), decodeStatus||'—',directRecovered?'finding-crit':'');

      if(robustRecovered){
        dctBody+=`<div style="margin:7px 0;padding:9px 11px;background:rgba(255,64,96,0.07);border:1px solid rgba(255,64,96,0.28);border-radius:3px;font-size:0.63rem;color:#ff9aae;line-height:1.75">${t('jpegEvidenceConfirmedNote')}</div>`;
      } else if(thirdParty){
        dctBody+=`<div style="margin:7px 0;padding:9px 11px;background:rgba(255,179,0,0.07);border:1px solid rgba(255,179,0,0.28);border-radius:3px;font-size:0.63rem;color:#ffcb5c;line-height:1.75">${t('jpegEvidenceThirdPartyNote')}</div>`;
      }
      dctBody+=`<div style="margin:6px 0;padding:9px 11px;background:rgba(96,165,250,0.07);border:1px solid rgba(96,165,250,0.28);border-radius:3px;font-size:0.63rem;color:var(--scan);line-height:1.75">${t('jdctHonestNote')}</div>`;

      const badge = directRecovered ? t('jpegBadgeRecovered') : robustState ? t('jpegBadgeEvidence') : anomaly ? t('badgeSuspicious') : t('badgeNormal');
      const badgeClass = directRecovered ? 'mb-crit' : (robustState||anomaly) ? 'mb-warn' : 'mb-ok';
      renderModule('jpegdct','🧊',t('modJpegDCT'),badge,badgeClass,dctBody);
    }
  }

  // Strings
  const strSusp=r.strings?.interesting?.length>0||r.strings?.appendedData;
  let strBody=row(t('rowPrintableStrings'),r.strings.count);
  strBody+=row(t('rowSuspiciousStrings'),r.strings.interesting.length,r.strings.interesting.length>0?'finding-warn':'');
  if(r.strings.interesting.length>0){
    strBody+='<div style="margin:4px 0;display:flex;flex-direction:column;gap:6px">';
    for(const s of r.strings.interesting.slice(0,5)){
      strBody+=`<div style="background:rgba(255,179,0,0.06);border:1px solid rgba(255,179,0,0.15);border-radius:3px;padding:6px 8px">
        <div style="font-size:0.58rem;color:#ffb300;letter-spacing:1px;margin-bottom:3px">[${escapeHTML(s.type)}]</div>
        <div class="finding-warn" style="word-break:break-all;white-space:pre-wrap;font-size:0.65rem;line-height:1.6">${escapeHTML(s.str)}</div></div>`;
    }
    strBody+='</div>';
  }
  if(r.strings.note) strBody+=`<div style="font-size:0.6rem;color:var(--dim);margin-top:6px;font-style:italic">${escapeHTML(r.strings.note||'')}</div>`;
  strBody+=row(t('rowAfterEOF'),r.strings.appendedData?(r.strings.appendedBytes+' bytes'):t('valNo'),r.strings.appendedData?'finding-crit':'');
  strBody+=`<div class="interp">${interpretModule('strings',r)}</div>`;
  renderModule('strings','🔤',t('modStrings'),strSusp?t('badgeSuspicious'):t('badgeClean'),strSusp?'mb-warn':'mb-ok',strBody);

  // Frequency
  const freqSusp=r.frequency.biasAnomaly;
  let freqBody=row(t('rowFreqPeaks'),r.frequency.spikes);
  freqBody+=row(t('rowParityBias'),r.frequency.evenOddBias,freqSusp?'finding-warn':'');
  const biasUnreliable = !r.frequency.biasReliable || r.frequency.biasLowComplexity;
  if(!r.frequency.biasReliable){
    freqBody+=`<div style="margin-top:6px;font-size:0.62rem;color:#ffb300;font-style:italic">${t('freqBiasUnreliableLossy')}</div>`;
  } else if(r.frequency.biasLowComplexity){
    freqBody+=`<div style="margin-top:6px;font-size:0.62rem;color:#ffb300;font-style:italic">${t('freqBiasUnreliableFlat')}</div>`;
  } else {
    freqBody+=row(t('rowAnomaly'),freqSusp?t('valWarnYes'):t('valNo'),freqSusp?'finding-warn':'finding-ok');
  }
  freqBody+=row(t('rowDominantRGB'),r.frequency.dominantRGB.join(' / '));
  freqBody+=`<div class="interp">${interpretModule('frequency',r)}</div>`;
  renderModule('frequency','〰',t('modFrequency'),biasUnreliable?t('badgeLimited'):freqSusp?t('badgeAnomalous'):t('badgeNormal'),biasUnreliable?'mb-scan':freqSusp?'mb-warn':'mb-ok',freqBody);

  // ── GRUPO 2: ORIGEM & AUTENTICIDADE ──
  if(r.lsb&&r.lsb.available) renderLeakModule(r);
  renderGroupHeader(t('groupOrigin'), 'ai');

  // Módulo resumo: compatibilidade com origem e sinais por categoria
  renderOriginModule(r);

  // Entropy
  const entSusp=r.entropy.highEntropy||r.entropy.noiseAnomaly;
  let entBody=row(t('rowShannonEntropy'),r.entropy.shannon+' bits',r.entropy.highEntropy?'finding-warn':'');
  entBody+=row(t('rowUniqueColors'),r.entropy.uniqueColors.toLocaleString());
  entBody+=row(t('rowAvgNoise'),r.entropy.avgNoise+` (${t('labelThreshold')}: ${r.entropy.noiseThreshold})`,r.entropy.noiseAnomaly?'finding-warn':'');
  entBody+=row(t('rowArtificialNoise'),r.entropy.noiseAnomaly?t('valPossible'):t('valNo'),r.entropy.noiseAnomaly?'finding-warn':'finding-ok');
  entBody+=`<div class="interp">${interpretModule('entropy',r)}</div>`;
  renderModule('entropy','⚡',t('modEntropy'),entSusp?t('badgeSuspicious'):t('badgeNormal'),entSusp?'mb-warn':'mb-ok',entBody);

  // Color
  const colSusp=r.color.alphaAnomaly||r.color.rareSuspicious;
  let colBody=row(t('rowAlphaValues'),r.color.uniqueAlpha,r.color.alphaAnomaly?'finding-warn':'');
  colBody+=row(t('rowPartialAlpha'),r.color.partialAlpha.toLocaleString());
  colBody+=row(t('rowRareColorClusters'),r.color.rareClusters,r.color.rareSuspicious?'finding-warn':'');
  if(r.color.rareDetails.length>0){
    colBody+='<div style="margin:4px 0 4px 12px">';
    for(const d of r.color.rareDetails) colBody+=`<div class="finding-warn">· ${escapeHTML(d)}</div>`;
    colBody+='</div>';
  }
  colBody+=`<div class="interp">${interpretModule('color',r)}</div>`;
  renderModule('color','🎨',t('modColor'),colSusp?t('badgeSuspicious'):t('badgeNormal'),colSusp?'mb-warn':'mb-ok',colBody);

  // C2PA
  if(r.c2pa){
    const c2Confirmed=r.c2pa.manifestDetected;
    const c2Found=r.c2pa.found;
    const c2Badge=c2Confirmed?t('c2BadgeConfirmed'):c2Found?t('c2BadgeFound'):t('c2BadgeNotFound');
    const c2Class=c2Confirmed?'mb-crit':c2Found?'mb-warn':'mb-ok';
    let c2Body='';
    if(c2Confirmed||c2Found){
      if(c2Confirmed){
        // `val` sai do CBOR/ASN.1 do manifesto — dado do arquivo, hostil por
        // definição. Escapar aqui é obrigatório porque os dados vêm do arquivo.
        const hl = (lbl,val) => val ? `<div style="padding:3px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:0.72rem;line-height:1.5">
          <span style="color:#ffb0b0;text-transform:uppercase;letter-spacing:1px">${escapeHTML(lbl)}:</span> <span style="color:#fff;font-family:var(--mono,monospace);word-break:break-word">${escapeHTML(val)}</span></div>` : '';
        const hlBlock = (r.c2pa.signerCN || r.c2pa.genName || r.c2pa.genVersion)
          ? `<div style="margin-top:8px">${hl(t('c2paFieldSigner'), r.c2pa.signerCN)}${hl(t('c2paFieldGenerator'), r.c2pa.genName)}${hl(t('c2paFieldVersion'), r.c2pa.genVersion)}</div>`
          : '';
        c2Body+=`<div style="padding:10px 12px;background:rgba(255,64,96,0.08);border:1px solid rgba(255,64,96,0.3);border-radius:4px;margin-bottom:10px">
          <div style="font-size:0.58rem;color:#ff6080;letter-spacing:2px;margin-bottom:4px">${t('c2paSignatureLabel')}</div>
          <div style="font-size:0.85rem;color:#fff;font-family:var(--sans);font-weight:600">${escapeHTML(r.c2pa.aiGenerator||t('c2paDefaultGenerator'))}</div>
          ${hlBlock}
          ${r.c2pa.digitalSourceType?`<div style="font-size:0.62rem;color:#ffb0b0;margin-top:6px">IPTC: ${escapeHTML(r.c2pa.digitalSourceType)}</div>`:''}
        </div>`;
      }
      if(r.c2pa.ca) c2Body+=row(t('rowSigningCA'),r.c2pa.ca,c2Confirmed?'finding-crit':'finding-warn');
      if(r.c2pa.certDate) c2Body+=row(t('rowCertDate'),r.c2pa.certDate);
      if(r.c2pa.rawSoftware) c2Body+=row(t('rowSoftwareId'),r.c2pa.rawSoftware,'finding-crit');
      if(r.c2pa.signals.length>0){
        c2Body+=`<div style="margin-top:8px;font-size:0.6rem;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${t('c2paEvidenceFound')}</div>`;
        // Sinais montados no parser, com pedaços do manifesto do arquivo dentro.
        for(const s of r.c2pa.signals) c2Body+=`<div style="font-size:0.65rem;color:var(--neutral);padding:2px 0">· ${escapeHTML(s)}</div>`;
      }
      const c2interp=c2Confirmed?t('c2paInterpConfirmed'):t('c2paInterpPartial');
      c2Body+=`<div class="interp">${c2interp}</div>`;

      // ── Assets C2PA extraídos: preview do SVG (sanitizado via <img>
      //    blob — NÃO executa script) + download do SVG e do manifesto JUMBF. ──
      if (C2PA_ASSETS.svg || C2PA_ASSETS.manifest) {
        let assets = `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="font-size:0.6rem;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">${t('c2paAssetsTitle')}</div>`;
        if (C2PA_ASSETS.svg) {
          const svgUrl = URL.createObjectURL(new Blob([C2PA_ASSETS.svg], {type:'image/svg+xml'}));
          // Preview seguro: <img> não executa <script> nem eventos do SVG. Fundo
          // xadrez para enxergar watermark clara/transparente.
          assets += `<div style="font-size:0.62rem;color:var(--neutral);margin-bottom:4px">${t('c2paSvgPreview')} <span style="color:var(--dim)">(${fmtBytes(C2PA_ASSETS.svg.length)})</span></div>
            <div style="background:repeating-conic-gradient(#2a2a2a 0% 25%, #1f1f1f 0% 50%) 50%/16px 16px;border:1px solid var(--border);border-radius:4px;padding:8px;text-align:center;margin-bottom:6px">
              <img src="${svgUrl}" alt="SVG watermark" style="max-width:100%;max-height:180px;object-fit:contain" />
            </div>
            <a href="${svgUrl}" download="c2pa_watermark.svg" class="c2pa-dl-btn">⬇ ${t('c2paDownloadSvg')}</a>`;
        }
        if (C2PA_ASSETS.manifest) {
          const mUrl = URL.createObjectURL(new Blob([C2PA_ASSETS.manifest], {type:'application/octet-stream'}));
          assets += `<a href="${mUrl}" download="c2pa_manifest.c2pa" class="c2pa-dl-btn">⬇ ${t('c2paDownloadManifest')} <span style="opacity:0.6">(${fmtBytes(C2PA_ASSETS.manifest.length)})</span></a>`;
          // Resumo LEGÍVEL (.txt) — resolve o .c2pa cru que o Notepad quebra.
          const L=[]; const add=(k,v)=>{ if(v) L.push(k.padEnd(20)+v); };
          L.push('STEGO·STUDIO — '+t('c2paReadableHeading')); L.push('='.repeat(48));
          add(t('c2paFieldSigner')+':', r.c2pa.signerCN);
          add(t('rowSigningCA')+':', r.c2pa.ca);
          add(t('c2paFieldGenerator')+':', r.c2pa.genName);
          add(t('c2paFieldVersion')+':', r.c2pa.genVersion);
          add('IPTC digitalSourceType:', r.c2pa.digitalSourceType);
          add(t('rowCertDate')+':', r.c2pa.certDate);
          if (r.c2pa.actionDescriptions?.length) { L.push(''); L.push(t('c2paActionsHeading')+':'); for(const d of r.c2pa.actionDescriptions) L.push('  - '+d); }
          L.push(''); L.push(t('c2paReadableNote'));
          const txtUrl = URL.createObjectURL(new Blob([L.join('\n')], {type:'text/plain'}));
          assets += `<a href="${txtUrl}" download="c2pa_manifest.txt" class="c2pa-dl-btn">⬇ ${t('c2paDownloadTxt')}</a>`;
        }
        assets += `<div style="font-size:0.58rem;color:var(--dim);font-style:italic;margin-top:8px">${t('c2paAssetSecNote')}</div></div>`;
        c2Body += assets;
      }
    } else {
      c2Body=`<div style="font-size:0.68rem;color:var(--dim);font-style:italic">${t('c2paNotFound')}</div>`;
    }
    renderModule('c2pa','🔏',t('modC2PA'),c2Badge,c2Class,c2Body);
  }

  // EXIF / XMP
  if(r.exif) {
    const exifUnavailable=r.exif.available===false;
    const exifPartial=!!r.exif.cameraPartial;
    const metadataNoCamera=!exifUnavailable && !r.exif.noExif && !!r.exif.found && !r.exif.hasCamera && !exifPartial;
    const exifBadge=exifUnavailable?t('exifBadgeUnavailable'):
      r.exif.aiSoftware?t('exifBadgeAI'):
      r.exif.noExif?t('exifBadgeNoExif'):
      r.exif.hasCamera?t('exifBadgeCamera'):
      exifPartial?t('exifBadgePartial'):
      metadataNoCamera?t('exifBadgeMetadataNoCamera'):t('exifBadgeNoCamera');
    const exifClass=exifUnavailable?'mb-scan':r.exif.aiSoftware?'mb-crit':r.exif.noExif?'mb-warn':r.exif.hasCamera?'mb-ok':'mb-warn';
    let exifBody='';
    if(exifUnavailable){
      exifBody+=`<div style="font-size:0.68rem;color:var(--dim);font-style:italic">${t('exifInterpUnavailable')}</div>`;
    } else {
      if(r.exif.aiSoftware){
        exifBody+=`<div style="padding:8px 10px;background:rgba(255,64,96,0.08);border:1px solid rgba(255,64,96,0.25);border-radius:3px;margin-bottom:8px">
          <div style="font-size:0.58rem;color:#ff6080;letter-spacing:2px;margin-bottom:3px">${t('exifGeneratorIdentified')}</div>
          <div style="font-size:0.9rem;color:#fff;font-family:var(--sans)">${escapeHTML(r.exif.aiSoftware)}</div>
        </div>`;
      }
      if(r.exif.noExif){
        exifBody+=`<div style="font-size:0.68rem;color:#ffb300;font-style:italic">${t('exifNoMetadata')}</div>`;
      } else {
        for(const [k,v] of Object.entries(r.exif.fields||{})) {
          if(k==='GPS') continue; // hasGPS below is the canonical visible row; keep fields.GPS in JSON for compatibility
          exifBody+=row(k,v,k==='Software'&&r.exif.aiSoftware?'finding-crit':'');
        }
        const cameraValue=r.exif.hasCamera?t('valCameraPresent'):exifPartial?t('valCameraPartial'):t('valCameraAbsent');
        exifBody+=row(t('rowCameraData'),cameraValue,r.exif.hasCamera?'finding-ok':'finding-warn');
        exifBody+=row(t('rowGPS'),r.exif.hasGPS?t('valPresent'):t('valAbsent'));
      }
      const interp = r.exif.aiSoftware
        ? t('exifInterpAI').replace('{software}',escapeHTML(r.exif.aiSoftware))
        : r.exif.noExif
          ? t('exifInterpNoExif')
          : r.exif.hasCamera
            ? t('exifInterpCamera')
            : exifPartial
              ? t('exifInterpPartial')
              : t('exifInterpNoCamera');
      exifBody+=`<div class="interp">${interp}</div>`;
    }
    renderModule('exif','📋',t('modEXIF'),exifBadge,exifClass,exifBody);
  }

  // DCT
  if(r.dct?.available) {
    const dctSusp=r.dct.suspicious;
    let dctBody=row(t('rowSampledBlocks'),r.dct.blockCount);
    dctBody+=row(t('rowAvgLuminance'),r.dct.mean);
    dctBody+=row(t('rowStdDevBlocks'),r.dct.stdDev,dctSusp?'finding-warn':'finding-ok');
    dctBody+=row(t('rowUniformity'),dctSusp?t('valHighSuspect'):t('valNormal'),dctSusp?'finding-warn':'finding-ok');
    const interp=dctSusp
      ?t('interpDCTSusp').replace('{std}',r.dct.stdDev)
      :t('interpDCTNormal').replace('{std}',r.dct.stdDev);
    dctBody+=`<div class="interp">${interp}</div>`;
    renderModule('dct','⬛',t('modDCT'),dctSusp?t('badgeSuspicious'):t('badgeNormal'),dctSusp?'mb-warn':'mb-ok',dctBody);
  }

  // Gradients
  if(r.gradients?.available) {
    const gradSusp=r.gradients.suspicious;
    let gradBody=row(t('rowDetectedEdges'),r.gradients.totalEdges.toLocaleString());
    gradBody+=row(t('rowSharpEdges'),r.gradients.sharpRatio,gradSusp?'finding-warn':'finding-ok');
    gradBody+=row(t('rowSoftEdges'),r.gradients.softEdges.toLocaleString());
    gradBody+=row(t('rowProfile'),gradSusp?t('valExcessiveSmoothing'):t('valNatural'),gradSusp?'finding-warn':'finding-ok');
    const interp=gradSusp
      ?t('interpGradSusp').replace('{ratio}',r.gradients.sharpRatio)
      :t('interpGradNormal').replace('{ratio}',r.gradients.sharpRatio);
    gradBody+=`<div class="interp">${interp}</div>`;
    renderModule('gradients','〰️',t('modGradients'),gradSusp?t('badgeSuspicious'):t('badgeNatural'),gradSusp?'mb-warn':'mb-ok',gradBody);
  }

  // Chrominance
  if(r.chroma?.available) {
    const chromaSusp=r.chroma.suspicious;
    let chromaBody=row(t('rowAvgSaturation'),r.chroma.avgSaturation);
    chromaBody+=row(t('rowOversaturatedPixels'),r.chroma.highSatRatio,r.chroma.oversaturated?'finding-warn':'');
    chromaBody+=row(t('rowVarianceCb'),r.chroma.cbVariance,r.chroma.uniformChroma?'finding-warn':'');
    chromaBody+=row(t('rowVarianceCr'),r.chroma.crVariance,r.chroma.uniformChroma?'finding-warn':'');
    chromaBody+=row(t('rowOversaturation'),r.chroma.oversaturated?t('valWarnYes'):t('valNo'),r.chroma.oversaturated?'finding-warn':'finding-ok');
    chromaBody+=row(t('rowUniformChroma'),r.chroma.uniformChroma?t('valWarnYes'):t('valNo'),r.chroma.uniformChroma?'finding-warn':'finding-ok');
    const interp=chromaSusp
      ?(r.chroma.oversaturated?t('interpChromaOversat'):'')+
       (r.chroma.uniformChroma?t('interpChromaUniform'):'')
      :t('interpChromaNormal');
    chromaBody+=`<div class="interp">${interp}</div>`;
    renderModule('chroma','🌈',t('modChroma'),chromaSusp?t('badgeSuspicious'):t('badgeNormal'),chromaSusp?'mb-warn':'mb-ok',chromaBody);
  }

  // AI Detection
  if(r.ai) {
    const aiC=r.ai.score>=65?'crit':r.ai.score>=40?'warn':r.ai.score>=18?'info':'ok';
    const aiBadgeClass=r.ai.score>=65?'mb-crit':r.ai.score>=40?'mb-warn':r.ai.score>=18?'mb-scan':'mb-ok';
    const aiBadge=r.ai.score>=65?t('aiBadgeHigh'):r.ai.score>=40?t('aiBadgeMedium'):r.ai.score>=18?t('aiBadgeLow'):t('aiBadgeUnlikely');
    let aiBody=`<div class="ai-verdict ${aiC}">
      <div>
        <div class="ai-score-num ${aiC}">${r.ai.score}</div>
        <div style="font-size:0.54rem;color:var(--dim);text-align:center;letter-spacing:1px;margin-top:2px">AI SCORE</div>
      </div>
      <div class="ai-verdict-text">
        <div class="ai-verdict-label">${t('aiVerdictLabel')}</div>
        <div class="ai-verdict-level ${aiC}">${r.ai.score>=70?t('aiLevelHigh'):r.ai.score>=45?t('aiLevelMedium'):r.ai.score>=20?t('aiLevelLow'):t('aiLevelUnlikely')}</div>
        ${r.ai.formatCat==='lossy'?'<div style="font-size:0.58rem;color:#ffb300;margin-top:4px">'+t('compressionMayMask').replace('{ext}',escapeHTML(r.ai.formatExt))+'</div>':''}
      </div>
    </div>`;
    if(r.ai.signals.length===0){
      aiBody+=`<div style="font-size:0.68rem;color:var(--dim);font-style:italic">${t('aiNoSignals')}</div>`;
    } else {
      aiBody+=`<div style="font-size:0.58rem;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">${t('aiDetectedHeader')}</div>`;
      for(const s of r.ai.signals){
        // Traduz label e detail a partir das chaves, aplicando variáveis
        // As STRINGS-BASE vêm do i18n (confiáveis, podem conter markup), mas as
        // VARIÁVEIS podem vir do arquivo — `{software}` é o campo Software do
        // EXIF, cru. Escapa-se o valor interpolado, nunca o molde. (Sink
        // dado do arquivo: deve permanecer escapado.)
        let lbl = s.labelKey ? t(s.labelKey) : escapeHTML(s.label||'');
        if (s.labelVars) for (const [k,v] of Object.entries(s.labelVars)) lbl = lbl.replace(`{${k}}`, escapeHTML(v));
        let det = s.detailKey ? t(s.detailKey) : escapeHTML(s.detail||'');
        if (s.detailVars) for (const [k,v] of Object.entries(s.detailVars)) det = det.replace(`{${k}}`, escapeHTML(v));
        aiBody+=`<div class="ai-signal ${escapeHTML(s.level)}"><div class="ai-signal-label">${lbl}</div><div class="ai-signal-detail">${det}</div></div>`;
      }
    }
    aiBody+=`<div class="interp" style="margin-top:8px">${t('aiClosingNote')}</div>`;
    renderModule('ai','🤖',t('modAI'),aiBadge,aiBadgeClass,aiBody);
  }

  document.getElementById('dec-placeholder').style.display='none';
  document.getElementById('results-area').classList.add('visible');
  document.getElementById('export-wrap').classList.add('visible');
}

// ════════════════════════════════════════
//  MAIN ANALYZE
// ════════════════════════════════════════
