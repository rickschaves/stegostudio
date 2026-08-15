const termState = {};
// Guarda como redesenhar o conteúdo atual de cada terminal, para que a troca
// de idioma possa reaplicar o texto traduzido sem perder o estado lógico
// (boas-vindas, imagem carregada, análise completa, etc.)
const termRedraw = {};
function redrawTerminals() {
  Object.values(termRedraw).forEach(fn => { try { fn(); } catch(e){} });
}

// Escreve uma sequência de linhas no terminal com efeito de digitação.
// lines: array de {text, cls} — cls opcional ('ok','err','warn','info','prompt')
// A última linha fica com o cursor piscando colado ao texto.
function termWrite(id, lines, opts={}) {
  const el = document.getElementById(id);
  if (!el) return;

  // Cancela qualquer digitação em andamento neste terminal
  if (termState[id]?.timer) clearTimeout(termState[id].timer);

  const speed = opts.speed || 18; // ms por caractere
  termState[id] = { lines, timer:null };

  // Modo instantâneo: renderiza todas as linhas de uma vez, sem animação de
  // digitação. Usado na troca de idioma para reaplicar o texto traduzido.
  if (opts.instant) {
    const html = lines.map((line, i) => {
      const isLast = i === lines.length - 1;
      return lineToHTML(line, line.text, isLast);
    }).join('<br>');
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
    return;
  }

  // Renderiza linhas já completas + linha sendo digitada
  let lineIdx = 0;
  let charIdx = 0;
  let rendered = []; // linhas finalizadas (html)

  function lineToHTML(line, partialText, withCursor) {
    const clsList = [];
    if (line.cls) clsList.push(line.cls);
    if (line.pulse) clsList.push('term-pulse');
    const cls = clsList.length ? ` class="${clsList.join(' ')}"` : '';
    const prompt = line.prompt !== false ? '<span class="prompt">&gt;</span> ' : '';
    const cursor = withCursor ? '<span class="term-cursor"></span>' : '';
    return `<span${cls}>${prompt}${escapeHTML(partialText)}${cursor}</span>`;
  }

  function tick() {
    const line = lines[lineIdx];
    const full = line.text;
    charIdx++;
    const partial = full.slice(0, charIdx);

    // Monta o HTML: linhas prontas + linha atual em digitação
    const isLastLine = lineIdx === lines.length - 1;
    const lineDone = charIdx >= full.length;
    const cursorOnThis = lineDone ? isLastLine : true;

    const currentHTML = lineToHTML(line, partial, cursorOnThis);
    el.innerHTML = rendered.join('<br>') + (rendered.length ? '<br>' : '') + currentHTML;
    el.scrollTop = el.scrollHeight; // auto-scroll para o fim

    if (!lineDone) {
      termState[id].timer = setTimeout(tick, speed);
    } else {
      // Linha completa — fixa ela e passa para a próxima
      rendered.push(lineToHTML(line, full, false));
      lineIdx++;
      charIdx = 0;
      if (lineIdx < lines.length) {
        // Pequena pausa entre linhas (efeito ENTER)
        termState[id].timer = setTimeout(tick, opts.lineDelay || 280);
      } else {
        // Terminou tudo — re-renderiza com cursor na última linha
        el.innerHTML = rendered.slice(0,-1).join('<br>') +
          (rendered.length>1?'<br>':'') +
          lineToHTML(lines[lines.length-1], lines[lines.length-1].text, true);
      }
    }
  }
  tick();
}

// Escapa os 5 caracteres que mudam o sentido do HTML. As ASPAS importam tanto
// quanto os sinais de maior/menor: dado do arquivo também é interpolado DENTRO
// de atributos (class, style), e ali um `"` solto fecha o atributo e permite
// injetar outro — inclusive um handler de evento. Escapar só < e > deixaria
// esse caminho aberto.
function escapeHTML(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// setStatus compatível — uma única linha digitada
// Escreve UMA linha de status. Recebe TEXTO e classe — nunca HTML.
//
// Já foi `div.innerHTML = html` num nó solto, depois `DOMParser`, ambos só para
// extrair o texto de dentro de uma string. A revisão externa perguntou qual dos
// dois era melhor e a resposta foi: nenhum. Os três chamadores sempre passaram
// `<span class="ok|err">…</span>` — markup montado aqui mesmo, imediatamente
// desmontado ali. Dois deles interpolam `e.message`, que pode carregar conteúdo
// do arquivo analisado.
//
// Texto puro elimina a classe inteira de problema: não há parser, não há DOM
// intermediário, não há o que sanitizar.
function setStatus(id, text, cls) {
  termWrite(id, [{ text: String(text), cls: cls || null }]);
}

// Status "trabalhando" com AMPULHETA ANIMADA. O terminal digita texto puro e
// escapa HTML, então uma animação CSS não sobrevive aqui — animamos por TEXTO,
// alternando os dois glifos de ampulheta (⏳ areia caindo / ⌛ vazia) num timer,
// o que lê como uma ampulheta virando. Renderiza direto (sem efeito de digitação)
// para o glifo trocar no lugar. Retorna uma função para PARAR a animação.
function setStatusWorking(id, label, cls='info') {
  const el = document.getElementById(id);
  if (!el) return () => {};
  if (termState[id]?.timer) { clearTimeout(termState[id].timer); termState[id].timer = null; }
  const frames = ['\u23F3', '\u231B']; // ⏳ ⌛
  let f = 0;
  const draw = () => {
    // espaço entre a ampulheta e o texto; cursor piscando ao final
    const line = `<span class="${cls}"><span class="prompt">&gt;</span> ${frames[f]} ${escapeHTML(label)}<span class="term-cursor"></span></span>`;
    el.innerHTML = line;
    el.scrollTop = el.scrollHeight;
  };
  draw();
  const iv = setInterval(() => { f = (f + 1) % frames.length; draw(); }, 500);
  // registra para a troca de idioma não apagar sem parar o timer
  termRedraw[id] = draw;
  return () => { clearInterval(iv); if (termRedraw[id] === draw) delete termRedraw[id]; };
}

// Reseta o terminal para o estado de instrução inicial
function resetStatus(id, welcome=false) {
  if (id === 'enc-status') {
    const build = () => {
      const lines = [];
      if (welcome) lines.push({text:t('termWelcome'), cls:'ok'});
      lines.push({text:t('termWelcomeEnc'), cls:'info'});
      lines.push({text:t('termWaiting'), cls:'prompt'});
      return lines;
    };
    termRedraw['enc-status'] = () => termWrite('enc-status', build(), {instant:true});
    termWrite('enc-status', build());
  } else {
    const build = () => {
      const lines = [];
      lines.push({text:t('termWelcomeDec'), cls:'info'});
      lines.push({text:t('termWaiting'), cls:'prompt'});
      return lines;
    };
    termRedraw['dec-status'] = () => termWrite('dec-status', build(), {instant:true});
    termWrite('dec-status', build());
  }
}

// Sequência de status após carregar imagem no ENCODE
async function encStatusLoaded(fmt, w, h, size, file) {
  // #17: qualquer imagem decodificável serve como portadora — a saída é sempre um
  // PNG novo. Para entrada não-lossless, avisamos a conversão (sem bloquear).
  const willConvert = fmt.cat!=='lossless';

  // Análise rápida de metadados: detecta C2PA / EXIF de câmera que serão removidos
  let hasSignature = false, sigType = [];
  if (file) {
    try {
      const [exif, c2pa] = await Promise.all([
        parseEXIF(file).catch(()=>({hasCamera:false})),
        parseC2PA(file).catch(()=>({found:false,manifestDetected:false}))
      ]);
      if (c2pa?.found || c2pa?.manifestDetected) { hasSignature = true; sigType.push('C2PA'); }
      if (exif?.hasCamera || exif?.found) { hasSignature = true; sigType.push('EXIF'); }
    } catch(e) {}
  }

  const build = () => {
    const lines = [
      {text:`${t('termImageInserted')} — ${w}×${h} · ${fmtBytes(size)} · ${fmt.ext}`, cls:'ok'}
    ];
    if (willConvert) {
      lines.push({text:'⚠ '+t('termWillConvertPng').replace('{ext}', fmt.ext), cls:'warn', pulse:true});
    }
    if (hasSignature) {
      lines.push({text:'⚠ '+t('termMetaWarn').replace('{types}', sigType.join(' + ')), cls:'warn', pulse:true});
    }
    lines.push({text:t('termTypeMsg'), cls:'info'});
    lines.push({text:t('termWaiting'), cls:'prompt'});
    return lines;
  };
  termRedraw['enc-status'] = () => termWrite('enc-status', build(), {instant:true});
  termWrite('enc-status', build());
}

// Sequência de status após carregar imagem no DECODE
function decStatusLoaded(fmt, w, h, size) {
  const build = () => {
    const lines = [{text:`${t('termImageInserted')} — ${w}×${h} · ${fmtBytes(size)} · ${fmt.ext}`, cls:'ok'}];
    if (fmt.cat === 'lossless') {
      lines.push({text:t('termReadyAnalysis'), cls:'info'});
    } else if (fmt.ext === 'JPEG') {
      // JPEG: LSB espacial não se aplica, MAS temos análise DCT + Steghide + IA.
      lines.push({text:t('termJpegDCTReady'), cls:'info'});
    } else if (fmt.cat === 'lossy') {
      lines.push({text:t('termLsbUnavailable').replace('{ext}', fmt.ext), cls:'warn'});
    } else {
      lines.push({text:t('termPartial').replace('{ext}', fmt.ext), cls:'info'});
    }
    lines.push({text:t('termClickAnalyze'), cls:'info'});
    lines.push({text:t('termWaiting'), cls:'prompt'});
    return lines;
  };
  termRedraw['dec-status'] = () => termWrite('dec-status', build(), {instant:true});
  termWrite('dec-status', build());
}

// Destaca o campo de chave sem depender só de cor. O aviso usa três canais:
// contorno, ícone ⚠ e texto visível abaixo do campo. Um único timer é mantido;
// chamadas consecutivas reiniciam o período em vez de deixarem timers competindo.
let keyFlashTimer = null;
let keyFlashReason = null;
function clearKeyFlash() {
  if (keyFlashTimer !== null) { clearTimeout(keyFlashTimer); keyFlashTimer = null; }
  const k = document.getElementById('dec-key');
  const field = k?.closest('.key-field');
  const icon = field?.querySelector('.key-icon');
  const hint = document.getElementById('dec-key-hint');
  if (field) field.classList.remove('key-flash');
  if (icon) icon.textContent = '🔑';
  if (hint) hint.textContent = t('decKeyHint2');
  if (k) k.placeholder = t('keyPlaceholder');
  keyFlashReason = null;
}
function refreshKeyFlashText() {
  if (!keyFlashReason) return;
  const hint = document.getElementById('dec-key-hint');
  if (hint) hint.textContent = t(keyFlashReason === 'wrong' ? 'decKeyFlashWrong' : 'decKeyFlashMissing');
}
function flashKey(reason='missing') {
  clearKeyFlash();
  keyFlashReason = reason;
  const k = document.getElementById('dec-key');
  const field = k?.closest('.key-field');
  const icon = field?.querySelector('.key-icon');
  const hint = document.getElementById('dec-key-hint');
  if (!k || !field) return;
  field.classList.add('key-flash');
  if (icon) icon.textContent = '⚠';
  refreshKeyFlashText();
  if (!k.value) k.placeholder = '⚠ ' + t('keyPlaceholder');
  keyFlashTimer = setTimeout(clearKeyFlash, 5000);
}
// Verifica se bytes brutos têm ratio de ASCII puro (usado para LSB raw / extração genérica)
function printable(bytes) {
  let c=0; for (const b of bytes) if (b>=32&&b<127) c++;
  return bytes.length ? c/bytes.length : 0;
}

// Verifica se bytes formam texto legível ao humano após decodificação UTF-8
// Muito mais robusto que printable() para texto em português, espanhol, etc.
function isReadableText(bytes) {
  try {
    const str = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    // Conta caracteres que fazem sentido como texto: letras, números, pontuação, espaços
    // Inclui Unicode (letras acentuadas, emojis comuns, etc.)
    let readable = 0;
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      // Espaço, pontuação básica, ASCII legível
      if (cp >= 32 && cp < 127) { readable++; continue; }
      // Caracteres Unicode comuns (Latin Extended, acentos, etc.)
      if (cp >= 0xC0 && cp < 0x2000) { readable++; continue; }
      // Emojis e símbolos comuns
      if (cp >= 0x2000 && cp < 0x10000) { readable += 0.5; continue; }
    }
    return str.length > 0 ? readable / str.length : 0;
  } catch(e) {
    // UTF-8 inválido — certamente não é texto puro
    return 0;
  }
}

// ════════════════════════════════════════
//  CODEC PNG EM JS PURO (anti-farbling)
// ════════════════════════════════════════
// Lê/escreve os pixels SEM passar pelo canvas 2D. Navegadores com proteção
// anti-fingerprint (Brave Shields/farbling, Firefox resistFingerprinting,
// extensões) injetam ±1 de ruído no getImageData/toDataURL em páginas https,
// corrompendo LSBs e quebrando o AES-GCM. Decodificando o PNG direto dos bytes
// (inflate→RGBA) e remontando o PNG na mão (RGBA→deflate) o farbling é
// contornado por completo. Bônus: imune a gerenciamento de cor (ICC) e à
// premultiplicação de alfa do canvas.
