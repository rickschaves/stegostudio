function showHelpModal() {
  document.getElementById('help-overlay').classList.add('visible');
  // Comportamento exclusivo SEM flash de scroll: interceptamos o clique no
  // summary e controlamos open/close de forma síncrona — fechamos as outras
  // seções no mesmo frame em que abrimos a atual, evitando o instante em que
  // duas ficam abertas e a barra de rolagem pisca.
  const sections = document.querySelectorAll('#help-overlay .help-section');
  sections.forEach(sec => {
    if (!sec.dataset.exclusiveBound) {
      const summary = sec.querySelector('summary');
      if (summary) {
        summary.addEventListener('click', (e) => {
          e.preventDefault(); // impede o toggle nativo do <details>
          const willOpen = !sec.open;
          // Fecha todas antes de abrir a escolhida — tudo no mesmo frame
          sections.forEach(other => { other.open = false; });
          sec.open = willOpen;
        });
      }
      sec.dataset.exclusiveBound = '1';
    }
  });
}
function hideHelpModal() {
  document.getElementById('help-overlay').classList.remove('visible');
}

// ── Histórico de versões (janela local) ──
// O HTML standalone mantém somente as 10 releases públicas mais recentes.
// O histórico público completo vive em CHANGELOG.md no repositório GitHub; builds
// laboratoriais internas (como v2.43.22 durante O1) não entram nesta janela.
// Cada item: {t:'add'|'chg'|'fix', en:'...', pt:'...'}. Texto curto, pode usar <b>.
const CHANGELOG = [
  { ver:'v2.44.0', date:'2026-08-21', title:{en:'Smaller, faster core with wider STC distribution',pt:'Núcleo menor e mais rápido com STC mais distribuído'}, items:[
    {t:'chg', en:'<b>The single-file app is substantially smaller and large-image work uses less temporary memory.</b> HILL, JPEG/DCT analysis, compatible JPEG recovery and the optional leak map were tightened while preserving the offline single-file model and existing decoding paths.', pt:'<b>O aplicativo de arquivo único ficou substancialmente menor e o trabalho com imagens grandes usa menos memória temporária.</b> HILL, análise JPEG/DCT, recuperação JPEG compatível e o mapa de vazamento opcional foram enxugados preservando o modelo offline de arquivo único e os caminhos existentes de decodificação.'},
    {t:'chg', en:'<b>New lossless STC messages without an alternative layer spread eligible carriers across the remaining opaque image instead of concentrating them near one end.</b> Older sequential STC images remain readable; changing dimensions or transparency after encoding can invalidate the spread selection.', pt:'<b>Novas mensagens STC lossless sem camada alternativa espalham os carriers elegíveis pela região opaca restante da imagem, em vez de concentrá-los perto de uma extremidade.</b> Imagens STC sequenciais antigas continuam legíveis; alterar dimensões ou transparência depois do encode pode invalidar a seleção espalhada.'},
    {t:'add', en:'<b>Optional technical embedding-pressure details are available from the small information button beside Capacity.</b> The normal flow stays image → message → Hide message, and the extra metrics are not prepared until the panel is opened.', pt:'<b>Detalhes técnicos opcionais de pressão de embedding ficam disponíveis no pequeno botão de informação ao lado de Capacidade.</b> O fluxo normal continua imagem → mensagem → Ocultar mensagem, e as métricas extras só são preparadas quando o painel é aberto.'},
    {t:'chg', en:'<b>The standalone History window now keeps the 10 newest releases and links to the complete changelog.</b> Full history remains available without carrying the entire archive inside the runtime.', pt:'<b>A janela de Histórico do arquivo standalone agora mantém as 10 versões mais recentes e aponta para o changelog completo.</b> O histórico integral continua acessível sem carregar todo o arquivo dentro do runtime.'},
    {t:'fix', en:'<b>Mobile and large-image responsiveness use less retained memory and unnecessary work.</b> Decoder-to-Encoder swipe, result scrolling, long message-field scrolling and output cleanup were tightened without changing message or report formats.', pt:'<b>A responsividade no celular e com imagens grandes usa menos memória retida e evita trabalho desnecessário.</b> O swipe Decoder→Encoder, a rolagem dos resultados, a rolagem de mensagens longas e a limpeza das saídas foram ajustados sem mudar formatos de mensagem ou relatório.'},
  ]},
  { ver:'v2.43.21', date:'2026-08-19', title:{en:'Better mobile scrolling and accessible password feedback',pt:'Rolagem móvel melhor e feedback de senha acessível'}, items:[
    {t:'fix', en:'<b>On mobile, vertical scrolling can now start inside the recovered-message box and continue into the surrounding results panel when appropriate.</b> Long recovered messages keep their bounded internal scroll, while short messages no longer behave like a dead area for page movement.', pt:'<b>No celular, a rolagem vertical agora pode começar dentro do quadro da mensagem recuperada e continuar no painel de resultados ao redor quando apropriado.</b> Mensagens longas continuam com rolagem interna limitada, enquanto mensagens curtas deixam de se comportar como uma área morta para mover a página.'},
    {t:'fix', en:'<b>Password feedback is now announced through a dedicated screen-reader status region.</b> The temporary visual hint keeps its existing timing, while expiration or language refresh does not announce the default hint again.', pt:'<b>O feedback de senha agora é anunciado por uma região de status dedicada para leitores de tela.</b> O aviso visual temporário mantém a duração existente, enquanto a expiração ou atualização de idioma não anuncia novamente a dica padrão.'},
  ]},
  { ver:'v2.43.20', date:'2026-08-19', title:{en:'More readable JPEG password feedback',pt:'Feedback de senha JPEG mais legível'}, items:[
    {t:'fix', en:'<b>The inconclusive JPEG password notice now remains visible for eight seconds.</b> The longer window improves readability without changing the diagnosis: a failed password attempt can still mean either an incorrect password or no compatible protected JPEG payload.', pt:'<b>O aviso inconclusivo de senha em JPEG agora permanece visível por oito segundos.</b> A janela maior melhora a leitura sem mudar o diagnóstico: uma tentativa sem recuperação ainda pode significar senha incorreta ou ausência de payload JPEG protegido compatível.'},
  ]},
  { ver:'v2.43.19', date:'2026-08-19', title:{en:'Honest JPEG password feedback',pt:'Feedback honesto de senha em JPEG'}, items:[
    {t:'fix', en:'<b>JPEG analysis now gives explicit feedback when a supplied password opens no compatible payload.</b> Because the robust JPEG slot plan itself depends on the password, the tool does not falsely claim that the password is definitely wrong; it says the password may be incorrect or the image may not contain a supported protected payload, while confirmed tool/damage states keep their specific diagnosis.', pt:'<b>A análise de JPEG agora dá feedback explícito quando a senha informada não abre nenhum payload compatível.</b> Como o próprio plano de posições do JPEG resistente depende da senha, a ferramenta não afirma falsamente que a senha está definitivamente errada; informa que ela pode estar incorreta ou que a imagem pode não conter um payload protegido compatível, enquanto estados confirmados de ferramenta/dano mantêm seu diagnóstico específico.'},
  ]},
  { ver:'v2.43.18', date:'2026-08-18', title:{en:'Browser-enforced offline boundary',pt:'Barreira offline imposta pelo navegador'}, items:[
    {t:'add', en:'<b>The single-file build now carries a restrictive Content Security Policy.</b> Script-initiated network connections are blocked by the browser, executable inline scripts are pinned to build-time SHA-256 hashes, and frames, objects, workers and form submissions are disabled while the local blob/data resources needed by the tool remain available.', pt:'<b>O arquivo único agora leva uma Content Security Policy restritiva.</b> Conexões de rede iniciadas por scripts são bloqueadas pelo navegador, os scripts inline executáveis ficam presos a hashes SHA-256 calculados no build e frames, objetos, workers e envio de formulários são desativados, mantendo disponíveis apenas os recursos locais blob/data necessários à ferramenta.'},
    {t:'chg', en:'<b>The CSP is defense in depth, not a replacement for sanitization or the build-time offline allowlist.</b> Argon2 WebAssembly is allowed through the narrower wasm-only execution permission; general JavaScript eval remains blocked.', pt:'<b>A CSP é defesa em profundidade, não substitui sanitização nem a allowlist offline do build.</b> O WebAssembly do Argon2 é permitido pela autorização mais estreita específica para WASM; avaliação dinâmica geral de JavaScript continua bloqueada.'},
  ]},
  { ver:'v2.43.17', date:'2026-08-18', title:{en:'Guidance aligned with current behavior',pt:'Orientação alinhada ao comportamento atual'}, items:[
    {t:'chg', en:'<b>The top ticker, both Quick Guides and How it works now describe the same current boundaries.</b> The sturdier JPG is presented as a conditional second output calibrated to measured publication workflows, not as a universal social-platform guarantee; the optional alternative message is correctly described as PNG-only.', pt:'<b>O ticker do topo, os dois Guias rápidos e o Como funciona agora descrevem os mesmos limites atuais.</b> O JPG resistente aparece como segunda saída condicional calibrada para fluxos de publicação medidos, não como garantia universal para redes sociais; a mensagem alternativa opcional é descrita corretamente como exclusiva do PNG.'},
    {t:'chg', en:'<b>Format, password and recovery guidance is more precise.</b> Inputs are limited by what the browser can decode, HEIC/HEIF is treated as browser-dependent, third-party coverage follows the documented container/cipher/mode limits, and direct confirmed recovery remains distinct from heuristic evidence.', pt:'<b>As orientações sobre formatos, senha e recuperação ficaram mais precisas.</b> A entrada depende do que o navegador consegue decodificar, HEIC/HEIF é tratado como dependente do navegador, a cobertura de terceiros segue os limites documentados de contêiner/cifra/modo e recuperação direta confirmada continua separada de evidência heurística.'},
    {t:'chg', en:'<b>The LSB and protection explanations now match the actual paths used by the Encoder.</b> STC/HILL, sequential LSB Matching and adaptive writes are described as different strategies instead of attributing one write method to the whole product.', pt:'<b>As explicações de LSB e proteção agora correspondem aos caminhos reais usados pelo Encoder.</b> STC/HILL, LSB Matching sequencial e escrita adaptativa são descritos como estratégias diferentes, em vez de atribuir um único método de escrita ao produto inteiro.'},
  ]},
  { ver:'v2.43.16', date:'2026-08-18', title:{en:'Cleaner Encoder output heading',pt:'Cabeçalho de saída do Encoder mais limpo'}, items:[
    {t:'chg', en:'<b>The Encoder output now uses GENERATED IMAGE with the same visual hierarchy as the Analyzer/Decoder RESULT heading.</b> The redundant // prefix was removed from the main heading while the amber processing-time label keeps its technical marker.', pt:'<b>A saída do Encoder agora usa IMAGEM GERADA com a mesma hierarquia visual do RESULTADO no Analyzer/Decoder.</b> O prefixo // redundante saiu do título principal, enquanto o tempo de processamento em âmbar mantém seu marcador técnico.'},
  ]},
  { ver:'v2.43.15', date:'2026-08-18', title:{en:'Consistent confirmed recovery',pt:'Recuperação confirmada consistente'}, items:[
    {t:'fix', en:'<b>Direct structured legacy recovery now shows 100 / CONFIRMED consistently instead of 100 / HIGH.</b> Processing-time values also keep the seconds unit in lowercase.', pt:'<b>A recuperação direta estruturada de formatos legados agora mostra 100 / CONFIRMADO de forma consistente, em vez de 100 / ALTO.</b> Os valores de tempo de processamento também mantêm a unidade de segundos em minúsculo.'},
  ]},
  { ver:'v2.43.14', date:'2026-08-18', title:{en:'Structured legacy LSB recovery',pt:'Recuperação estruturada de LSB legado'}, items:[
    {t:'fix', en:'<b>Recognized JOI_LSB and Steg/v1 messages are now parsed by their declared framing instead of relying only on deep-scan text cleanup.</b> A complete structured recovery can reach 100 / CONFIRMED; header-like or heuristic text without valid framing remains below the terminal state.', pt:'<b>Mensagens reconhecidas JOI_LSB e Steg/v1 agora são lidas pelo framing declarado em vez de depender apenas da limpeza de texto da investigação profunda.</b> Uma recuperação estruturada completa pode chegar a 100 / CONFIRMADO; texto heurístico ou apenas semelhante a header sem framing válido permanece abaixo do estado terminal.'},
  ]},
  { ver:'v2.43.13', date:'2026-08-18', title:{en:'Visible processing time',pt:'Tempo de processamento visível'}, items:[
    {t:'add', en:'<b>Encoder and Analyzer/Decoder now show the total processing time directly beside the result heading.</b> The value is measured locally for the current operation only and is not embedded in the image or exported in the forensic report.', pt:'<b>Encoder e Analyzer/Decoder agora mostram o tempo total de processamento diretamente ao lado do título do resultado.</b> O valor é medido apenas localmente para a operação atual e não é gravado na imagem nem exportado no relatório forense.'},
  ]},

];

function renderChangelog() {
  const tagLabel = { add:t('clTagAdded'), chg:t('clTagChanged'), fix:t('clTagFixed') };
  const renderEntry = (entry, legacy) => {
    const items = entry.items.map(it =>
      `<li class="cl-li"><span class="cl-tag ${it.t}">${tagLabel[it.t]}</span><span>${LANG==='pt'?it.pt:it.en}</span></li>`
    ).join('');
    return `<div class="cl-entry">
      <div class="cl-head"><span class="cl-ver">${entry.ver}${legacy?' — Legacy':''}</span><span class="cl-date">${entry.date}</span>
      <span class="cl-title">${LANG==='pt'?entry.title.pt:entry.title.en}</span></div>
      <ul class="cl-list">${items}</ul>
    </div>`;
  };
  let html = CHANGELOG.map(e => renderEntry(e, false)).join('');
  html += `<div class="cl-full-history"><a class="cl-full-history-link" href="https://github.com/rickschaves/stegostudio/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">${t('clFullHistory')} ↗</a><span class="cl-full-history-note">${t('clFullHistoryOnline')}</span></div>`;
  document.getElementById('changelog-content').innerHTML = html;
}
function showChangelogModal() {
  renderChangelog();
  document.getElementById('changelog-overlay').classList.add('visible');
}
function hideChangelogModal() {
  document.getElementById('changelog-overlay').classList.remove('visible');
}

function showAboutModal() {
  document.getElementById('about-overlay').classList.add('visible');
}
function hideAboutModal() {
  document.getElementById('about-overlay').classList.remove('visible');
}

// ── Menu de configurações (engrenagem) ──
function toggleSettingsMenu(e) {
  if (e) e.stopPropagation();
  const dd = document.getElementById('settings-dropdown');
  const gear = document.getElementById('settings-gear');
  const isOpen = dd.classList.toggle('open');
  gear.classList.toggle('open', isOpen);
}
function closeSettingsMenu() {
  const dd = document.getElementById('settings-dropdown');
  const gear = document.getElementById('settings-gear');
  if (dd) dd.classList.remove('open');
  if (gear) gear.classList.remove('open');
}


// ── QoL de teclado: ENTER aciona a ação primária do campo de senha ──
// Mantém exatamente o mesmo gate do botão: se ele estiver disabled/aria-disabled,
// ENTER não faz nada. `isComposing`/keyCode 229 evita disparar no meio de IME e
// `repeat` impede múltiplos cliques ao segurar a tecla. Campos de mensagem são
// textarea e NÃO entram aqui — ENTER continua criando nova linha normalmente.
function bindEnterToEnabledAction(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (!input || !button) return;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat || e.isComposing || e.keyCode === 229) return;
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    button.click();
  });
}
bindEnterToEnabledAction('enc-key', 'btn-encode');
bindEnterToEnabledAction('enc-decoy-key', 'btn-encode');
bindEnterToEnabledAction('dec-key', 'btn-analyze');
// Fecha ao clicar fora do menu
document.addEventListener('click', (e) => {
  const menu = document.querySelector('.settings-menu');
  if (menu && !menu.contains(e.target)) closeSettingsMenu();
});

function showModal(icon, title, msg, warn, onConfirm) {
  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-msg').textContent = msg;
  document.getElementById('modal-warn').textContent = warn;
  // Botões traduzidos (estavam fixos em PT no HTML)
  document.getElementById('modal-cancel').textContent = t('modalCancel');
  document.getElementById('modal-confirm').textContent = t('modalConfirm');
  document.getElementById('modal-overlay').classList.add('visible');
  modalCallback = onConfirm;
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('visible');
  modalCallback = null;
});

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('visible');
  if (modalCallback) { modalCallback(); modalCallback = null; }
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('visible');
    modalCallback = null;
  }
});

// ── LIMPAR ENCODE ──
document.getElementById('btn-clear-enc').addEventListener('click', () => {
  const hasOutput = document.getElementById('enc-dl').classList.contains('visible');
  showModal(
    '🗑️',
    t('dlgClearEncoderTitle'),
    t('dlgClearEncoderBody'),
    hasOutput
      ? t('dlgClearEncoderWarn')
      : t('dlgClearEncoderSafe'),
    () => {
      encID = null; encW = 0; encH = 0; encFormatOk = false;
      document.getElementById('enc-prev').src = '';
      document.getElementById('enc-pw').style.display = 'none';
      document.getElementById('enc-hint').style.display = 'flex';
      document.getElementById('enc-msg').value = '';
      document.getElementById('enc-key').value = '';
      const mc=document.getElementById('enc-maxcap'); if(mc){ mc.checked=false; mc.disabled=false; }
      encMaxcapManual=false;
      const mn=document.getElementById('enc-mode-note'); if(mn) mn.style.display='none';
      const an=document.getElementById('enc-alpha-note'); if(an) an.style.display='none';
      const ct=document.getElementById('enc-cover-tip'); if(ct) ct.style.display='none';
      if (typeof resetCarrierPreflight === 'function') resetCarrierPreflight();
      document.getElementById('enc-file').value = '';
      resetEncOutputs();   // mesma limpeza usada ao clicar em codificar
      resetStatus('enc-status');
      document.getElementById('cap-used').textContent = '0';
      document.getElementById('cap-total').textContent = '—';
      document.getElementById('cap-fill').style.width = '0%';
      document.getElementById('enc-fill-warn').style.display = 'none';
      if (typeof hideEmbeddingPressure === 'function') hideEmbeddingPressure();
      document.getElementById('enc-key-warn').style.display = 'none';
      document.getElementById('enc-pw-strength').style.display = 'none';
      document.getElementById('enc-key-hint').style.display = 'block';
      // reset dos campos da isca (negação plausível)
      const dt=document.getElementById('enc-decoy-toggle'); if(dt) dt.checked=false;
      const df=document.getElementById('enc-decoy-fields'); if(df) df.style.display='none';
      const dh=document.getElementById('enc-decoy-hint'); if(dh) dh.style.display='none';
      const dm=document.getElementById('enc-decoy-msg'); if(dm) dm.value='';
      const dk=document.getElementById('enc-decoy-key'); if(dk) dk.value='';
      const dw=document.getElementById('enc-decoy-samekey-warn'); if(dw) dw.style.display='none';
      const dnm=document.getElementById('enc-decoy-needmsg-warn'); if(dnm) dnm.style.display='none';
      const dnk=document.getElementById('enc-decoy-needkey-warn'); if(dnk) dnk.style.display='none';
      const ds=document.getElementById('enc-decoy-pw-strength'); if(ds) ds.style.display='none';
      const dkc=document.getElementById('enc-decoy-key-clear'); if(dkc) dkc.style.display='none';
      checkEncReady(false);
    }
  );
});

// ── NEGAÇÃO PLAUSÍVEL: toggle da segunda mensagem (isca) ──
(() => {
  const toggle = document.getElementById('enc-decoy-toggle');
  if (!toggle) return;
  const fields = document.getElementById('enc-decoy-fields');
  const hint = document.getElementById('enc-decoy-hint');
  const decoyKey = document.getElementById('enc-decoy-key');
  const decoyMsg = document.getElementById('enc-decoy-msg');
  const decoyKeyClear = document.getElementById('enc-decoy-key-clear');
  const sameWarn = document.getElementById('enc-decoy-samekey-warn');

  toggle.addEventListener('change', () => {
    const on = toggle.checked;
    if (fields) fields.style.display = on ? 'block' : 'none';
    if (hint) hint.style.display = on ? 'block' : 'none';
    if (typeof updateCap === 'function') updateCap(); // recalcula capacidade (soma/tira a isca)
    if (typeof checkEncReady === 'function') checkEncReady(); // re-avalia o gate do botão
  });

  // Aviso em tempo real se a senha da isca == senha real (precisam diferir).
  const checkSameKey = () => {
    const realKey = document.getElementById('enc-key')?.value || '';
    const dKey = decoyKey?.value || '';
    if (sameWarn) sameWarn.style.display = (dKey.length > 0 && dKey === realKey) ? 'block' : 'none';
    if (decoyKeyClear) decoyKeyClear.style.display = dKey.length > 0 ? 'block' : 'none';
  };
  if (decoyKey) decoyKey.addEventListener('input', () => {
    checkSameKey();
    if (typeof updateDecoyPwStrength === 'function') updateDecoyPwStrength();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
  document.getElementById('enc-key')?.addEventListener('input', () => {
    checkSameKey();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
  if (decoyKeyClear) decoyKeyClear.addEventListener('click', () => {
    if (decoyKey) decoyKey.value = '';
    checkSameKey();
    if (typeof updateDecoyPwStrength === 'function') updateDecoyPwStrength();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
  // A isca conta para a capacidade usada e afeta o gate do botão.
  if (decoyMsg) decoyMsg.addEventListener('input', () => {
    if (typeof updateCap === 'function') updateCap();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
})();

// ── LIMPAR ANALYZER ──
document.getElementById('btn-clear-dec').addEventListener('click', () => {
  const hasResults = document.getElementById('results-area').classList.contains('visible');
  showModal(
    '🗑️',
    t('dlgClearAnalysisTitle'),
    t('dlgClearAnalysisBody'),
    hasResults
      ? t('dlgClearAnalysisWarn')
      : t('dlgClearAnalysisSafe'),
    () => {
      bumpAnalysisGeneration();   // limpar também invalida análise em voo
      decID = null; decFile = null; decFmt = null; lastReport = null; lastRenderArgs = null;
      if(typeof lastRecoveredFile!=='undefined') lastRecoveredFile=null;
      document.getElementById('dec-prev').src = '';
      document.getElementById('dec-pw').style.display = 'none';
      document.getElementById('dec-hint').style.display = 'flex';
      document.getElementById('dec-file').value = '';
      const dk = document.getElementById('dec-key');
      dk.value = ''; clearKeyFlash();
      resetStatus('dec-status');
      document.getElementById('results-area').classList.remove('visible');
      document.getElementById('export-wrap').classList.remove('visible');
      clearProcessingTime('dec-processing-time');
      document.getElementById('dec-placeholder').style.display = 'block';
      document.getElementById('modules-wrap').textContent = '';
      document.getElementById('decoded-box').classList.remove('visible');
      document.getElementById('threat-num').textContent = '—';
      document.getElementById('threat-level').textContent = '—';
      document.getElementById('threat-flags').textContent = '';
      ['orig-foto','orig-screen','orig-art','orig-synth'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.textContent='—';
      });
      ['orig-foto-bar','orig-screen-bar','orig-art-bar','orig-synth-bar'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.style.height='0%';
      });
      document.querySelectorAll('.origin-cell.top').forEach(c=>c.classList.remove('top'));
      checkDecReady(false);
    }
  );
});
let tabSwitchGeneration = 0;
let mobileSwipeAbortForTabSwitch = null;
function switchTab(t, options) {
  options = options || {};
  // Navegação explícita vence imediatamente qualquer preview/settle de swipe.
  // O commit interno do próprio swipe passa fromSwipe para não cancelar a si mesmo.
  if (!options.fromSwipe && typeof mobileSwipeAbortForTabSwitch === 'function') {
    mobileSwipeAbortForTabSwitch();
  }
  tabSwitchGeneration++;
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(e => e.classList.remove('active'));
  document.querySelector('.tab.'+t).classList.add('active');
  document.getElementById('panel-'+t).classList.add('active');
  document.getElementById('paste-anchor').focus({preventScroll:true});

  // Trocar de aba é somente navegação: o terminal mantém exatamente o estado
  // que já tinha. Reiniciar a digitação aqui causava re-renderizações repetidas do terminal e
  // trabalho desnecessário justamente durante swipes repetidos no celular.
}


// ── Swipe móvel interativo entre as duas áreas principais ──────────────────
// No mobile, o painel acompanha o dedo. A troca só vira estado real quando o
// gesto é concluído; se o usuário recuar ou soltar cedo, ambos os painéis
// retornam às posições de origem. O scroll vertical continua nativo até a
// intenção horizontal ficar clara; só então o touchmove é bloqueado para que
// o painel permaneça fisicamente preso ao dedo.
const MOBILE_TAB_SWIPE = Object.freeze({
  maxWidth: 700,
  edge: 32,
  lockX: 8,
  dominance: 1.20,
  verticalCancel: 12,
  minCommitX: 85,
  commitRatio: 0.28,
  maxCommitX: 180,
  flickMinX: 55,
  flickVelocity: 0.45, // px/ms — gesto curto e rápido, estilo feed/galeria
  settleMs: 210,
  clickSuppressX: 14,
});

function mobileSwipeBlockedTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  // O gesto deve poder nascer sobre quase todo o painel. Bloqueamos somente
  // superfícies cujo próprio gesto horizontal precisa vencer (slider/edição ativa)
  // ou um controle nativo que abre UI do sistema. Tap sem arrasto continua normal.
  if (target.closest('input[type="range"], select, option, [contenteditable]:not([contenteditable="false"])')) return true;
  const editable = target.closest('input:not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
  return !!(editable && document.activeElement === editable);
}

function mobileSwipeDirection(tab) {
  if (tab === 'enc') return -1;
  if (tab === 'dec') return 1;
  return 0;
}

function evaluateMobileSwipeMotion(startX, startY, x, y, startTab, viewportWidth, locked, cancelled) {
  if (cancelled || !Number.isFinite(viewportWidth) || viewportWidth <= 0 || viewportWidth > MOBILE_TAB_SWIPE.maxWidth) {
    return {state:'cancelled', offsetX:0};
  }
  if (startX <= MOBILE_TAB_SWIPE.edge || startX >= viewportWidth - MOBILE_TAB_SWIPE.edge) {
    return {state:'cancelled', offsetX:0};
  }
  const direction = mobileSwipeDirection(startTab);
  if (!direction) return {state:'cancelled', offsetX:0};

  const dx = x - startX;
  const dy = y - startY;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (!locked) {
    if (ay >= MOBILE_TAB_SWIPE.verticalCancel && ay > ax) return {state:'cancelled', offsetX:0};
    if (ax < MOBILE_TAB_SWIPE.lockX || ax < ay * MOBILE_TAB_SWIPE.dominance) return {state:'pending', offsetX:0};
    // Não há wrap: mover inicialmente para o lado sem aba vizinha não bloqueia
    // o scroll nem o gesto; o usuário ainda pode voltar e cruzar a origem.
    if (Math.sign(dx) !== direction) return {state:'pending', offsetX:0};
  }

  let offsetX = dx;
  if (direction < 0) offsetX = Math.min(0, dx);
  else offsetX = Math.max(0, dx);
  offsetX = Math.max(-viewportWidth, Math.min(viewportWidth, offsetX));
  return {state:'locked', offsetX};
}

function shouldCommitMobileSwipe(offsetX, panelWidth, elapsedMs=Infinity) {
  if (!Number.isFinite(panelWidth) || panelWidth <= 0) return false;
  const distance = Math.abs(offsetX);
  const threshold = Math.min(
    MOBILE_TAB_SWIPE.maxCommitX,
    Math.max(MOBILE_TAB_SWIPE.minCommitX, panelWidth * MOBILE_TAB_SWIPE.commitRatio)
  );
  if (distance >= threshold) return true;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return false;
  return distance >= MOBILE_TAB_SWIPE.flickMinX &&
         (distance / elapsedMs) >= MOBILE_TAB_SWIPE.flickVelocity;
}

function bindMobileTabSwipe() {
  const panels = Array.from(document.querySelectorAll('.panel'));
  if (panels.length < 2) return;
  let gesture = null;
  let settling = false;
  let settlingGesture = null;
  let settleTimer = null;

  function activeTabName() {
    const active = document.querySelector('.tab.active');
    if (!active) return null;
    if (active.classList.contains('enc')) return 'enc';
    if (active.classList.contains('dec')) return 'dec';
    return null;
  }

  function panelFor(tab) { return document.getElementById('panel-'+tab); }
  function otherTab(tab) { return tab === 'enc' ? 'dec' : 'enc'; }
  function viewportWidth() {
    return (window.visualViewport && window.visualViewport.width) ||
           document.documentElement.clientWidth || window.innerWidth || 0;
  }
  function raf(fn) { return typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(fn) : fn(); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clearPreviewPanel(panel) {
    if (!panel) return;
    panel.classList.remove('swipe-preview','swipe-animating');
    panel.style.transform = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.zIndex = '';
    panel.style.pointerEvents = '';
    panel.style.transitionDuration = '';
    if (panel.dataset.swipeAriaHidden === 'absent') panel.removeAttribute('aria-hidden');
    else if (panel.dataset.swipeAriaHidden != null) panel.setAttribute('aria-hidden', panel.dataset.swipeAriaHidden);
    delete panel.dataset.swipeAriaHidden;
  }

  function clearCurrentPanel(panel) {
    if (!panel) return;
    panel.classList.remove('swipe-current','swipe-animating');
    panel.style.transform = '';
    panel.style.willChange = '';
    panel.style.transitionDuration = '';
  }

  function cleanupPanels(g) {
    if (!g) return;
    clearCurrentPanel(g.currentPanel);
    clearPreviewPanel(g.nextPanel);
    document.documentElement.classList.remove('mobile-swipe-active');
    document.body.classList.remove('mobile-swipe-active');
  }

  function preparePanels(g) {
    if (g.prepared) return true;
    const current = g.currentPanel || panelFor(g.tab);
    const next = panelFor(g.nextTab);
    if (!current || !next) return false;
    const rect = current.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    g.currentPanel = current;
    g.nextPanel = next;
    g.panelWidth = rect.width;
    g.prepared = true;

    current.classList.add('swipe-current');
    current.style.willChange = 'transform';
    document.documentElement.classList.add('mobile-swipe-active');
    document.body.classList.add('mobile-swipe-active');

    next.dataset.swipeAriaHidden = next.hasAttribute('aria-hidden') ? (next.getAttribute('aria-hidden') || '') : 'absent';
    next.setAttribute('aria-hidden','true');
    next.classList.add('swipe-preview');
    next.style.top = rect.top+'px';
    next.style.left = rect.left+'px';
    next.style.width = rect.width+'px';
    next.style.height = rect.height+'px';
    next.style.zIndex = '20';
    next.style.pointerEvents = 'none';

    const offscreen = -g.direction * g.panelWidth;
    current.style.transform = 'translate3d(0,0,0)';
    next.style.transform = `translate3d(${offscreen}px,0,0)`;
    return true;
  }

  function renderOffset(g, offsetX) {
    if (!g || !g.prepared) return;
    const clamped = g.direction < 0 ? Math.min(0, offsetX) : Math.max(0, offsetX);
    g.offsetX = Math.max(-g.panelWidth, Math.min(g.panelWidth, clamped));
    const nextX = g.offsetX - g.direction * g.panelWidth;
    g.currentPanel.style.transform = `translate3d(${g.offsetX}px,0,0)`;
    g.nextPanel.style.transform = `translate3d(${nextX}px,0,0)`;
  }

  function finishSettle(g, commit) {
    if (settlingGesture !== g) return;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    const validCommit = commit && tabSwitchGeneration === g.tabGeneration &&
      activeTabName() === g.tab && viewportWidth() === g.viewportWidth;
    if (validCommit) {
      // Faz o painel de destino virar o estado real ainda na posição final do
      // swipe e só devolve seu layout normal no frame seguinte. Isso evita
      // concentrar troca de classes + rasterização + reflow no mesmo frame final,
      // que era perceptível sobretudo ao sair do Analyzer pesado no Android.
      switchTab(g.nextTab, {fromSwipe:true});
      raf(() => {
        if (settlingGesture !== g) return;
        cleanupPanels(g);
        settlingGesture = null;
        settling = false;
      });
      return;
    }
    cleanupPanels(g);
    settlingGesture = null;
    settling = false;
  }

  function abortForExplicitTabSwitch() {
    const g = gesture || settlingGesture;
    gesture = null;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (g) cleanupPanels(g);
    settlingGesture = null;
    settling = false;
  }
  mobileSwipeAbortForTabSwitch = abortForExplicitTabSwitch;

  function settle(g, commit) {
    if (!g) return;
    if (!g.prepared) { gesture = null; return; }
    // Click suppression is armed once from touchend using the final horizontal
    // displacement. Keeping it there also covers wrong-direction drags and
    // avoids two independent guards for the same synthetic-click property.
    gesture = null;
    settling = true;
    settlingGesture = g;
    const duration = reducedMotion() ? 0 : MOBILE_TAB_SWIPE.settleMs;
    g.currentPanel.style.transitionDuration = duration+'ms';
    g.nextPanel.style.transitionDuration = duration+'ms';
    g.currentPanel.classList.add('swipe-animating');
    g.nextPanel.classList.add('swipe-animating');
    const targetCurrent = commit ? g.direction * g.panelWidth : 0;
    const targetNext = commit ? 0 : -g.direction * g.panelWidth;
    raf(() => {
      if (settlingGesture !== g) return;
      g.currentPanel.style.transform = `translate3d(${targetCurrent}px,0,0)`;
      g.nextPanel.style.transform = `translate3d(${targetNext}px,0,0)`;
      if (duration === 0) finishSettle(g, commit);
      else settleTimer = setTimeout(() => finishSettle(g, commit), duration + 40);
    });
  }

  function cancelGesture(animate=true) {
    const g = gesture;
    gesture = null;
    if (!g) return;
    if (g.prepared && animate) settle(g, false);
    else cleanupPanels(g);
  }

  function begin(e) {
    if (settling || !e.touches || e.touches.length !== 1 || mobileSwipeBlockedTarget(e.target)) { gesture = null; return; }
    const p = e.touches[0];
    const width = viewportWidth();
    const tab = activeTabName();
    if (!tab || width <= 0 || width > MOBILE_TAB_SWIPE.maxWidth ||
        p.clientX <= MOBILE_TAB_SWIPE.edge || p.clientX >= width - MOBILE_TAB_SWIPE.edge) {
      gesture = null;
      return;
    }
    gesture = {
      x:p.clientX, y:p.clientY, lastX:p.clientX, lastY:p.clientY,
      startTime:Number.isFinite(e.timeStamp) ? e.timeStamp : NaN,
      touchId:p.identifier, tab, nextTab:otherTab(tab), direction:mobileSwipeDirection(tab),
      viewportWidth:width, tabGeneration:tabSwitchGeneration,
      locked:false, cancelled:false, prepared:false, offsetX:0
    };
    // O painel do Analyzer pode estar muito mais pesado depois de uma análise.
    // No caminho de volta para o Encoder, damos ao compositor um frame para
    // promover a camada atual ANTES de o dedo cruzar o limiar do swipe. Não
    // montamos o preview ainda, portanto taps/scroll vertical continuam baratos.
    if (tab === 'dec') {
      const g = gesture;
      raf(() => {
        if (gesture !== g || g.locked || g.cancelled || settling) return;
        const current = panelFor(g.tab);
        if (!current) return;
        g.currentPanel = current;
        current.classList.add('swipe-current');
        current.style.willChange = 'transform';
        current.style.transform = 'translate3d(0,0,0)';
      });
    }
  }

  function move(e) {
    if (!gesture) return;
    if (!e.touches || e.touches.length !== 1) { cancelGesture(true); return; }
    const g = gesture;
    if (tabSwitchGeneration !== g.tabGeneration || activeTabName() !== g.tab || viewportWidth() !== g.viewportWidth) {
      cancelGesture(true); return;
    }
    const p = e.touches[0];
    if (p.identifier !== g.touchId) { cancelGesture(true); return; }
    g.lastX = p.clientX; g.lastY = p.clientY;
    const state = evaluateMobileSwipeMotion(g.x,g.y,p.clientX,p.clientY,g.tab,g.viewportWidth,g.locked,g.cancelled);
    if (state.state === 'cancelled') { g.cancelled = true; cancelGesture(true); return; }
    if (state.state !== 'locked') {
      // Movimento horizontal inequívoco para o lado sem aba vizinha não troca
      // painel, mas também não deve virar click sintético no controle de origem.
      // Cancelamos somente essa sequência horizontal; vertical continua nativo.
      const dx = p.clientX - g.x, dy = p.clientY - g.y;
      if (Math.abs(dx) >= MOBILE_TAB_SWIPE.lockX &&
          Math.abs(dx) >= Math.abs(dy) * MOBILE_TAB_SWIPE.dominance && e.cancelable) {
        e.preventDefault();
      }
      return;
    }
    if (!g.locked) {
      // Se o navegador já tornou o evento não-cancelável, ele assumiu a
      // sequência (normalmente scroll). Nesse caso não iniciamos um arrasto
      // visual tardio que poderia disputar a rolagem nativa.
      if (!e.cancelable) { cancelGesture(false); return; }
      g.locked = true;
      if (!preparePanels(g)) { cancelGesture(false); return; }
    }
    // Só depois da intenção horizontal estar inequívoca. Até aqui o scroll
    // vertical permaneceu 100% sob controle nativo do navegador.
    if (e.cancelable) e.preventDefault();
    renderOffset(g, state.offsetX);
  }

  function end(e) {
    if (!gesture) return;
    const g = gesture;
    if (tabSwitchGeneration !== g.tabGeneration || activeTabName() !== g.tab || viewportWidth() !== g.viewportWidth) {
      cancelGesture(true); return;
    }
    if (!e.changedTouches || e.changedTouches.length !== 1) { cancelGesture(true); return; }
    const p = e.changedTouches[0];
    if (p.identifier !== g.touchId) { cancelGesture(true); return; }
    g.lastX = p.clientX; g.lastY = p.clientY;
    // Sem janela temporal: o próprio gesto horizontal cancela somente o click
    // sintético desta sequência. Um tap seguinte fica disponível imediatamente.
    const endDx = p.clientX - g.x, endDy = p.clientY - g.y;
    if (Math.abs(endDx) >= MOBILE_TAB_SWIPE.clickSuppressX &&
        Math.abs(endDx) > Math.abs(endDy) && e.cancelable) {
      e.preventDefault();
    }

    // Sempre usamos a coordenada final real. O último touchmove pode ter sido
    // entregue antes de o dedo completar (ou desfazer) alguns pixels do gesto.
    const state = evaluateMobileSwipeMotion(g.x,g.y,p.clientX,p.clientY,g.tab,g.viewportWidth,g.locked,g.cancelled);
    if (state.state !== 'locked') { cancelGesture(g.prepared); return; }
    if (!g.locked) {
      if (!preparePanels(g)) { cancelGesture(false); return; }
      g.locked = true;
    }
    renderOffset(g, state.offsetX);
    const elapsedMs = Number.isFinite(e.timeStamp) && Number.isFinite(g.startTime)
      ? Math.max(1, e.timeStamp - g.startTime) : Infinity;
    const commit = shouldCommitMobileSwipe(g.offsetX, g.panelWidth, elapsedMs);
    settle(g, commit);
  }

  function cancel() { cancelGesture(true); }
  function onResize() {
    if (gesture && viewportWidth() !== gesture.viewportWidth) cancelGesture(true);
  }

  panels.forEach(panel => {
    panel.addEventListener('touchstart', begin, {passive:true});
    panel.addEventListener('touchmove', move, {passive:false});
    panel.addEventListener('touchend', end, {passive:false});
    panel.addEventListener('touchcancel', cancel, {passive:true});
  });
  window.addEventListener('resize', onResize, {passive:true});
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', onResize, {passive:true});
  }
}

