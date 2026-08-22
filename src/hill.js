function boxBlurSeparableInto(src, w, h, radius, tmp, out) {
  const k = 2*radius + 1;
  const cx = i => i<0 ? 0 : (i>=w ? w-1 : i);
  const cy = j => j<0 ? 0 : (j>=h ? h-1 : j);
  // horizontal
  for (let y=0; y<h; y++) {
    const row = y*w;
    let sum = 0;
    for (let i=-radius; i<=radius; i++) sum += src[row + cx(i)];
    for (let x=0; x<w; x++) {
      tmp[row+x] = sum / k;
      sum -= src[row + cx(x-radius)];
      sum += src[row + cx(x+radius+1)];
    }
  }
  // vertical
  for (let x=0; x<w; x++) {
    let sum = 0;
    for (let j=-radius; j<=radius; j++) sum += tmp[cy(j)*w + x];
    for (let y=0; y<h; y++) {
      out[y*w+x] = sum / k;
      sum -= tmp[cy(y-radius)*w + x];
      sum += tmp[cy(y+radius+1)*w + x];
    }
  }
  return out;
}

function hillCostMap(d, w, h) {
  const n = w * h;
  // O1-M2: três buffers Float64 de tamanho n são suficientes para toda a cadeia.
  // A ordem aritmética permanece a mesma da implementação anterior; só o ciclo de
  // vida das matrizes mudou para reduzir pressão de memória/GC em imagens grandes.
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  const c = new Float64Array(n);

  // 1) Luminância usando apenas os 7 bits SUPERIORES de cada canal (LSB mascarado
  // com &0xFE). Isso é ESSENCIAL: o embedding altera o LSB, e se o custo dependesse
  // dele, a ordem por custo mudaria entre embed e extract. Mascarando o LSB, o
  // custo fica idêntico antes e depois de embutir → o decoder reconstrói a mesma
  // ordem exata.
  for (let i = 0; i < n; i++) {
    a[i] = 0.299*(d[i*4]&0xFE) + 0.587*(d[i*4+1]&0xFE) + 0.114*(d[i*4+2]&0xFE);
  }

  // 2) Resíduo de alta frequência: kernel KB 3x3 [[-1,2,-1],[2,-4,2],[-1,2,-1]].
  // Quanto maior |resíduo|, mais textura/borda ali.
  const at = (x,y) => a[Math.min(h-1,Math.max(0,y))*w + Math.min(w-1,Math.max(0,x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = -at(x-1,y-1)+2*at(x,y-1)-at(x+1,y-1)
                +2*at(x-1,y)  -4*at(x,y)  +2*at(x+1,y)
                -at(x-1,y+1)+2*at(x,y+1)-at(x+1,y+1);
      b[y*w+x] = Math.abs(v);
    }
  }

  // 3) Custo HILL canônico (Li et al. 2014): ρ = ( |R| ⊛ L1 )^{-1} ⊛ L2.
  //    L1 = média 3x3 (raio 1) suaviza o resíduo ANTES do inverso;
  //    L2 = média 15x15 (raio 7) espalha o custo DEPOIS do inverso, agrupando os
  //    mínimos de custo em regiões texturizadas (o que dá ao HILL a resistência
  //    à steganálise — melhor que uma única passada 3x3 sobre 1/|R|).
  // Reuso: L1 usa B→A(scratch)→C; o inverso substitui o resíduo em B; L2 usa
  // B→A(scratch)→C. Portanto o pico estrutural cai de até 6 para 3 Float64Array(n).
  const EPS = 1e-6;
  boxBlurSeparableInto(b, w, h, 1, a, c); // C = xi = |R| ⊛ L1
  for (let i = 0; i < n; i++) b[i] = 1 / (c[i] + EPS); // B = inv(xi)
  boxBlurSeparableInto(b, w, h, 7, a, c); // C = custo final
  return c;
}

// Mapa de custo HILL LEGADO (≤ v2.21): 1/|R| seguido de UMA média 3x3. Mantido apenas
// para DECODIFICAR imagens ADAPTATIVAS criadas antes da v2.22 (sem FLAG_HILLV2). Não usar
// para novos embeds — o `hillCostMap` (V2 canônico) é melhor. Round-trip dessas imagens
// antigas depende de este cálculo permanecer idêntico ao da época.
function hillCostMapLegacy(d, w, h) {
  const n = w * h;
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  const c = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = 0.299*(d[i*4]&0xFE) + 0.587*(d[i*4+1]&0xFE) + 0.114*(d[i*4+2]&0xFE);
  }
  const at = (x,y) => a[Math.min(h-1,Math.max(0,y))*w + Math.min(w-1,Math.max(0,x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = -at(x-1,y-1)+2*at(x,y-1)-at(x+1,y-1)
                +2*at(x-1,y)  -4*at(x,y)  +2*at(x+1,y)
                -at(x-1,y+1)+2*at(x,y+1)-at(x+1,y+1);
      b[y*w+x] = Math.abs(v);
    }
  }
  const EPS = 1e-6;
  for (let i = 0; i < n; i++) c[i] = 1 / (b[i] + EPS);
  const ai = (x,y) => c[Math.min(h-1,Math.max(0,y))*w + Math.min(w-1,Math.max(0,x))];
  // A já não precisa mais guardar luminância; vira a saída final do mapa legado.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) s += ai(x+dx,y+dy);
      a[y*w+x] = s / 9;
    }
  }
  return a;
}

// Ordena os pixels CANDIDATOS por custo CRESCENTE (menor custo = mais seguro,
// embutido primeiro). Os candidatos já vêm filtrados (pixels opacos fora do header).
// Empates desempatados pelo índice para ser reprodutível no encoder e no decoder.
function adaptiveOrder(cost, candidatePx) {
  let idx;
  if (candidatePx?.identityRange) {
    idx = new Array(candidatePx.length);
    for (let i=0;i<candidatePx.length;i++) idx[i]=candidatePx.start+i;
  } else {
    idx = Array.from(candidatePx);
  }
  idx.sort((a,b) => (cost[a] - cost[b]) || (a - b));
  return idx;
}

// O mapa HILL não define a derivação estrutural da senha. No formato legado,
// encoder.js/decoder.js ainda preservam a permutação Mulberry32/FNV necessária
// para compatibilidade. Na F21 v3, a estrutura protegida vive em f21.js; o caminho
// STC padrão recupera o corpo pela síndrome e não depende daquela ordem legada.
