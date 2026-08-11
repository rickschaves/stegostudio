document.getElementById('btn-analyze').addEventListener('click', async ()=>{
  if(!decID||!decFile) return;
  const key=document.getElementById('dec-key').value;
  document.getElementById('results-area').classList.remove('visible');
  document.getElementById('export-wrap').classList.remove('visible');
  document.getElementById('btn-analyze').disabled=true;

  try {
    setProgress(0, 'Iniciando pipeline...');
    // ── F7 (ação 1b): decode DCT ÚNICO POR ANÁLISE, um nível ACIMA ──
    // O mesmo arquivo chegava a ser decodificado três vezes: uma no
    // Analyzer-JPEG (dentro do runForensics) e uma por motor do Decoder.
    // Agora decodifica-se aqui, antes de tudo, e o resultado desce para todos.
    // `decFmt` vem dos magic bytes lidos no upload (v2.32.1), então é confiável
    // para esta pré-decisão. Se o decode falhar (ex.: JPEG progressivo), segue
    // null e cada consumidor faz o próprio tratamento — inclusive a mensagem
    // amigável do Analyzer, que depende de decodificar para saber o motivo.
    let sharedDec=null, jpegBytes=null;
    if(decFmt && decFmt.ext==='JPEG' && decFile){
      try{
        jpegBytes=new Uint8Array(await decFile.arrayBuffer());
        sharedDec=decodeJpegCoefficients(jpegBytes);
      }catch(_){ sharedDec=null; }
    }
    const report = await runForensics(decID, decFile, setProgress, sharedDec);
    // report.format foi corrigido por magic bytes (pega .jfif, MIME errado, etc.)
    // — tem precedência sobre o decFmt detectado no upload (só por extensão).
    const fmt = report.format || decFmt;

    // Decode attempt
    let decodedMsg=null, decodeStatus=t('decStatusNoStudio');
    let decodedFromDeepScan=false; // true quando a msg veio da investigação profunda (pode ser ruído)
    const isLossless=fmt&&fmt.cat==='lossless';

    if(!isLossless){
      decodeStatus=t('decStatusLSBUnavailable')+fmt.ext+t('decStatusLossySuffix');
      // ── MOTOR DE TERCEIRO: Steghide em JPEG (domínio DCT) ──
      // JPEG não tem LSB espacial, mas pode conter dados do Steghide nos
      // coeficientes DCT. Lê os bytes crus do arquivo e tenta o motor Steghide
      // (com a senha informada, ou sem senha). Uma extração real tem precedência
      // sobre a mensagem padrão de "indisponível".
      if(fmt.ext==='JPEG' && decFile){
        try{
          // F7: reusa os bytes e os coeficientes obtidos no topo do fluxo.
          // Se o arquivo só foi reconhecido como JPEG pelo relatório (o decFmt
          // do upload pode divergir em casos de borda), faz o trabalho aqui,
          // exatamente como antes — o caminho autônomo continua íntegro.
          const bytes = jpegBytes || new Uint8Array(await decFile.arrayBuffer());
          let dec = sharedDec;
          if(!dec){ try{ dec=decodeJpegCoefficients(bytes); }catch(_){ } }
          // ── MODO ROBUSTO (F4) — tentado ANTES dos motores de terceiros ──
          // Tem assinatura própria e CRC no cabeçalho, então é o teste mais
          // específico e o de menor risco de falso positivo. O estado
          // 'damaged' é o caso honesto: o cabeçalho sobreviveu ao caminho e o
          // corpo não — dizer isso é melhor do que dizer "nada encontrado".
          try{
            const rb = robustExtract(bytes, key);
            if(rb.status === 'ok'){
              const p = rb.payload, modeByte = p[5];
              const len = p[6] | (p[7]<<8) | (p[8]<<16) | (p[9]<<24);
              const comp = !!(modeByte & FLAG_COMPRESSED);
              let body = p.slice(10, 10 + len), plain = null;
              if(isAesPayload(body)){
                if(key.length > 0) plain = await aesDecryptBytes(body, key);
              } else plain = body;
              if(plain && comp){ try{ plain = await inflateBytes(plain); }catch(_){ plain = null; } }
              if(plain){
                decodedMsg = new TextDecoder().decode(plain).slice(0,5000);
                decodeStatus = t('rbDecFound');
                report.studio = {...report.studio, robust:true, robustCorrected:rb.errosCorrigidos};
              } else if(isAesPayload(body)){
                decodeStatus = t('decStatusShuffledNeedsKey'); flashKey();
              }
            } else if(rb.status === 'damaged'){
              decodeStatus = t('rbDecDamaged');
              report.studio = {...report.studio, robust:'damaged'};
            }
          }catch(_){ /* não é payload robusto — segue para os motores de terceiros */ }
          const shRes = decodedMsg ? null : await shDecodeJpeg(bytes, key, dec);
          if(shRes && shRes.text!==null){
            decodedMsg=shRes.text.slice(0,5000);
            decodeStatus=t('decStatusSteghide');
            report.studio={...report.studio, thirdParty:'Steghide', foreignFile:shRes.fileName||null};
          }
          // ── MOTOR DE TERCEIRO: OutGuess (mesmo domínio DCT) ──
          // Só tenta se o Steghide não achou nada. Sem magic próprio, o motor
          // só reporta extrações que pareçam conteúdo real (sem falso positivo).
          if(!decodedMsg){
            const ogRes=ogDecodeJpeg(bytes, key, dec);
            if(ogRes && ogRes.text!==null){
              decodedMsg=ogRes.text.slice(0,5000);
              decodeStatus=ogRes.truncated?t('decStatusOutGuessPartial'):t('decStatusOutGuess');
              report.studio={...report.studio, thirdParty:'OutGuess', foreignTruncated:!!ogRes.truncated};
            }
          }
        }catch(_){ /* não é Steghide/OutGuess ou falhou — mantém a msg padrão */ }
        // Em JPEG, o status padrão ("LSB indisponível") apenas REPETE a nota do
        // módulo logo acima. Troca por algo que informa de fato: quais motores
        // foram tentados e qual foi o resultado.
        if(!decodedMsg){
          decodeStatus=t('decStatusJpegNoneFound');
          // F9 fatia 2 — CONFIRMADO sem extração. O magic do Steghide vive em
          // posições derivadas da senha: se ele bate, é prova de que o arquivo é
          // Steghide, mesmo sem conseguirmos ler o conteúdo. Só roda aqui, no
          // caminho em que TODOS os motores já falharam — nunca duplica um
          // resultado que a extração já provou.
          try{
            const sh=shIdentifyJpeg(bytes, key, dec);
            if(sh) report.toolprint=[...(report.toolprint||[]),
              { tool:'Steghide', id:'steghide', level:'confirmado',
                evidence:'magic', algoName:sh.algoName, modeName:sh.modeName,
                supported:sh.supported, usedEmptyPassword:sh.usedEmptyPassword }];
          }catch(_){}
          // Se há assinatura estatística do modo robusto mas nada foi extraído,
          // a causa provável é recompressão a mais — copiar-e-colar é a mais
          // comum, porque o sistema recodifica a imagem ao colar. A dica aparece
          // exatamente para quem colou em vez de salvar o arquivo.
          try{ const sig=robustSignature(sharedDec);
               if(sig && sig.suspeito) decodeStatus=t('decStatusRobustLostPaste'); }catch(_){}
        }
      }
    } else {
      const studioPayload=extractLSBStudio(decID,key);
      if(studioPayload && studioPayload.needsPassword){
        // Corpo embaralhado por senha, mas nenhuma senha foi informada.
        decodeStatus=t('decStatusShuffledNeedsKey');decodedMsg=null;flashKey();
      } else if(studioPayload){
        const comp = !!studioPayload.compressed;
        const isAes = isAesPayload(studioPayload);
        // Descomprime se o flag FLAG_COMPRESSED estiver setado; null se falhar.
        const inflateIfNeeded = async (bytes) => {
          if(!comp) return bytes;
          try{ return await inflateBytes(bytes); }catch(_){ return null; }
        };
        if(key.length>0){
          if(isAes){
            // Formato novo: AES-GCM (autenticado). Decifra → (descomprime) → texto.
            let bytes=null;
            try{ bytes=await aesDecryptBytes(studioPayload,key); }catch(_){ bytes=null; }
            if(bytes!==null) bytes=await inflateIfNeeded(bytes);
            if(bytes!==null){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusDecryptedKey');
            } else {
              decodeStatus=t('decStatusCipherWrongKey');decodedMsg=null;flashKey();
            }
          } else if(comp){
            // Comprimido mas não cifrado: a chave é ignorada (compressão ≠ cripto).
            const bytes=await inflateIfNeeded(studioPayload);
            if(bytes!==null && isReadableText(bytes)>0.7){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusPlainKeyIgnored');
            } else {
              decodeStatus=t('decStatusCipherWrongKey');decodedMsg=null;flashKey();
            }
          } else {
            // Não-AES e não comprimido → tenta XOR legado; senão texto puro.
            let attempt=decryptXOR(studioPayload,key);
            if(isReadableText(new TextEncoder().encode(attempt))<=0.7) attempt=null;
            if(attempt!==null){
              decodedMsg=attempt;decodeStatus=t('decStatusDecryptedKey');
            } else {
              const plain=new TextDecoder('utf-8',{fatal:false}).decode(studioPayload);
              if(isReadableText(studioPayload)>0.7){decodedMsg=plain;decodeStatus=t('decStatusPlainKeyIgnored');}
              else{decodeStatus=t('decStatusCipherWrongKey');decodedMsg=null;flashKey();}
            }
          }
        } else {
          // Sem chave: se for payload AES, avisa que precisa de senha.
          if(isAes){
            decodeStatus=t('decStatusCipherFound');decodedMsg=null;flashKey();
          } else {
            const bytes=await inflateIfNeeded(studioPayload);
            if(bytes!==null && isReadableText(bytes)>0.7){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusPlainNoCipher');
            } else {
              decodeStatus=t('decStatusCipherFound');decodedMsg=null;flashKey();
            }
          }
        }
      } else {
        const maxBytes=Math.min(Math.floor(decID.width*decID.height/8),8000);
        const generic=extractLSBRaw(decID,maxBytes);
        const hasC2PA=report.c2pa?.found||report.c2pa?.confirmed;

        // Com chave: tenta decifrar os bytes brutos (AES novo ou XOR legado)
        if(key.length>0){
          let decrypted=null;
          if(isAesPayload(generic.bytes)){
            try{ decrypted=await aesDecrypt(generic.bytes,key); }catch(_){ decrypted=null; }
          } else {
            const x=decryptXOR(generic.bytes,key);
            if(isReadableText(new TextEncoder().encode(x))>0.7) decrypted=x;
          }
          if(decrypted!==null){
            decodedMsg=decrypted.replace(/\0+$/,'').slice(0,1000);
            decodeStatus=t('decStatusDecryptedVia').replace('{mode}',translateMode(generic.mode));
          } else {
            decodeStatus=t('decStatusKeyNoText');
            decodedMsg=null; flashKey();
          }
        }
        // Sem chave: usa o investigador de janela deslizante
        // Mínimo de 12 caracteres (mesmo critério do módulo LSB) para evitar
        // exibir ruído estatístico curto como mensagem decodificada.
        else if(generic.foundText && generic.foundTextLength >= 12 && !hasC2PA){
          let msg = generic.foundText;
          const hadHeader = !!generic.headerName;
          // JOI usa um byte de tamanho logo após o header; outros formatos podem
          // não usar. Só removemos esse byte quando o header é reconhecidamente JOI.
          const isJoiHeader = /^JOI_LSB/i.test(generic.headerName || '');
          // Remove headers de ferramentas conhecidas no início (JOI_LSB2, STEGO, etc.)
          msg = msg.replace(/^(JOI_LSB\d?|STEGO|LSB|STEG)[\x00-\x20]*/i, '');
          // Remove caracteres de controle e nulls
          msg = msg.replace(/[\x00-\x1F]/g, '').trim();
          // Formato JOI/STEGO: header + bytes-nulos + [1 byte de tamanho] + texto.
          // A ilha de texto começa no byte de tamanho, que vira o 1º caractere do
          // foundText (ex: 'Q' = 0x51 = 81 ≈ comprimento da msg). Como esse byte
          // pode calhar de ser uma letra ASCII, não dá para distingui-lo pelo
          // valor — então, havendo header conhecido, removemos 1 caractere inicial.
          if (isJoiHeader && msg.length > 1) {
            msg = msg.slice(1).trim();
          }
          // Remove um possível byte de pontuação solto no início (resíduo de header)
          msg = msg.replace(/^['"`´]/, '').trim();
          // Remove cauda residual: 1-2 caracteres soltos logo após uma pontuação
          // final (ex: "...PEOPLE DO.m" → "...PEOPLE DO."). É o início do lixo
          // binário que colou na ilha de texto.
          msg = msg.replace(/([.!?])[A-Za-z]{1,2}$/, '$1');
          decodedMsg = msg.slice(0,1000);
          decodeStatus = t('deepInvestText').replace('{mode}',translateMode(generic.mode));
          decodedFromDeepScan = true; // marca origem: investigação profunda (candidata a ruído)
          report.studio={...report.studio,genericMode:generic.mode,deepScan:true,headerName:generic.headerName||null};
        }
        else if(hasC2PA && generic.printableRatio>0.35){
          decodeStatus=t('decStatusC2PAData');
        }
        else {
          decodeStatus=t('decStatusNoReadable');
        }
      }
    }

    // ── NEGAÇÃO PLAUSÍVEL: sonda da mensagem-isca (decoy) ──
    // Se uma senha foi informada mas NENHUMA mensagem real decodificou com ela,
    // pode ser a senha da isca (Opção C: isca gravada no FIM via AES-GCM). A
    // sonda SEMPRE roda nesse caso — não depende de flag (marcar a isca vazaria
    // sua existência). A tag do GCM valida: sem isca ou senha errada → null,
    // sem falsa leitura. Rodada só quando lossless (LSB só existe aí).
    if(isLossless && key.length>0 && !decodedMsg){
      let decoyMsg=null;
      try{ decoyMsg=await extractDecoyTail(decID,key); }catch(_){ decoyMsg=null; }
      if(decoyMsg!==null){
        decodedMsg=decoyMsg;
        decodeStatus=t('decStatusDecryptedKey');
        decodedFromDeepScan=false; // veio de camada válida (GCM autenticado), não é ruído
      }
    }

    // ── MOTOR DE TERCEIRO: OpenStego (RandomLSB) ──
    // Roda quando NÃO decodificamos uma mensagem nossa confiável (ou só ruído de
    // deep scan). Se a imagem for OpenStego, extrai de verdade (com a senha, ou
    // sem senha via seed fixa). Uma extração real de terceiro tem precedência
    // sobre ruído especulativo de deep scan.
    if(isLossless && (!decodedMsg || decodedFromDeepScan)){
      let osRes=null;
      try{ osRes=await osDecodeMessage(decID,key); }catch(_){ osRes=null; }
      if(osRes){
        if(osRes.text!==null){
          decodedMsg=osRes.text.slice(0,5000);
          decodeStatus=t('decStatusOpenStego');
          decodedFromDeepScan=false; // extração real (magic OpenStego bateu), não é ruído
          report.studio={...report.studio, thirdParty:'OpenStego', foreignFile:osRes.fileName||null};
        } else if(osRes.encrypted){
          // identificado como OpenStego, mas com cifra AES (não suportada ainda):
          // não mostramos texto, mas sinalizamos a origem honestamente.
          decodeStatus=t('decStatusOpenStegoEnc');
          report.studio={...report.studio, thirdParty:'OpenStego', foreignEncrypted:true, foreignFile:osRes.fileName||null};
        }
      }
    }

    // ── CONSOLIDAÇÃO INICIAL (sem neural ainda) ──
    // Roda mesmo sem backend: se o decode produziu ruído de deep scan, suprime
    // já aqui em vez de mostrar o ruído como mensagem.
    {
      const c0 = consolidateVerdict(report, decodedMsg, decodeStatus, decodedFromDeepScan);
      decodedMsg = c0.decodedMsg;
      decodeStatus = c0.decodeStatus;
    }

    report.stegomalware = decodedMsg ? detectStegomalware(decodedMsg) : [];
    lastReport={timestamp:new Date().toISOString(),threat:computeThreat(report),synth:computeSynth(report),origin:report.origin,decodedMsg,decodeStatus,modules:report};
    // Guarda os argumentos do render para poder refazê-lo ao trocar de idioma
    lastRenderArgs = {report, decodedMsg, decodeStatus};
    renderResults(report,decodedMsg,decodeStatus);
    // Rola até o topo dos resultados para o usuário ver os scores imediatamente,
    // sem precisar rolar manualmente. Funciona tanto no scroll da coluna direita
    // (desktop) quanto no scroll do painel inteiro (mobile).
    requestAnimationFrame(() => {
      const results = document.getElementById('results-area');
      if (results) {
        if (window.innerWidth > 760) {
          const y = results.getBoundingClientRect().top + window.scrollY - 22;
          window.scrollTo({ top: y, behavior: 'smooth' });
        } else {
          results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });

    const {score:tScore}=computeThreat(report);
    const col=tScore>60?'err':tScore>30?'warn':'ok';
    // Origem mais provável
    const origin=report.origin||{};
    const topVal=origin[origin.topCategory]||0;
    // Mostra resultado completo no terminal, incluindo o status de decodificação.
    // Reconstrói via t() para que a troca de idioma reaplique o texto traduzido.
    const buildComplete = () => {
      const catNames={fotografia:t('catFotografia'),screenshot:t('catScreenshot'),arte_digital:t('catArte'),sintetica:t('catSintetica')};
      const topName=catNames[origin.topCategory]||'—';
      return [
        {text:t('termAnalysisComplete'), cls:col},
        {text:`Threat: ${tScore}/100`, cls:'info'},
        {text:`${t('termOriginProbable')}: ${topName} (${topVal})`, cls:'info'},
        {text:`${t('termDecodeStatus')}: ${decodeStatus}`, cls: decodedMsg ? 'ok' : 'info'}
      ];
    };
    termRedraw['dec-status'] = () => termWrite('dec-status', buildComplete(), {instant:true});
    termWrite('dec-status', buildComplete());

  } catch(e) {
    setStatus('dec-status','<span class="err">✗ Erro: '+e.message+'</span>');
    console.error('STEGO·STUDIO erro:', e);
  } finally {
    document.getElementById('btn-analyze').disabled=false;
  }
});

// ════════════════════════════════════════
//  EXPORT JSON
// ════════════════════════════════════════
document.getElementById('btn-export-json').addEventListener('click',()=>{
  if(!lastReport) return;
  const payload={_tool:'STEGO·STUDIO v2.40.0',_schema:'forensic-report-v2',
    _hint:t('exportHintJSON'),
    ...lastReport};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const name=(lastReport.modules?.metadata?.filename||'imagem').replace(/\.[^.]+$/,'');
  a.href=url;a.download=`stegoscan_${name}_${Date.now()}.json`;a.click();
  URL.revokeObjectURL(url);
});

/* ---- #22 overlay: mapa de vazamento sobre a imagem do Analyzer (v2.27.0) ---- */
function positionLeakOverlay(){
  const img=document.getElementById('leak-img'), hm=document.getElementById('leak-heatmap');
  if(!img||!hm) return;
  const bw=img.clientWidth, bh=img.clientHeight, nw=img.naturalWidth||1, nh=img.naturalHeight||1;
  const sc=Math.min(bw/nw, bh/nh)||1, dw=nw*sc, dh=nh*sc;       // object-fit:contain -> retângulo real
  hm.style.left=(img.offsetLeft+(bw-dw)/2)+'px';
  hm.style.top=(img.offsetTop+(bh-dh)/2)+'px';
  hm.style.width=dw+'px'; hm.style.height=dh+'px';
}
function toggleLeakOverlay(){
  const hm=document.getElementById('leak-heatmap'), btn=document.getElementById('leak-toggle');
  if(!hm||!btn||!decID) return;
  if(hm.classList.contains('on')){ hm.classList.remove('on'); btn.textContent=t('heatmapShow'); return; }
  if(hm.dataset.built!=='1'){
    const w=decID.width, h=decID.height;
    const cols=Math.max(8,Math.min(20,Math.round(w/32))), rows=Math.max(6,Math.min(16,Math.round(h/32)));
    const mp=rsResidualMap(decID.data,w,h,cols,rows,true);        // max sobre canais (imagem arbitrária)
    hm.style.gridTemplateColumns='repeat('+cols+',1fr)';
    hm.innerHTML=mp.map(function(v){ const a=Math.min(v/0.22,1).toFixed(2); return '<span style="background:rgba(150,220,255,'+a+')"></span>'; }).join('');
    hm.dataset.built='1';
  }
  positionLeakOverlay();
  hm.classList.add('on'); btn.textContent=t('heatmapHide');
}

/* ---- overlay do mapa sobre a imagem gerada do Encoder (v2.28.1) ---- */
function positionEncOverlay(){
  const img=document.getElementById('enc-out-prev'), hm=document.getElementById('enc-heatmap');
  if(!img||!hm) return;
  if(!img.complete||!img.naturalWidth){ img.addEventListener('load',positionEncOverlay,{once:true}); return; }
  const bw=img.clientWidth, bh=img.clientHeight, nw=img.naturalWidth, nh=img.naturalHeight;
  const sc=Math.min(bw/nw, bh/nh)||1, dw=nw*sc, dh=nh*sc;
  hm.style.left=(img.offsetLeft+(bw-dw)/2)+'px'; hm.style.top=(img.offsetTop+(bh-dh)/2)+'px';
  hm.style.width=dw+'px'; hm.style.height=dh+'px';
}
function toggleEncOverlay(){
  const hm=document.getElementById('enc-heatmap'), btn=document.getElementById('btn-enc-heatmap');
  if(!hm||!btn||!encOutID) return;
  if(hm.classList.contains('on')){ hm.classList.remove('on'); btn.textContent=t('encMapShow'); return; }
  if(hm.dataset.built!=='1'){
    const w=encOutID.width, h=encOutID.height;
    const cols=Math.max(8,Math.min(20,Math.round(w/32))), rows=Math.max(6,Math.min(16,Math.round(h/32)));
    const mp=rsResidualMap(encOutID.data,w,h,cols,rows);
    hm.style.gridTemplateColumns='repeat('+cols+',1fr)';
    hm.innerHTML=mp.map(function(v){ const a=Math.min(v/0.22,1).toFixed(2); return '<span style="background:rgba(150,220,255,'+a+')"></span>'; }).join('');
    hm.dataset.built='1';
  }
  positionEncOverlay();
  hm.classList.add('on'); btn.textContent=t('encMapHide');
}

/* ---- Migração onclick -> addEventListener (v2.24.0) ----
   Reproduz exatamente o comportamento dos antigos atributos inline.
   Rodando aqui (fim do main.js, fim do <body>), todo o DOM estático já existe. */
(function wireEvents(){
  const on = (sel, ev, fn) => { const el = typeof sel==='string' ? document.querySelector(sel) : sel; if (el) el.addEventListener(ev, fn); };

  on('.tab.enc', 'click', () => switchTab('enc'));
  on('.tab.dec', 'click', () => switchTab('dec'));
  on('#settings-gear', 'click', (e) => toggleSettingsMenu(e));
  on('#settings-help', 'click', () => { showHelpModal(); closeSettingsMenu(); });
  on('#settings-changelog', 'click', () => { showChangelogModal(); closeSettingsMenu(); });
  on('#lang-en', 'click', () => setLang('en'));
  on('#lang-pt', 'click', () => setLang('pt'));

  // Overlays: fechar só ao clicar no fundo (event.target === o próprio overlay)
  on('#help-overlay', 'click', (e) => { if (e.target === e.currentTarget) hideHelpModal(); });
  on('#help-close-btn', 'click', () => hideHelpModal());
  on('#changelog-overlay', 'click', (e) => { if (e.target === e.currentTarget) hideChangelogModal(); });
  on('#changelog-close-btn', 'click', () => hideChangelogModal());

  // Accordion dos módulos forenses é gerado dinamicamente -> delegação no document.
  document.addEventListener('click', (e) => {
    const header = e.target.closest && e.target.closest('.module-header');
    if (header) {
      toggleAccordionItem(header);
      const item=header.parentElement, hm=item.querySelector('#leak-heatmap');
      if(hm && item.classList.contains('open') && !hm.classList.contains('on')) requestAnimationFrame(toggleLeakOverlay);
    }
  });

  // #22 — toggle do overlay de vazamento (módulo é dinâmico -> delegação no document)
  document.addEventListener('click', (e)=>{ if(e.target.closest && e.target.closest('.leak-toggle')) toggleLeakOverlay(); });
  document.addEventListener('click', (e)=>{ if(e.target.closest && e.target.closest('.enc-map-toggle')) toggleEncOverlay(); });
})();
