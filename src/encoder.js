const MAGIC = [0x53,0x54,0x45,0x47,0x4F]; // "STEGO" (5 bytes; o 6º byte agora é o flag de modo)
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
const STC_H = 8;       // altura de restrição do trellis (2^h estados). h=8 = ótimo memória/eficiência.
const STC_WMAX = 16;   // largura máxima da submatriz (= 1/α mínimo); limita memória do path.

// ════════════════════════════════════════
//  MODO FURTIVO — header cifrado por senha (ETAPA 1)
//  O header (MAGIC + modo + tamanho) normalmente fica em claro nos primeiros
//  pixels, com o MAGIC "STEGO" funcionando como assinatura óbvia — qualquer
//  ferramenta que saiba procurá-lo detecta a presença da mensagem. No modo
//  furtivo, derivamos um keystream da SENHA (via o mesmo PRNG do embaralhamento)
//  e fazemos XOR sobre os bytes do header. Sem a senha, o header parece ruído
//  aleatório (nenhum MAGIC reconhecível). Com a senha certa, o decoder reverte o
//  XOR e o MAGIC reaparece — o que serve de auto-validação (senha errada → MAGIC
//  não bate → rejeitado). O bit de modo também é cifrado, então preservamos a
//  flag FLAG_STEALTH numa posição derivada para o decoder saber que deve tentar.
//  ESTRATÉGIA: o byte de modo é XORado mas mantemos a informação de que é furtivo
//  porque o decoder SEMPRE tenta decifrar com a senha quando uma senha é dada e o
//  header em claro não valida. Furtivo exige senha (sem senha não há keystream).
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
//  EMBEDDING ADAPTATIVO — custo HILL (FRENTE 3)
//  Em vez de embutir em posições fixas/sequenciais (que o RS/WS pega em áreas
//  lisas), o adaptativo calcula um MAPA DE CUSTO: quão detectável seria alterar
//  cada pixel. Textura/ruído/bordas = custo baixo (a alteração se esconde no
//  caos natural); áreas lisas = custo altíssimo. Embute nos pixels de MENOR
//  custo primeiro. O decoder recalcula o MESMO mapa sobre a imagem-estego
//  (alterar LSBs quase não muda o custo, que depende dos bits significativos) e
//  encontra as mesmas posições. Versão pragmática: custo HILL + seleção greedy
//  dos menores custos (sem STC ótimo, que fica como evolução futura).
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

// Box-blur SEPARÁVEL (média k×k) por somas correntes — O(n) independente do raio,
// com bordas por replicação (clamp), igual ao resto do mapa. Determinístico: encode e
// decode rodam o MESMO código sobre a MESMA luminância (7 bits), então o resultado é
// idêntico bit-a-bit (round-trip do adaptativo preservado).
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
//  STC — Syndrome-Trellis Codes (FRENTE #13)
//  Embute o CORPO escolhendo o conjunto de alterações de MENOR custo HILL total,
//  sujeito a H·y=m, via Viterbi sobre trellis de 2^STC_H estados. Decode = síndrome
//  (m=H·y), independente de custo → mais robusto que o adaptativo. Validado isolado
//  em Node: custo exatamente ótimo (vs força bruta), round-trip exato, ~3,4 bits/
//  mudança vs ~2,0 do LSB-matching. Submatriz Ĥ determinística por seed (reusa
//  mulberry32). Path bit-packed para limitar memória (~n·2^h/8 bytes).
// ════════════════════════════════════════
function buildPayload(data, mode=MODE_B) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = bytes.length;
  const out = new Uint8Array(MAGIC.length + 1 + 4 + len);
  out.set(MAGIC);
  out[5] = mode & 0xFF; // flag de modo
  out[6]=(len)&0xFF; out[7]=(len>>8)&0xFF; out[8]=(len>>16)&0xFF; out[9]=(len>>24)&0xFF;
  out.set(bytes, MAGIC.length+1+4);
  return out;
}

// Fonte de bits ±1 do LSB Matching. Era Math.random(), que num navegador é um
// PRNG rápido e previsível — a direção de cada alteração é parte do padrão que
// um esteganalista observa, então ela merece a mesma aleatoriedade do resto da
// cripto. Consome de um buffer de crypto.getRandomValues() para não pagar uma
// chamada por pixel.
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
  if ((cur & 1) === bit) return;       // já coincide
  if (cur === 0) d[idx] = 1;           // não pode subtrair
  else if (cur === 255) d[idx] = 254;  // não pode somar
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
const HEADER_BYTES = MAGIC.length + 1 + 4; // 10

function embedLSB(imageData, payload, mode=MODE_B, password='', adaptive=false, stealth=false, stcW=0) {
  const d = imageData.data;
  const w = imageData.width, h = imageData.height;
  const op = opaquePixels(d);              // pixels utilizáveis (opacos, alfa==255)
  const opCount = op.length;
  const headerBits = HEADER_BYTES * 8;
  const bodyBits = (payload.length - HEADER_BYTES) * 8;
  const shuffle = password.length > 0;

  // ── CORPO via STC (Frente #13): early return. Header(10)+w-byte(1) sequenciais
  //    no canal B (LSBR); corpo nos pixels seguintes, escolhendo as alterações de
  //    MENOR custo HILL total (Viterbi). Decode é por síndrome, sem custo. ──
  if (stcW > 0) {
    payload[5] |= FLAG_STC;
    if (stealth) payload[5] |= FLAG_STEALTH;
    const headBits2 = (HEADER_BYTES + 1) * 8; // 88 = header(80) + w-byte(8)
    const n = bodyBits * stcW;
    if (opCount < headBits2 + n) throw new Error(t('msgTooLong'));
    // header(10)+w-byte cifrados juntos no furtivo (keystream é posição-baseado)
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

  // 2) Corpo
  if (adaptive) {
    // Adaptativo: entre os pixels OPACOS além do header, escolhe os de MENOR custo.
    const cost = hillCostMap(d, w, h);
    const orderPx = adaptiveOrder(cost, op.subarray(headerBits)); // pixels por custo crescente
    const bitOrder = shuffle ? shuffledOrder(bodyBits, password) : null;
    for (let k = 0; k < bodyBits; k++) {
      const i = bitOrder ? bitOrder[k] : k;     // qual bit do corpo
      const bitGlobal = headerBits + i;
      const bit = (payload[Math.floor(bitGlobal/8)] >> (7-(bitGlobal%8))) & 1;
      writeBitLSBR(d, orderPx[k]*4 + 2, bit);   // canal B, replacement
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
//  NEGAÇÃO PLAUSÍVEL — embed da mensagem-isca (decoy) — Opção C
//  A isca é gravada por LSB (canal B) a partir do FIM do pool de pixels opacos,
//  crescendo para trás. Cada bloco é AES-256-GCM (Argon2id, salt derivado da
//  senha da isca). Validação é pela TAG do GCM — SEM MAGIC, SEM flag no header
//  da real (marcar a existência da isca seria um distinguidor → quebraria a
//  negação plausível). A real (STC, do início) e a isca (do fim) não se tocam
//  desde que caibam juntas — checado em embedDecoyTail via colisão.
//
//  Layout no FIM (do último pixel opaco para trás), em blocos de bits:
//    [ Bloco-len : iv(12) + GCM(len:uint32 BE)+tag = 12+4+16 = 32 bytes fixos ]
//    [ Bloco-msg : iv(12) + GCM(mensagem)+tag = 12 + len + 16 bytes ]
//  O bloco-len tem tamanho fixo → âncora localizável só com a senha. Sem a
//  senha, tudo é ruído LSB indistinguível de uma imagem sem isca.
// ════════════════════════════════════════

// Escreve `bytes` no canal B dos pixels opacos, do último para trás, a partir
// do deslocamento `bitOffset` (em bits, contados do fim). LSB replacement.
function writeDecoyTailBits(d, op, bytes, bitOffset) {
  const nBits = bytes.length * 8;
  for (let i = 0; i < nBits; i++) {
    const px = op[op.length - 1 - (bitOffset + i)];
    const bit = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
    d[px * 4 + 2] = (d[px * 4 + 2] & 0xFE) | bit; // canal B
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
  const blockLen = await decoyGcmEncrypt(lenPlain, decoyPwd);   // 32 bytes
  // Bloco-msg: cifra a mensagem → 12 + len + 16 bytes.
  const blockMsg = await decoyGcmEncrypt(msgBytes, decoyPwd);   // 12+len+16

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
