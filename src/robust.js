// ============================================================================
// robust.js — modo mais resistente em JPEG/DCT
//
// Embute o payload nos coeficientes DCT de um JPEG por Quantization Index
// Modulation. O objetivo é aumentar a resistência às recompressões observadas nos
// fluxos sociais medidos; não existe promessa universal de sobrevivência. O modo LSB
// privilegia furtividade, enquanto este modo aceita mais alteração em troca de robustez.
//
// Os parâmetros vêm das medições consolidadas em docs/SOCIAL_PLATFORM_MEASUREMENTS.md:
//   · envelope 1080 px  — faixa de trabalho dos fluxos medidos
//   · Δ = 80             — margem escolhida após os ensaios de recompressão
//   · nsym = 32          — ECC protege o payload autenticado contra erros de bit
//   · tabela q80         — compromisso medido entre distorção e robustez
//
// O payload transportado é o MESMO do modo LSB (buildPayload), então o decoder
// reaproveita o parser que já existe.
// ============================================================================

const RB_MAGIC = [0x53, 0x53, 0x52, 0x31];   // 'SSR1'
const RB_VERSION = 1;
const RB_HEAD_BYTES = 14;
const RB_HEAD_NSYM = 32;                      // cabeçalho SEMPRE com nsym=32
const RB_HEAD_DELTA = 80;                     // e SEMPRE com Δ=80 (o mais robusto)
const RB_DELTA = 80;
const RB_NSYM = 32;
const RB_QUALITY = 80;
const RB_MAX_W = 1080;
const RB_AC_MAX = 1023;
const RB_BANDA = [3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48];

// ---------------------------------------------------------------- GF(256)
const RB_EXP = new Uint8Array(512), RB_LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { RB_EXP[i] = x; RB_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) RB_EXP[i] = RB_EXP[i - 255];
})();
const rbMul = (a, b) => (a === 0 || b === 0) ? 0 : RB_EXP[RB_LOG[a] + RB_LOG[b]];
const rbDiv = (a, b) => a === 0 ? 0 : RB_EXP[RB_LOG[a] + 255 - RB_LOG[b]];
const rbInv = (a) => RB_EXP[255 - RB_LOG[a]];
const rbPow = (n) => RB_EXP[((n % 255) + 255) % 255];
function rbPolyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] ^= rbMul(p[i], q[j]);
  return r;
}
function rbPolyEval(p, x) { let y = p[0]; for (let i = 1; i < p.length; i++) y = rbMul(y, x) ^ p[i]; return y; }
function rbPolyScale(p, x) { const r = new Uint8Array(p.length); for (let i = 0; i < p.length; i++) r[i] = rbMul(p[i], x); return r; }
function rbPolyAdd(p, q) {
  const r = new Uint8Array(Math.max(p.length, q.length));
  for (let i = 0; i < p.length; i++) r[i + r.length - p.length] ^= p[i];
  for (let i = 0; i < q.length; i++) r[i + r.length - q.length] ^= q[i];
  return r;
}
const _rbGenCache = {};
function rbGenerator(nsym) {
  if (_rbGenCache[nsym]) return _rbGenCache[nsym];   // um por nsym, não por bloco
  let g = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) g = rbPolyMul(g, new Uint8Array([1, RB_EXP[i]]));
  return (_rbGenCache[nsym] = g);
}
function rbEncBlock(msg, nsym) {
  const gen = rbGenerator(nsym), out = new Uint8Array(msg.length + nsym);
  out.set(msg);
  for (let i = 0; i < msg.length; i++) {
    const c = out[i];
    if (c !== 0) for (let j = 1; j < gen.length; j++) out[i + j] ^= rbMul(gen[j], c);
  }
  out.set(msg);
  return out;
}
function rbSynd(msg, nsym) {
  const s = new Uint8Array(nsym + 1);
  for (let i = 0; i < nsym; i++) s[i + 1] = rbPolyEval(msg, rbPow(i));
  return s;
}
function rbDecBlock(cw, nsym) {
  const r = Uint8Array.from(cw);
  const synd = rbSynd(r, nsym);
  let zero = true; for (let i = 0; i < synd.length; i++) if (synd[i]) { zero = false; break; }
  if (zero) return { data: r.subarray(0, r.length - nsym), erros: 0 };
  // Berlekamp-Massey
  let errLoc = new Uint8Array([1]), oldLoc = new Uint8Array([1]);
  const shift = synd.length - nsym;
  for (let i = 0; i < nsym; i++) {
    const K = i + shift; let delta = synd[K];
    for (let j = 1; j < errLoc.length; j++) delta ^= rbMul(errLoc[errLoc.length - 1 - j], synd[K - j]);
    const grow = new Uint8Array(oldLoc.length + 1); grow.set(oldLoc); oldLoc = grow;
    if (delta !== 0) {
      if (oldLoc.length > errLoc.length) {
        const novo = rbPolyScale(oldLoc, delta);
        oldLoc = rbPolyScale(errLoc, rbInv(delta));
        errLoc = novo;
      }
      errLoc = rbPolyAdd(errLoc, rbPolyScale(oldLoc, delta));
    }
  }
  let k0 = 0; while (k0 < errLoc.length && errLoc[k0] === 0) k0++;
  errLoc = errLoc.subarray(k0);
  if (errLoc.length - 1 > nsym / 2) return null;
  // Chien
  const pos = [];
  for (let i = 0; i < r.length; i++) if (rbPolyEval(errLoc, rbPow(255 - i)) === 0) pos.push(r.length - 1 - i);
  if (pos.length !== errLoc.length - 1) return null;
  // Forney
  const coefPos = pos.map(p => r.length - 1 - p);
  let eLoc = new Uint8Array([1]);
  for (const i of coefPos) eLoc = rbPolyMul(eLoc, rbPolyAdd(new Uint8Array([1]), new Uint8Array([rbPow(i), 0])));
  const sr = Uint8Array.from(synd).reverse();
  const prod = rbPolyMul(sr, eLoc);
  const eEval = Uint8Array.from(prod.subarray(prod.length - eLoc.length)).reverse();
  const X = coefPos.map(cp => rbPow(-(255 - cp)));
  const E = new Uint8Array(r.length);
  for (let i = 0; i < X.length; i++) {
    const Xinv = rbInv(X[i]);
    let deriv = 1;
    for (let j = 0; j < X.length; j++) if (j !== i) deriv = rbMul(deriv, 1 ^ rbMul(Xinv, X[j]));
    if (deriv === 0) return null;
    E[pos[i]] = rbDiv(rbMul(X[i], rbPolyEval(Uint8Array.from(eEval).reverse(), Xinv)), deriv);
  }
  const fixed = rbPolyAdd(r, E);
  const chk = rbSynd(fixed, nsym);
  for (let i = 0; i < chk.length; i++) if (chk[i]) return null;   // não convergiu
  return { data: fixed.subarray(0, fixed.length - nsym), erros: pos.length };
}
// entrelaçado: espalha rajadas entre blocos
function rbRsEncode(data, nsym) {
  const k = 255 - nsym, nb = Math.ceil(data.length / k);
  const out = new Uint8Array(nb * 255);
  for (let b = 0; b < nb; b++) {
    const msg = new Uint8Array(k);
    msg.set(data.subarray(b * k, Math.min((b + 1) * k, data.length)));
    const cw = rbEncBlock(msg, nsym);
    for (let i = 0; i < 255; i++) out[i * nb + b] = cw[i];
  }
  return { data: out, nblocos: nb };
}
function rbRsDecode(buf, nsym, nb, tamOriginal) {
  const k = 255 - nsym, saida = new Uint8Array(nb * k);
  let erros = 0;
  for (let b = 0; b < nb; b++) {
    const cw = new Uint8Array(255);
    for (let i = 0; i < 255; i++) cw[i] = buf[i * nb + b];
    const res = rbDecBlock(cw, nsym);
    if (!res) return null;
    erros += res.erros;
    saida.set(res.data, b * k);
  }
  return { data: saida.subarray(0, tamOriginal), erros };
}

// ------------------------------------------------------- plano de slots (QIM)
function rbXorshift(seed) {
  let s = (seed | 0) || 0x9E3779B9;
  return function () { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296; };
}
function rbSeed(senha) {
  let h = 0x811C9DC5;
  const b = new TextEncoder().encode(senha || '');
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return h | 0;
}
// Ordem e dither dependem SÓ da senha — não do Δ. Assim cabeçalho e corpo
// podem usar Δ diferentes sobre a mesma sequência de slots.
function rbPlan(wb, hb, senha) {
  const slots = new Int32Array(wb * hb * RB_BANDA.length);
  let n = 0;
  for (let r = 0; r < hb; r++) for (let c = 0; c < wb; c++)
    for (let i = 0; i < RB_BANDA.length; i++) slots[n++] = (r * wb + c) * 64 + RB_BANDA[i];
  const rnd = rbXorshift(rbSeed(senha));
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = slots[i]; slots[i] = slots[j]; slots[j] = t;
  }
  const u = new Float64Array(slots.length);
  for (let i = 0; i < slots.length; i++) u[i] = rnd();
  return { slots, u, wb, total: slots.length };
}
const rbStep = (q, delta) => Math.max(2, Math.ceil(delta / q));   // m, com Δ = m·q

function rbEmbedBits(blocks, plan, qNat, bits, offset, delta) {
  for (let i = 0; i < bits.length; i++) {
    const s = plan.slots[offset + i], bi = (s / 64) | 0, pos = s % 64;
    const blk = blocks.get('0,' + ((bi / plan.wb) | 0) + ',' + (bi % plan.wb));
    const m = rbStep(qNat[pos], delta), d = Math.floor(plan.u[offset + i] * m);
    let j = Math.round((blk[pos] - d) / m);
    if (((j % 2) + 2) % 2 !== bits[i]) j += (blk[pos] - d >= j * m) ? 1 : -1;
    let k = j * m + d;
    while (k > RB_AC_MAX) k -= 2 * m;      // limite do baseline é no QUANTIZADO
    while (k < -RB_AC_MAX) k += 2 * m;
    blk[pos] = k;
  }
}
function rbExtractBits(decLido, plan, qNat, qLido, nbits, offset, delta) {
  const out = new Uint8Array(nbits);
  for (let i = 0; i < nbits; i++) {
    const s = plan.slots[offset + i], bi = (s / 64) | 0, pos = s % 64;
    const blk = decLido.blocks.get('0,' + ((bi / plan.wb) | 0) + ',' + (bi % plan.wb));
    if (!blk) { out[i] = 0; continue; }
    const m = rbStep(qNat[pos], delta), d = Math.floor(plan.u[offset + i] * m);
    const j = Math.round((blk[pos] * qLido[pos] / qNat[pos] - d) / m);
    out[i] = ((j % 2) + 2) % 2;
  }
  return out;
}

// ------------------------------------------------------------------ utilidades
function rbBytesToBits(b) {
  const o = new Uint8Array(b.length * 8);
  for (let i = 0; i < b.length; i++) for (let j = 0; j < 8; j++) o[i * 8 + j] = (b[i] >> (7 - j)) & 1;
  return o;
}
function rbBitsToBytes(x) {
  const o = new Uint8Array(x.length >> 3);
  for (let i = 0; i < o.length; i++) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | x[i * 8 + j]; o[i] = v; }
  return o;
}
function rbCrc16(b, n) {
  let c = 0xFFFF;
  for (let i = 0; i < n; i++) {
    c ^= b[i] << 8;
    for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
  }
  return c;
}
// Reamostragem por média de área. Evita canvas para manter o caminho de pixels
// determinístico e independente de transformações específicas do navegador.
function rbResize(rgba, w, h, nw, nh) {
  const out = new Uint8ClampedArray(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.min(h, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.min(w, Math.ceil((x + 1) * sx)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const p = (yy * w + xx) * 4; r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2]; n++;
      }
      const o = (y * nw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}
// Dimensão de saída do modo robusto: dentro do envelope medido de 1080 px.
function rbTargetSize(w, h) {
  // Dentro do envelope, preserve as dimensões originais: a DCT direta replica
  // bordas para blocos 8x8 parciais e não exige recorte prévio.
  if (w <= RB_MAX_W && h <= RB_MAX_W) return { w, h };
  // Só quando precisa REDUZIR: aí o múltiplo de 8 evita uma faixa parcial de
  // blocos que a plataforma poderia tratar de forma diferente na recompressão.
  const sc = RB_MAX_W / Math.max(w, h);
  const nw = Math.max(8, Math.round(w * sc)), nh = Math.max(8, Math.round(h * sc));
  return { w: nw - (nw % 8), h: nh - (nh % 8) };
}
// Capacidade útil, em bytes de payload, para uma dada dimensão.
function rbCapacity(w, h) {
  const { w: tw, h: th } = rbTargetSize(w, h);
  const wb = Math.ceil(tw / 8), hb = Math.ceil(th / 8);
  const total = wb * hb * RB_BANDA.length;
  const headBits = (RB_HEAD_BYTES + RB_HEAD_NSYM) * 8;
  const corpoBytes = Math.floor((total - headBits) / 8);
  const nb = Math.floor(corpoBytes / 255);
  return { bytes: Math.max(0, nb * (255 - RB_NSYM)), w: tw, h: th, slots: total };
}

// ------------------------------------------------------------------- EMBUTIR
// rgba/w/h: a capa LIMPA. payload: o MESMO buildPayload do modo LSB.
function robustEmbed(rgba, w, h, payload, senha) {
  const alvo = rbTargetSize(w, h);
  const px = (alvo.w === w && alvo.h === h) ? rgba : rbResize(rgba, w, h, alvo.w, alvo.h);
  const dec = imageToJpegCoefficients(px, alvo.w, alvo.h, { quality: RB_QUALITY });
  const qNat = dec._qNatural[0];
  const c0 = dec.comps[0];
  const plan = rbPlan(c0.width_blocks, c0.height_blocks, senha);

  const rs = rbRsEncode(payload, RB_NSYM);
  const corpoBits = rbBytesToBits(rs.data);
  const headBits = (RB_HEAD_BYTES + RB_HEAD_NSYM) * 8;
  if (headBits + corpoBits.length > plan.total) {
    const cap = rbCapacity(w, h);
    const err = new Error('robustCapacity');
    err.capacidade = cap.bytes; err.necessario = payload.length;
    throw err;
  }
  const head = new Uint8Array(RB_HEAD_BYTES);
  head.set(RB_MAGIC); head[4] = RB_VERSION; head[5] = 0;
  head[6] = RB_DELTA; head[7] = RB_NSYM;
  head[8] = payload.length & 0xFF; head[9] = (payload.length >> 8) & 0xFF;
  head[10] = (payload.length >> 16) & 0xFF; head[11] = (payload.length >> 24) & 0xFF;
  const crc = rbCrc16(head, 12); head[12] = crc & 0xFF; head[13] = (crc >> 8) & 0xFF;

  rbEmbedBits(dec.blocks, plan, qNat, rbBytesToBits(rbEncBlock(head, RB_HEAD_NSYM)), 0, RB_HEAD_DELTA);
  rbEmbedBits(dec.blocks, plan, qNat, corpoBits, headBits, RB_DELTA);

  return {
    jpeg: encodeJpegCoefficients(dec),
    width: alvo.w, height: alvo.h,
    redimensionada: (alvo.w !== w || alvo.h !== h),
    bytesUsados: payload.length,
    capacidade: rbCapacity(w, h).bytes,
    slotsUsados: headBits + corpoBits.length, slotsTotal: plan.total,
  };
}

// -------------------------------------------------------------------- EXTRAIR
// Devolve {status:'ok'|'damaged'|'none', payload}. 'damaged' é o caso honesto:
// o cabeçalho sobreviveu mas o corpo não — melhor do que dizer "nada aqui".
function robustExtract(jpegBytes, senha) {
  let dec;
  try { dec = decodeJpegCoefficients(jpegBytes); } catch (_) { return { status: 'none' }; }
  const c0 = dec.comps[0];
  const qLido = rbZigToNat(dec.qtables[c0.qt]);
  const qNat = rbQtableNatural(RB_QUALITY);
  const plan = rbPlan(c0.width_blocks, c0.height_blocks, senha);
  const headBits = (RB_HEAD_BYTES + RB_HEAD_NSYM) * 8;
  if (plan.total <= headBits) return { status: 'none' };

  const hb = rbExtractBits(dec, plan, qNat, qLido, headBits, 0, RB_HEAD_DELTA);
  const hres = rbDecBlock(rbBitsToBytes(hb), RB_HEAD_NSYM);
  if (!hres) return { status: 'none' };
  const head = hres.data;
  for (let i = 0; i < 4; i++) if (head[i] !== RB_MAGIC[i]) return { status: 'none' };
  const crc = rbCrc16(head, 12);
  if ((crc & 0xFF) !== head[12] || ((crc >> 8) & 0xFF) !== head[13]) return { status: 'none' };

  const delta = head[6], nsym = head[7];
  const len = head[8] | (head[9] << 8) | (head[10] << 16) | (head[11] << 24);
  if (len <= 0 || len > 1 << 24) return { status: 'damaged' };
  const nb = Math.ceil(len / (255 - nsym));
  const corpoBits = nb * 255 * 8;
  if (headBits + corpoBits > plan.total) return { status: 'damaged' };
  const cb = rbExtractBits(dec, plan, qNat, qLido, corpoBits, headBits, delta);
  const r = rbRsDecode(rbBitsToBytes(cb), nsym, nb, len);
  if (!r) return { status: 'damaged' };
  return { status: 'ok', payload: r.data, errosCorrigidos: r.erros };
}

function rbZigToNat(zz) {
  const n = new Array(64);
  for (let k = 0; k < 64; k++) n[JD_ZIGZAG[k]] = zz[k];
  return n;
}
function rbQtableNatural(quality) {
  const s = quality < 50 ? Math.floor(5000 / quality) : 200 - 2 * quality;
  return JD_ANNEX_K_LUM.map(v => Math.min(255, Math.max(1, Math.floor((v * s + 50) / 100))));
}

// ── Assinatura estatística do próprio modo robusto ───────────────────────────
// Detecta o QIM em imagem de TERCEIRO — sem senha, sem extração.
//
// Como funciona: o QIM força cada coeficiente usado a um ponto do reticulado, e
// zero quase nunca é um deles. A taxa de zeros na banda 6-21 desaba. Sozinha
// essa taxa não serve (capas limpas variam de 14% a 74%), então comparamos com
// a banda vizinha 22-35 DA MESMA IMAGEM — o que cancela o conteúdo da capa.
//
// CALIBRAÇÃO MEDIDA (46 imagens limpas: 5 capas × 7 qualidades + 10 fotos reais
// de WhatsApp, Facebook, Instagram e X):
//     menor razão entre as limpas ....... 0,147
//     maior razão em stego 100% cheio ... 0,092
//     limiar adotado .................... 0,120  (margem ~22% para cada lado)
//
// ⚠️ LIMITE HONESTO: só acusa payload que ocupa quase toda a capacidade. A 50%
// não dispara (menor medida: 0,150); abaixo disso o sinal fica dentro da
// variação natural entre capas. AUSÊNCIA DE SINAL NÃO SIGNIFICA IMAGEM LIMPA.
const RB_SIG_LIMIAR = 0.12;
const RB_SIG_MIN_BLOCOS = 500;      // abaixo disso a estatística é ruído

function robustSignature(dec) {
  try {
    if (!dec || !dec.comps || !dec.comps.length) return null;
    const zz = JD_ZIGZAG;
    let z1 = 0, n1 = 0, z2 = 0, n2 = 0, blocos = 0;
    for (const [chave, v] of dec.blocks) {
      if (chave.charCodeAt(0) !== 48 || chave.charCodeAt(1) !== 44) continue;  // só '0,'
      blocos++;
      for (let p = 6; p < 22; p++) { if (v[zz[p]] === 0) z1++; n1++; }
      for (let p = 22; p < 36; p++) { if (v[zz[p]] === 0) z2++; n2++; }
    }
    if (blocos < RB_SIG_MIN_BLOCOS || !n1 || !n2) return null;
    const taxaAlta = z2 / n2;
    if (taxaAlta <= 0.02) return null;          // banda vizinha vazia: sem base
    const razao = (z1 / n1) / taxaAlta;
    return { razao, limiar: RB_SIG_LIMIAR, blocos, suspeito: razao < RB_SIG_LIMIAR };
  } catch (_) { return null; }
}
