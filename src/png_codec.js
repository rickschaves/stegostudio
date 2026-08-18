const PNG_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function pngCRC32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = PNG_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngPaeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a; if (pb <= pc) return b; return c;
}
function pngIsPNG(u8) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (u8.length < 8) return false;
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) return false;
  return true;
}
function pngUnfilter(raw, height, stride, bpp) {
  const out = new Uint8Array(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[pos++], cur = y * stride, prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rv = raw[pos++];
      const a = x >= bpp ? out[cur + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = (y > 0 && x >= bpp) ? out[prev + x - bpp] : 0;
      let v;
      switch (ft) {
        case 0: v = rv; break; case 1: v = rv + a; break; case 2: v = rv + b; break;
        case 3: v = rv + ((a + b) >> 1); break; case 4: v = rv + pngPaeth(a, b, c); break;
        default: throw new Error('filtro PNG inválido: ' + ft);
      }
      out[cur + x] = v & 0xFF;
    }
  }
  return out;
}
function pngParse(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8, ihdr = null, plte = null, trns = null; const idatParts = [];
  while (p < bytes.length) {
    const len = dv.getUint32(p); p += 4;
    const type = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]); p += 4;
    const data = bytes.subarray(p, p + len); p += len + 4;
    if (type === 'IHDR') {
      const d = new DataView(data.buffer, data.byteOffset, data.byteLength);
      ihdr = { width: d.getUint32(0), height: d.getUint32(4), bitDepth: data[8], colorType: data[9], interlace: data[12] };
    } else if (type === 'PLTE') plte = data.slice();
    else if (type === 'tRNS') trns = data.slice();
    else if (type === 'IDAT') idatParts.push(data.slice());
    else if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('IHDR ausente');
  let total = 0; for (const a of idatParts) total += a.length;
  const idat = new Uint8Array(total); { let o = 0; for (const a of idatParts) { idat.set(a, o); o += a.length; } }
  return { ...ihdr, idat, plte, trns };
}
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
function pngRasterToRGBA(meta, inflated) {
  const { width, height, bitDepth, colorType, plte, trns } = meta;
  const ch = PNG_CHANNELS[colorType];
  if (ch === undefined) throw new Error('colorType não suportado: ' + colorType);
  if (meta.interlace !== 0) throw new Error('PNG entrelaçado não suportado');
  if (bitDepth === 16) throw new Error('PNG 16-bit não suportado');
  const bpp = Math.max(1, Math.ceil(ch * bitDepth / 8));
  const stride = Math.ceil(width * ch * bitDepth / 8);
  const ras = pngUnfilter(inflated, height, stride, bpp);
  const out = new Uint8ClampedArray(width * height * 4);
  const maxv = (1 << bitDepth) - 1;
  function rowSamples(y, count) {
    const res = new Uint16Array(count); const base = y * stride;
    if (bitDepth === 8) { for (let i = 0; i < count; i++) res[i] = ras[base + i]; }
    else { const mask = (1 << bitDepth) - 1; let bit = 0; for (let i = 0; i < count; i++) { const bi = base + (bit >> 3), sh = 8 - bitDepth - (bit & 7); res[i] = (ras[bi] >> sh) & mask; bit += bitDepth; } }
    return res;
  }
  for (let y = 0; y < height; y++) {
    if (colorType === 6 && bitDepth === 8) { const base = y * stride; out.set(ras.subarray(base, base + width * 4), y * width * 4); continue; }
    if (colorType === 2 && bitDepth === 8) {
      const base = y * stride; let o = y * width * 4; const tr = trns ? [trns[1], trns[3], trns[5]] : null;
      for (let x = 0; x < width; x++) { const r = ras[base + x * 3], g = ras[base + x * 3 + 1], b = ras[base + x * 3 + 2]; out[o++] = r; out[o++] = g; out[o++] = b; out[o++] = (tr && r === tr[0] && g === tr[1] && b === tr[2]) ? 0 : 255; }
      continue;
    }
    const samp = rowSamples(y, width * ch); let o = y * width * 4;
    for (let x = 0; x < width; x++) {
      let r, g, b, a = 255;
      if (colorType === 0) { const v = Math.round(samp[x] * 255 / maxv); r = g = b = v; if (trns && samp[x] === ((trns[0] << 8) | trns[1])) a = 0; }
      else if (colorType === 4) { const v = samp[x * 2]; r = g = b = v; a = samp[x * 2 + 1]; }
      else if (colorType === 2) { r = Math.round(samp[x * 3] * 255 / maxv); g = Math.round(samp[x * 3 + 1] * 255 / maxv); b = Math.round(samp[x * 3 + 2] * 255 / maxv); }
      else if (colorType === 3) { const idx = samp[x]; r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2]; a = (trns && idx < trns.length) ? trns[idx] : 255; }
      else if (colorType === 6) { r = Math.round(samp[x * 4] * 255 / maxv); g = Math.round(samp[x * 4 + 1] * 255 / maxv); b = Math.round(samp[x * 4 + 2] * 255 / maxv); a = Math.round(samp[x * 4 + 3] * 255 / maxv); }
      out[o++] = r; out[o++] = g; out[o++] = b; out[o++] = a;
    }
  }
  return out;
}
function pngBuild(width, height, deflated) {
  function chunk(type, data) {
    const len = data.length, out = new Uint8Array(12 + len), dv = new DataView(out.buffer);
    dv.setUint32(0, len);
    out[4] = type.charCodeAt(0); out[5] = type.charCodeAt(1); out[6] = type.charCodeAt(2); out[7] = type.charCodeAt(3);
    out.set(data, 8); dv.setUint32(8 + len, pngCRC32(out.subarray(4, 8 + len)));
    return out;
  }
  const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', new Uint8Array(0))];
  let tot = 0; for (const part of parts) tot += part.length;
  const out = new Uint8Array(tot); let o = 0; for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}
function pngRGBAToRawNone(width, height, rgba) {
  const stride = width * 4, raw = new Uint8Array(height * (stride + 1)); let o = 0;
  for (let y = 0; y < height; y++) { raw[o++] = 0; raw.set(rgba.subarray(y * stride, y * stride + stride), o); o += stride; }
  return raw;
}

// Escolha adaptativa dos cinco filtros PNG por scanline. Os filtros NÃO mudam
// nenhum pixel: só transformam reversivelmente o raster antes do DEFLATE. O
// critério soma o módulo dos bytes filtrados interpretados como signed 8-bit,
// heurística clássica que favorece linhas mais compressíveis sem segunda
// serialização nem qualquer negociação com o payload esteganográfico.
function pngFilterCost(v){ v&=255; return v<128?v:256-v; }
function pngRGBAToRawAdaptive(width, height, rgba) {
  const bpp=4, stride=width*bpp, raw=new Uint8Array(height*(stride+1));
  let o=0;
  for(let y=0;y<height;y++){
    const row=y*stride, prev=(y-1)*stride;
    const scores=[0,0,0,0,0];
    for(let x=0;x<stride;x++){
      const v=rgba[row+x];
      const a=x>=bpp?rgba[row+x-bpp]:0;
      const b=y>0?rgba[prev+x]:0;
      const c=(y>0&&x>=bpp)?rgba[prev+x-bpp]:0;
      scores[0]+=pngFilterCost(v);
      scores[1]+=pngFilterCost(v-a);
      scores[2]+=pngFilterCost(v-b);
      scores[3]+=pngFilterCost(v-((a+b)>>1));
      scores[4]+=pngFilterCost(v-pngPaeth(a,b,c));
    }
    let ft=0; for(let f=1;f<5;f++) if(scores[f]<scores[ft]) ft=f;
    raw[o++]=ft;
    for(let x=0;x<stride;x++){
      const v=rgba[row+x];
      const a=x>=bpp?rgba[row+x-bpp]:0;
      const b=y>0?rgba[prev+x]:0;
      const c=(y>0&&x>=bpp)?rgba[prev+x-bpp]:0;
      let fv=v;
      if(ft===1) fv=v-a;
      else if(ft===2) fv=v-b;
      else if(ft===3) fv=v-((a+b)>>1);
      else if(ft===4) fv=v-pngPaeth(a,b,c);
      raw[o++]=fv&255;
    }
  }
  return raw;
}
async function pngInflate(u8) {
  const ds = new DecompressionStream('deflate'); // formato zlib (= IDAT)
  const w = ds.writable.getWriter(); w.write(u8); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
async function pngDeflate(u8) {
  const cs = new CompressionStream('deflate');
  const w = cs.writable.getWriter(); w.write(u8); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
// ── Limites contra arquivo hostil ──────────────────────────────────────────
// Valide dimensões do IHDR antes de alocar o buffer RGBA e limite o raster
// descomprimido para conter expansão excessiva de IDAT. Os tetos falham cedo
// com erro legível em vez de permitir alocações descontroladas.
const PNG_MAX_PIXELS = 80e6;      // limite de segurança da aplicação: 80 MP
const PNG_MAX_INFLATED = 512e6;   // 512 MB de raster descomprimido

async function pngDecodeRGBA(u8) {
  const meta = pngParse(u8);
  if (!(meta.width > 0 && meta.height > 0))
    throw new Error('pngDimensoesInvalidas');
  if (meta.width * meta.height > PNG_MAX_PIXELS)
    throw new Error('pngExcedeLimitePixels');
  const inflated = await pngInflate(meta.idat);
  if (inflated.length > PNG_MAX_INFLATED)
    throw new Error('pngExcedeLimiteRaster');
  return { width: meta.width, height: meta.height, data: pngRasterToRGBA(meta, inflated) };
}
async function pngEncodeRGBA(width, height, rgba) {
  const raw = pngRGBAToRawAdaptive(width, height, rgba);
  return pngBuild(width, height, await pngDeflate(raw));
}

// ════════════════════════════════════════
//  CANVAS LOAD
// ════════════════════════════════════════
// Decodifica via canvas (fallback: JPEG/WEBP, ou PNG entrelaçado/16-bit que o
// nosso codec puro não cobre). Para PNG comum, NÃO passamos por aqui.
function canvasDecode(objURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('canvas');
      const w = img.width, h = img.height; c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      resolve({ id: ctx.getImageData(0, 0, w, h), w, h });
    };
    img.onerror = reject; img.src = objURL;
  });
}
// Detecta HEIC/HEIF (HEVC) por assinatura ISO-BMFF para emitir um erro específico
// quando o navegador não oferece decoder. AVIF segue pelo decoder nativo do navegador.
function isHeic(u8) {
  if (!u8 || u8.length < 12) return false;
  // bytes 4..7 = 'ftyp'
  if (!(u8[4]===0x66 && u8[5]===0x74 && u8[6]===0x79 && u8[7]===0x70)) return false;
  const HEVC_BRANDS = ['heic','heix','hevc','hevx','heim','heis','hevm','hevs'];
  let boxLen = ((u8[0]<<24)|(u8[1]<<16)|(u8[2]<<8)|u8[3])>>>0;
  if (boxLen < 8 || boxLen > u8.length) boxLen = u8.length;
  boxLen = Math.min(boxLen, 64); // major brand + compatible brands ficam no começo
  let s = '';
  for (let i=8; i<boxLen; i++) s += String.fromCharCode(u8[i]);
  return HEVC_BRANDS.some(b => s.includes(b));
}

// Mostra erro de carregamento no terminal do painel certo (encoder/decoder) e reseta
// o estado para o botão não ficar habilitado sobre um load que falhou.
function showLoadError(which, reason) {
  const statusId = which==='enc' ? 'enc-status' : 'dec-status';
  const key = reason==='heic' ? 'termHeicUnsupported' : 'termDecodeFailed';
  const build = () => [{text:'✗ '+t(key), cls:'err'}];
  termRedraw[statusId] = () => termWrite(statusId, build(), {instant:true});
  termWrite(statusId, build());
  if (which==='enc') { encID=null; encFormatOk=false; checkEncReady(); }
  else { decID=null; const btn=document.getElementById('btn-analyze'); if(btn) btn.disabled=true; }
}

function loadToCanvas(file, cb, onErr) {
  const previewURL = URL.createObjectURL(file);
  let u8cap = null;
  file.arrayBuffer().then(async buf => {
    const u8 = new Uint8Array(buf); u8cap = u8;
    let id, w, h;
    if (pngIsPNG(u8)) {
      try {
        const dec = await pngDecodeRGBA(u8);       // leitura LIMPA, sem canvas
        w = dec.width; h = dec.height; id = new ImageData(dec.data, w, h);
      } catch (err) {
        ({ id, w, h } = await canvasDecode(previewURL)); // entrelaçado/16-bit → canvas
      }
    } else {
      ({ id, w, h } = await canvasDecode(previewURL));   // não-PNG → canvas
    }
    // Detecta transparência (alfa < 255). Não alteramos a imagem: o embedding
    // usa só pixels OPACOS, preservando alfa e aparência.
    let hadAlpha = false; const d = id.data;
    for (let i = 3; i < d.length; i += 4) { if (d[i] !== 255) { hadAlpha = true; break; } }
    cb(id, w, h, previewURL, hadAlpha);
  }).catch(err => {
    console.error('loadToCanvas falhou:', err);
    // HEIC (não decodificável no navegador) ganha mensagem própria; senão, decode genérico.
    const reason = (u8cap && isHeic(u8cap)) ? 'heic' : 'decode';
    if (onErr) onErr(reason); else console.error('decode reason:', reason);
  });
}

// ════════════════════════════════════════
//  DROP ZONES
// ════════════════════════════════════════
// ── EXTRAI IMAGEM DO CLIPBOARD ──
