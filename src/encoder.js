const MAGIC = [0x53,0x54,0x45,0x47,0x4F]; // "STEGO"; mode byte follows
const MODE_B = 0x00;   // canal B apenas (LSBM padrão)
const MODE_RGB = 0x01; // alta capacidade: espalha pelos 3 canais R,G,B
const FLAG_SHUFFLED = 0x02; // bit no byte de modo: corpo embaralhado por senha
const FLAG_ADAPTIVE = 0x04; // bit no byte de modo: embedding adaptativo (HILL)
const FLAG_STEALTH = 0x08;  // bit no byte de modo: header cifrado (modo furtivo)
const FLAG_COMPRESSED = 0x10; // bit no byte de modo: corpo comprimido (deflate-raw) antes de cifrar
const FLAG_STC = 0x20; // bit no byte de modo: corpo embutido via STC (Syndrome-Trellis Codes)
const FLAG_HILLV2 = 0x40; // bit no byte de modo: custo HILL canônico (L1 3x3 + L2 15x15).
// Versiona o mapa de custo do ADAPTATIVO: imagens adaptativas antigas (sem este bit) são
// decodificadas com o mapa LEGADO; novas, com o V2. O STC não precisa do bit (decode por
// síndrome é independente de custo).
const STC_H = 8;       // altura de restrição do trellis (2^h estados)
const STC_WMAX = 16;   // largura máxima da submatriz (= 1/α mínimo)

// ════════════════════════════════════════
//  MODO FURTIVO — header mascarado por senha
//  MAGIC, modo e tamanho são XORados com um keystream determinístico da senha.
//  O decoder tenta desfazer a máscara quando existe senha e o header claro não
//  valida; o MAGIC recuperado funciona como validação estrutural.
// ════════════════════════════════════════

// Gera um keystream determinístico de N bytes a partir da senha, para cifrar o
// header. Usa o mesmo PRNG (mulberry32 + seedFromPassword) já usado no
// embaralhamento, com um sal fixo distinto para não coincidir com aquele uso.
function headerKeystream(password, n) {
  const rnd = mulberry32((seedFromPassword(password) ^ 0x5A5A5A5A) >>> 0);
  const ks = new Uint8Array(n);
  for (let i = 0; i < n; i++) ks[i] = Math.floor(rnd() * 256) & 0xFF;
  return ks;
}

// Cifra (ou decifra — XOR é simétrico) os HEADER_BYTES iniciais do payload in-place.
function xorHeader(headerBytes, password) {
  const ks = headerKeystream(password, headerBytes.length);
  const out = new Uint8Array(headerBytes.length);
  for (let i = 0; i < headerBytes.length; i++) out[i] = headerBytes[i] ^ ks[i];
  return out;
}

// ════════════════════════════════════════
//  EMBEDDING ADAPTATIVO — custo HILL
//  O mapa atribui custo baixo a textura/ruído/bordas e alto a áreas lisas. O
//  encoder usa as posições de menor custo; o decoder recalcula o mesmo mapa
//  ignorando LSBs para reconstruir a ordem determinística.
// ════════════════════════════════════════

// Calcula o custo HILL por pixel sobre o canal escolhido (luminância aproximada).
// HILL = filtro passa-alta (realça resíduo/textura) seguido de duas suavizações
// passa-baixa do inverso do resíduo. Pixels em textura têm resíduo alto → custo
// baixo. Retorna Float64Array de custos (mesmo tamanho que o nº de pixels).
// Lista de pixels OPACOS (alfa==255), em ordem raster. Só esses guardam dados de
// forma confiável: o canvas zera/altera o RGB de pixels com alfa<255 (premultiplicação),
// então embutir neles destrói a mensagem. Embutindo apenas nos opacos, a TRANSPARÊNCIA
// e a aparência são preservadas (não tocamos no alfa nem nos pixels transparentes),
// e o round-trip do PNG é lossless. O canvas zera os transparentes de forma
// DETERMINÍSTICA no encode e no decode, então o mapa de custo do adaptativo (que ignora
// LSB) é reproduzível dos dois lados.
function opaquePixels(d) {
  const n = d.length / 4;
  const list = new Uint32Array(n);
  let m = 0;
  for (let p = 0; p < n; p++) if (d[p*4+3] === 255) list[m++] = p;
  return list.subarray(0, m);
}

// Cover "chapado" / pouca textura: poucas cores únicas. Imagens assim (ícones,
// logos, flat design) são péssimos covers para furtividade — o LSB fica fácil de
// detectar (RS sobe rápido). Usado só para a DICA ao usuário, não bloqueia nada.
function isLowTextureCover(d) {
  const pal = new Set();
  for (let i = 0; i < d.length; i += 16) {
    pal.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
    if (pal.size > 6000) break;
  }
  return pal.size <= 4000;
}

// PRNG determinístico usado por formatos que precisam reconstruir exatamente a
// mesma ordem a partir da senha. Não é usado como fonte de aleatoriedade criptográfica.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deriva uma semente inteira de 32 bits a partir da senha (hash simples e estável).
function seedFromPassword(password) {
  let h = 0x811C9DC5; // FNV-1a offset
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Gera a permutação das posições [0..n-1] embaralhada pela senha (Fisher-Yates
// com o PRNG semeado). Determinística: a mesma senha sempre produz a mesma
// ordem, então o decoder reconstrói exatamente a mesma sequência.
function shuffledOrder(n, password) {
  const order = new Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const rnd = mulberry32(seedFromPassword(password));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  return order;
}

// Monta o payload completo: MAGIC + flag de modo + comprimento (uint32) + dados.
// ════════════════════════════════════════
//  STC — Syndrome-Trellis Codes
//  Viterbi escolhe alterações de menor custo HILL sujeitas a H·y=m. O decoder
//  recupera a mensagem pela síndrome, sem precisar reconstruir o mapa de custo.
//  A submatriz é determinística e o path é bit-packed para limitar memória.
// ════════════════════════════════════════
function buildPayload(data, mode=MODE_B) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = bytes.length;
  const out = new Uint8Array(MAGIC.length + 1 + 4 + len);
  out.set(MAGIC);
  out[5] = mode & 0xFF;
  out[6]=(len)&0xFF; out[7]=(len>>8)&0xFF; out[8]=(len>>16)&0xFF; out[9]=(len>>24)&0xFF;
  out.set(bytes, MAGIC.length+1+4);
  return out;
}

// Fonte CSPRNG para a direção ±1 do LSB Matching. A direção das alterações faz
// parte do padrão observável, então usa crypto.getRandomValues(); um buffer evita
// uma chamada ao gerador por pixel.
const _lsbmBits = { buf: new Uint8Array(0), byte: 0, bit: 8 };
function lsbmSign() {
  if (_lsbmBits.bit > 7) {
    if (_lsbmBits.buf.length === 0) { _lsbmBits.buf = new Uint8Array(4096); _lsbmBits.i = 4096; }
    if (_lsbmBits.i >= _lsbmBits.buf.length) { crypto.getRandomValues(_lsbmBits.buf); _lsbmBits.i = 0; }
    _lsbmBits.byte = _lsbmBits.buf[_lsbmBits.i++];
    _lsbmBits.bit = 0;
  }
  return ((_lsbmBits.byte >> _lsbmBits.bit++) & 1) ? 1 : -1;
}

// Escreve um bit via LSB Matching num índice do array de dados (canal já resolvido).
function writeBitLSBM(d, idx, bit) {
  const cur = d[idx];
  if ((cur & 1) === bit) return;
  if (cur === 0) d[idx] = 1;
  else if (cur === 255) d[idx] = 254;
  else d[idx] = cur + lsbmSign();
}

// LSB Replacement puro: substitui só o bit menos significativo, sem transbordar
// para bits superiores. Usado no modo adaptativo, onde o custo HILL é calculado
// sobre os 7 bits superiores — assim embutir NÃO altera o custo, e o decoder
// reconstrói exatamente a mesma ordem de posições por custo.
function writeBitLSBR(d, idx, bit) {
  d[idx] = (d[idx] & 0xFE) | bit;
}

// O cabeçalho (MAGIC + modo + comprimento = 10 bytes = 80 bits) é SEMPRE escrito
// no canal B, para que o decoder possa lê-lo da mesma forma e descobrir o modo.
const HEADER_BYTES = MAGIC.length + 1 + 4;

function embedLSB(imageData, payload, mode=MODE_B, password='', adaptive=false, stealth=false, stcW=0) {
  const d = imageData.data;
  const w = imageData.width, h = imageData.height;
  const op = opaquePixels(d);
  const opCount = op.length;
  const headerBits = HEADER_BYTES * 8;
  const bodyBits = (payload.length - HEADER_BYTES) * 8;
  const shuffle = password.length > 0;

  // ── CORPO via STC: early return. Header(10)+w-byte(1) sequenciais
  //    no canal B (LSBR); corpo nos pixels seguintes, escolhendo as alterações de
  //    MENOR custo HILL total (Viterbi). Decode é por síndrome, sem custo. ──
  if (stcW > 0) {
    payload[5] |= FLAG_STC;
    if (stealth) payload[5] |= FLAG_STEALTH;
    const headBits2 = (HEADER_BYTES + 1) * 8;
    const n = bodyBits * stcW;
    if (opCount < headBits2 + n) throw new Error(t('msgTooLong'));
    const hb = new Uint8Array(HEADER_BYTES + 1);
    hb.set(payload.slice(0, HEADER_BYTES));
    hb[HEADER_BYTES] = stcW & 0xFF;
    const hbOut = (stealth && password.length > 0) ? xorHeader(hb, password) : hb;
    for (let i = 0; i < headBits2; i++) {
      const bit = (hbOut[i >> 3] >> (7 - (i & 7))) & 1;
      writeBitLSBR(d, op[i] * 4 + 2, bit);
    }
    const cost = hillCostMap(d, w, h);
    const Hhat = makeStcSubmatrix(STC_H, stcW);
    const xb = new Uint8Array(n), rho = new Float64Array(n);
    for (let k = 0; k < n; k++) { const px = op[headBits2 + k]; xb[k] = d[px*4+2] & 1; rho[k] = cost[px]; }
    const m = new Uint8Array(bodyBits);
    for (let i = 0; i < bodyBits; i++) { const g = HEADER_BYTES*8 + i; m[i] = (payload[g>>3] >> (7-(g&7))) & 1; }
    const y = stcEmbed(xb, m, rho, STC_H, Hhat);
    for (let k = 0; k < n; k++) { const px = op[headBits2 + k]; d[px*4+2] = (d[px*4+2] & 0xFE) | y[k]; }
    return imageData;
  }

  // Capacidade conta SÓ pixels opacos. Header usa headerBits pixels; o corpo usa
  // o restante (1 bit/px no canal B; 3 bits/px no RGB).
  const bodyPx = opCount - headerBits;
  const bodyCapacity = (mode === MODE_RGB && !adaptive) ? bodyPx * 3 : bodyPx;
  if (opCount < headerBits || bodyBits > bodyCapacity) throw new Error(t('msgTooLong'));

  // Marca as flags no byte de modo DO PAYLOAD (byte 5) antes de escrever o header.
  if (shuffle) payload[5] |= FLAG_SHUFFLED;
  if (adaptive) { payload[5] |= FLAG_ADAPTIVE; payload[5] |= FLAG_HILLV2; }
  if (stealth) payload[5] |= FLAG_STEALTH;

  // Modo furtivo: cifra os HEADER_BYTES iniciais do payload com keystream da senha.
  let headerSlice = payload.slice(0, HEADER_BYTES);
  if (stealth && password.length > 0) {
    headerSlice = xorHeader(headerSlice, password);
  }

  // 1) Cabeçalho: primeiros headerBits pixels OPACOS, canal B, sequencial.
  // No modo adaptativo usa LSBR (não transborda); senão LSBM.
  const writeBit = adaptive ? writeBitLSBR : writeBitLSBM;
  for (let i = 0; i < headerBits; i++) {
    const bit = (headerSlice[Math.floor(i/8)] >> (7-(i%8))) & 1;
    writeBit(d, op[i]*4+2, bit);
  }

  if (adaptive) {
    // Adaptativo: entre os pixels OPACOS além do header, escolhe os de MENOR custo.
    const cost = hillCostMap(d, w, h);
    const orderPx = adaptiveOrder(cost, op.subarray(headerBits));
    const bitOrder = shuffle ? shuffledOrder(bodyBits, password) : null;
    for (let k = 0; k < bodyBits; k++) {
      const i = bitOrder ? bitOrder[k] : k;
      const bitGlobal = headerBits + i;
      const bit = (payload[Math.floor(bitGlobal/8)] >> (7-(bitGlobal%8))) & 1;
      writeBitLSBR(d, orderPx[k]*4 + 2, bit);
    }
    return imageData;
  }

  // 2b) Não-adaptativo: ordem sequencial (ou embaralhada por senha) nos pixels opacos.
  const order = shuffle ? shuffledOrder(bodyBits, password) : null;
  if (mode === MODE_B) {
    for (let k = 0; k < bodyBits; k++) {
      const i = order ? order[k] : k;
      const bitGlobal = headerBits + i;
      const bit = (payload[Math.floor(bitGlobal/8)] >> (7-(bitGlobal%8))) & 1;
      writeBitLSBM(d, op[headerBits + k]*4+2, bit);
    }
  } else {
    for (let k = 0; k < bodyBits; k++) {
      const i = order ? order[k] : k;
      const bitGlobal = headerBits + i;
      const bit = (payload[Math.floor(bitGlobal/8)] >> (7-(bitGlobal%8))) & 1;
      const px = op[headerBits + Math.floor(k/3)];
      const chan = k % 3;
      writeBitLSBM(d, px*4 + chan, bit);
    }
  }
  return imageData;
}

// ════════════════════════════════════════
//  NEGAÇÃO PLAUSÍVEL — mensagem alternativa
//  A camada alternativa cresce do fim do pool opaco para trás, em canal B, sem
//  MAGIC ou flag pública. Dois blocos AES-GCM guardam comprimento e mensagem; a
//  tag autentica a senha. A checagem de colisão impede sobreposição com a camada
//  principal que cresce a partir do início.
// ════════════════════════════════════════

// Escreve `bytes` no canal B dos pixels opacos, do último para trás, a partir
// do deslocamento `bitOffset` (em bits, contados do fim). LSB replacement.
function writeDecoyTailBits(d, op, bytes, bitOffset) {
  const nBits = bytes.length * 8;
  for (let i = 0; i < nBits; i++) {
    const px = op[op.length - 1 - (bitOffset + i)];
    const bit = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
    d[px * 4 + 2] = (d[px * 4 + 2] & 0xFE) | bit;
  }
  return nBits;
}

// Embute a mensagem-isca no fim. `realUsedPx` = nº de pixels opacos já ocupados
// pela mensagem real a partir do início (para checar colisão). Lança se as duas
// camadas não couberem juntas. Retorna nº de bits usados pela isca.
async function embedDecoyTail(imageData, decoyText, decoyPwd, realUsedPx) {
  const d = imageData.data;
  const op = opaquePixels(d);
  const msgBytes = new TextEncoder().encode(decoyText);

  // Bloco-len: cifra o comprimento (uint32 BE) → 12 + 4 + 16 = 32 bytes.
  const lenPlain = new Uint8Array(4);
  new DataView(lenPlain.buffer).setUint32(0, msgBytes.length, false);
  const blockLen = await decoyGcmEncrypt(lenPlain, decoyPwd);
  // Bloco-msg: cifra a mensagem → 12 + len + 16 bytes.
  const blockMsg = await decoyGcmEncrypt(msgBytes, decoyPwd);

  const totalBits = (blockLen.length + blockMsg.length) * 8;

  // Colisão: real (do início) + isca (do fim) não podem exceder o pool.
  if (realUsedPx + totalBits > op.length) {
    throw new Error(t('msgTooLong'));
  }

  let off = 0;
  off += writeDecoyTailBits(d, op, blockLen, off);
  off += writeDecoyTailBits(d, op, blockMsg, off);
  return totalBits;
}
