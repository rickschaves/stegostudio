function makeStcSubmatrix(h, w, seed = 0x5715C0DE) {
  const rnd = mulberry32((seed ^ (h * 131 + w)) >>> 0);
  const mask = (1 << h) - 1;
  const cols = new Array(w);
  for (let j = 0; j < w; j++) cols[j] = (Math.floor(rnd() * (mask + 1)) & mask) | 1 | (1 << (h - 1));
  return cols;
}
function stcEmbed(x, msg, rho, h, Hhat) {
  const INF = Infinity, w = Hhat.length, mLen = msg.length, n = x.length, S = 1 << h;
  if (n !== mLen * w) throw new Error('STC: n != mLen*w');
  let wght = new Float64Array(S).fill(INF); wght[0] = 0;
  let nw = new Float64Array(S);
  const path = new Uint8Array(Math.ceil(n * S / 8)); // bit (i*S+s) = bit p/ chegar a s
  const pc = new Uint8Array(S);
  for (let b = 0; b < mLen; b++) {
    const rowsLeft = mLen - b, colMask = rowsLeft >= h ? (S - 1) : ((1 << rowsLeft) - 1);
    for (let j = 0; j < w; j++) {
      const i = b * w + j, col = Hhat[j] & colMask, xi = x[i], ri = rho[i];
      const cost0 = xi ? ri : 0, cost1 = xi ? 0 : ri;
      nw.fill(INF); pc.fill(0);
      for (let s = 0; s < S; s++) {
        const ws = wght[s]; if (ws === INF) continue;
        const c0 = ws + cost0; if (c0 < nw[s]) { nw[s] = c0; pc[s] = 0; }
        const s1 = s ^ col, c1 = ws + cost1; if (c1 < nw[s1]) { nw[s1] = c1; pc[s1] = 1; }
      }
      const base = i * S;
      for (let s = 0; s < S; s++) if (pc[s]) { const idx = base + s; path[idx >> 3] |= (1 << (idx & 7)); }
      const tmp = wght; wght = nw; nw = tmp;
    }
    nw.fill(INF); const mb = msg[b];
    for (let s = 0; s < S; s++) { if (wght[s] === INF) continue; if ((s & 1) !== mb) continue; const sh = s >>> 1; if (wght[s] < nw[sh]) nw[sh] = wght[s]; }
    const tmp = wght; wght = nw; nw = tmp;
  }
  if (wght[0] === INF) throw new Error('STC: sem caminho viável');
  const y = new Uint8Array(n); let state = 0;
  const getb = (i, s) => { const idx = i * S + s; return (path[idx >> 3] >> (idx & 7)) & 1; };
  for (let b = mLen - 1; b >= 0; b--) {
    state = (state << 1) | msg[b];
    const rowsLeft = mLen - b, colMask = rowsLeft >= h ? (S - 1) : ((1 << rowsLeft) - 1);
    for (let j = w - 1; j >= 0; j--) { const i = b * w + j, bit = getb(i, state); y[i] = bit; if (bit) state ^= (Hhat[j] & colMask); }
  }
  return y;
}
function stcExtract(y, mLen, h, Hhat) {
  const w = Hhat.length, S = 1 << h; const msg = new Uint8Array(mLen); let synd = 0;
  for (let b = 0; b < mLen; b++) {
    const rowsLeft = mLen - b, colMask = rowsLeft >= h ? (S - 1) : ((1 << rowsLeft) - 1);
    for (let j = 0; j < w; j++) { const i = b * w + j; if (y[i]) synd ^= (Hhat[j] & colMask); }
    msg[b] = synd & 1; synd >>>= 1;
  }
  return msg;
}
// Escolhe a maior largura w (=1/α) que cabe → máxima furtividade. 0 = não cabe.
function pickStcW(bodyBits, availBodyPx) {
  if (bodyBits === 0) return 1;
  const fit = Math.floor(availBodyPx / bodyBits);
  if (fit < 1) return 0;
  return Math.min(STC_WMAX, fit);
}
