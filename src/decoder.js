// LEGADO: decoder do formato lossless anterior à F21. Continua sendo o probe
// barato/compatível e é tentado antes do caminho v3. Novos PNGs com senha usam
// extractLSBStudioV3() abaixo; sem senha, a escrita compatível continua neste formato.
function extractLSBStudio(imageData, password='') {
  const d = imageData.data;
  const hLen = HEADER_BYTES;
  const op = opaquePixels(d);              // mesma lista de opacos do embed
  if (op.length < hLen*8) return null;     // nem o header cabe nos opacos
  // Lê os bytes brutos do cabeçalho (primeiros headerBits pixels opacos, canal B)
  const rawHeader = new Uint8Array(hLen);
  for (let i = 0; i < hLen*8; i++) {
    const bit = d[op[i]*4+2] & 1;
    rawHeader[Math.floor(i/8)] |= bit << (7-(i%8));
  }

  // Tenta validar o header de dois jeitos:
  // 1) EM CLARO: o MAGIC bate diretamente (modo normal, não-furtivo).
  // 2) CIFRADO (modo furtivo): se há senha, decifra o header com o keystream da
  //    senha e checa o MAGIC. Se bater, é uma mensagem furtiva válida.
  let hBytes = null;
  let stealth = false;
  const magicOK = (bytes) => { for (let i=0;i<MAGIC.length;i++) if (bytes[i]!==MAGIC[i]) return false; return true; };

  if (magicOK(rawHeader)) {
    hBytes = rawHeader;
  } else if (password.length > 0) {
    const dec = xorHeader(rawHeader, password); // tenta decifrar (furtivo)
    if (magicOK(dec)) { hBytes = dec; stealth = true; }
  }
  if (!hBytes) {
    // Header não validou. Se SEM senha e o header bruto não bate, pode ser furtivo
    // (precisaria de senha) — mas não temos como saber com certeza; retornamos null
    // e o fluxo de deep scan / estatística assume daqui.
    return null;
  }

  const modeByte = hBytes[5];
  const shuffled = !!(modeByte & FLAG_SHUFFLED);
  const adaptive = !!(modeByte & FLAG_ADAPTIVE);
  const hillV2 = !!(modeByte & FLAG_HILLV2); // adaptativo: V2 canônico vs legado (retrocompat)
  const compressed = !!(modeByte & FLAG_COMPRESSED);
  const isStc = !!(modeByte & FLAG_STC);
  const mode = modeByte & ~(FLAG_SHUFFLED | FLAG_ADAPTIVE | FLAG_STEALTH | FLAG_COMPRESSED | FLAG_STC | FLAG_HILLV2); // modo puro
  if (mode !== MODE_B && mode !== MODE_RGB) return null;
  // Lê como uint32 sem sinal (>>> 0 evita len negativo em mensagens grandes)
  const len = (hBytes[6]|(hBytes[7]<<8)|(hBytes[8]<<16)|(hBytes[9]<<24)) >>> 0;
  if (len<=0||len>5_000_000) return null;
  const payload = new Uint8Array(len);
  payload.compressed = compressed; // anexa o flag para o decoder descomprimir
  // Metadado LOCAL (não exportado): em formatos legados/hostis a senha pode
  // participar do framing mesmo quando o corpo final é texto puro. Isso evita
  // afirmar "senha ignorada" quando ela foi necessária para desmascarar o
  // header furtivo ou reconstruir a ordem embaralhada do corpo.
  payload.stealth = stealth;
  payload.shuffled = shuffled;
  payload.passwordUsedForFraming = password.length > 0 && (stealth || shuffled);
  const headerBits = hLen*8;
  const bodyBits = len*8;

  // Se embaralhado mas sem senha, não há como remontar — sinaliza com retorno
  // especial para o chamador pedir a senha.
  if (shuffled && password.length === 0) return { needsPassword: true };

  // ── CORPO via STC: lê o w-byte (decifra se furtivo), reconstrói Ĥ
  //    e extrai por síndrome (independente de custo, sem recalcular HILL). ──
  if (isStc) {
    let rawW = 0;
    for (let i = 0; i < 8; i++) rawW = (rawW << 1) | (d[op[hLen*8 + i]*4+2] & 1);
    let stcW = rawW;
    if (stealth && password.length > 0) { const ks = headerKeystream(password, hLen + 1); stcW = rawW ^ ks[hLen]; }
    if (stcW < 1 || stcW > STC_WMAX) return null;
    const headBits2 = (hLen + 1) * 8;
    const n = bodyBits * stcW;
    if (op.length < headBits2 + n) return null;
    const Hhat = makeStcSubmatrix(STC_H, stcW);
    const y = new Uint8Array(n);
    for (let k = 0; k < n; k++) y[k] = d[op[headBits2 + k]*4+2] & 1;
    const m = stcExtract(y, bodyBits, STC_H, Hhat);
    for (let i = 0; i < bodyBits; i++) if (m[i]) payload[i >> 3] |= (1 << (7 - (i & 7)));
    return payload;
  }

  // order[k] = qual bit do corpo está na k-ésima posição física (mesma permutação do embed).
  const order = shuffled ? shuffledOrder(bodyBits, password) : null;

  // ── Modo ADAPTATIVO: recalcula o mesmo mapa de custo HILL sobre a imagem-estego
  // (alterar LSBs quase não muda o custo, que depende dos bits significativos),
  // encontra os mesmos pixels de menor custo, e lê dali. ──
  if (adaptive) {
    const w = imageData.width, h = imageData.height;
    const cost = hillV2 ? hillCostMap(d, w, h) : hillCostMapLegacy(d, w, h);
    const orderPx = adaptiveOrder(cost, op.subarray(headerBits));
    for (let k = 0; k < bodyBits; k++) {
      if (k >= orderPx.length) break;
      const px = orderPx[k];
      const i = order ? order[k] : k;
      payload[Math.floor(i/8)] |= (d[px*4+2]&1) << (7-(i%8));
    }
    return payload;
  }

  if (mode === MODE_B) {
    for (let k = 0; k < bodyBits; k++) {
      const pxIdx = headerBits + k;
      if (pxIdx >= op.length) break;
      const px = op[pxIdx];
      const i = order ? order[k] : k;
      payload[Math.floor(i/8)] |= (d[px*4+2]&1) << (7-(i%8));
    }
  } else {
    for (let k = 0; k < bodyBits; k++) {
      const pxIdx = headerBits + Math.floor(k/3);
      if (pxIdx >= op.length) break;
      const px = op[pxIdx];
      const chan = k % 3;
      const i = order ? order[k] : k;
      payload[Math.floor(i/8)] |= (d[px*4+chan]&1) << (7-(i%8));
    }
  }
  return payload;
}


// ════════════════════════════════════════
//  F21 v3 — decoder PNG/lossless protegido por senha
// ════════════════════════════════════════
// A sonda v3 só roda quando o chamador já tem senha e o probe legado falhou.
// HMAC do header valida antes de bodyLen/mode/stcW influenciarem alocação ou loops.
async function extractLSBStudioV3(imageData, password='') {
  if (!password || password.length === 0) return null;
  const d = imageData.data;
  const op = opaquePixels(d);
  if (op.length < F21_PREFIX_CARRIER_PIXELS) return null;

  // O bootstrap físico não é uma faixa crua de bits: os 448 bits lógicos são
  // recuperados como síndrome de um STC fixo sobre a região canônica inicial.
  const yPrefix = new Uint8Array(F21_PREFIX_CARRIER_PIXELS);
  for (let k = 0; k < yPrefix.length; k++) yPrefix[k] = d[op[k]*4+2] & 1;
  const prefixBits = stcExtract(yPrefix, F21_PREFIX_BITS, STC_H,
    makeStcSubmatrix(STC_H, F21_BOOTSTRAP_STC_W, F21_BOOTSTRAP_STC_SEED));
  const prefix = new Uint8Array(F21_PREFIX_BYTES);
  for (let i = 0; i < F21_PREFIX_BITS; i++) if (prefixBits[i]) prefix[i >> 3] |= 1 << (7 - (i & 7));
  const salt = prefix.slice(0, F21_STRUCTURAL_SALT_BYTES);
  const maskedHeader = prefix.slice(F21_STRUCTURAL_SALT_BYTES);
  const opened = await f21OpenHeader(salt, maskedHeader, password, op.length);
  if (!opened) return null;

  const h = opened.parsed;
  const modeByte = h.modeFlags;
  const shuffled = !!(modeByte & FLAG_SHUFFLED);
  const adaptive = !!(modeByte & FLAG_ADAPTIVE);
  const compressed = !!(modeByte & FLAG_COMPRESSED);
  const isStc = !!(modeByte & FLAG_STC);
  const mode = modeByte & ~(FLAG_SHUFFLED | FLAG_ADAPTIVE | FLAG_STEALTH |
                           FLAG_COMPRESSED | FLAG_STC | FLAG_HILLV2);
  const bodyBits = h.bodyLen * 8;
  const body = new Uint8Array(h.bodyLen);

  if (isStc) {
    const n = bodyBits * h.stcW;
    const Hhat = makeStcSubmatrix(STC_H, h.stcW);
    const y = new Uint8Array(n);
    for (let k = 0; k < n; k++) y[k] = d[op[F21_PREFIX_CARRIER_PIXELS + k]*4+2] & 1;
    const m = stcExtract(y, bodyBits, STC_H, Hhat);
    for (let i = 0; i < bodyBits; i++) if (m[i]) body[i >> 3] |= 1 << (7 - (i & 7));
  } else {
    // Todo v3 não-STC usa body-order; o validador do header rejeita a combinação
    // sem FLAG_SHUFFLED antes de chegarmos aqui.
    if (!shuffled) return null;
    // Mesma permutação byte-granular do encoder: reduz o pico de memória sem
    // mudar a fronteira criptográfica (o corpo já é AES-GCM ciphertext).
    const byteOrder = await f21ShuffledOrder(h.bodyLen, opened.bodyOrderKey);
    if (adaptive) {
      const cost = hillCostMap(d, imageData.width, imageData.height);
      const orderPx = adaptiveOrder(cost, op.subarray(F21_PREFIX_CARRIER_PIXELS));
      if (bodyBits > orderPx.length) return null;
      for (let k = 0; k < bodyBits; k++) {
        const outByte = k >> 3, bitInByte = k & 7;
        const dstByte = byteOrder[outByte];
        body[dstByte] |= (d[orderPx[k]*4+2] & 1) << (7 - bitInByte);
      }
    } else if (mode === MODE_B) {
      for (let k = 0; k < bodyBits; k++) {
        const outByte = k >> 3, bitInByte = k & 7;
        const dstByte = byteOrder[outByte];
        body[dstByte] |= (d[op[F21_PREFIX_CARRIER_PIXELS + k]*4+2] & 1) << (7 - bitInByte);
      }
    } else if (mode === MODE_RGB) {
      for (let k = 0; k < bodyBits; k++) {
        const outByte = k >> 3, bitInByte = k & 7;
        const dstByte = byteOrder[outByte];
        const px = op[F21_PREFIX_CARRIER_PIXELS + Math.floor(k/3)];
        body[dstByte] |= (d[px*4 + (k % 3)] & 1) << (7 - bitInByte);
      }
    } else return null;
  }

  try {
    const plainBytes = await f21DecryptOpenedBody(body, opened);
    return { v3:true, headerMatched:true, bodyAuthenticated:true, compressed,
      plainBytes, modeFlags:modeByte, stcW:h.stcW, bodyLen:h.bodyLen };
  } catch (_) {
    // Header válido + corpo GCM inválido é evidência estrutural real, mas não
    // mensagem recuperada. O chamador mantém essa distinção no relatório/UI.
    return { v3:true, headerMatched:true, bodyAuthenticated:false, compressed,
      plainBytes:null, modeFlags:modeByte, stcW:h.stcW, bodyLen:h.bodyLen };
  }
}

// ════════════════════════════════════════
//  NEGAÇÃO PLAUSÍVEL — extração da mensagem alternativa
//  Sonda a âncora fixa no FIM do pool de pixels opacos. Lê o bloco-len (32 bytes
//  fixos: iv+GCM(len)+tag), valida pela TAG do GCM. Se validar, lê o bloco-msg.
//  Retorna a string da isca, ou null (sem isca ali / senha não é da isca). Nunca
//  lança — a falha de autenticação É o sinal de "não é esta camada". Chamada
//  SEMPRE que há senha (não depende de flag: marcar a isca vazaria sua
//  existência). Assíncrona (usa Argon2id + AES-GCM).
// ════════════════════════════════════════
async function extractDecoyTail(imageData, password) {
  if (!password || password.length === 0) return null;
  const d = imageData.data;
  const op = opaquePixels(d);
  const BLOCK_LEN_BYTES = 12 + 4 + 16; // iv + GCM(uint32) + tag = 32

  if (op.length < BLOCK_LEN_BYTES * 8) return null;

  // Lê o bloco-len na âncora do fim (do último opaco para trás).
  const readTail = (nBytes, bitOffset) => {
    const out = new Uint8Array(nBytes);
    for (let i = 0; i < nBytes * 8; i++) {
      const px = op[op.length - 1 - (bitOffset + i)];
      out[i >> 3] |= (d[px * 4 + 2] & 1) << (7 - (i & 7));
    }
    return out;
  };

  const blockLen = readTail(BLOCK_LEN_BYTES, 0);
  const lenPlain = await decoyGcmDecrypt(blockLen, password);
  if (!lenPlain || lenPlain.length !== 4) return null; // tag inválida → sem isca
  const len = new DataView(lenPlain.buffer, lenPlain.byteOffset).getUint32(0, false);
  if (len <= 0 || len > op.length / 8) return null;
  // Bloco-msg logo "acima" do bloco-len: iv(12) + ct(len) + tag(16).
  const blockMsgLen = 12 + len + 16;
  if (op.length < (BLOCK_LEN_BYTES + blockMsgLen) * 8) return null;
  const blockMsg = readTail(blockMsgLen, BLOCK_LEN_BYTES * 8);
  const plain = await decoyGcmDecrypt(blockMsg, password);
  if (!plain) return null;
  return new TextDecoder('utf-8', { fatal: false }).decode(plain);
}
// ════════════════════════════════════════
//  DETECTORES ESTATÍSTICOS DE LSB REPLACEMENT
//  RS/WS exploram assimetrias introduzidas por replacement. Não detectam LSBM
//  de forma equivalente, porque matching evita a estrutura que esses testes medem.
// ════════════════════════════════════════

// RS Attack (Regular–Singular), Fridrich et al. 2001.
// Estima a taxa de embedding de LSBR analisando como a "suavidade" de grupos
// de pixels muda sob duas funções de flipping (F1 e máscara invertida).
// Retorna a taxa estimada de mensagem [0..1] para um canal. ~0 = limpo.
function rsAttack(data, channelOffset, width, height) {
  // Função discriminante: variação absoluta entre pixels vizinhos do grupo
  const groupSize = 4;
  // F1: flip LSB (0<->1, 2<->3, ...) ; F-1: flip "shifted" (1<->2, 3<->4, ...)
  const flip = (v) => v ^ 1;
  const flipNeg = (v) => ((v + 1) ^ 1) - 1;
  const px = (i) => data[i*4 + channelOffset];

  function smoothness(vals) {
    let s = 0;
    for (let k = 1; k < vals.length; k++) s += Math.abs(vals[k] - vals[k-1]);
    return s;
  }

  // Máscara fixa [0,1,1,0] aplicada a cada grupo de 4 pixels
  const mask = [0,1,1,0];
  let Rm=0, Sm=0, Rnm=0, Snm=0; // Regular/Singular para máscara e máscara negada
  const totalPx = width*height;
  const groups = Math.floor(totalPx / groupSize);

  for (let g = 0; g < groups; g++) {
    const base = g*groupSize;
    const vals = [px(base), px(base+1), px(base+2), px(base+3)];

    const f0 = smoothness(vals);

    // Aplica flipping conforme a máscara (positiva)
    const fm = vals.map((v,k) => mask[k]===1 ? flip(v) : v);
    const f1 = smoothness(fm);
    // Aplica flipping conforme a máscara negada
    const fnm = vals.map((v,k) => mask[k]===1 ? flipNeg(v) : v);
    const f1n = smoothness(fnm);

    if (f1 > f0) Rm++; else if (f1 < f0) Sm++;
    if (f1n > f0) Rnm++; else if (f1n < f0) Snm++;
  }

  // Estimativa simplificada da taxa: divergência entre grupos Regular/Singular
  // das máscaras positiva e negada. Em imagem limpa, Rm≈Rnm e Sm≈Snm.
  // Sob LSBR, surge uma assimetria proporcional ao payload.
  const totalGroups = groups || 1;
  const d1 = Math.abs(Rm - Sm) / totalGroups;
  const d2 = Math.abs(Rnm - Snm) / totalGroups;
  const asymmetry = Math.abs(d2 - d1);
  // Normaliza para uma estimativa aproximada de taxa de embedding
  return Math.min(asymmetry * 2, 1);
}

// WS Attack (Weighted Stego), Fridrich & Goljan 2004 (versão simplificada).
// Estima a taxa de embedding comparando cada pixel com a média dos vizinhos:
// sob LSBR, os LSBs tornam-se descorrelacionados da estrutura local da imagem.
// Retorna estimativa [0..1] para um canal. ~0 = limpo.
function wsAttack(data, channelOffset, width, height) {
  const px = (x,y) => data[(y*width + x)*4 + channelOffset];
  let num = 0, den = 0;
  for (let y = 1; y < height-1; y++) {
    for (let x = 1; x < width-1; x++) {
      const c = px(x,y);
      // Média dos 4 vizinhos como predição do valor "cover"
      const pred = (px(x-1,y) + px(x+1,y) + px(x,y-1) + px(x,y+1)) / 4;
      // Valor com LSB invertido
      const flipped = c ^ 1;
      // Peso: correlação local (quanto mais suave a região, mais confiável)
      const w = 1;
      num += w * (c - pred) * (c - flipped);
      den += w * (c - flipped) * (c - flipped);
    }
  }
  if (den === 0) return 0;
  // A taxa de embedding estimada é ~2× o coeficiente de regressão
  const beta = num / den;
  return Math.min(Math.max(Math.abs(beta) * 2, 0), 1);
}

// ════════════════════════════════════════
//  HEURÍSTICA DE EMBEDDING NEURAL (SteganoGAN-like)
//  Métodos baseados em GAN (ex.: SteganoGAN) NÃO escondem dados nos LSBs de um
//  único canal — eles espalham perturbações sutis de alta frequência pelos TRÊS
//  canais simultaneamente, de forma quase uniforme. Isso deixa duas marcas:
//   (1) o plano LSB de R, G e B tem entropia alta e MUITO parecida entre canais;
//   (2) a energia de alta frequência (resíduo vs. vizinhos) é elevada e também
//       muito parecida entre os canais.
//  Imagens naturais quase nunca têm os três canais tão simétricos.
//  IMPORTANTE: sem o modelo neural original isto é uma SUSPEITA estatística, não
//  uma prova. Serve para levantar a hipótese, jamais para afirmar com certeza.
// ---- Avaliação de furtividade da saída do Encoder ----
// Roda o arsenal estatístico na PRÓPRIA saída do encoder e devolve o veredito,
// usando OS MESMOS limiares do Analyzer (runForensics) para nunca discordar dele:
// RS>0.15 = detectável (confiável), >0.08 = sinal fraco, abaixo = indistinguível.
// WS é gated por textura do cover (chapado → WS não confiável), igual ao forense.
function analyzeOutputStealth(data, width, height) {
  const rs = Math.max(rsAttack(data,0,width,height), rsAttack(data,1,width,height), rsAttack(data,2,width,height));
  const ws = Math.max(wsAttack(data,0,width,height), wsAttack(data,1,width,height), wsAttack(data,2,width,height));
  const wsReliable = !isLowTextureCover(data);
  const rsDetect = rs > 0.15, rsSoft = rs > 0.08, wsDetect = ws > 0.15 && wsReliable;
  let verdict;
  if (rsDetect || wsDetect) verdict = 'detect';
  else if (rsSoft)          verdict = 'weak';
  else                      verdict = 'clean';
  return { rs, ws, wsReliable, verdict };
}

// ---- Mapa de resíduos: RS por célula da grade (canal azul, o padrão furtivo).
// Localiza ONDE o sinal RS é mais forte — o "onde vazou". Reaproveita rsAttack.
function rsResidualMap(data, w, h, cols, rows, allCh) {
  const map = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c*w/cols), x1 = Math.floor((c+1)*w/cols);
      const y0 = Math.floor(r*h/rows), y1 = Math.floor((r+1)*h/rows);
      const cw = x1-x0, ch = y1-y0;
      if (cw < 4 || ch < 4) { map.push(0); continue; }
      const cell = new Uint8ClampedArray(cw*ch*4);
      for (let y = y0; y < y1; y++) {
        const srow = (y*w + x0)*4;
        cell.set(data.subarray(srow, srow + cw*4), (y-y0)*cw*4);
      }
      const rv = allCh
        ? Math.max(rsAttack(cell,0,cw,ch), rsAttack(cell,1,cw,ch), rsAttack(cell,2,cw,ch))
        : rsAttack(cell, 2, cw, ch);
      map.push(Math.max(0, rv));
    }
  }
  return map;
}

function neuralStegoHeuristic(data, width, height) {
  const channels = [0,1,2];
  const lsbEntropy = [];   // entropia do plano LSB por canal
  const hfEnergy = [];     // energia de alta frequência por canal

  for (const ch of channels) {
    // (1) Entropia do plano LSB: conta proporção de 1s; entropia binária de Shannon.
    let ones = 0, n = 0;
    for (let i = 0; i < width*height; i++) {
      ones += data[i*4+ch] & 1; n++;
    }
    const p = n ? ones/n : 0.5;
    const H = (p<=0||p>=1) ? 0 : -(p*Math.log2(p) + (1-p)*Math.log2(1-p));
    lsbEntropy.push(H);

    // (2) Energia de alta frequência: |valor - média dos 4 vizinhos|, normalizada.
    let acc = 0, cnt = 0;
    const px = (x,y) => data[(y*width+x)*4+ch];
    const step = Math.max(1, Math.floor(Math.sqrt((width*height)/40000))); // amostra
    for (let y = 1; y < height-1; y += step) {
      for (let x = 1; x < width-1; x += step) {
        const pred = (px(x-1,y)+px(x+1,y)+px(x,y-1)+px(x,y+1))/4;
        acc += Math.abs(px(x,y) - pred); cnt++;
      }
    }
    hfEnergy.push(cnt ? acc/cnt : 0);
  }

  // Similaridade entre canais: 1 = idênticos, 0 = muito diferentes.
  const spread = (a) => { const mx=Math.max(...a), mn=Math.min(...a); return mx>0?(mx-mn)/mx:0; };
  const entSim = 1 - spread(lsbEntropy);
  const hfSim  = 1 - spread(hfEnergy);
  const minEnt = Math.min(...lsbEntropy); // todos os canais com LSB quase aleatório?
  const avgHF  = hfEnergy.reduce((a,b)=>a+b,0)/3;

  // Critérios (todos precisam apontar na mesma direção para levantar suspeita).
  // Limiares deliberadamente CONSERVADORES: como isto é uma suspeita exibida ao
  // usuário, preferimos errar para o lado de não acusar (falso negativo) a gerar
  // falsos positivos em fotos reais, cujos canais têm ruído correlacionado mas
  // raramente tão simétrico quanto o de um embedding neural.
  //  - LSB quase máximo nos três canais (entropia > 0.985)
  //  - entropias LSB quase idênticas entre canais (> 0.995)
  //  - energia de alta frequência quase idêntica entre canais (> 0.96)
  //  - energia HF não-trivial (embedding adiciona ruído; imagem não é chapada)
  const suspect = minEnt > 0.985 && entSim > 0.995 && hfSim > 0.96 && avgHF > 1.0;

  return {
    suspect,
    lsbEntropy: lsbEntropy.map(v=>v.toFixed(4)),
    entSim: (entSim*100).toFixed(1)+'%',
    hfSim: (hfSim*100).toFixed(1)+'%',
    avgHF: avgHF.toFixed(2)
  };
}

// Generic LSB extract — testa múltiplos modos e retorna o melhor
function extractLSBRaw(imageData, maxBytes) {
  const d = imageData.data;

  // Modo 1: canal B only (protocolo Studio v2)
  function extractB() {
    const out = new Uint8Array(maxBytes);
    for (let i = 0; i < maxBytes*8; i++) {
      const px = i*4+2; if (px>=d.length) break;
      out[Math.floor(i/8)] |= (d[px]&1) << (7-(i%8));
    }
    return out;
  }

  // Modo 2: RGB intercalado R→G→B por pixel (formato da v1 / JOI_LSB)
  function extractRGB() {
    const out = new Uint8Array(maxBytes);
    const channels = [0,1,2]; // R, G, B offsets
    for (let i = 0; i < maxBytes*8; i++) {
      const pixelIdx = Math.floor(i/3);
      const chanOff  = channels[i%3];
      const px = pixelIdx*4 + chanOff;
      if (px >= d.length) break;
      out[Math.floor(i/8)] |= (d[px]&1) << (7-(i%8));
    }
    return out;
  }

  // Modo 3: canal R only
  function extractR() {
    const out = new Uint8Array(maxBytes);
    for (let i = 0; i < maxBytes*8; i++) {
      const px = i*4; if (px>=d.length) break;
      out[Math.floor(i/8)] |= (d[px]&1) << (7-(i%8));
    }
    return out;
  }

  // Modo 4: canal G only
  function extractG() {
    const out = new Uint8Array(maxBytes);
    for (let i = 0; i < maxBytes*8; i++) {
      const px = i*4+1; if (px>=d.length) break;
      out[Math.floor(i/8)] |= (d[px]&1) << (7-(i%8));
    }
    return out;
  }

  const candidates = [
    {mode:'RGB intercalado', bytes: extractRGB()},
    {mode:'canal B',         bytes: extractB()},
    {mode:'canal R',         bytes: extractR()},
    {mode:'canal G',         bytes: extractG()},
  ];

  // INVESTIGADOR DE JANELA DESLIZANTE
  // Procura a maior sequência contígua de texto legível em cada modo,
  // ignorando header e lixo ao redor. Funciona com qualquer codificador.
  let best = null;
  for (const c of candidates) {
    const island = findTextIsland(c.bytes);
    c.printableRatio = printable(c.bytes);  // mantém compat com resto do código
    c.island = island;
    if (!best || island.score > best.island.score) best = c;
  }

  // Anexa a melhor ilha de texto encontrada como propriedade extra
  best.foundText = best.island.text;
  best.foundTextLength = best.island.length;
  // Identifica o header: bytes ASCII imediatamente antes da ilha de texto.
  // Muitas ferramentas escrevem um magic (ex: "JOI_LSB2", "STEGO") antes da mensagem.
  best.headerName = extractHeader(best.bytes, best.island.start);
  return best;
}

// Lê os bytes antes da ilha de texto e tenta identificar um magic header.
// Retorna a string do header (ex: "JOI_LSB2") ou null se não houver um reconhecível.
function extractHeader(bytes, islandStart) {
  if (!islandStart || islandStart <= 0 || islandStart > 64) return null;
  // Pega os bytes antes da mensagem e extrai a sequência ASCII inicial
  const pre = bytes.slice(0, islandStart);
  let header = '';
  for (let i = 0; i < pre.length; i++) {
    const b = pre[i];
    // ASCII permitido no token (letras, números, underscore) = parte do magic
    if ((b >= 48 && b <= 57) || (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 95) {
      header += String.fromCharCode(b);
    } else if (header.length > 0) {
      // Encontrou um byte não-ASCII após começar o header — fim do magic
      break;
    }
  }
  // Two different boundaries live here and must not be conflated:
  // 1) the accumulation loop above admits only [0-9A-Za-z_], constraining the token;
  // 2) this allowlist decides which constrained names count as protocol evidence.
  // Render safety does NOT depend on either guard: downstream HTML sinks escape
  // headerName independently. That separation lets F9 expand recognition later
  // without turning a parser change into a markup-injection regression.
  // An arbitrary alphanumeric prefix can still be exposed as text by the generic
  // investigator; it simply cannot gain protocol trust from an unknown name.
  if (/^(?:JOI_LSB\d?|STEGO|LSB|STEG)$/i.test(header)) return header;
  return null;
}

// Encontra a melhor região de texto legível num array de bytes.
// Coleta TODAS as ilhas de texto e escolhe a de maior score real,
// dando peso extra a ilhas próximas do início (onde codificadores colocam a mensagem).
function findTextIsland(bytes) {
  function isAsciiText(b){ return b===9||b===10||b===13||(b>=32&&b<127); }

  // Coleta ilhas de texto: ASCII imprimível OU sequências UTF-8 BEM-FORMADAS.
  // A validação de boa-formação é o que distingue um acento real (ex: "á" =
  // C3 A1, uma sequência válida) de lixo de bytes altos (ex: EF BF soltos, ou
  // um lead byte sem os continuation corretos). Sem isso: ou acentos quebram a
  // ilha (truncando mensagens PT/ES), ou lixo alto é fundido com texto real
  // (poluindo a ilha e fazendo o scoreIsland rejeitá-la). Validar UTF-8
  // resolve os dois casos.
  // Retorna o nº de bytes consumidos por uma sequência UTF-8 válida em pos i,
  // ou 0 se não houver sequência válida ali.
  function utf8Len(i){
    const b = bytes[i];
    if (b < 0x80) return 0; // ASCII tratado à parte
    if (b>=0xC2 && b<=0xDF){ // 2 bytes
      if (i+1<bytes.length && bytes[i+1]>=0x80 && bytes[i+1]<=0xBF) return 2;
    } else if (b>=0xE0 && b<=0xEF){ // 3 bytes
      if (i+2<bytes.length && bytes[i+1]>=0x80 && bytes[i+1]<=0xBF
          && bytes[i+2]>=0x80 && bytes[i+2]<=0xBF) return 3;
    } else if (b>=0xF0 && b<=0xF4){ // 4 bytes
      if (i+3<bytes.length && bytes[i+1]>=0x80 && bytes[i+1]<=0xBF
          && bytes[i+2]>=0x80 && bytes[i+2]<=0xBF
          && bytes[i+3]>=0x80 && bytes[i+3]<=0xBF) return 4;
    }
    return 0;
  }

  // Coleta todas as ilhas de texto contíguo (ASCII + UTF-8 válido).
  const islands = [];
  let curStart=0, curLen=0;
  let i=0;
  while (i<bytes.length){
    let step = 0;
    if (isAsciiText(bytes[i])) {
      step = 1;
    } else {
      step = utf8Len(i); // 0 se não for UTF-8 válido
    }
    if (step > 0) {
      if (curLen===0) curStart=i;
      curLen += step;
      i += step;
    } else {
      if (curLen>=6) islands.push({start:curStart,len:curLen});
      curLen=0;
      i += 1;
    }
  }
  if (curLen>=6) islands.push({start:curStart,len:curLen});

  if (islands.length===0) return {text:'',length:0,start:0,score:0};

  // Avalia cada ilha: extrai texto, mede densidade e entropia de caracteres
  function scoreIsland(isl) {
    const slice = bytes.slice(isl.start, isl.start+isl.len);
    let text = new TextDecoder('utf-8',{fatal:false}).decode(slice);
    text = text.replace(/[\x00-\x08\x0E-\x1F]/g,'').trim();
    let readable=0;
    for (const ch of text){ const cp=ch.codePointAt(0); if((cp>=32&&cp<127)||(cp>=0xA0&&cp<0x2000)) readable++; }
    const density = text.length ? readable/text.length : 0;
    let charEntropy=0;
    if (text.length>=4){
      const chars={};
      for (const ch of text) chars[ch]=(chars[ch]||0)+1;
      for (const c of Object.values(chars)){ const p=c/text.length; charEntropy-=p*Math.log2(p); }
    }
    // Texto real: densidade alta E entropia de caracteres ≥2.8 bits
    const isReal = density>=0.75 && charEntropy>=2.8;
    return { text, readable, density, charEntropy, score: isReal ? readable : 0 };
  }

  let best = {text:'', length:0, start:0, score:0};
  for (const isl of islands) {
    const s = scoreIsland(isl);
    if (s.score > best.score) {
      best = {text:s.text, length:s.readable, start:isl.start, score:s.score, charEntropy:s.charEntropy};
    }
  }
  return best;
}


// ════════════════════════════════════════
//  CARRIER PREFLIGHT
// ════════════════════════════════════════
// Lightweight, password-free check used by the Encoder before writing a new
// payload. It looks only for obvious remnants that can be recognized without
// trusting a full forensic verdict: a visible native header or a coherent text
// island in common pixel-LSB layouts. A negative result is not evidence that a
// carrier is free of hidden data.
function inspectCarrierPreflight(imageData, fmt) {
  const cat = typeof fmt === 'string' ? fmt : fmt?.cat;
  if (!imageData?.data || cat !== 'lossless') {
    return { checked:false, suspicious:false, signals:[] };
  }

  const d = imageData.data;
  const rawHeader = new Uint8Array(HEADER_BYTES);
  let bit = 0;
  for (let p = 0; p < d.length / 4 && bit < HEADER_BYTES * 8; p++) {
    if (d[p*4+3] !== 255) continue;
    rawHeader[bit >> 3] |= (d[p*4+2] & 1) << (7 - (bit & 7));
    bit++;
  }

  if (bit === HEADER_BYTES * 8) {
    let magic = true;
    for (let i = 0; i < MAGIC.length; i++) {
      if (rawHeader[i] !== MAGIC[i]) { magic = false; break; }
    }
    if (magic) {
      const modeByte = rawHeader[5];
      const mode = modeByte & ~(FLAG_SHUFFLED | FLAG_ADAPTIVE | FLAG_STEALTH |
                                FLAG_COMPRESSED | FLAG_STC | FLAG_HILLV2);
      const len = (rawHeader[6] | (rawHeader[7] << 8) |
                  (rawHeader[8] << 16) | (rawHeader[9] << 24)) >>> 0;
      if ((mode === MODE_B || mode === MODE_RGB) && len > 0 && len <= 5_000_000) {
        return { checked:true, suspicious:true, signals:['native-header'] };
      }
    }
  }

  const total = imageData.width * imageData.height;
  const maxBytes = Math.min(Math.floor(total / 8), 8000);
  if (maxBytes < 12) return { checked:true, suspicious:false, signals:[] };

  const raw = extractLSBRaw(imageData, maxBytes);
  if (raw?.foundText && raw.foundTextLength >= 12) {
    return { checked:true, suspicious:true, signals:['readable-lsb-text'] };
  }

  return { checked:true, suspicious:false, signals:[] };
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function fmtBytes(b) {
  if (b<1024) return b+' B';
  if (b<1048576) return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(2)+' MB';
}

// ── CLASSIFICAÇÃO DE FORMATO ──────────────────────────────────────────
// lossless : LSB preservado, análise completa
// lossy    : LSB destruído por compressão DCT/VP8/HEVC
// palette  : cores indexadas, LSB distorcido por quantização
// magicBytes: opcional — os primeiros bytes do arquivo. Quando fornecido, a
//   detecção por assinatura tem PRECEDÊNCIA sobre extensão/MIME (mais robusto:
//   pega .jfif, .jpe, arquivos sem extensão, MIME errado do browser, etc.).
function classifyFormat(file, magicBytes) {
  const ext = file.name.split('.').pop().toLowerCase();
  const mime = file.type;

  // ── detecção por magic bytes (precedência) ──
  if (magicBytes && magicBytes.length >= 12) {
    const b = magicBytes;
    // JPEG: FF D8 FF  (cobre jpg, jpeg, jfif, jpe, exif, etc.)
    if (b[0]===0xFF && b[1]===0xD8 && b[2]===0xFF)
      return {cat:'lossy', ext:'JPEG', encOk:false,
        msg:'JPEG uses lossy DCT compression — pixel LSBs are not preserved. DCT coefficient analysis, strings and metadata remain available.'};
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47)
      return {cat:'lossless', ext:'PNG', encOk:true};
    // BMP: 42 4D
    if (b[0]===0x42 && b[1]===0x4D)
      return {cat:'lossless', ext:'BMP', encOk:true};
    // GIF: 47 49 46 38
    if (b[0]===0x47 && b[1]===0x49 && b[2]===0x46 && b[3]===0x38)
      return {cat:'palette', ext:'GIF', encOk:false,
        msg:'GIF uses an indexed-color palette — pixel LSBs are altered by quantization, so LSB analysis is not reliable.'};
    // TIFF: 49 49 2A 00  ou  4D 4D 00 2A
    if ((b[0]===0x49 && b[1]===0x49 && b[2]===0x2A) || (b[0]===0x4D && b[1]===0x4D && b[2]===0x00))
      return {cat:'lossless', ext:'TIFF', encOk:true};
    // WEBP: RIFF....WEBP
    if (b[0]===0x52 && b[1]===0x49 && b[2]===0x46 && b[3]===0x46 && b[8]===0x57 && b[9]===0x45 && b[10]===0x42 && b[11]===0x50) {
      // VP8L = lossless, VP8 (space) = lossy, VP8X = extended
      const c = b[15];
      if (c===0x4C) return {cat:'lossless', ext:'WEBP', encOk:true, webp:true}; // VP8L
      return {cat:'lossy', ext:'WEBP lossy', encOk:false,
        msg:'Lossy WebP uses VP8 compression — pixel LSBs are not preserved.'};
    }
    // HEIC/AVIF: ....ftyp + marca
    if (b[4]===0x66 && b[5]===0x74 && b[6]===0x79 && b[7]===0x70)
      return {cat:'lossy', ext:'HEIC/AVIF', encOk:false,
        msg:'HEIF/AVIF (ftyp) uses lossy HEVC/AV1 compression — pixel LSBs are not preserved. Forensic coverage is partial.'};
  }

  // ── fallback por MIME/extensão (quando não há magic) ──
  if (['image/png','image/bmp','image/tiff'].includes(mime) ||
      ['png','bmp','tiff','tif'].includes(ext))
    return {cat:'lossless', ext:ext.toUpperCase(), encOk:true};
  if (mime==='image/webp' || ext==='webp') {
    return {cat:'lossless', ext:'WEBP', encOk:true, webp:true};
  }
  // JPEG por MIME ou por QUALQUER extensão comum de JPEG (inclui jfif, jpe)
  if (['image/jpeg','image/jpg'].includes(mime) || ['jpg','jpeg','jfif','jpe','jif','jfi'].includes(ext))
    return {cat:'lossy', ext:'JPEG', encOk:false,
      msg:'JPEG uses lossy DCT compression — pixel LSBs are not preserved. DCT coefficient analysis, strings and metadata remain available.'};
  if (['image/avif','image/heic','image/heif'].includes(mime) || ['avif','heic','heif'].includes(ext))
    return {cat:'lossy', ext:ext.toUpperCase(), encOk:false,
      msg:`${ext.toUpperCase()} uses lossy AV1/HEVC compression — pixel LSBs are not preserved. Forensic coverage is partial.`};
  if (mime==='image/gif' || ext==='gif')
    return {cat:'palette', ext:'GIF', encOk:false,
      msg:'GIF uses an indexed-color palette — pixel LSBs are altered by quantization, so LSB analysis is not reliable.'};
  // Fallback: trata como lossless para não bloquear
  return {cat:'lossless', ext:ext.toUpperCase(), encOk:false};
}

// Strings de estrutura interna de JPEG — tabelas Huffman, marcadores, etc.
// Presença dessas strings é normal e não indica esteganografia
const JPEG_INTERNAL_PATTERNS = [
  /^[%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz]+$/,
  /^[\s!-~]{0,4}(JFIF|Exif|Adobe|ICC_PROFILE|XMP|photoshop|http:\/\/ns\.adobe)/i,
  /^(ACD Systems|GIMP|Photoshop|Lightroom|Camera|Canon|Nikon|Sony|Samsung|Apple|Google)/i,
];
function isJpegInternalString(s) {
  return JPEG_INTERNAL_PATTERNS.some(rx => rx.test(s));
}

// ════════════════════════════════════════
//  DETECÇÃO DE CONTEÚDO ADVERSARIAL (camada aditiva)
//  Filosofia: NÃO usa lista de frases conhecidas (que ficaria presa ao que
//  conhece). Em vez disso, identifica ESTRUTURAS de manipulação dirigida a
//  quem analisa a imagem — instruções imperativas a um leitor/IA, referências
//  ao próprio ato de analisar, e afirmações contra-forenses (negação de
//  conteúdo oculto). Por ser estrutural, pega variações que uma lista perderia.
//  Aditivo: recebe as strings já extraídas e devolve as que têm essas marcas,
//  com o MOTIVO estrutural. Não altera nada do que o sistema já captura.
// ════════════════════════════════════════
function detectAdversarialContent(strings, isLossy) {
  // Cada teste retorna uma chave de motivo (i18n) se a ESTRUTURA casar.
  // São padrões gerais, não frases fechadas.
  const structuralTests = [
    // Instrução dirigida a um leitor/IA: verbo imperativo comum de comando +
    // referência a responder/dizer/ignorar/seguir. Pega "answer exactly with",
    // "respond with", "say that", "ignore previous", "disregard the", etc.
    { key:'advInstruction',
      rx:/\b(answer|respond|reply|say|write|output|print|repeat|ignore|disregard|forget|follow|obey|comply)\b[\s\S]{0,40}\b(exactly|with|that|this|the following|previous|above|below|instruction|prompt|rule|sentence|hidden|secret)\b/i },
    // Instrução em português equivalente
    { key:'advInstruction',
      rx:/\b(responda|diga|escreva|imprima|repita|ignore|desconsidere|esqueça|siga|obedeça)\b[\s\S]{0,40}\b(exatamente|com|que|isto|isso|a seguir|anterior|acima|abaixo|instrução|oculta|secreta|frase)\b/i },
    // Referência ao ato de analisar (meta-instrução ao analista/IA):
    // "when analyzing", "if you are reading", "as an AI", "you must", etc.
    { key:'advMetaAnalysis',
      rx:/\b(when|while|if you('?re| are)?|as an?|você está|quando (você )?(analisar|estiver))\b[\s\S]{0,30}\b(analy[sz]|reading|assistant|model|ler|analisar|lendo)\b/i },
    // Comando direto à 2ª pessoa: "you must", "your task is", "you should",
    // "você deve", "sua tarefa é"
    { key:'advDirectCommand',
      rx:/\b(you (must|should|will|need to|have to)|your (task|job|goal|role) is|você (deve|precisa|tem que)|sua (tarefa|função|missão) é)\b/i },
    // Afirmação contra-forense: NEGAÇÃO estrutural sobre conteúdo oculto/limpeza.
    // Pega "no hidden content", "nothing to see", "clean image", "nada oculto",
    // "sem esteganografia", "imagem limpa", e variações.
    { key:'advCounterForensic',
      rx:/\b(no|not|nothing|none|never|sem|nenhum[ao]?|nada|livre de)\b[\s\S]{0,30}\b(hidden|secret|steg|payload|embedded|content|suspicious|oculto|secreto|escondido|esteganografia|carga|suspeito|conteúdo)\b/i },
    { key:'advCounterForensic',
      rx:/\b(clean|safe|legitimate|harmless|innocent|normal|limpa?|seguro|legítim[ao]|inofensiv[ao])\b[\s\S]{0,20}\b(image|file|picture|photo|imagem|arquivo|foto)\b/i },
  ];

  const flagged = [];
  const seen = new Set();
  for (const s of strings) {
    if (isLossy && isJpegInternalString(s)) continue;
    if (s.length < 8) continue;            // textos muito curtos: pouco sinal
    // Precisa parecer linguagem natural (tem espaços/palavras), não blob binário
    const wordish = (s.match(/[A-Za-zÀ-ÿ]{3,}/g) || []).length;
    if (wordish < 2) continue;
    for (const test of structuralTests) {
      if (test.rx.test(s)) {
        const key = s.slice(0,300);
        if (!seen.has(key)) {
          seen.add(key);
          flagged.push({ str: s.slice(0,300), reasonKey: test.key });
        }
        break; // um motivo por string basta
      }
    }
  }
  return flagged;
}

// ════════════════════════════════════════
//  STEGOMALWARE — payload oculto parece script/executável
// ════════════════════════════════════════
// Roda SOBRE A MENSAGEM DECODIFICADA (conteúdo já extraído com sucesso), nunca
// sobre bytes brutos — por isso o risco de falso positivo é baixo: só dispara
// quando o que foi escondido tem cara de script/executável. Cada achado tem
// severidade 'crit' (execução/payload inequívoco) ou 'warn' (indicador suspeito).
const STEGOMALWARE_PATTERNS = [
  // ── Crítico: execução / download-and-execute / payload codificado ──
  { key:'malwPowershell', sev:'crit', rx:/-encodedcommand\b|frombase64string\s*\(|invoke-expression\b|\biex\s*\(|downloadstring\s*\(|\bpowershell(\.exe)?\b[\s\S]{0,60}(-enc\b|-e\s|-nop\b|-noprofile\b|-windowstyle\s+hidden|-w\s+hidden|-ep\s+bypass|bypass\b)/i },
  { key:'malwDownloadExec', sev:'crit', rx:/\b(curl|wget)\b[\s\S]{0,80}\|\s*(sh|bash|python|perl)\b|\b(sh|bash)\s+-c\b|\bchmod\s+\+x\b|\bcertutil\b[\s\S]{0,20}-urlcache/i },
  { key:'malwReverseShell', sev:'crit', rx:/\/dev\/tcp\/\d|\bnc\b\s+-[a-z]*e\b|\bncat\b[\s\S]{0,20}-e\b|\bbash\s+-i\b[\s\S]{0,12}>&|socket\.socket\([\s\S]{0,40}connect/i },
  { key:'malwJsEval', sev:'crit', rx:/\beval\s*\(\s*(atob|unescape|String\.fromCharCode|decodeURIComponent)|new\s+Function\s*\(\s*["'`]|document\.write\s*\(\s*unescape/i },
  { key:'malwScriptInject', sev:'crit', preview:'context', rx:/<script[\s>]|<iframe\b[\s\S]{0,80}\bsrc\s*=|\bonerror\s*=\s*["']?[a-z(]|<\?php\b/i },
  { key:'malwWinScript', sev:'crit', rx:/\bWScript\.Shell\b|\bShell\.Application\b|CreateObject\s*\(\s*["']?(WScript|Scripting\.|Shell)|\b(Auto_?Open|Document_Open|Workbook_Open)\b/i },
  { key:'malwExecHeader', sev:'crit', rx:/^MZ[\x00-\x1f]|\x7fELF|^#!\s*\/(bin|usr)\/(env\s+)?(ba|z)?sh/ },
  // ── Atenção: indicadores suspeitos, não necessariamente maliciosos ──
  { key:'malwCryptoAddr', sev:'warn', rx:/\b(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40}|4[0-9AB][1-9A-HJ-NP-Za-km-z]{93})\b/ },
  { key:'malwUrl', sev:'warn', rx:/\bhttps?:\/\/[^\s"'<>]{4,}/i },
  { key:'malwBase64Blob', sev:'warn', rx:/[A-Za-z0-9+/]{120,}={0,2}/ },
];
function stegomalwareContext(text, index, matchLength) {
  // Alguns detectores (por exemplo <script>) reconhecem apenas o gatilho e
  // precisam de uma pequena janela para mostrar o conteúdo relevante ao redor.
  // Indicadores autocontidos (URL, endereço cripto, Base64 etc.) mostram apenas
  // o próprio match, evitando repetir trechos grandes da mensagem recuperada.
  const at = Math.max(0, Number.isFinite(index) ? index : 0);
  const ml = Math.max(1, Math.min(Number.isFinite(matchLength) ? matchLength : 1, 80));
  let start = Math.max(0, at - 48);
  let end = Math.min(text.length, at + ml + 120);
  // Não parta pares substitutos UTF-16 nas bordas do preview. O detector trabalha
  // em offsets de JS, mas o trecho exportado/renderizado deve continuar sendo
  // uma string Unicode persistível em UTF-8 por consumidores externos.
  if (start > 0) {
    const c = text.charCodeAt(start);
    if (c >= 0xDC00 && c <= 0xDFFF) start--;
  }
  if (end < text.length && end > 0) {
    const c = text.charCodeAt(end - 1);
    if (c >= 0xD800 && c <= 0xDBFF) end--;
  }
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet += '…';
  return snippet;
}
function stegomalwareMatchPreview(match) {
  const raw = String(match || '');
  if (!raw) return '';
  // Limite por code point para nunca cortar surrogate pair no preview curto.
  const chars = Array.from(raw);
  return chars.length > 80 ? chars.slice(0,80).join('') + '…' : raw;
}
function detectStegomalware(text) {
  if (!text || text.length < 4) return [];
  const out = [], seen = new Set();
  for (const p of STEGOMALWARE_PATTERNS) {
    const m = text.match(p.rx);
    if (m && !seen.has(p.key)) {
      seen.add(p.key);
      const match = m[0] || '';
      out.push({
        key:p.key,
        sev:p.sev,
        snippet:p.preview === 'context'
          ? stegomalwareContext(text, m.index, match.length)
          : stegomalwareMatchPreview(match)
      });
    }
  }
  return out;
}

// ════════════════════════════════════════
//  MOTOR DE TERCEIRO — OpenStego (RandomLSB)
//  Decodifica imagens geradas pela ferramenta OpenStego (v0.8.x). Algoritmo
//  reimplementado a partir da especificação/fonte oficial (GPLv2 — lógica
//  reimplementada, sem cópia de código). Validado contra amostras reais.
//
//  Seed do PRNG = passwordHash(senha): vazia → 98234782; senha → MD5(senha) hex,
//  primeiros 15 chars, base 16. PRNG = java.util.Random (LCG 48-bit). Posições:
//  nextInt(w), nextInt(h), nextInt(3)=canal(0=B,1=G,2=R), nextInt(chBits), pulando
//  repetidas. Header: "OPENSTEGO"+ver(2)+[len4LE,chBits,fnLen,comp,enc]+algo8+nome.
//  Dados: gzip por padrão; AES opcional (não implementado neste decoder).
// ════════════════════════════════════════

// java.util.Random fiel (LCG 48-bit) via BigInt.
class OSJavaRandom {
  constructor(seed){ this.seed = (BigInt(seed) ^ 0x5DEECE66Dn) & ((1n<<48n)-1n); }
  _next(bits){
    this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & ((1n<<48n)-1n);
    return Number(this.seed >> BigInt(48-bits));
  }
  nextInt(bound){
    if(bound<=0) throw new Error('bound<=0');
    if((bound & -bound)===bound) return Number((BigInt(bound)*BigInt(this._next(31)))>>31n);
    let bits, val;
    do { bits=this._next(31); val=bits%bound; } while(bits-val+(bound-1)<0);
    return val;
  }
}

// passwordHash do OpenStego (StringUtil.passwordHash). Usa MD5 via SubtleCrypto
// não dá (síncrono aqui), então usamos uma MD5 pequena embutida. Retorna BigInt.
// Sem senha → constante fixa 98234782.
function osPasswordHash(password){
  if(password==null || password==='') return 98234782n;
  const hex = md5hex(password);            // 32 chars hex
  return BigInt('0x' + hex.substring(0,15));
}

// MD5 síncrona (domínio público, RFC 1321) — necessária para a seed do OpenStego.
function md5hex(str){
  function rl(n,c){return (n<<c)|(n>>>(32-c));}
  function add(x,y){const l=(x&0xFFFF)+(y&0xFFFF);return (((x>>16)+(y>>16)+(l>>16))<<16)|(l&0xFFFF);}
  function cmn(q,a,b,x,s,t){return add(rl(add(add(a,q),add(x,t)),s),b);}
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t);}
  // aceita string (UTF-8) OU Uint8Array/array de bytes crus (para chaves binárias)
  const bytes = (typeof str === 'string') ? new TextEncoder().encode(str) : str;
  const n = bytes.length;
  const words = [];
  for(let i=0;i<n;i++) words[i>>2]=(words[i>>2]||0)|(bytes[i]<<((i%4)*8));
  words[n>>2]=(words[n>>2]||0)|(0x80<<((n%4)*8));
  const bitLen=n*8;
  const len=(((n+8)>>6)+1)*16;
  while(words.length<len) words.push(0);
  words[len-2]=bitLen;
  let a=1732584193,b=-271733879,c=-1732584194,d=271733878;
  for(let i=0;i<words.length;i+=16){
    const oa=a,ob=b,oc=c,od=d;
    a=ff(a,b,c,d,words[i],7,-680876936);d=ff(d,a,b,c,words[i+1],12,-389564586);c=ff(c,d,a,b,words[i+2],17,606105819);b=ff(b,c,d,a,words[i+3],22,-1044525330);
    a=ff(a,b,c,d,words[i+4],7,-176418897);d=ff(d,a,b,c,words[i+5],12,1200080426);c=ff(c,d,a,b,words[i+6],17,-1473231341);b=ff(b,c,d,a,words[i+7],22,-45705983);
    a=ff(a,b,c,d,words[i+8],7,1770035416);d=ff(d,a,b,c,words[i+9],12,-1958414417);c=ff(c,d,a,b,words[i+10],17,-42063);b=ff(b,c,d,a,words[i+11],22,-1990404162);
    a=ff(a,b,c,d,words[i+12],7,1804603682);d=ff(d,a,b,c,words[i+13],12,-40341101);c=ff(c,d,a,b,words[i+14],17,-1502002290);b=ff(b,c,d,a,words[i+15],22,1236535329);
    a=gg(a,b,c,d,words[i+1],5,-165796510);d=gg(d,a,b,c,words[i+6],9,-1069501632);c=gg(c,d,a,b,words[i+11],14,643717713);b=gg(b,c,d,a,words[i],20,-373897302);
    a=gg(a,b,c,d,words[i+5],5,-701558691);d=gg(d,a,b,c,words[i+10],9,38016083);c=gg(c,d,a,b,words[i+15],14,-660478335);b=gg(b,c,d,a,words[i+4],20,-405537848);
    a=gg(a,b,c,d,words[i+9],5,568446438);d=gg(d,a,b,c,words[i+14],9,-1019803690);c=gg(c,d,a,b,words[i+3],14,-187363961);b=gg(b,c,d,a,words[i+8],20,1163531501);
    a=gg(a,b,c,d,words[i+13],5,-1444681467);d=gg(d,a,b,c,words[i+2],9,-51403784);c=gg(c,d,a,b,words[i+7],14,1735328473);b=gg(b,c,d,a,words[i+12],20,-1926607734);
    a=hh(a,b,c,d,words[i+5],4,-378558);d=hh(d,a,b,c,words[i+8],11,-2022574463);c=hh(c,d,a,b,words[i+11],16,1839030562);b=hh(b,c,d,a,words[i+14],23,-35309556);
    a=hh(a,b,c,d,words[i+1],4,-1530992060);d=hh(d,a,b,c,words[i+4],11,1272893353);c=hh(c,d,a,b,words[i+7],16,-155497632);b=hh(b,c,d,a,words[i+10],23,-1094730640);
    a=hh(a,b,c,d,words[i+13],4,681279174);d=hh(d,a,b,c,words[i],11,-358537222);c=hh(c,d,a,b,words[i+3],16,-722521979);b=hh(b,c,d,a,words[i+6],23,76029189);
    a=hh(a,b,c,d,words[i+9],4,-640364487);d=hh(d,a,b,c,words[i+12],11,-421815835);c=hh(c,d,a,b,words[i+15],16,530742520);b=hh(b,c,d,a,words[i+2],23,-995338651);
    a=ii(a,b,c,d,words[i],6,-198630844);d=ii(d,a,b,c,words[i+7],10,1126891415);c=ii(c,d,a,b,words[i+14],15,-1416354905);b=ii(b,c,d,a,words[i+5],21,-57434055);
    a=ii(a,b,c,d,words[i+12],6,1700485571);d=ii(d,a,b,c,words[i+3],10,-1894986606);c=ii(c,d,a,b,words[i+10],15,-1051523);b=ii(b,c,d,a,words[i+1],21,-2054922799);
    a=ii(a,b,c,d,words[i+8],6,1873313359);d=ii(d,a,b,c,words[i+15],10,-30611744);c=ii(c,d,a,b,words[i+6],15,-1560198380);b=ii(b,c,d,a,words[i+13],21,1309151649);
    a=ii(a,b,c,d,words[i+4],6,-145523070);d=ii(d,a,b,c,words[i+11],10,-1120210379);c=ii(c,d,a,b,words[i+2],15,718787259);b=ii(b,c,d,a,words[i+9],21,-343485551);
    a=add(a,oa);b=add(b,ob);c=add(c,oc);d=add(d,od);
  }
  function hex(x){let s='';for(let i=0;i<4;i++)s+=('0'+((x>>(i*8))&0xFF).toString(16)).slice(-2);return s;}
  return hex(a)+hex(b)+hex(c)+hex(d);
}

const OS_STAMP = [0x4F,0x50,0x45,0x4E,0x53,0x54,0x45,0x47,0x4F]; // "OPENSTEGO"

// Leitor de bytes RandomLSB sobre imageData RGBA do projeto.
function osMakeReader(d, w, h, password){
  const rand = new OSJavaRandom(osPasswordHash(password));
  const used = new Set();
  let channelBits = 1;
  const pixelBit = (x,y,ch,bit) => {
    const idx=(y*w+x)*4;                 // RGBA
    const R=d[idx], G=d[idx+1], B=d[idx+2];
    const argb=((0xFF<<24)|(R<<16)|(G<<8)|B);
    return (argb >> (ch*8+bit)) & 1;     // ch 0=B,1=G,2=R
  };
  const readByte = () => {
    let v=0;
    for(let i=0;i<8;i++){
      let x,y,ch,bit,key;
      do{ x=rand.nextInt(w); y=rand.nextInt(h); ch=rand.nextInt(3); bit=rand.nextInt(channelBits); key=x+'_'+y+'_'+ch+'_'+bit; }
      while(used.has(key));
      used.add(key);
      v=(v<<1)|pixelBit(x,y,ch,bit);
    }
    return v & 0xFF;
  };
  const readBytes = (n) => { const o=new Uint8Array(n); for(let i=0;i<n;i++)o[i]=readByte(); return o; };
  return { readBytes, setChannelBits:(n)=>{channelBits=n;} };
}

// Extrai um payload OpenStego de imageData (RGBA). Retorna objeto ou null.
// Não lança: senha errada/não-OpenStego → null (sem falsa leitura, o magic decide).
function osExtract(imageData, password){
  try{
    const d=imageData.data, w=imageData.width, h=imageData.height;
    if(!w||!h||w*h<256) return null;
    const r=osMakeReader(d,w,h,password);
    const stamp=r.readBytes(OS_STAMP.length);
    for(let i=0;i<OS_STAMP.length;i++) if(stamp[i]!==OS_STAMP[i]) return null;
    const ver=r.readBytes(1)[0];
    if(ver!==2) return null;
    const hdr=r.readBytes(8);
    const dataLength=(hdr[0])|(hdr[1]<<8)|(hdr[2]<<16)|(hdr[3]<<24);
    const channelBits=hdr[4], fileNameLen=hdr[5];
    const useCompression=hdr[6]===1, useEncryption=hdr[7]===1;
    if(dataLength<=0 || dataLength>w*h*3) return null; // sanidade
    r.readBytes(8); // cryptAlgo (não usado por este decoder)
    let fileName='';
    if(fileNameLen>0) fileName=new TextDecoder().decode(r.readBytes(fileNameLen));
    r.setChannelBits(channelBits);
    const data=r.readBytes(dataLength);
    return { data, dataLength, channelBits, fileName, useCompression, useEncryption };
  }catch(_){ return null; }
}

// Descompressão gzip via DecompressionStream do browser (OpenStego usa gzip).
async function osGunzip(bytes){
  const ds=new DecompressionStream('gzip');
  const w=ds.writable.getWriter(); w.write(bytes); w.close();
  const buf=await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

// Classifica bytes recuperados por motores de terceiros sem destruí-los.
// A evidência de recuperação é dos BYTES; texto é apenas uma visão quando o
// conteúdo é UTF-8 legível. Arquivos binários permanecem byte a byte intactos
// para download local e nunca atravessam o JSON público automaticamente.
function classifyThirdPartyPayload(bytes, fileName='', source='payload'){
  if(!(bytes instanceof Uint8Array) || bytes.length===0)
    return {text:null, binary:false, bytes:null, fileName:fileName||null, mime:'application/octet-stream'};

  const lower=String(fileName||'').toLowerCase();
  const ext=(lower.match(/\.([a-z0-9]{1,10})$/)||[])[1]||'';
  let magicExt='', mime='application/octet-stream';
  if(bytes.length>=8 && bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47){ magicExt='png'; mime='image/png'; }
  else if(bytes.length>=3 && bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff){ magicExt='jpg'; mime='image/jpeg'; }
  else if(bytes.length>=4 && bytes[0]===0x50&&bytes[1]===0x4b&&([0x03,0x05,0x07].includes(bytes[2]))&&([0x04,0x06,0x08].includes(bytes[3]))){ magicExt='zip'; mime='application/zip'; }
  else if(bytes.length>=4 && bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46){ magicExt='pdf'; mime='application/pdf'; }
  else if(bytes.length>=2 && bytes[0]===0x1f&&bytes[1]===0x8b){ magicExt='gz'; mime='application/gzip'; }

  const binaryExts=new Set(['png','jpg','jpeg','gif','webp','bmp','zip','gz','gzip','7z','rar','pdf','exe','dll','bin','dat','mp3','mp4','mov','avi','wav','ogg','woff','woff2','ttf','otf']);
  const forceBinary=!!magicExt || binaryExts.has(ext);
  let text=null;
  if(!forceBinary){
    try{
      const candidate=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const chars=Array.from(candidate);
      let good=0;
      for(const ch of chars){
        const c=ch.codePointAt(0);
        if(c===9||c===10||c===13||(c>=32&&c!==0x7f)) good++;
      }
      if(chars.length>0 && good/chars.length>=0.9) text=candidate;
    }catch(_){ text=null; }
  }

  if(text!==null) return {text, binary:false, bytes, fileName:fileName||null, mime:'text/plain;charset=utf-8'};
  const safeSource=String(source||'payload').toLowerCase().replace(/[^a-z0-9_-]+/g,'_')||'payload';
  const inferred=fileName || `${safeSource}_payload.${magicExt||ext||'bin'}`;
  return {text:null, binary:true, bytes, fileName:inferred, mime};
}

// Decodifica uma mensagem OpenStego de imageData, retornando texto ou null.
// Tenta a senha fornecida E a seed sem-senha (98234782). Descomprime se preciso.
// A camada AES (useEncryption) ainda não é suportada → retorna null nesse caso
// (mas identifica a origem, ver osIdentify).
async function osDecodeMessage(imageData, password){
  // tenta com a senha informada; se falhar e havia senha, tenta também sem senha
  // (caso a imagem seja OpenStego sem senha e o usuário tenha digitado algo).
  const attempts = password && password.length>0 ? [password, ''] : [''];
  for(const pw of attempts){
    const res=osExtract(imageData, pw);
    if(!res) continue;
    if(res.useEncryption) return { text:null, encrypted:true, fileName:res.fileName };
    let bytes=res.data;
    if(res.useCompression){
      // Se o framing declara gzip, só há conteúdo recuperado depois de a
      // descompressão terminar com sucesso. Salvar o stream comprimido com o
      // nome original seria byte-exato para o wire, mas NÃO para o arquivo.
      try{ bytes=await osGunzip(res.data); }catch(_){ return null; }
    }
    const payload=classifyThirdPartyPayload(bytes, res.fileName, 'openstego');
    return { text:payload.text, data:payload.bytes, binary:payload.binary,
             fileName:res.fileName, downloadName:payload.fileName, mime:payload.mime,
             encrypted:false, usedEmptyPassword:pw==='' };
  }
  return null;
}

// Fingerprint leve: identifica se a imagem é OpenStego (magic bate com alguma
// das tentativas de senha), sem necessariamente extrair o texto. Retorna
// {tool:'OpenStego', encrypted, fileName} ou null.
function osIdentify(imageData, password){
  const attempts = password && password.length>0 ? [password, ''] : [''];
  for(const pw of attempts){
    const res=osExtract(imageData, pw);
    if(res) return { tool:'OpenStego', encrypted:res.useEncryption, fileName:res.fileName };
  }
  return null;
}

// ════════════════════════════════════════
//  MOTOR DE TERCEIRO — Steghide (BMP espacial + JPEG DCT)
//  Decodifica imagens geradas pela ferramenta Steghide (0.5.x). Algoritmo
//  reimplementado da spec/fonte oficial (GPLv2 — lógica reimplementada, sem
//  copiar código). Validado contra amostras reais do binário oficial.
//
//  Núcleo: seed do Selector = XOR dos 4 blocos de 32 bits do MD5(senha);
//  PseudoRandomSource (LCG A=1367208549,C=1,mod 2^32); permutação Fisher-Yates
//  preguiçosa. Formato interno EmbData: Magic 24-bit 0x73688D, versão unária,
//  EncAlgo(5)+EncMode(3), NPlainBits(32), compressão zlib, CRC32, filename,
//  dados (tudo LSB-first). Cifra padrão: AES-256-CBC (chave = MD5(pw)||MD5(pw||
//  MD5(pw)); IV prefixado). Reusa md5hex() do motor OpenStego acima.
//  Fontes de amostra: BMP → pixel; JPEG → coeficiente DCT != 0 (via jpeg_dct.js).
// ════════════════════════════════════════

// seed do Selector (XOR dos 4 blocos LE de 32 bits do MD5). Usa a md5hex já
// presente (retorna hex); converte para bytes.
function shSelectorSeed(password){
  const hex=md5hex(password);                 // 32 chars hex (16 bytes)
  const b=[]; for(let i=0;i<16;i++) b.push(parseInt(hex.substr(i*2,2),16));
  let seed=0>>>0;
  for(let blk=0;blk<4;blk++){ const v=(b[blk*4]|(b[blk*4+1]<<8)|(b[blk*4+2]<<16)|(b[blk*4+3]<<24))>>>0; seed=(seed^v)>>>0; }
  return seed>>>0;
}
class SHPRandom{ constructor(s){this.Value=s>>>0;} getValue(n){this.Value=Number((1367208549n*BigInt(this.Value)+1n)&0xFFFFFFFFn)>>>0;return Math.floor(n*(this.Value/4294967296.0));} }
class SHSelector{
  constructor(max,pw){this.Maximum=max;this.PRandom=new SHPRandom(shSelectorSeed(pw));this.X=new Map();this.Y=new Map();this.Xr=new Map();this.N=0;}
  _sX(i,v){this.X.set(i,v);this.Xr.set(v,i);}
  _iX(v,m){const it=this.Xr.get(v);return(it!==undefined&&it<m)?it:-1;}
  get(i){this._calc(i+1);return this.X.get(i);}
  _calc(m){let j=this.N;if(m>this.N)this.N=m;
    for(;j<m;j++){const k=j+this.PRandom.getValue(this.Maximum-j);const i=this._iX(k,j);
      if(i!==-1){this._sX(j,this.Y.get(i));if(this.X.get(j)>j)this.Y.set(j,j);
        if(this.X.get(i)>j){this.Y.set(i,j);const l=this._iX(this.Y.get(i),j);if(l!==-1)this.Y.set(i,this.Y.get(l));}}
      else{this._sX(j,k);this.Y.set(j,j);}
      if(this.X.get(j)>j){const i2=this._iX(this.Y.get(j),j);if(i2!==-1)this.Y.set(j,this.Y.get(i2));}}}
}
function shBitsToBytesLE(bits){const out=[];for(let i=0;i+8<=bits.length;i+=8){let b=0;for(let k=0;k<8;k++)b|=bits[i+k]<<k;out.push(b);}return new Uint8Array(out);}
function shEncryptedSizeBits(nPlainBits){const IV=128,BLK=128;const bl=(nPlainBits%BLK===0)?(nPlainBits/BLK):(Math.floor(nPlainBits/BLK)+1);return IV+bl*BLK;}

const SH_MAGIC=0x73688D, SH_NBITS_MAGIC=24;

// leitor de bits genérico do Steghide sobre uma fonte de EValues.
// spv = samples per vertex, mod = EmbValueModulus.
function shMakeBitReader(evalues, password, spv, mod){
  const sel=new SHSelector(evalues.length, password);
  const arity=Math.round(Math.log2(mod)); // 1 (jpeg mod2) ou 2 (bmp mod4)
  let svIdx=0; const bitbuf=[];
  const ensure=(n)=>{ while(bitbuf.length<n){ let ev=0; for(let j=0;j<spv;j++,svIdx++) ev=(ev+evalues[sel.get(svIdx)])%mod; for(let b=0;b<arity;b++) bitbuf.push((ev>>b)&1); } };
  let pos=0;
  return { getValue(len){ensure(pos+len);let v=0;for(let i=0;i<len;i++)v|=bitbuf[pos+i]<<i;pos+=len;return v>>>0;},
           readBit(){ensure(pos+1);return bitbuf[pos++];},
           readBitsArray(len){ensure(pos+len);const a=bitbuf.slice(pos,pos+len);pos+=len;return a;} };
}

// parse do EmbData (comum a BMP e JPEG). Descomprime (gzip/zlib) via
// DecompressionStream. Retorna {ok,text,fileName,crc32,data} ou {ok:false}.
async function shParseTail(bits){
  let p=0;const pv=(l)=>{let v=0;for(let i=0;i<l;i++)v|=bits[p+i]<<i;p+=l;return v>>>0;};const pb=()=>bits[p++];
  const checksum=pb();let crc32=null;if(checksum)crc32=pv(32);
  let fileName='';while(true){const c=pv(8);if(c===0)break;fileName+=String.fromCharCode(c);if(p>bits.length)return{ok:false};}
  const rem=bits.length-p,nd=Math.floor(rem/8);const data=new Uint8Array(nd);for(let i=0;i<nd;i++)data[i]=pv(8);
  let text=null;try{text=new TextDecoder('utf-8',{fatal:false}).decode(data);}catch(_){}
  return{ok:true,fileName,crc32,data,text};
}
async function shInflate(bytes){
  const ds=new DecompressionStream('deflate'); // zlib (compress2) → deflate c/ header
  const w=ds.writable.getWriter();
  // write() e close() devolvem promessas próprias. Quando o fluxo falha (dado
  // que não é zlib — ex.: Steghide em modo ECB decifrado com a cifra errada),
  // elas rejeitam DEPOIS que esta função já retornou, virando
  // unhandledrejection no navegador. O erro real chega pelo await abaixo; estas
  // só precisam não vazar.
  w.write(bytes).catch(()=>{}); w.close().catch(()=>{});
  const buf=await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}
async function shParsePlain(plainBits){
  let p=0;const pv=(l)=>{let v=0;for(let i=0;i<l;i++)v|=plainBits[p+i]<<i;p+=l;return v>>>0;};const pb=()=>plainBits[p++];
  const compression=pb();
  if(compression){ const nU=pv(32); const cb=plainBits.slice(p); const by=shBitsToBytesLE(cb);
    let out; try{ out=await shInflate(by); }catch(e){ return {ok:false}; }
    const ub=[]; for(const b of out) for(let k=0;k<8;k++) ub.push((b>>k)&1);
    return shParseTail(ub);
  }
  return shParseTail(plainBits.slice(p));
}

// decode central: recebe a fonte de EValues + parâmetros, devolve msg ou null.
async function shExtractCore(evalues, password, spv, mod){
  if(!evalues || evalues.length < 64) return null;
  const r=shMakeBitReader(evalues, password, spv, mod);
  if(r.getValue(SH_NBITS_MAGIC)!==SH_MAGIC) return null; // magic decide (sem falsa leitura)
  let version=0; while(r.readBit()===1){ version++; if(version>32) return null; }
  const encAlgo=r.getValue(5); r.getValue(3); // EncMode ignorado
  const nPlainBits=r.getValue(32);
  if(nPlainBits<=0 || nPlainBits > evalues.length) return null;
  if(encAlgo===0){ return shParsePlain(r.readBitsArray(nPlainBits)); }
  if(encAlgo===2){ // AES-256-CBC (steghide: sem padding PKCS)
    const encBytes=shBitsToBytesLE(r.readBitsArray(shEncryptedSizeBits(nPlainBits)));
    const IV=encBytes.subarray(0,16), ct=encBytes.subarray(16);
    const key=shAesKey(password);
    try{
      const pt=await shAesCbcNoPadDecrypt(key, IV, ct);
      if(!pt) return null;
      const pbits=[]; for(const b of pt) for(let k=0;k<8;k++) pbits.push((b>>k)&1);
      return shParsePlain(pbits.slice(0,nPlainBits));
    }catch(e){ return null; }
  }
  return null;
}

// AES-256-CBC SEM padding, compatível com browser. O WebCrypto exige padding
// PKCS no decrypt, então fazemos CBC manualmente: decifra cada bloco em "ECB"
// (via AES-CBC de 1 bloco com IV zero + truque de padding) e XOR com o bloco
// de cifra anterior. Implementação: usa AES-CBC do WebCrypto para decifrar,
// contornando o unpad ao ENCRIPTAR um bloco de padding conhecido e anexá-lo.
async function shAesCbcNoPadDecrypt(key, iv, ct){
  if(ct.length % 16 !== 0 || ct.length === 0) return null;
  const ck=await crypto.subtle.importKey('raw', key, {name:'AES-CBC'}, false, ['decrypt','encrypt']);
  // Truque: para decifrar sem padding, encriptamos um bloco PKCS válido (16 bytes
  // de valor 0x10) usando como IV o ÚLTIMO bloco de ciphertext; isso gera um
  // bloco extra que, anexado ao ct, faz o unpad do WebCrypto passar. Depois
  // descartamos esse bloco extra decifrado.
  const padBlock=new Uint8Array(16).fill(16);
  const lastCtBlock=ct.subarray(ct.length-16);
  const extra=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC', iv:lastCtBlock}, ck, padBlock));
  // extra tem 32 bytes (bloco cifrado + padding do WebCrypto); pegamos os 16 primeiros.
  const ctExt=new Uint8Array(ct.length+16); ctExt.set(ct,0); ctExt.set(extra.subarray(0,16), ct.length);
  const dec=new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC', iv:iv}, ck, ctExt));
  return dec.subarray(0, ct.length); // descarta o bloco extra
}
// chave AES do steghide (32 bytes). key = MD5(pw) || MD5(pw_bytes || h1_bytes).
// A segunda parte DEVE usar bytes crus (não string) — bytes >127 de h1 seriam
// corrompidos se passassem por UTF-8.
function shAesKey(password){
  const hexToBytes=(h)=>{const b=new Uint8Array(16);for(let i=0;i<16;i++)b[i]=parseInt(h.substr(i*2,2),16);return b;};
  const pwBytes=new TextEncoder().encode(password);
  const h1=hexToBytes(md5hex(password));
  const concat=new Uint8Array(pwBytes.length+16);
  concat.set(pwBytes,0); concat.set(h1, pwBytes.length);
  const h2=hexToBytes(md5hex(concat));    // md5hex agora aceita bytes crus
  const key=new Uint8Array(32); key.set(h1,0); key.set(h2,16); return key;
}

// EValues de um BMP a partir de imageData RGBA (steghide BMP: sample=pixel,
// spv=2, mod=4, EValue=(((R&1)^(G&1))<<1)|((R&1)^(B&1))). No browser o BMP já
// veio como RGBA; a ordem de amostra do steghide é a do BitmapData (bottom-up),
// mas como o canvas entrega top-down, o mapeamento de posição do Selector muda.
// → BMP via browser fica como caso futuro; priorizamos JPEG (caso comum real).

// EValues de um JPEG a partir dos bytes crus (usa jpeg_dct.js).
// steghide JPEG: sample = coeficiente DCT != 0, spv=3, mod=2, EValue=|coef|%2.
// `dec` opcional — coeficientes já decodificados, compartilhados entre os
// motores. Sem ele, decodifica por conta própria (a função segue autônoma).
function shJpegEValues(jpegBytes, dec){
  try{ if(!dec) dec=decodeJpegCoefficients(jpegBytes); }catch(_){ return null; }
  if(!dec) return null;
  const lin=jpegCoeffsLinear(dec);
  const ev=[]; for(const v of lin){ if(v!==0) ev.push(Math.abs(v)%2); }
  return ev;
}

// API pública do motor Steghide-JPEG: recebe os bytes crus do arquivo + senha,
// devolve {text,fileName,encrypted} ou null. Tenta a senha e, se falhar, "".
async function shDecodeJpeg(jpegBytes, password, dec){
  const ev=shJpegEValues(jpegBytes, dec);
  if(!ev) return null;
  const attempts = (password && password.length>0) ? [password, ''] : [''];
  for(const pw of attempts){
    const res=await shExtractCore(ev, pw, 3, 2);
    if(res && res.ok && res.data instanceof Uint8Array && res.data.length>0){
      const payload=classifyThirdPartyPayload(res.data, res.fileName, 'steghide');
      return { text:payload.text, data:payload.bytes, binary:payload.binary,
               fileName:res.fileName, downloadName:payload.fileName, mime:payload.mime,
               encrypted:false, usedEmptyPassword:pw==='' };
    }
  }
  return null;
}

// Enums do mcrypt usados pelo Steghide. Mapeados por MEDIÇÃO em 11/08/2026:
// um embed real por algoritmo/modo com o binário oficial 0.5.1, lendo os campos
// de 5 e 3 bits do cabeçalho. Não são chute nem transcrição de documentação.
const SH_ALGOS={0:'none',1:'twofish',2:'rijndael-128',3:'rijndael-192',4:'rijndael-256',
  5:'saferplus',6:'rc2',7:'xtea',8:'serpent',11:'cast-256',12:'loki97',13:'gost',
  15:'cast-128',16:'blowfish',17:'des',18:'tripledes',19:'enigma',20:'arcfour',22:'wake'};
const SH_MODES={0:'ECB',1:'CBC',2:'OFB',3:'CFB',4:'nOFB',5:'nCFB',6:'CTR',7:'stream'};
// O que shExtractCore realmente implementa hoje: sem cifra, e rijndael-128/CBC.
const SH_SUPPORTED=new Set(['0/1','0/0','2/1']);

// Fingerprint: confirma que um JPEG é Steghide lendo o magic com a senha
// informada (ou vazia). O magic vive em posições derivadas da senha, então ele
// nunca acende por acaso — capa limpa e senha errada devolvem null.
// Devolve também QUAL cifra foi usada, para que a interface possa dizer o
// motivo exato de não termos extraído, em vez de um genérico "não suportado".
function shIdentifyJpeg(jpegBytes, password, dec){
  const ev=shJpegEValues(jpegBytes, dec);
  if(!ev) return null;
  const attempts = (password && password.length>0) ? [password, ''] : [''];
  for(const pw of attempts){
    const r=shMakeBitReader(ev, pw, 3, 2);
    try{
      if(r.getValue(SH_NBITS_MAGIC)!==SH_MAGIC) continue;
      let version=0; while(r.readBit()===1){ version++; if(version>32) break; }
      const algo=r.getValue(5), mode=r.getValue(3);
      return { tool:'Steghide', algo, mode,
               algoName: SH_ALGOS[algo] || ('algo#'+algo),
               modeName: SH_MODES[mode] || ('modo#'+mode),
               supported: SH_SUPPORTED.has(algo+'/'+mode),
               usedEmptyPassword: pw==='' };
    }catch(_){}
  }
  return null;
}

// ════════════════════════════════════════
//  MOTOR DE TERCEIRO — OutGuess 0.4 (JPEG, domínio DCT)
//  Decodifica imagens geradas pela ferramenta OutGuess. Algoritmo
//  reimplementado da spec/fonte oficial (licença BSD — lógica reimplementada,
//  sem copiar código). Validado contra amostras reais do binário oficial.
//
//  Peças: DOIS streams RC4 independentes — MD5("Seeding"+chave) escolhe as
//  POSIÇÕES (iterator com passo aleatório), MD5("Encryption"+chave) CIFRA os
//  dados. Chave default (sem -k) = a string literal "Default key". O bitmap
//  percorre os coeficientes DCT em ordem de MCU (entrelaçada), pulando os de
//  valor 0 e 1 e usando o LSB do resto. Cabeçalho: 4 bytes decifrados →
//  seed(16b) + datalen(16b); depois re-semeia o iterator e lê datalen bytes,
//  decifrados por um stream RC4 NOVO (o outguess copia o stream antes do
//  cabeçalho). Reusa md5hex() e a base jpeg_dct.js.
// ════════════════════════════════════════

const OG_DEFAULT_KEY='Default key', OG_INIT_SKIPMOD=32;

function ogMd5Bytes(bytes){
  const hex=md5hex(bytes), out=new Uint8Array(16);
  for(let i=0;i<16;i++) out[i]=parseInt(hex.substr(i*2,2),16);
  return out;
}
class OGArc4{
  constructor(){ this.s=new Uint8Array(256); for(let n=0;n<256;n++)this.s[n]=n; this.i=0; this.j=0; }
  addrandom(dat){
    this.i=(this.i-1)&0xff;
    for(let n=0;n<256;n++){
      this.i=(this.i+1)&0xff;
      const si=this.s[this.i];
      this.j=(this.j+si+dat[n%dat.length])&0xff;
      this.s[this.i]=this.s[this.j]; this.s[this.j]=si;
    }
  }
  getbyte(){
    this.i=(this.i+1)&0xff;
    const si=this.s[this.i];
    this.j=(this.j+si)&0xff;
    const sj=this.s[this.j];
    this.s[this.i]=sj; this.s[this.j]=si;
    return this.s[(si+sj)&0xff];
  }
  getword(){ const a=this.getbyte(),b=this.getbyte(),c=this.getbyte(),d=this.getbyte();
    return (((a<<24)|(b<<16)|(c<<8)|d)>>>0); }
  clone(){ const x=new OGArc4(); x.s.set(this.s); x.i=this.i; x.j=this.j; return x; }
}
function ogInitKey(type,keyStr){
  const enc=new TextEncoder(), t=enc.encode(type), k=enc.encode(keyStr);
  const all=new Uint8Array(t.length+k.length); all.set(t,0); all.set(k,t.length);
  const a=new OGArc4(); a.addrandom(ogMd5Bytes(all)); return a;
}
// SKIPADJ(x,y) = (y > x/32 ? 2 : 2 - ((x/32)-y)/(x/32))   [x/32 = divisão inteira]
function ogSkipAdj(x,y){ const x32=Math.floor(x/32); return (y>x32)?2:(2-((x32-y)/x32)); }
class OGIterator{
  constructor(keyStr){ this.as=ogInitKey('Seeding',keyStr); this.skipmod=OG_INIT_SKIPMOD;
    this.off=this.as.getword()%this.skipmod; }
  next(){ this.off+=(this.as.getword()%this.skipmod)+1; return this.off; }
  seed(s){ this.as.addrandom(Uint8Array.from([s&0xff,(s>>8)&0xff])); }
  adapt(bits,datalen){
    const v=ogSkipAdj(bits,bits-this.off)*(bits-this.off)/(8*datalen);
    this.skipmod=Math.trunc(v); if(this.skipmod<1) this.skipmod=1;
  }
}
// bits utilizáveis: pula coeficientes 0 e 1, usa o LSB do resto (ordem MCU)
function ogBitmap(jpegBytes, dec){
  try{ if(!dec) dec=decodeJpegCoefficients(jpegBytes); }catch(_){ return null; }
  if(!dec) return null;
  const co=jpegCoeffsMCUOrder(dec), bits=[];
  for(let i=0;i<co.length;i++){ const v=co[i]; if(v===0||v===1) continue; bits.push(v&1); }
  return bits;
}
// lê nbits seguindo o iterator; bits fora do bitmap não existem no arquivo
// (o embed do OutGuess para na borda) — lemos 0 e sinalizamos em st.
function ogRetrByte(bits,iter,nbits,st){
  let i=iter.off, tmp=0;
  for(let w=0;w<nbits;w++){
    if(i>=bits.length){ st.unknownBits++; } else tmp|=((bits[i]?1:0)<<w);
    i=iter.next();
  }
  return tmp&0xff;
}
// heurística de plausibilidade: o OutGuess não tem magic, então só reportamos
// uma extração que pareça conteúdo real (evita "recuperar" ruído).
function ogLooksLikeContent(bytes){
  if(!bytes||bytes.length===0) return false;
  const b=bytes;
  if(b[0]===0x89&&b[1]===0x50) return true;                 // PNG
  if(b[0]===0xFF&&b[1]===0xD8) return true;                 // JPEG
  if(b[0]===0x50&&b[1]===0x4B) return true;                 // ZIP
  if(b[0]===0x25&&b[1]===0x50) return true;                 // PDF
  if(b[0]===0x1F&&b[1]===0x8B) return true;                 // gzip
  let head=''; for(let i=0;i<Math.min(11,b.length);i++) head+=String.fromCharCode(b[i]);
  if(head.indexOf('-----BEGIN')===0) return true;           // PGP / chaves
  const txt=new TextDecoder('utf-8',{fatal:false}).decode(b);
  const chars=Array.from(txt); if(chars.length===0) return false;
  let good=0;
  for(const ch of chars){ const c=ch.codePointAt(0);
    if(c===9||c===10||c===13||(c>=32&&c!==0xFFFD)) good++; }
  const ratio=good/chars.length;
  return b.length>=8 ? ratio>=0.9 : ratio===1;
}
function ogExtract(bits,keyStr){
  if(!bits||bits.length<64) return null;
  const st={unknownBits:0};
  const asData=ogInitKey('Encryption',keyStr), tas=asData.clone();
  const iter=new OGIterator(keyStr);
  const hdr=new Uint8Array(4);
  for(let i=0;i<4;i++) hdr[i]=ogRetrByte(bits,iter,8,st);
  for(let j=0;j<4;j++) hdr[j]^=asData.getbyte();
  const seed=hdr[0]|(hdr[1]<<8);
  let datalen=hdr[2]|(hdr[3]<<8); const origlen=datalen;
  if(datalen<1||datalen>bits.length/8) return null;
  iter.seed(seed);
  const buf=new Uint8Array(datalen); let n=0;
  while(datalen>0){ iter.adapt(bits.length,datalen); buf[n++]=ogRetrByte(bits,iter,8,st); datalen--; }
  for(let j=0;j<origlen;j++) buf[j]^=tas.getbyte();
  return {data:buf, len:origlen, seed, truncated:st.unknownBits>0};
}
// API pública: bytes crus do JPEG + senha → {text,truncated} ou null.
// Tenta a senha informada e, depois, a chave default do OutGuess.
function ogDecodeJpeg(jpegBytes,password,dec){
  const bits=ogBitmap(jpegBytes, dec); if(!bits) return null;
  const attempts=(password&&password.length>0)?[password,OG_DEFAULT_KEY]:[OG_DEFAULT_KEY];
  for(const k of attempts){
    const r=ogExtract(bits,k);
    if(r && ogLooksLikeContent(r.data)){
      const payload=classifyThirdPartyPayload(r.data, '', 'outguess');
      return { text:payload.text, data:payload.bytes, binary:payload.binary,
               downloadName:payload.fileName, mime:payload.mime,
               truncated:r.truncated, len:r.len, usedDefaultKey:k===OG_DEFAULT_KEY };
    }
  }
  return null;
}
