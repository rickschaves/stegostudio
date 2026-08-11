// ════════════════════════════════════════════════════════════════════════════
//  AVISOS DE CONTEÚDO — 100% offline
//
//  Extraído do antigo pro.js na v2.40.0. Apesar de morar lá, NADA aqui era
//  neural nem dependia de backend: os dois avisos operam sobre texto que a
//  própria ferramenta já extraiu, dentro do navegador. Ficaram no pro.js por
//  acidente histórico, e apagar aquele módulo inteiro teria levado junto a
//  detecção de stegomalware.
//
//  - renderAdversarialWarning: texto no arquivo que tenta manipular quem analisa.
//  - renderStegomalwareWarning: mensagem decodificada com cara de script/executável.
//
//  Os DETECTORES ficam em outros módulos (detectAdversarialContent em
//  forensics.js, detectStegomalware em decoder.js); aqui é só a apresentação.
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════
//  INTERRUPTOR DE CALIBRAÇÃO
//  true  = mostra o aviso "Ferramenta em calibração"
//  false = esconde o aviso (use quando a calibração estiver satisfatória)
// ════════════════════════════════════════
const CALIBRATION_MODE = true;

// Exibe o aviso de conteúdo adversarial: texto encontrado no arquivo que tem
// estrutura de manipulação do analista (instrução a IA, ou afirmação contra-
// forense). Separado da esteganografia — é categoria de segurança, não de
// mensagem oculta. Não soma ao threat; tem destaque visual próprio.
function renderAdversarialWarning(r) {
  const host = document.getElementById('adversarial-warning');
  if (!host) return;
  const items = r.strings?.adversarial || [];
  if (!items.length) { host.style.display = 'none'; return; }

  const rows = items.slice(0, 8).map(it => {
    const reason = t(it.reasonKey || 'advGeneric');
    const safe = escapeHTML(it.str);
    return `<div class="adv-item">
      <div class="adv-item-reason">${reason}</div>
      <div class="adv-item-str">"${safe}"</div>
    </div>`;
  }).join('');

  host.innerHTML = `
    <div class="adv-head">
      <span class="adv-icon">⚠</span>
      <span class="adv-title">${t('advWarningTitle')}</span>
    </div>
    <div class="adv-desc">${t('advWarningDesc')}</div>
    <div class="adv-list">${rows}</div>
  `;
  host.style.display = 'block';
}

// Exibe o alerta de STEGOMALWARE: a mensagem oculta decodificada tem padrões de
// script/executável. Separado do adversarial — aqui o conteúdo é potencialmente
// MALICIOSO (executável), não apenas manipulador. Soma ao threat (computeThreat).
function renderStegomalwareWarning(r) {
  const host = document.getElementById('stegomalware-warning');
  if (!host) return;
  const items = r.stegomalware || [];
  if (!items.length) { host.style.display = 'none'; return; }
  const sevLabel = s => s === 'crit' ? t('malwSevCrit') : t('malwSevWarn');
  const rows = items.slice(0, 8).map(it => `
    <div class="adv-item">
      <div class="adv-item-reason">[${sevLabel(it.sev)}] ${t(it.key)}</div>
      <div class="adv-item-str">"${escapeHTML(it.snippet)}"</div>
    </div>`).join('');
  host.innerHTML = `
    <div class="adv-head">
      <span class="adv-icon">☣</span>
      <span class="adv-title">${t('malwWarningTitle')}</span>
    </div>
    <div class="adv-desc">${t('malwWarningDesc')}</div>
    <div class="adv-list">${rows}</div>
  `;
  host.style.display = 'block';
}
