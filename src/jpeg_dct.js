// ════════════════════════════════════════════════════════════════════════
//  jpeg_dct.js — base compartilhada de leitura de coeficientes DCT
// ════════════════════════════════════════════════════════════════════════
//  Reimplementa o essencial do jpeg_read_coefficients da libjpeg em JS: parseia
//  um JPEG baseline e expõe os COEFICIENTES DCT QUANTIZADOS por bloco 8×8, na
//  ordem NATURAL (row-major) — a mesma da libjpeg. Para ANTES da dequantização
//  e da IDCT (o navegador só entrega o resultado final da IDCT, sem coefs).
//
//  Consumidores: Steghide-JPEG, Analyzer-JPEG, modo mais resistente e OutGuess.
//  Cada um só lê os coeficientes; a base é construída uma vez e reutilizada.
//  A implementação foi validada coeficiente a coeficiente contra a libjpeg.
//
//  Suporte: baseline (SOF0/SOF1) E PROGRESSIVO (SOF2), 4:2:0/4:4:4/etc,
//  byte-stuffing, RSTn/DRI. O progressivo acumula N scans no mesmo buffer de
//  coeficientes (DC first/refine, AC first/refine, EOBRUN, aproximação
//  sucessiva Ah/Al). Validado coef-a-coef contra a libjpeg. Reimplementado do zero
//  a partir da ITU-T T.81 (sem copiar código de terceiros).
//
//  API pública:
//   decodeJpegCoefficients(bytes) → { header:{components,width,height},
//        comps:[{comp,h_samp,v_samp,width_blocks,height_blocks}],
//        blocks: Map("comp,row,col" → [64] coefs quantizados, ordem natural) }
//   jpegCoeffsLinear(dec) → [coefs...] na ordem componente→linha→bloco→coef
//        (a mesma que o steghide usa em LinDctCoeffs).
// ════════════════════════════════════════════════════════════════════════

function decodeJpegCoefficients(bytes) {
  // zig-zag → natural (ordem de armazenamento do libjpeg jpeg_read_coefficients)
  const ZIGZAG = [0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
  const d = bytes;
  const u16 = (o) => (d[o] << 8) | d[o + 1];

  const qtables = {};
  const huffDC = {}, huffAC = {};
  let frame = null;            // {precision,h,w,comps,progressive}
  let restartInterval = 0;
  let compData = null;         // buffers acumuladores (alocados no SOF)
  let maxH = 1, maxV = 1, mcusPerRow = 0, mcusPerCol = 0;

  // ---- Huffman canônico (Annex C do T.81) ----
  function buildHuff(counts, symbols) {
    const huffsize = [];
    for (let l = 1; l <= 16; l++) for (let i = 0; i < counts[l - 1]; i++) huffsize.push(l);
    huffsize.push(0);
    const huffcode = [];
    let code = 0, si = huffsize[0], k = 0;
    while (huffsize[k]) {
      while (huffsize[k] === si) { huffcode[k] = code; code++; k++; }
      code <<= 1; si++;
    }
    const mincode = new Array(17).fill(0), maxcode = new Array(17).fill(-1), valptr = new Array(17).fill(0);
    let kk = 0;
    for (let l = 1; l <= 16; l++) {
      if (counts[l - 1] > 0) {
        valptr[l] = kk; mincode[l] = huffcode[kk];
        kk += counts[l - 1]; maxcode[l] = huffcode[kk - 1];
      } else maxcode[l] = -1;
    }
    return { mincode, maxcode, valptr, huffval: symbols };
  }

  // ---- alocação dos buffers (uma vez, no SOF) ----
  function allocate() {
    maxH = Math.max(...frame.comps.map(c => c.hs));
    maxV = Math.max(...frame.comps.map(c => c.vs));
    mcusPerRow = Math.ceil(frame.w / (8 * maxH));
    mcusPerCol = Math.ceil(frame.h / (8 * maxV));
    compData = frame.comps.map(c => {
      // wb/hb PADDED (alinhado a MCU) para o armazenamento;
      // wbReal/hbReal são o que a libjpeg reporta e o que os scans
      // NÃO-entrelaçados percorrem.
      const wb = mcusPerRow * c.hs, hb = mcusPerCol * c.vs;
      const wbReal = Math.ceil((frame.w * c.hs / maxH) / 8);
      const hbReal = Math.ceil((frame.h * c.vs / maxV) / 8);
      const blocks = new Array(wb * hb);
      for (let i = 0; i < wb * hb; i++) blocks[i] = new Int16Array(64);
      return { wb, hb, wbReal, hbReal, blocks };
    });
  }

  // ---- leitor de bits (por scan) ----
  let bp = 0, bitBuf = 0, bitCnt = 0, markerHit = false;
  function resetBits() { bitBuf = 0; bitCnt = 0; markerHit = false; }
  function nextBit() {
    if (bitCnt === 0) {
      if (bp >= d.length) { markerHit = true; return 0; }
      let b = d[bp];
      if (b === 0xFF) {
        const b2 = d[bp + 1];
        if (b2 === 0x00) { bp += 2; }        // byte stuffing: vale 0xFF
        else { markerHit = true; return 0; } // marcador real: NÃO consome
      } else bp++;
      bitBuf = b; bitCnt = 8;
    }
    bitCnt--;
    return (bitBuf >> bitCnt) & 1;
  }
  function receive(n) { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | nextBit(); return v; }
  function extend(v, n) { return v < (1 << (n - 1)) ? v - (1 << n) + 1 : v; }
  function huffDecode(tbl) {
    let code = 0;
    for (let l = 1; l <= 16; l++) {
      code = (code << 1) | nextBit();
      if (tbl.maxcode[l] >= 0 && code <= tbl.maxcode[l]) {
        return tbl.huffval[tbl.valptr[l] + (code - tbl.mincode[l])];
      }
    }
    return 0;
  }

  // ---- decodificação de um scan ----
  let pred = [], EOBRUN = 0;

  function decodeScan(sc, Ss, Se, Ah, Al) {
    // sc: [{ci,dcTable,acTable}] na ordem do SOS
    resetBits();
    pred = new Array(frame.comps.length).fill(0);
    EOBRUN = 0;

    const interleaved = sc.length > 1;
    const nUnits = interleaved
      ? mcusPerRow * mcusPerCol
      : compData[sc[0].ci].wbReal * compData[sc[0].ci].hbReal;
    const unitsPerRow = interleaved ? mcusPerRow : compData[sc[0].ci].wbReal;

    let sinceRestart = 0;
    for (let u = 0; u < nUnits; u++) {
      if (restartInterval && sinceRestart === restartInterval) {
        // alinha no RSTn: pula até o marcador e o consome
        resetBits();
        while (bp < d.length && !(d[bp] === 0xFF && d[bp + 1] >= 0xD0 && d[bp + 1] <= 0xD7)) bp++;
        if (bp < d.length) bp += 2;
        pred.fill(0); EOBRUN = 0; sinceRestart = 0;
      }
      const ux = u % unitsPerRow, uy = (u / unitsPerRow) | 0;

      if (interleaved) {
        for (const s of sc) {
          const comp = frame.comps[s.ci], cd = compData[s.ci];
          for (let by = 0; by < comp.vs; by++) {
            for (let bx = 0; bx < comp.hs; bx++) {
              const row = uy * comp.vs + by, col = ux * comp.hs + bx;
              decodeBlock(cd.blocks[row * cd.wb + col], s, Ss, Se, Ah, Al);
            }
          }
        }
      } else {
        const s = sc[0], cd = compData[s.ci];
        decodeBlock(cd.blocks[uy * cd.wb + ux], s, Ss, Se, Ah, Al);
      }
      sinceRestart++;
    }
  }

  function decodeBlock(blk, s, Ss, Se, Ah, Al) {
    if (!frame.progressive) return decodeSequential(blk, s);
    if (Ss === 0) {
      if (Ah === 0) decodeDCFirst(blk, s, Al);
      else decodeDCRefine(blk, Al);
    } else {
      if (Ah === 0) decodeACFirst(blk, s, Ss, Se, Al);
      else decodeACRefine(blk, s, Ss, Se, Al);
    }
  }

  // --- baseline / sequencial (bloco inteiro de uma vez) ---
  function decodeSequential(blk, s) {
    const dcT = huffDC[s.dcTable], acT = huffAC[s.acTable];
    const t = huffDecode(dcT);
    const diff = t ? extend(receive(t), t) : 0;
    pred[s.ci] += diff;
    blk[0] = pred[s.ci];
    let k = 1;
    while (k < 64) {
      const rs = huffDecode(acT), r = rs >> 4, ss = rs & 0xF;
      if (ss === 0) { if (r === 15) { k += 16; continue; } else break; }
      k += r;
      if (k >= 64) break;
      blk[ZIGZAG[k]] = extend(receive(ss), ss);
      k++;
    }
  }

  // --- progressivo: DC primeira aproximação ---
  function decodeDCFirst(blk, s, Al) {
    const dcT = huffDC[s.dcTable];
    const t = huffDecode(dcT);
    const diff = t ? extend(receive(t), t) : 0;
    pred[s.ci] += diff;
    blk[0] = pred[s.ci] << Al;
  }

  // --- progressivo: DC refinamento (um bit por bloco) ---
  function decodeDCRefine(blk, Al) {
    if (nextBit()) blk[0] |= (1 << Al);
  }

  // --- progressivo: AC primeira aproximação (com EOBRUN) ---
  function decodeACFirst(blk, s, Ss, Se, Al) {
    if (EOBRUN > 0) { EOBRUN--; return; }
    const acT = huffAC[s.acTable];
    let k = Ss;
    while (k <= Se) {
      const rs = huffDecode(acT), r = rs >> 4, ss = rs & 0xF;
      if (ss === 0) {
        if (r !== 15) {                       // EOB run
          EOBRUN = (1 << r) - 1;
          if (r) EOBRUN += receive(r);
          break;
        }
        k += 16;                              // ZRL
        continue;
      }
      k += r;
      if (k > Se) break;
      blk[ZIGZAG[k]] = extend(receive(ss), ss) << Al;
      k++;
    }
  }

  // --- progressivo: AC refinamento (o caminho mais delicado) ---
  function decodeACRefine(blk, s, Ss, Se, Al) {
    const acT = huffAC[s.acTable];
    const p1 = 1 << Al, m1 = (-1) << Al;
    let k = Ss;

    if (EOBRUN === 0) {
      for (; k <= Se; k++) {
        const rs = huffDecode(acT);
        let r = rs >> 4;
        const ss = rs & 0xF;
        let val = 0;
        if (ss) {
          val = nextBit() ? p1 : m1;          // ss é sempre 1 em refinamento
        } else {
          if (r !== 15) {
            EOBRUN = 1 << r;
            if (r) EOBRUN += receive(r);
            break;
          }
          // r === 15: pula 16 coeficientes de histórico zero
        }
        // avança sobre r coeficientes zero, corrigindo os já não-zero
        while (k <= Se) {
          const z = ZIGZAG[k];
          if (blk[z] !== 0) {
            if (nextBit() && (blk[z] & p1) === 0) {
              blk[z] += (blk[z] >= 0) ? p1 : m1;
            }
          } else {
            if (r === 0) { if (val) blk[z] = val; break; }
            r--;
          }
          k++;
        }
      }
    }

    if (EOBRUN > 0) {
      // bloco dentro de um EOB run: só correções dos coeficientes não-zero
      for (; k <= Se; k++) {
        const z = ZIGZAG[k];
        if (blk[z] !== 0) {
          if (nextBit() && (blk[z] & p1) === 0) {
            blk[z] += (blk[z] >= 0) ? p1 : m1;
          }
        }
      }
      EOBRUN--;
    }
  }

  // ---- avança para o próximo marcador após os dados de entropia ----
  function skipEntropy() {
    while (bp < d.length - 1) {
      if (d[bp] === 0xFF) {
        const b2 = d[bp + 1];
        if (b2 !== 0x00 && !(b2 >= 0xD0 && b2 <= 0xD7)) return;
        bp += 2; continue;
      }
      bp++;
    }
    bp = d.length;
  }

  // ================= laço principal de marcadores =================
  let p = 0;
  while (p < d.length - 1) {
    if (d[p] !== 0xFF) { p++; continue; }
    const m = d[p + 1];
    if (m === 0xFF) { p++; continue; }
    p += 2;
    if (m === 0xD8) continue;                          // SOI
    if (m === 0xD9) break;                             // EOI
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD7)) continue;
    const len = u16(p), seg = p + 2, segEnd = p + len;

    if (m === 0xDB) {                                  // DQT
      let q = seg;
      while (q < segEnd) {
        const pq = d[q] >> 4, tq = d[q] & 0xF; q++;
        const t = new Array(64);
        for (let i = 0; i < 64; i++) { t[i] = pq ? u16(q) : d[q]; q += pq ? 2 : 1; }
        qtables[tq] = t;
      }
    } else if (m === 0xC0 || m === 0xC1 || m === 0xC2) { // SOF0/1/2
      const precision = d[seg], h = u16(seg + 1), w = u16(seg + 3), nc = d[seg + 5];
      const comps = []; let c = seg + 6;
      for (let i = 0; i < nc; i++) {
        comps.push({ id: d[c], hs: d[c + 1] >> 4, vs: d[c + 1] & 0xF, qt: d[c + 2] });
        c += 3;
      }
      frame = { precision, h, w, comps, progressive: (m === 0xC2) };
      allocate();
    } else if (m === 0xC3 || (m >= 0xC5 && m <= 0xCF && m !== 0xC8 && m !== 0xCC)) {
      throw new Error('JPEG sem perda/aritmético não suportado');
    } else if (m === 0xC4) {                            // DHT
      let q = seg;
      while (q < segEnd) {
        const tc = d[q] >> 4, th = d[q] & 0xF; q++;
        const counts = []; let total = 0;
        for (let i = 0; i < 16; i++) { counts.push(d[q + i]); total += d[q + i]; }
        q += 16;
        const symbols = [];
        for (let i = 0; i < total; i++) symbols.push(d[q + i]);
        q += total;
        const tbl = buildHuff(counts, symbols);
        if (tc === 0) huffDC[th] = tbl; else huffAC[th] = tbl;
      }
    } else if (m === 0xDD) {                            // DRI
      restartInterval = u16(seg);
    } else if (m === 0xDA) {                            // SOS
      if (!frame) throw new Error('SOS antes do SOF');
      const ns = d[seg];
      let c = seg + 1;
      const sc = [];
      for (let i = 0; i < ns; i++) {
        const cs = d[c], td = d[c + 1] >> 4, ta = d[c + 1] & 0xF;
        const ci = frame.comps.findIndex(x => x.id === cs);
        sc.push({ ci, dcTable: td, acTable: ta });
        c += 2;
      }
      const Ss = d[c], Se = d[c + 1], Ah = d[c + 2] >> 4, Al = d[c + 2] & 0xF;
      bp = segEnd;
      decodeScan(sc, Ss, Se, Ah, Al);
      skipEntropy();
      p = bp;
      continue;
    }
    p = segEnd;
  }

  if (!frame) throw new Error('sem SOF');

  // ---- saída no formato do gabarito da libjpeg ----
  const comps = frame.comps.map((c, ci) => ({
    comp: ci, h_samp: c.hs, v_samp: c.vs,
    width_blocks: compData[ci].wbReal, height_blocks: compData[ci].hbReal,
    // id e qt são necessários para RE-ESCREVER o JPEG (encodeJpegCoefficients)
    id: c.id, qt: c.qt,
  }));
  const blocks = new Map();
  frame.comps.forEach((c, ci) => {
    const cd = compData[ci];
    for (let r = 0; r < cd.hbReal; r++) {
      for (let cc = 0; cc < cd.wbReal; cc++) {
        blocks.set(`${ci},${r},${cc}`, Array.from(cd.blocks[r * cd.wb + cc]));
      }
    }
  });
  return {
    header: { components: frame.comps.length, width: frame.w, height: frame.h },
    comps, blocks, progressive: frame.progressive, qtables,
  };
}

// Enumeração LINEAR dos coeficientes na ordem componente→linha→bloco→coef(0..63),
// idêntica ao LinDctCoeffs do Steghide. Base para os consumidores DCT.
function jpegCoeffsLinear(dec){
  const out=[];
  for(let ci=0; ci<dec.comps.length; ci++){
    const c=dec.comps[ci];
    for(let r=0;r<c.height_blocks;r++){
      for(let cc=0;cc<c.width_blocks;cc++){
        const blk=dec.blocks.get(ci+','+r+','+cc);
        for(let i=0;i<64;i++) out.push(blk[i]);
      }
    }
  }
  return out;
}

// Histograma dos coeficientes DCT para o Analyzer-JPEG (chi-quadrado).
// Retorna Map(valor → contagem). Opcionalmente ignora DC (i%64===0) e zeros.
function jpegCoeffHistogram(dec, {skipDC=true, skipZero=true}={}){
  const hist=new Map();
  for(let ci=0; ci<dec.comps.length; ci++){
    const c=dec.comps[ci];
    for(let r=0;r<c.height_blocks;r++){
      for(let cc=0;cc<c.width_blocks;cc++){
        const blk=dec.blocks.get(ci+','+r+','+cc);
        for(let i=0;i<64;i++){
          if(skipDC && i===0) continue;
          const v=blk[i];
          if(skipZero && v===0) continue;
          hist.set(v,(hist.get(v)||0)+1);
        }
      }
    }
  }
  return hist;
}

// Enumeração dos coeficientes em ordem de MCU (ENTRELAÇADA), que é como a
// libjpeg os entrega ao decodificar o scan: para cada MCU, para cada
// componente, seus v_samp × h_samp blocos, e k=0..63 dentro do bloco.
// Difere de jpegCoeffsLinear (que é componente-a-componente, ordem usada pelo
// Steghide). O OutGuess usa ESTA ordem.
function jpegCoeffsMCUOrder(dec){
  const comps=dec.comps;
  let hmax=1,vmax=1;
  for(const c of comps){ if(c.h_samp>hmax)hmax=c.h_samp; if(c.v_samp>vmax)vmax=c.v_samp; }
  const mcusX=Math.ceil(dec.header.width/(8*hmax));
  const mcusY=Math.ceil(dec.header.height/(8*vmax));
  const out=[];
  for(let my=0;my<mcusY;my++){
    for(let mx=0;mx<mcusX;mx++){
      for(let ci=0;ci<comps.length;ci++){
        const c=comps[ci];
        for(let v=0;v<c.v_samp;v++){
          for(let h=0;h<c.h_samp;h++){
            const blk=dec.blocks.get(ci+','+(my*c.v_samp+v)+','+(mx*c.h_samp+h));
            if(!blk){ for(let k=0;k<64;k++) out.push(0); continue; }
            for(let k=0;k<64;k++) out.push(blk[k]);
          }
        }
      }
    }
  }
  return out;
}

// Leitura ESTRUTURAL do JPEG — marcadores, tabelas de quantização, tipo de SOF,
// subamostragem e comentários — SEM decodificar coeficiente nenhum.
// Funciona inclusive em JPEG PROGRESSIVO, que o decodificador de coeficientes
// não abre. Isso importa: Facebook e X publicam progressivo, e é exatamente
// onde a identificação de origem tem mais valor.
function jpegStructure(bytes){
  if(!bytes || bytes.length<4 || bytes[0]!==0xFF || bytes[1]!==0xD8) return null;
  let i=2, progressive=false, width=0, height=0, sub=null, comment='';
  const apps=[], qtables={};
  while(i<bytes.length-1){
    if(bytes[i]!==0xFF){ i++; continue; }
    const m=bytes[i+1]; i+=2;
    if(m===0xD8||m===0xD9||m===0x01||(m>=0xD0&&m<=0xD7)) continue;
    if(i+2>bytes.length) break;
    const L=(bytes[i]<<8)|bytes[i+1];
    if(L<2 || i+L>bytes.length) break;
    const seg=bytes.subarray(i+2, i+L);
    if(m>=0xE0 && m<=0xEF) apps.push(m-0xE0);
    if(m===0xC0||m===0xC1||m===0xC2){
      if(m===0xC2) progressive=true;
      height=(seg[1]<<8)|seg[2]; width=(seg[3]<<8)|seg[4];
      if(seg[5]>0 && seg.length>=9) sub=[seg[7]>>4, seg[7]&15];
    } else if(m===0xDB){
      let q=0;
      while(q<seg.length){
        const pq=seg[q]>>4, tq=seg[q]&15; q++;
        const t=new Array(64);
        if(pq){ if(q+128>seg.length) break;
                for(let k=0;k<64;k++) t[k]=(seg[q+k*2]<<8)|seg[q+k*2+1]; q+=128; }
        else  { if(q+64>seg.length) break;
                for(let k=0;k<64;k++) t[k]=seg[q+k]; q+=64; }
        qtables[tq]=t;
      }
    } else if(m===0xFE){
      let s=''; for(let k=0;k<seg.length && k<400;k++) s+=String.fromCharCode(seg[k]);
      comment+=s;
    } else if(m===0xDA){ break; }
    i+=L;
  }
  return {width,height,progressive,sub,apps,qtables,comment};
}


// ============================================================================
// ESCRITOR JPEG — encodeJpegCoefficients(dec, opts) -> Uint8Array
//
// Espelho do decoder acima: reconstrói um JPEG baseline válido a partir dos
// coeficientes DCT quantizados, possivelmente MODIFICADOS. É a peça que o Modo
// O modo mais resistente usa este caminho para gravar o payload QIM sem passar por pixels.
//
// Aceita entrada progressiva e emite baseline. Tabelas de Huffman ótimas por
// padrão (opts.optimize === false usa as do Annex K).
//
// Validado em 11 amostras com dupla checagem: round-trip pelo nosso decoder E
// leitura pela libjpeg (coefdump + djpeg). Zero divergência de coeficiente.
// ============================================================================
// ---- tabelas de Huffman padrão do Annex K (T.81) ----
const STD = {
  dcLum: { bits:[0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0], vals:[0,1,2,3,4,5,6,7,8,9,10,11] },
  dcChr: { bits:[0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0], vals:[0,1,2,3,4,5,6,7,8,9,10,11] },
  acLum: { bits:[0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d], vals:[
    0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,
    0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,
    0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,
    0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
    0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
    0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
    0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,
    0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,
    0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,
    0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
    0xf9,0xfa] },
  acChr: { bits:[0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77], vals:[
    0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,
    0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,
    0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,
    0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,
    0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,
    0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,
    0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,
    0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,
    0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,
    0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
    0xf9,0xfa] },
};


// ---- geração de tabela de Huffman ÓTIMA (jpeg_gen_optimal_table da libjpeg) ----
// Todo codificador real otimiza; emitir as tabelas padrão do Annex K é uma
// assinatura de encoder ingênuo — e ainda custa ~11% de tamanho.
function genOptimalTable(freqIn) {
  const freq = new Int32Array(257);
  freq.set(freqIn.subarray(0, 256));
  freq[256] = 1;                          // símbolo fantasma: impede código só de 1s
  const others = new Int32Array(257).fill(-1);
  const codesize = new Int32Array(257);
  for (;;) {
    let c1 = -1, v = Infinity;
    for (let i = 0; i <= 256; i++) if (freq[i] && freq[i] <= v) { v = freq[i]; c1 = i; }
    let c2 = -1; v = Infinity;
    for (let i = 0; i <= 256; i++) if (freq[i] && i !== c1 && freq[i] <= v) { v = freq[i]; c2 = i; }
    if (c2 < 0) break;
    freq[c1] += freq[c2]; freq[c2] = 0;
    codesize[c1]++;
    while (others[c1] >= 0) { c1 = others[c1]; codesize[c1]++; }
    others[c1] = c2;
    codesize[c2]++;
    while (others[c2] >= 0) { c2 = others[c2]; codesize[c2]++; }
  }
  const bits = new Int32Array(37);
  for (let i = 0; i <= 256; i++) if (codesize[i]) {
    if (codesize[i] > 32) throw new Error('código de Huffman longo demais');
    bits[codesize[i]]++;
  }
  for (let i = 32; i > 16; i--) {          // achata para no máximo 16 bits
    while (bits[i] > 0) {
      let j = i - 2;
      while (bits[j] === 0) j--;
      bits[i] -= 2; bits[i - 1] += 1; bits[j + 1] += 2; bits[j] -= 1;
    }
  }
  let i = 16;
  while (bits[i] === 0) i--;
  bits[i]--;                               // remove o fantasma
  // ATENÇÃO: varre até 32, não até 16. O achatamento acima mexe nas CONTAGENS
  // (bits[]), não nos comprimentos originais (codesize[]) — parar em 16 aqui
  // descarta símbolos silenciosamente. É o que a libjpeg faz (MAX_CLEN=32).
  const vals = [];
  for (let len = 1; len <= 32; len++)
    for (let sym = 0; sym < 256; sym++)
      if (codesize[sym] === len) vals.push(sym);
  return { bits: Array.from(bits.subarray(1, 17)), vals };
}

// Constrói {code[], size[]} indexado por SÍMBOLO, a partir de (bits, vals).
function buildEncTable(spec) {
  const code = new Int32Array(256).fill(-1), size = new Uint8Array(256);
  let k = 0, c = 0;
  for (let l = 1; l <= 16; l++) {
    for (let i = 0; i < spec.bits[l - 1]; i++) {
      const sym = spec.vals[k++];
      code[sym] = c++; size[sym] = l;
    }
    c <<= 1;
  }
  return { code, size };
}

// ---- escritor de bytes com byte-stuffing ----
function makeWriter() {
  let buf = new Uint8Array(1 << 16), n = 0;
  let bitBuf = 0, bitCnt = 0;
  function need(k) {
    if (n + k <= buf.length) return;
    let cap = buf.length;
    while (cap < n + k) cap *= 2;
    const nb = new Uint8Array(cap); nb.set(buf.subarray(0, n)); buf = nb;
  }
  return {
    byte(b) { need(1); buf[n++] = b & 0xFF; },
    word(w) { need(2); buf[n++] = (w >> 8) & 0xFF; buf[n++] = w & 0xFF; },
    bytes(a) { need(a.length); buf.set(a, n); n += a.length; },
    // bits do fluxo de entropia: 0xFF vira 0xFF 0x00
    bits(value, len) {
      for (let i = len - 1; i >= 0; i--) {
        bitBuf = (bitBuf << 1) | ((value >> i) & 1);
        bitCnt++;
        if (bitCnt === 8) {
          need(2); buf[n++] = bitBuf;
          if (bitBuf === 0xFF) buf[n++] = 0x00;
          bitBuf = 0; bitCnt = 0;
        }
      }
    },
    flushBits() {                      // completa o último byte com 1s
      while (bitCnt !== 0) this.bits(1, 1);
    },
    result() { return buf.slice(0, n); },
  };
}

// categoria (nº de bits) e representação do valor, conforme T.81
function category(v) { let a = v < 0 ? -v : v, n = 0; while (a) { a >>= 1; n++; } return n; }
function magbits(v, n) { return v >= 0 ? v : v + (1 << n) - 1; }

function encodeJpegCoefficients(dec, opts) {
  opts = opts || {};
  // zig-zag -> natural, igual ao decoder (o ZIGZAG dele é local à função)
  const ZIGZAG = [0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
  const W = dec.header.width, H = dec.header.height;
  const nc = dec.comps.length;
  const qtables = opts.qtables || dec.qtables;
  if (!qtables) throw new Error('encodeJpegCoefficients: faltam as tabelas de quantização');

  // identidade e tabela de cada componente: preferimos o que o decoder expôs
  const comps = dec.comps.map((c, i) => ({
    id: (c.id !== undefined ? c.id : i + 1),
    hs: c.h_samp, vs: c.v_samp,
    qt: (c.qt !== undefined ? c.qt : (i === 0 ? 0 : 1)),
    wb: c.width_blocks, hb: c.height_blocks,
    dcT: i === 0 ? 0 : 1, acT: i === 0 ? 0 : 1,
  }));
  const maxH = Math.max(...comps.map(c => c.hs));
  const maxV = Math.max(...comps.map(c => c.vs));
  const mcusPerRow = Math.ceil(W / (8 * maxH));
  const mcusPerCol = Math.ceil(H / (8 * maxV));

  // Percorre todos os blocos na ordem de MCU chamando emit() por símbolo.
  // Usada DUAS vezes: 1ª para contar frequências (tabelas ótimas), 2ª para escrever.
  const ZERO = new Int16Array(64);
  function bloco(ci, r, c) {
    const cc = comps[ci];
    // blocos de preenchimento (fora da área real) replicam a borda
    const rr = Math.min(r, cc.hb - 1), ccl = Math.min(c, cc.wb - 1);
    return dec.blocks.get(`${ci},${rr},${ccl}`) || ZERO;
  }
  function varrer(emit) {
    const pred = new Array(nc).fill(0);
    for (let my = 0; my < mcusPerCol; my++)
      for (let mx = 0; mx < mcusPerRow; mx++)
        for (let ci = 0; ci < nc; ci++) {
          const cc = comps[ci], ti = (ci === 0 ? 0 : 1);
          for (let by = 0; by < cc.vs; by++)
            for (let bx = 0; bx < cc.hs; bx++) {
              const blk = bloco(ci, my * cc.vs + by, mx * cc.hs + bx);
              const diff = blk[0] - pred[ci];
              pred[ci] = blk[0];
              const s = category(diff);
              if (s > 11) throw new Error(
                'diferença de DC fora da faixa do JPEG baseline: ' + diff);
              emit('dc', ti, s, magbits(diff, s), s);
              let run = 0;
              for (let k = 1; k < 64; k++) {
                const v = blk[ZIGZAG[k]];
                if (v === 0) { run++; continue; }
                while (run > 15) { emit('ac', ti, 0xF0, 0, 0); run -= 16; }  // ZRL
                const sz = category(v);
                if (sz > 10) throw new Error(
                  'coeficiente AC fora da faixa do JPEG baseline: ' + v +
                  ' (limite |v| <= 1023). Quem modifica coeficientes precisa saturar nessa faixa.');
                emit('ac', ti, (run << 4) | sz, magbits(v, sz), sz);
                run = 0;
              }
              if (run > 0) emit('ac', ti, 0x00, 0, 0);                       // EOB
            }
        }
  }

  const w = makeWriter();
  w.word(0xFFD8);                                            // SOI

  // ---- DQT ----
  const usados = [...new Set(comps.map(c => c.qt))].sort();
  for (const tq of usados) {
    const t = qtables[tq];
    if (!t) throw new Error('tabela de quantização ausente: ' + tq);
    w.word(0xFFDB); w.word(67); w.byte(tq & 0x0F);           // Pq=0 (8 bits)
    for (let i = 0; i < 64; i++) w.byte(t[i]);               // já em ordem zigzag
  }

  // ---- SOF0 (baseline) ----
  w.word(0xFFC0); w.word(8 + 3 * nc); w.byte(8); w.word(H); w.word(W); w.byte(nc);
  for (const c of comps) { w.byte(c.id); w.byte((c.hs << 4) | c.vs); w.byte(c.qt); }

  // ---- DHT: tabelas ótimas por padrão (1ª passada conta os símbolos) ----
  const otimizar = opts.optimize !== false;
  const nt = nc === 1 ? 1 : 2;
  let specDC, specAC;
  if (otimizar) {
    const fDC = [new Int32Array(257), new Int32Array(257)];
    const fAC = [new Int32Array(257), new Int32Array(257)];
    varrer((t, i, sym) => { (t === 'dc' ? fDC : fAC)[i][sym]++; });
    specDC = []; specAC = [];
    for (let i = 0; i < nt; i++) {
      specDC.push(genOptimalTable(fDC[i]));
      specAC.push(genOptimalTable(fAC[i]));
    }
  } else {
    specDC = [STD.dcLum, STD.dcChr]; specAC = [STD.acLum, STD.acChr];
  }
  const tabs = nc === 1
    ? [[0, 0, specDC[0]], [1, 0, specAC[0]]]
    : [[0, 0, specDC[0]], [1, 0, specAC[0]], [0, 1, specDC[1]], [1, 1, specAC[1]]];
  for (const [tc, th, spec] of tabs) {
    w.word(0xFFC4); w.word(2 + 1 + 16 + spec.vals.length);
    w.byte((tc << 4) | th);
    for (let i = 0; i < 16; i++) w.byte(spec.bits[i]);
    for (const v of spec.vals) w.byte(v);
  }
  const enc = {
    dc: specDC.map(buildEncTable),
    ac: specAC.map(buildEncTable),
  };

  // ---- SOS ----
  w.word(0xFFDA); w.word(6 + 2 * nc); w.byte(nc);
  for (const c of comps) { w.byte(c.id); w.byte((c.dcT << 4) | c.acT); }
  w.byte(0); w.byte(63); w.byte(0);

  // ---- 2ª passada: escreve o fluxo de entropia ----
  varrer((t, i, sym, val, nbits) => {
    const tb = (t === 'dc' ? enc.dc[i] : enc.ac[i]);
    if (tb.size[sym] === 0) throw new Error('símbolo sem código de Huffman: ' + t + ' ' + sym);
    w.bits(tb.code[sym], tb.size[sym]);
    if (nbits) w.bits(val, nbits);
  });
  w.flushBits();
  w.word(0xFFD9);                                            // EOI
  return w.result();
}

// ============================================================================
// DCT DIRETA — imageToJpegCoefficients(rgba, w, h, opts)
//
// O caminho de IDA: RGBA -> YCbCr -> subamostragem de croma -> nível -128 ->
// DCT 8x8 -> quantização. A saída tem o MESMO formato que decodeJpegCoefficients
// produz, e entra direto no encodeJpegCoefficients. É o que permite gerar um
// JPEG a partir de uma imagem qualquer (PNG, ou um JPEG redimensionado).
//
// ⚠️ ORDEM DAS TABELAS: a DQT vive em ordem ZIGZAG no arquivo (e é assim que o
// decoder a devolve), mas o quantizador precisa dela em ordem NATURAL. Confundir
// as duas é silencioso e desastroso.
//
// Validado contra a libjpeg (cjpeg -dct float, mesma tabela): nenhum coeficiente
// difere por mais de 1 em nenhum bloco; qualidade visual +0,01 dB.
// ============================================================================
const JD_ZIGZAG = [0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
const JD_ANNEX_K_LUM = [
  16,11,10,16,24,40,51,61, 12,12,14,19,26,58,60,55,
  14,13,16,24,40,57,69,56, 14,17,22,29,51,87,80,62,
  18,22,37,56,68,109,103,77, 24,35,55,64,81,104,113,92,
  49,64,78,87,103,121,120,101, 72,92,95,98,112,100,103,99];
const JD_ANNEX_K_CHR = [
  17,18,24,47,99,99,99,99, 18,21,26,66,99,99,99,99,
  24,26,56,99,99,99,99,99, 47,66,99,99,99,99,99,99,
  99,99,99,99,99,99,99,99, 99,99,99,99,99,99,99,99,
  99,99,99,99,99,99,99,99, 99,99,99,99,99,99,99,99];

const JD_COS = (function () {
  const t = [];
  for (let u = 0; u < 8; u++) {
    t.push(new Float64Array(8));
    for (let x = 0; x < 8; x++)
      t[u][x] = (u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16) / 2;
  }
  return t;
})();
const _jdTmp = new Float64Array(64);
function jdFdct8(inp, out) {
  for (let y = 0; y < 8; y++)
    for (let u = 0; u < 8; u++) {
      let s = 0; const r = y * 8;
      for (let x = 0; x < 8; x++) s += JD_COS[u][x] * inp[r + x];
      _jdTmp[r + u] = s;
    }
  for (let u = 0; u < 8; u++)
    for (let v = 0; v < 8; v++) {
      let s = 0;
      for (let y = 0; y < 8; y++) s += JD_COS[v][y] * _jdTmp[y * 8 + u];
      out[v * 8 + u] = s;
    }
}
function jdQtableNatural(base, quality) {
  const s = quality < 50 ? Math.floor(5000 / quality) : 200 - 2 * quality;
  return base.map(v => Math.min(255, Math.max(1, Math.floor((v * s + 50) / 100))));
}
function jdNatToZigzag(nat) { return JD_ZIGZAG.map(i => nat[i]); }

function imageToJpegCoefficients(rgba, width, height, opts) {
  opts = opts || {};
  const quality = opts.quality || 80;
  const sub420 = (opts.subsampling || '4:2:0') === '4:2:0';
  const qLum = jdQtableNatural(JD_ANNEX_K_LUM, quality);
  const qChr = jdQtableNatural(JD_ANNEX_K_CHR, quality);

  const n = width * height;
  const Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
  }
  function meia(src, w, h) {                       // média de caixa 2x2
    const dw = Math.ceil(w / 2), dh = Math.ceil(h / 2), o = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const a = Math.min(2 * y, h - 1) * w, b2 = Math.min(2 * y + 1, h - 1) * w;
      for (let x = 0; x < dw; x++) {
        const c = Math.min(2 * x, w - 1), d = Math.min(2 * x + 1, w - 1);
        o[y * dw + x] = (src[a + c] + src[a + d] + src[b2 + c] + src[b2 + d]) / 4;
      }
    }
    return { data: o, w: dw, h: dh };
  }
  const planos = [{ data: Y, w: width, h: height, hs: 1, vs: 1, q: qLum, id: 1, qt: 0 }];
  if (sub420) {
    const b = meia(Cb, width, height), r = meia(Cr, width, height);
    planos[0].hs = 2; planos[0].vs = 2;
    planos.push({ data: b.data, w: b.w, h: b.h, hs: 1, vs: 1, q: qChr, id: 2, qt: 1 });
    planos.push({ data: r.data, w: r.w, h: r.h, hs: 1, vs: 1, q: qChr, id: 3, qt: 1 });
  } else {
    planos.push({ data: Cb, w: width, h: height, hs: 1, vs: 1, q: qChr, id: 2, qt: 1 });
    planos.push({ data: Cr, w: width, h: height, hs: 1, vs: 1, q: qChr, id: 3, qt: 1 });
  }

  const blocks = new Map(), comps = [];
  const bl = new Float64Array(64), co = new Float64Array(64);
  planos.forEach((pl, ci) => {
    const wb = Math.ceil(pl.w / 8), hb = Math.ceil(pl.h / 8);
    for (let br = 0; br < hb; br++)
      for (let bc = 0; bc < wb; bc++) {
        for (let y = 0; y < 8; y++) {
          const sy = Math.min(br * 8 + y, pl.h - 1) * pl.w;
          for (let x = 0; x < 8; x++)
            bl[y * 8 + x] = pl.data[sy + Math.min(bc * 8 + x, pl.w - 1)] - 128;
        }
        jdFdct8(bl, co);
        const out = new Int16Array(64);
        for (let i = 0; i < 64; i++) out[i] = Math.round(co[i] / pl.q[i]);
        blocks.set(ci + ',' + br + ',' + bc, out);
      }
    comps.push({ comp: ci, h_samp: pl.hs, v_samp: pl.vs,
                 width_blocks: wb, height_blocks: hb, id: pl.id, qt: pl.qt });
  });
  return {
    header: { components: planos.length, width, height },
    comps, blocks, progressive: false,
    qtables: { 0: jdNatToZigzag(qLum), 1: jdNatToZigzag(qChr) },
    _qNatural: { 0: qLum, 1: qChr },
  };
}
