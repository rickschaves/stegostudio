const C2PA_AI_SOURCES = [
  {rx:/trainedAlgorithmicMedia/i,      label:'Conteúdo gerado por IA (IPTC trainedAlgorithmicMedia)', key:'c2paLblTrainedAlgo'},
  {rx:/compositeWithTrainedAlgorithmic/i, label:'Composição com IA (IPTC composite)', key:'c2paLblComposite'},
  {rx:/gpt-?image/i,                   label:'GPT Image / DALL-E (OpenAI)'},
  {rx:/dall[- ]?e/i,                   label:'DALL-E (OpenAI)'},
  {rx:/midjourney/i,                   label:'Midjourney'},
  {rx:/stable[- ]?diffusion/i,         label:'Stable Diffusion'},
  {rx:/adobe.firefly|firefly/i,        label:'Adobe Firefly'},
  {rx:/imagen/i,                       label:'Imagen (Google)'},
  {rx:/grok/i,                         label:'Grok (xAI)'},
  {rx:/flux/i,                         label:'Flux'},
  {rx:/leonardo/i,                     label:'Leonardo AI'},
  {rx:/ideogram/i,                     label:'Ideogram'},
  {rx:/canva/i,                        label:'Canva AI'},
];

const C2PA_CA_KNOWN = [
  {rx:/trufo\.ai/i,     label:'Trufo.ai'},
  {rx:/contentauth/i,   label:'Content Authenticity Initiative'},
  {rx:/adobe\.com/i,    label:'Adobe'},
  {rx:/microsoft/i,     label:'Microsoft'},
  {rx:/google/i,        label:'Google'},
  {rx:/c2pa\.org/i,     label:'C2PA.org'},
];

// ── Extração de assets C2PA (Frente #16/b.1): SVG watermark + superbox JUMBF ──
// Os assets ficam FORA do objeto de relatório (não vão pro JSON exportado) — só
// flags pequenas entram no relatório. Recorte é feito nos BYTES (offsets exatos),
// não no texto decodificado (onde índice de char ≠ índice de byte por causa do
// {fatal:false}).
let C2PA_ASSETS = { svg: null, manifest: null };
function bytesIndexOf(buf, needle, from=0){
  const n=needle.length;
  outer: for(let i=from;i<=buf.length-n;i++){
    for(let j=0;j<n;j++){ if(buf[i+j]!==needle.charCodeAt(j)) continue outer; }
    return i;
  }
  return -1;
}
function extractSvgBytes(bytes){
  const s=bytesIndexOf(bytes,'<svg'); if(s===-1) return null;
  const vb=bytesIndexOf(bytes,'viewBox',s); if(vb===-1 || vb-s>200) return null;
  const e=bytesIndexOf(bytes,'</svg>',s); if(e===-1) return null;
  return bytes.slice(s, e+6);
}
function extractJumbfBox(bytes){
  const dv=new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let from=0,k;
  while((k=bytesIndexOf(bytes,'jumb',from))!==-1){
    if(k>=4){
      const start=k-4, len=dv.getUint32(start,false);
      if(len>=16 && len<=8*1024*1024 && start+len<=bytes.length) return bytes.slice(start,start+len);
      if(len===0) return bytes.slice(start);
    }
    from=k+4;
  }
  return null;
}

// ── Leitura de campos do manifesto (Frente #16/b.2) ──────────────────────────
// NÃO é um parser CBOR completo: é leitura ANCORADA NA CHAVE de poucos campos,
// respeitando só o suficiente do CBOR (tamanho do tstr) e do ASN.1 (string do CN)
// para não pegar lixo. Validado isolado em Node contra manifestos reais de 2
// fornecedores (GPT/Trufo e Gemini/Google).
function cborReadTstr(buf, pos) {
  if (pos < 0 || pos >= buf.length) return null;
  const b = buf[pos], mt = b >> 5, ai = b & 0x1f;
  if (mt !== 3) return null; // major type 3 = text string
  let ln, hp;
  if (ai < 24) { ln = ai; hp = 1; }
  else if (ai === 24) { ln = buf[pos+1]; hp = 2; }
  else if (ai === 25) { ln = (buf[pos+1] << 8) | buf[pos+2]; hp = 3; }
  else return null;
  if (pos + hp + ln > buf.length) return null;
  return { text: new TextDecoder('utf-8', {fatal:false}).decode(buf.subarray(pos+hp, pos+hp+ln)), next: pos+hp+ln };
}
// Gerador: 1º par adjacente name→version (claim_generator_info).
function c2paGenerator(buf) {
  let from = 0, i;
  while ((i = bytesIndexOf(buf, 'name', from)) !== -1) {
    from = i + 4;
    if (i < 1 || (buf[i-1] >> 5) !== 3 || (buf[i-1] & 0x1f) !== 4) continue; // 'name' como chave tstr(4)
    const val = cborReadTstr(buf, i + 4); if (!val) continue;
    const nk = cborReadTstr(buf, val.next); if (!nk || nk.text !== 'version') continue;
    const ver = cborReadTstr(buf, nk.next);
    return { name: val.text, version: ver ? ver.text : null };
  }
  return null;
}
// digitalSourceType correto, ancorado na URL IPTC (conserta a regex antiga que pegava lixo).
function c2paDigitalSourceType(buf) {
  const m = new TextDecoder('latin1').decode(buf).match(/digitalsourcetype\/([A-Za-z]+)/i);
  return m ? m[1] : null;
}
// common_name do SIGNATÁRIO: Subject CN (OID 55 04 03) do cert leaf — pula os
// certs de cadeia (CA/Root/ICA/TSA/etc). Heurística validada nos 2 fornecedores.
function c2paSignerCN(buf) {
  const skip = /\b(CA|Root|ICA|TSA|Authority|Issuing|Time[- ]?Stamping|Signing)\b/i;
  let from = 0, i; const all = [];
  while ((i = bytesIndexOf(buf, '\x55\x04\x03', from)) !== -1) {
    from = i + 3; const p = i + 3, tag = buf[p], ln = buf[p+1];
    if ((tag === 0x0c || tag === 0x13 || tag === 0x16) && ln > 0 && ln < 64 && p+2+ln <= buf.length)
      all.push(new TextDecoder('utf-8', {fatal:false}).decode(buf.subarray(p+2, p+2+ln)));
  }
  return all.find(s => !skip.test(s)) || null;
}
// Descrições de ação (c2pa.action) — informativo p/ o resumo legível.
function c2paActionDescriptions(buf) {
  const out = []; let from = 0, i;
  while ((i = bytesIndexOf(buf, 'description', from)) !== -1) {
    from = i + 11;
    if (i < 1 || (buf[i-1] >> 5) !== 3 || (buf[i-1] & 0x1f) !== 11) continue; // 'description' tstr(11)
    const v = cborReadTstr(buf, i + 11);
    if (v && v.text && !out.includes(v.text)) out.push(v.text);
    if (out.length >= 8) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Localiza os contêineres onde a norma C2PA de fato guarda o manifesto JUMBF:
//   • JPEG — segmento APP11 (0xFFEB)
//   • PNG  — chunk caBX
// Devolve [{kind, text}] com o conteúdo de cada um. Texto solto no meio dos
// pixels ou num comentário JPEG NÃO entra aqui, e é essa a diferença entre
// "o arquivo carrega um manifesto" e "o arquivo contém a palavra c2pa".
// Isto NÃO valida assinatura, certificado nem hash — ver F16 no ROADMAP.
// ─────────────────────────────────────────────────────────────────────────────
function findC2PAContainers(bytes) {
  const out = [];
  const dec = (a, b) => new TextDecoder('utf-8', {fatal:false}).decode(bytes.subarray(a, Math.min(b, a + 65536)));
  try {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {           // JPEG
      let off = 2;
      while (off + 4 < bytes.length) {
        if (bytes[off] !== 0xFF) break;
        const marker = bytes[off + 1];
        if (marker === 0xDA || marker === 0xD9) break;      // SOS/EOI
        if (marker >= 0xD0 && marker <= 0xD8) { off += 2; continue; }
        const len = (bytes[off + 2] << 8) | bytes[off + 3];
        if (len < 2) break;
        if (marker === 0xEB) out.push({kind:'app11', text: dec(off + 4, off + 2 + len)});
        off += 2 + len;
      }
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {    // PNG
      let off = 8;
      while (off + 8 <= bytes.length) {
        const len  = (bytes[off]<<24 | bytes[off+1]<<16 | bytes[off+2]<<8 | bytes[off+3]) >>> 0;
        const type = String.fromCharCode(bytes[off+4], bytes[off+5], bytes[off+6], bytes[off+7]);
        if (type === 'IEND') break;
        if (type === 'caBX') out.push({kind:'caBX', text: dec(off + 8, off + 8 + len)});
        off += 12 + len;
        if (len > bytes.length) break;
      }
    }
  } catch (_) {}
  return out;
}

async function parseC2PA(file) {
  // Leitura via readFileBytes: falha vira rejeição, nunca promessa pendente.
  const _bytes = await readFileBytes(file, 'parseC2PA');
  return new Promise(res => {
    const e = { target: { result: _bytes.buffer } };
    (() => {
      const result = {
        found: false,
        manifestDetected: false,
        aiGenerator: null,
        ca: null,
        certDate: null,
        digitalSourceType: null,
        manifestPresent: false,
        signals: [],
        rawSoftware: null,
      };

      try {
        const bytes = new Uint8Array(e.target.result);
        const text  = new TextDecoder('utf-8', {fatal:false}).decode(bytes);
        C2PA_ASSETS = { svg: null, manifest: null }; // zera assets do arquivo anterior

        // ── Detectar presença de manifesto JUMBF/C2PA ──
        // Exige evidências explícitas de C2PA — não basta namespace Adobe/XMP genérico
        // XMP do Picasa/Photoshop contém "adobe:ns:meta" mas NÃO é C2PA
        // ⚠️ v2.42.0 — ESTRUTURA, não texto solto.
        // Antes bastava a string "JUMB" ou "c2pa" aparecer EM QUALQUER LUGAR dos
        // bytes. Um comentário JPEG de 71 caracteres produzia "C2PA confirmado"
        // com gerador de IA identificado — zero criptografia envolvida.
        // Agora o marcador precisa estar no CONTÊINER certo: segmento APP11 no
        // JPEG (onde a norma põe o JUMBF) ou chunk caBX no PNG. Isso não é
        // validação criptográfica — continua sendo detecção — mas forjar exige
        // montar a estrutura do formato, não escrever texto num comentário.
        const c2paBoxes = findC2PAContainers(bytes);
        const hasJUMB     = c2paBoxes.some(b => b.kind === 'app11' || b.kind === 'caBX');
        const boxText     = c2paBoxes.map(b => b.text).join('\n');
        const hasC2PA     = /c2pa\.org|c2pa\/|\bc2pa\b/i.test(boxText);
        const hasManifest = /jumbf manifest|c2pa\.manifest/i.test(boxText);

        // Evidência = marcador dentro do contêiner do formato.
        const c2paEvidence = hasJUMB && (hasC2PA || hasManifest || c2paBoxes.length > 0);
        if (c2paEvidence) {
          result.found = true;
          result.manifestPresent = true;
          result.signals.push(t('sigJUMBFDetected'));
        }

        // ── Identificar gerador de IA ──
        // SÓ quando há evidência de C2PA real (c2paEvidence). Caçar nomes de
        // gerador no texto bruto do arquivo inteiro (incluindo os pixels) gera
        // FALSO POSITIVO: tokens curtos como "grok"/"flux"/"canva" aparecem por
        // acaso no lixo binário. Sem manifesto C2PA, um nome solto nos bytes não
        // confirma nada. (O resto da função já segue essa mesma regra.)
        if (c2paEvidence) {
          for (const s of C2PA_AI_SOURCES) {
            if (s.rx.test(boxText)) {
              result.manifestDetected = true;
              const lbl = s.key ? t(s.key) : s.label;
              result.aiGenerator = result.aiGenerator || lbl;
              result.signals.push(t('c2paGenIdentified').replace('{gen}', lbl));
              break;
            }
          }
        }

        // ── digitalSourceType IPTC ──
        const dstMatch = text.match(/digitalsourcetype[^"'\s]*["'\s]+([^\s"'<>]{5,80})/i)
                      || text.match(/digitalsourcetype\/([a-zA-Z]+)/i);
        if (dstMatch) {
          result.digitalSourceType = dstMatch[1].replace(/[^a-zA-Z\/]/g,'').slice(0,60);
          result.found = true;
          if (/trainedAlgorithm|compositeWith/i.test(result.digitalSourceType)) {
            result.manifestDetected = true;
            result.signals.push(`IPTC digitalSourceType: ${escapeHTML(result.digitalSourceType)}`);
          }
        }

        // ── CA signatária — só conta se há manifesto C2PA real ──
        // Adobe como CA genérica (namespace XMP) não é evidência de C2PA
        if (c2paEvidence) {
          for (const ca of C2PA_CA_KNOWN) {
            // Ignora Adobe puro sem JUMB/c2pa — é só XMP genérico
            if (ca.rx.test(text) && !(ca.label==='Adobe' && !hasJUMB && !hasC2PA)) {
              result.ca = ca.label;
              result.signals.push(t('c2paSigningCASignal').replace('{ca}', ca.label));
              break;
            }
          }
        }

        // ── Data do certificado (só dentro de um manifesto C2PA real) ──
        if (c2paEvidence) {
          const dateMatch = text.match(/20[2-9]\d[01]\d[0-3]\d[0-2]\d[0-5]\d[0-5]\dZ/);
          if (dateMatch) {
            const d = dateMatch[0];
            result.certDate = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)} ${d.slice(8,10)}:${d.slice(10,12)} UTC`;
            result.found = true;
          }
        }

        // ── Software raw (só dentro de um manifesto C2PA real) ──
        if (c2paEvidence) {
          const swMatch = text.match(/gpt-image[a-zA-Z0-9._-]*/i)
                       || text.match(/dall-?e[a-zA-Z0-9._-]*/i)
                       || text.match(/stable[- ]diffusion[a-zA-Z0-9._-]*/i);
          if (swMatch) result.rawSoftware = swMatch[0];
        }

        // ── SVG watermark (Trufo e outros embutem SVG invisível) ──
        // Exige viewBox logo após o <svg (SVG real), evitando casar bytes "<svg"
        // e "viewBox" espalhados por acaso pelos pixels.
        const svgIdx = text.indexOf('<svg');
        const vbIdx  = svgIdx !== -1 ? text.indexOf('viewBox', svgIdx) : -1;
        if (svgIdx !== -1 && vbIdx !== -1 && (vbIdx - svgIdx) < 200) {
          result.signals.push(t('sigSVGWatermark'));
          result.found = true;
          // Recorta os bytes reais do SVG (offsets nos bytes, não no texto).
          const svgB = extractSvgBytes(bytes);
          if (svgB) { C2PA_ASSETS.svg = svgB; result.hasSvg = true; result.svgLen = svgB.length; }
        }

        // ── Manifesto JUMBF/C2PA: recorta o superbox para download (só se houver
        //    evidência C2PA real e o box tiver tamanho coerente). ──
        if (c2paEvidence) {
          const mB = extractJumbfBox(bytes);
          if (mB) {
            C2PA_ASSETS.manifest = mB; result.hasManifest = true; result.manifestLen = mB.length;
            // Campos legíveis do manifesto (Frente #16/b.2)
            const gen = c2paGenerator(mB);
            if (gen) { result.genName = gen.name; result.genVersion = gen.version; }
            const signer = c2paSignerCN(mB);
            if (signer) result.signerCN = signer;
            const descs = c2paActionDescriptions(mB);
            if (descs.length) result.actionDescriptions = descs;
            // Conserta digitalSourceType (a regex antiga pega lixo binário): usa a URL IPTC.
            const dst = c2paDigitalSourceType(mB);
            if (dst) result.digitalSourceType = dst;
          }
        }

      } catch(_) {}
      res(result);
    })();
  });
}

async function runForensics(imageData, file, onProgress=()=>{}, sharedDec=null) {
  const d=imageData.data, w=imageData.width, h=imageData.height, total=w*h;
  // Sniff dos primeiros bytes: detecção por assinatura tem precedência sobre
  // extensão/MIME (pega .jfif, .jpe, MIME errado do browser, sem extensão, etc.)
  let magicBytes=null;
  try{
    const head=await file.slice(0,16).arrayBuffer();
    magicBytes=new Uint8Array(head);
  }catch(_){ /* segue sem magic — cai no fallback por extensão/MIME */ }
  const fmt=classifyFormat(file, magicBytes);
  const isLossy   = fmt.cat==='lossy';
  const isPalette  = fmt.cat==='palette';
  const isLossless = fmt.cat==='lossless';
  const report={format:fmt};

  // M1: METADATA
  onProgress(1, PIPELINE_STEPS[0]);
  report.metadata={filename:file.name,size:fmtBytes(file.size),type:file.type,
    formatCategory:fmt.cat,width:w,height:h,pixels:total,
    lastModified:new Date(file.lastModified).toISOString()};

  // M2: STRINGS
  onProgress(2, PIPELINE_STEPS[1]);
  const strResult = await (async () => {
    const bytes = await readFileBytes(file, 'strings');
    {
      const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
      const regex=/[\x20-\x7E]{6,}/g;
      let m,found=[],count=0;
      while((m=regex.exec(text))!==null&&count<300){
        const s=m[0].trim();
        if(s.length>=6&&!s.match(/^[0-9a-f]+$/i)){found.push(s);count++;}
      }
      const patterns=[
        {rx:/https?:\/\/[^\s"'<>]+/,label:'URL'},
        {rx:/[A-Za-z0-9+\/]{20,}={0,2}/,label:'Base64 candidate'},
        {rx:/\b[A-Fa-f0-9]{32,}\b/,label:'Hash/hex'},
        {rx:/password|secret|hidden|key|token|flag\{/i,label:'Palavra-chave sensível'},
        {rx:/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,label:'IP address'},
        {rx:/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,label:'Email'},
        {rx:/STEGO\x00/,label:'Header STEGO·STUDIO'},
      ];
      const interesting=[];
      for(const s of found){
        if(isLossy&&isJpegInternalString(s)) continue;
        for(const p of patterns) if(p.rx.test(s)){interesting.push({str:s.slice(0,500),type:p.label});break;}
      }

      // ── CAMADA ADITIVA: realce de conteúdo adversarial ──
      // NÃO substitui a captura acima nem usa lista de frases. Sobre TODAS as
      // strings legíveis encontradas, marca as que têm ESTRUTURA de instrução
      // dirigida a quem analisa, ou de afirmação contra-forense. Por padrão
      // estrutural (não frase exata), pega variações. Aditivo: só acrescenta
      // a flag `adversarial` e o motivo; a string segue listada normalmente.
      const adversarial = detectAdversarialContent(found, isLossy);
      let appendedData=false,appendedBytes=0;
      if(fmt.ext==='JPEG'){
        for(let i=bytes.length-1;i>bytes.length-500;i--){
          if(bytes[i]===0xD9&&bytes[i-1]===0xFF&&i<bytes.length-1){
            appendedBytes=bytes.length-i-1;
            appendedData=appendedBytes>200;
            break;
          }
        }
      } else if(file.type==='image/png'){
        const iend=[0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82];
        for(let i=bytes.length-8;i>=0;i--){
          let ok=true; for(let j=0;j<8;j++)if(bytes[i+j]!==iend[j]){ok=false;break;}
          if(ok&&i+8<bytes.length-1){appendedData=true;appendedBytes=bytes.length-i-8;}
          break;
        }
      }
      return {count:found.length,interesting,adversarial,appendedData,appendedBytes,
        note:isLossy?t('noteStringsFiltered'):'',
        _rawBytes:(fmt.ext==='JPEG'?bytes:null)};
    }
  })();
  report.strings=strResult;

  // ── F3-C: esteganálise DCT para JPEG (usa os bytes já lidos acima) ──
  let jpegStruct = null;
  if(fmt.ext==='JPEG' && strResult._rawBytes){
    try{ report.jpegDCT = analyzeJpegDCT(strResult._rawBytes, sharedDec); }
    catch(_){ report.jpegDCT = {available:false, reason:'erro na análise DCT'}; }
    // Fatia A: assinatura do modo robusto, sem senha e sem extração.
    try{ const sig = robustSignature(sharedDec);
         if(sig) report.studio = {...(report.studio||{}), robustSignature: sig}; }
    catch(_){}
    // F9: leitura ESTRUTURAL — roda mesmo quando a análise DCT falha (ex.:
    // progressivo), que é justamente onde a identificação de origem mais serve.
    try{
      jpegStruct = jpegStructure(strResult._rawBytes);
      const tp = identifyJpegToolprint(jpegStruct);
      if(tp && tp.length) report.toolprint = tp;
    }catch(_){ jpegStruct = null; }
  }
  delete strResult._rawBytes; // não vaza os bytes crus para o relatório final

  // M3: LSB — desabilitado para lossy/palette
  onProgress(3, PIPELINE_STEPS[2]);
  // Pré-análise de complexidade do cover: imagens chapadas/sintéticas (poucas
  // cores) fazem o WS (Weighted Stego) e o viés de paridade DISPARAREM sem stego
  // (falso-positivo). Detectamos esse tipo de cover para não confiar nesses
  // sinais instáveis nele — o RS continua sendo o juiz confiável.
  let lowComplexity = false;
  {
    const pal = new Set();
    for (let i = 0; i < d.length; i += 16) {   // amostra 1 em 4 pixels
      pal.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
      if (pal.size > 6000) break;
    }
    lowComplexity = pal.size <= 4000;
  }
  if(isLossless){
    const sample=Math.min(total,5000);
    const lbR=[],lbG=[],lbB=[];
    for(let i=0;i<sample;i++){lbR.push(d[i*4]&1);lbG.push(d[i*4+1]&1);lbB.push(d[i*4+2]&1);}
    function chi(bits){const o=bits.reduce((a,b)=>a+b,0),z=bits.length-o,ex=bits.length/2;return(Math.pow(o-ex,2)+Math.pow(z-ex,2))/ex;}
    const chiR=chi(lbR),chiG=chi(lbG),chiB=chi(lbB);
    const rawResult=extractLSBRaw(imageData,Math.min(Math.floor(total/8),8000));
    const rawBytes=rawResult.bytes;
    const decoded=new TextDecoder('utf-8',{fatal:false}).decode(rawBytes);
    const pr=rawResult.printableRatio;

    // Investigador encontrou uma ilha de texto legível?
    // Mínimo de 12 caracteres: ilhas de 6-11 chars em canais isolados são
    // frequentemente ruído estatístico (ex: "km+]s'I6" em foto real), não
    // mensagem intencional. 12+ reduz drasticamente os falsos positivos.
    const foundText = rawResult.foundText && rawResult.foundTextLength >= 12;

    // Chi-quadrado MUITO baixo (<2) em algum canal = LSBs quase aleatórios
    // = possível mensagem CIFRADA (dados criptografados parecem ruído)
    const lowChi = chiR<2||chiG<2||chiB<2;

    // Detecta "ilha de aleatoriedade": região onde os LSBs ficam ~50/50
    // mesmo numa imagem cujo chi global é alto. Indica payload cifrado localizado.
    let cipherSuspicion = false;
    if (!foundText && !lowChi) {
      // Varre os primeiros LSBs do canal B em janelas, procurando região aleatória
      const winSize = 512;
      const bChan = [];
      const maxScan = Math.min(total, 20000);
      for (let i=0;i<maxScan;i++) bChan.push(d[i*4+2]&1);
      for (let w=0; w+winSize<=bChan.length; w+=winSize) {
        const win = bChan.slice(w, w+winSize);
        const c = chi(win);
        // Janela com chi muito baixo (<3.84 = p>0.05) = aleatória nessa região
        if (c < 3.84) { cipherSuspicion = true; break; }
      }
    }

    const suspicious = lowChi || pr>0.35 || foundText || cipherSuspicion;

    // Ataques estruturais RS e WS — detectam especificamente LSB Replacement
    // (OpenStego, OpenPuff e similares). Rodam sobre os 3 canais.
    const w = imageData.width, h = imageData.height;
    const rs = { r: rsAttack(d,0,w,h), g: rsAttack(d,1,w,h), b: rsAttack(d,2,w,h) };
    const ws = { r: wsAttack(d,0,w,h), g: wsAttack(d,1,w,h), b: wsAttack(d,2,w,h) };
    const rsMax = Math.max(rs.r, rs.g, rs.b);
    const wsMax = Math.max(ws.r, ws.g, ws.b);
    // RS é o juiz CONFIÁVEL (separa limpo de stego: ~2-4% vs ~19-22%). O WS
    // (Weighted Stego) é INSTÁVEL em covers chapados/sintéticos — dá taxa alta
    // (53-80%) SEM stego —, então só confiamos nele quando a imagem tem
    // complexidade suficiente, e mesmo assim apenas como CORROBORAÇÃO. A
    // detecção se baseia no RS; o WS nunca dispara sozinho.
    const rsDetect = rsMax > 0.15;          // taxa alta = LSBR provável (confiável)
    const rsSoft   = rsMax > 0.08;          // sinal fraco de RS
    const wsReliable = !lowComplexity;
    const wsDetect = wsMax > 0.15 && wsReliable;
    const lsbrDetected = rsDetect || (wsDetect && rsSoft);    // alta confiança
    // lsbrStrong: SÓ o caminho do RS (>15%), que é o confiável. O caminho
    // corroborado (WS>15% + RS>8%) fica de fora — o WS produz taxas altas em
    // imagem limpa, e o próprio comentário acima diz que ele nunca decide
    // sozinho. Nenhum limiar mudou aqui: é a mesma condição `rsDetect`,
    // exposta separadamente para quem precisa distinguir os dois caminhos.
    const lsbrStrong = rsDetect;
    const lsbrPossible = !lsbrDetected && (rsSoft || wsDetect); // baixa confiança

    // Heurística de embedding neural (SteganoGAN-like) — suspeita, não prova
    const neural = neuralStegoHeuristic(d, w, h);

    report.lsb={available:true,chiR:chiR.toFixed(2),chiG:chiG.toFixed(2),chiB:chiB.toFixed(2),
      bestMode:rawResult.mode,printableRatio:(pr*100).toFixed(1)+'%',
      decodedSample:decoded.slice(0,120),suspicious: suspicious || lsbrDetected,
      foundText: foundText ? rawResult.foundText.slice(0,1000) : null,
      headerName: foundText ? (rawResult.headerName||null) : null,
      cipherSuspicion,
      // Resultados dos ataques estruturais
      rsRate: (rsMax*100).toFixed(1)+'%',
      wsRate: (wsMax*100).toFixed(1)+'%',
      lsbrDetected, lsbrStrong, lsbrPossible, wsReliable,
      // Heurística neural
      neuralSuspect: neural.suspect,
      neuralEntSim: neural.entSim,
      neuralHfSim: neural.hfSim,
      neuralAvgHF: neural.avgHF};
  } else {
    report.lsb={available:false,
      note:isLossy
        ?t('interpLSBUnavailLossy').replace('{ext}',fmt.ext)
        :t('interpLSBUnavailPalette').replace('{ext}',fmt.ext)};
  }

  // M4: FREQUENCY
  onProgress(4, PIPELINE_STEPS[3]);
  const hR=new Array(256).fill(0),hG=new Array(256).fill(0),hB=new Array(256).fill(0);
  for(let i=0;i<d.length;i+=4){hR[d[i]]++;hG[d[i+1]]++;hB[d[i+2]]++;}
  let evenOdd=0;
  for(let v=0;v<255;v+=2){const sum=hR[v]+hR[v+1]+1;evenOdd+=Math.abs(hR[v]-hR[v+1])/sum;}
  evenOdd/=128;
  const spikes=hR.filter(v=>v/total>0.02).length;
  report.frequency={spikes,evenOddBias:evenOdd.toFixed(4),
    biasAnomaly:isLossless&&evenOdd>0.3&&!lowComplexity,biasReliable:isLossless,biasLowComplexity:isLossless&&lowComplexity,
    dominantRGB:[hR.indexOf(Math.max(...hR)),hG.indexOf(Math.max(...hG)),hB.indexOf(Math.max(...hB))]};

  // M5: ENTROPY
  onProgress(5, PIPELINE_STEPS[4]);
  const freq={};
  for(let i=0;i<d.length;i+=4){const k=`${d[i]},${d[i+1]},${d[i+2]}`;freq[k]=(freq[k]||0)+1;}
  let entropy=0;
  for(const c of Object.values(freq)){const p=c/total;if(p>0)entropy-=p*Math.log2(p);}
  const noiseSum=[];
  const rows=Math.min(50,h);
  for(let y=0;y<rows;y++)for(let x=0;x<w-1;x++){const i=(y*w+x)*4;noiseSum.push(Math.abs(d[i]-d[i+4]));}
  const avgNoise=noiseSum.reduce((a,b)=>a+b,0)/noiseSum.length;
  const noiseThreshold=isLossy?0.8:isPalette?0.5:2;
  report.entropy={shannon:entropy.toFixed(4),uniqueColors:Object.keys(freq).length,
    avgNoise:avgNoise.toFixed(2),noiseAnomaly:avgNoise<noiseThreshold,
    noiseThreshold,highEntropy:entropy>18};

  // M6: COLOR
  onProgress(6, PIPELINE_STEPS[5]);
  const alphaVals=new Set(); let partialAlpha=0;
  for(let i=3;i<d.length;i+=4){alphaVals.add(d[i]);if(d[i]!==255&&d[i]!==0)partialAlpha++;}
  const colorMap={};
  for(let i=0;i<d.length;i+=4){
    const k=`${Math.round(d[i]/8)*8},${Math.round(d[i+1]/8)*8},${Math.round(d[i+2]/8)*8}`;
    colorMap[k]=(colorMap[k]||0)+1;
  }
  const rare=Object.entries(colorMap).filter(([,v])=>v>5&&v/total<0.001).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const rareThreshold=isLossy?8:2;
  report.color={uniqueAlpha:alphaVals.size,
    alphaAnomaly:isLossless&&alphaVals.size>2&&alphaVals.size<20,
    partialAlpha,rareClusters:rare.length,
    rareSuspicious:rare.length>rareThreshold,
    rareDetails:rare.map(([c,v])=>`RGB(${c}): ${v}px`)};

  // M7: STUDIO PROTOCOL
  onProgress(7, PIPELINE_STEPS[6]);
  const studioRaw=isLossless?extractLSBStudio(imageData):null;
  const studioShuffled=!!(studioRaw && studioRaw.needsPassword);
  const studioPayload=studioShuffled?null:studioRaw;
  report.studio={hasHeader:!!(studioPayload||studioShuffled),
    payloadBytes:studioPayload?studioPayload.length:0,
    shuffled:studioShuffled,
    available:isLossless,
    note:!isLossless?t('noteStudioUnavailable').replace('{ext}',fmt.ext):''};


  // M8: DCT, GRADIENTS, CHROMINANCE, EXIF, C2PA
  onProgress(8, PIPELINE_STEPS[7]);
  report.dct = analyzeDCT(imageData);
  report.gradients = analyzeGradients(imageData);
  onProgress(9, PIPELINE_STEPS[8]);
  report.chroma = analyzeChrominance(imageData);
  // ⚠️ "não li o arquivo" ≠ "li e não havia EXIF".
  // O fallback antigo devolvia `noExif:true` também quando a LEITURA falhava, e
  // esse campo alimenta o classificador de origem — uma falha de I/O virava
  // evidência de "PNG sem metadados de câmera". A v2.42.8 agravou isso: antes a
  // leitura travava (ruim e visível); depois passou a rejeitar, e a rejeição era
  // engolida aqui como ausência (ruim e invisível).
  report.exif  = await parseEXIF(file).catch(e=>({available:false,readError:String(e&&e.message||e),
    found:false,fields:{},aiSoftware:null,hasCamera:false,hasGPS:false,noExif:false}));
  report.c2pa  = await parseC2PA(file).catch(e=>({available:false,readError:String(e&&e.message||e),
    found:false,manifestDetected:false,aiGenerator:null,ca:null,certDate:null,
    digitalSourceType:null,manifestPresent:false,signals:[],rawSoftware:null}));
  // `available===false` significa que a leitura falhou. Sem ler, não dá para
  // afirmar ausência de EXIF — e `noExif` alimenta o score de origem.
  if(!report.exif.found && report.exif.available !== false){
    report.exif.noExif = fmt.ext==='JPEG' || file.type==='image/png';
  }

  // M9: DETECÇÃO DE IA
  onProgress(10, PIPELINE_STEPS[9]);
  const aiSignals=[];
  let aiScore=0;
  const aiDims=[512,640,768,832,1024,1152,1280,1344,1536,1792,2048];
  const wExact=aiDims.includes(w),hExact=aiDims.includes(h);
  if(wExact&&hExact){aiScore+=25;aiSignals.push({labelKey:'aiLblDimTypical',detailKey:'aiDetDimTypical',detailVars:{w:w,h:h},level:'warn'});}
  else if(wExact||hExact){aiScore+=10;aiSignals.push({labelKey:'aiLblDimPartial',detailKey:'aiDetDimPartial',detailVars:{w:w,h:h},level:'info'});}

  // C2PA — indicador definitivo, peso máximo
  if(report.c2pa?.manifestDetected){
    aiScore+=85;
    // Estes valores saem do manifesto do arquivo e terminam em HTML via
    // detailVars. Escapados na origem (sink perdido na v2.42.0).
    const c2paDetail=[
      report.c2pa.aiGenerator?t('c2paGenPrefix').replace('{gen}',escapeHTML(report.c2pa.aiGenerator)):null,
      report.c2pa.digitalSourceType?`IPTC: ${escapeHTML(report.c2pa.digitalSourceType)}`:null,
      report.c2pa.ca?`CA: ${escapeHTML(report.c2pa.ca)}`:null,
      report.c2pa.certDate?`Certificado: ${escapeHTML(report.c2pa.certDate)}`:null,
    ].filter(Boolean).join(' · ');
    aiSignals.push({labelKey:'aiLblC2PAConfirmed',
      detailKey:'aiDetC2PAConfirmed',detailVars:{extra:c2paDetail},level:'crit'});
  } else if(report.c2pa?.found && report.c2pa?.manifestPresent){
    // Manifesto JUMB real encontrado mas sem confirmação de gerador
    aiScore+=20;
    aiSignals.push({labelKey:'aiLblC2PAManifest',
      detailKey:'aiDetC2PAManifest',detailVars:{signals:report.c2pa.signals.slice(0,3).join(' · ')},level:'warn'});
  }
  // CA Adobe sem manifesto JUMB = XMP genérico, não conta como C2PA

  // EXIF — segundo indicador mais forte
  const legacyEditors = /picasa|lightroom|photoshop|gimp|paint\.net|irfanview|acdsee|darktable|rawtherapee/i;
  if(report.exif.aiSoftware){
    aiScore+=60;
    aiSignals.push({labelKey:'aiLblAISoftwareEXIF',
      detailKey:'aiDetAISoftwareEXIF',detailVars:{software:report.exif.aiSoftware},level:'crit'});
  } else if(report.exif.found && report.exif.fields?.Software && legacyEditors.test(report.exif.fields.Software)){
    // Software de edição legado conhecido — não penaliza, apenas informa
    aiSignals.push({labelKey:'aiLblEditSoftware',
      detailKey:'aiDetEditSoftware',detailVars:{software:report.exif.fields.Software},level:'info'});
  } else if(report.exif.noExif&&fmt.ext==='JPEG'){
    aiScore+=15;
    aiSignals.push({labelKey:'aiLblJPEGNoEXIF',
      detailKey:'aiDetJPEGNoEXIF',level:'warn'});
  } else if(report.exif.found&&!report.exif.hasCamera&&!report.exif.fields?.Software){
    aiScore+=10;
    aiSignals.push({labelKey:'aiLblEXIFNoCamera',
      detailKey:'aiDetEXIFNoCamera',level:'warn'});
  }
  // Câmera real é tratada pelo VETO DE CÂMERA no final (teto de score)
  // (O sinal "PNG sem EXIF" é adicionado uma única vez mais abaixo, com peso reduzido)

  const noise=parseFloat(report.entropy.avgNoise);
  if(!isLossy){
    if(noise<0.5){aiScore+=35;aiSignals.push({labelKey:'aiLblNoiseAbsent',detailKey:'aiDetNoiseAbsent',detailVars:{noise:noise},level:'crit'});}
    else if(noise<2){aiScore+=20;aiSignals.push({labelKey:'aiLblNoiseVeryLow',detailKey:'aiDetNoiseVeryLow',detailVars:{noise:noise},level:'warn'});}
  } else {
    if(noise<0.5){aiScore+=25;aiSignals.push({labelKey:'aiLblNoiseAbsentComp',detailKey:'aiDetNoiseAbsentComp',detailVars:{noise:noise,ext:fmt.ext},level:'crit'});}
    else if(noise<1.0){aiScore+=12;aiSignals.push({labelKey:'aiLblNoiseLowLossy',detailKey:'aiDetNoiseLowLossy',detailVars:{noise:noise,ext:fmt.ext},level:'warn'});}
  }

  const uniqueColors=report.entropy.uniqueColors;
  if(!isLossy){
    if(uniqueColors<500){aiScore+=25;aiSignals.push({labelKey:'aiLblPaletteVeryLimited',detailKey:'aiDetPaletteVeryLimited',detailVars:{colors:uniqueColors.toLocaleString()},level:'crit'});}
    else if(uniqueColors<5000){aiScore+=10;aiSignals.push({labelKey:'aiLblPaletteReduced',detailKey:'aiDetPaletteReduced',detailVars:{colors:uniqueColors.toLocaleString()},level:'warn'});}
  } else {
    if(uniqueColors<5000){aiScore+=20;aiSignals.push({labelKey:'aiLblPaletteVeryLimited',detailKey:'aiDetPaletteVeryLimitedLossy',detailVars:{colors:uniqueColors.toLocaleString(),ext:fmt.ext},level:'warn'});}
    else if(uniqueColors<20000){aiScore+=8;aiSignals.push({labelKey:'aiLblPaletteBelow',detailKey:'aiDetPaletteBelow',detailVars:{colors:uniqueColors.toLocaleString(),ext:fmt.ext},level:'info'});}
  }

  if(isLossless&&report.color.rareClusters>2){
    aiScore+=10;aiSignals.push({labelKey:'aiLblRareClusters',detailKey:'aiDetRareClusters',detailVars:{count:report.color.rareClusters},level:'warn'});
  }

  const ratio=w/h;
  const aiRatios=[{r:1,label:'1:1'},{r:4/3,label:'4:3'},{r:3/4,label:'3:4'},{r:16/9,label:'16:9'},{r:9/16,label:'9:16'},{r:3/2,label:'3:2'},{r:2/3,label:'2:3'}];
  const matchRatio=aiRatios.find(a=>Math.abs(ratio-a.r)<0.01);
  if(matchRatio&&(wExact||hExact)){aiScore+=10;aiSignals.push({labelKey:'aiLblExactRatio',labelVars:{ratio:matchRatio.label},detailKey:'aiDetExactRatio',level:'info'});}

  const qW=Math.floor(w/2),qH=Math.floor(h/2);
  const quadEntropies=[];
  for(let qy=0;qy<2;qy++)
    for(let qx=0;qx<2;qx++){
      const qFreq={};
      for(let y=qy*qH;y<(qy+1)*qH;y++)
        for(let x=qx*qW;x<(qx+1)*qW;x++){
          const i=(y*w+x)*4;
          const k=`${Math.round(d[i]/16)*16},${Math.round(d[i+1]/16)*16},${Math.round(d[i+2]/16)*16}`;
          qFreq[k]=(qFreq[k]||0)+1;
        }
      const qTotal=qW*qH;let qEnt=0;
      for(const c of Object.values(qFreq)){const p=c/qTotal;if(p>0)qEnt-=p*Math.log2(p);}
      quadEntropies.push(qEnt);
    }
  const qSpread=Math.max(...quadEntropies)-Math.min(...quadEntropies);
  report._regionalEntropyVar = qSpread;  // exposto para o classificador de origem
  // Escala proporcional — quanto menor o spread, maior o peso (máx 28)
  if(uniqueColors>200){
    if(qSpread<0.5){aiScore+=28;aiSignals.push({labelKey:'aiLblEntropyExtreme',detailKey:'aiDetEntropyExtreme',detailVars:{spread:qSpread.toFixed(2)},level:'crit'});}
    else if(qSpread<1.0){aiScore+=22;aiSignals.push({labelKey:'aiLblEntropyVery',detailKey:'aiDetEntropyVery',detailVars:{spread:qSpread.toFixed(2)},level:'crit'});}
    else if(qSpread<2.0){aiScore+=14;aiSignals.push({labelKey:'aiLblEntropyModerate',detailKey:'aiDetEntropyModerate',detailVars:{spread:qSpread.toFixed(2)},level:'warn'});}
    else if(qSpread<3.0){aiScore+=6;aiSignals.push({labelKey:'aiLblEntropySlight',detailKey:'aiDetEntropySlight',detailVars:{spread:qSpread.toFixed(2)},level:'info'});}
  }

  if(report.dct?.available&&report.dct.suspicious){
    aiScore+=15;aiSignals.push({labelKey:'aiLblDCTUniform',detailKey:'aiDetDCTUniform',detailVars:{std:report.dct.stdDev},level:'warn'});
  }

  // Gradientes — escala proporcional com limiares ajustados por formato
  // JPEG/lossy: recompressão (Facebook, WhatsApp, etc.) suaviza bordas naturalmente
  // Limiares lossy são mais permissivos para evitar falsos positivos
  if(report.gradients?.available){
    const sr=parseFloat(report.gradients.sharpRatio);
    if(isLossy){
      // Para JPEG: só sinaliza se for extremamente baixo (recompressão explica até ~5%)
      if(sr<0.5){
        aiScore+=30;aiSignals.push({labelKey:'aiLblEdgeExtremeJPEG',detailKey:'aiDetEdgeExtremeJPEG',detailVars:{ratio:report.gradients.sharpRatio},level:'crit'});
      } else if(sr<2){
        aiScore+=15;aiSignals.push({labelKey:'aiLblEdgeSevereJPEG',detailKey:'aiDetEdgeSevereJPEG',detailVars:{ratio:report.gradients.sharpRatio},level:'warn'});
      } else if(sr<5){
        aiScore+=6;aiSignals.push({labelKey:'aiLblEdgeSmoothJPEG',detailKey:'aiDetEdgeSmoothJPEG',detailVars:{ratio:report.gradients.sharpRatio},level:'info'});
      }
      // sr >= 5% em JPEG: comportamento normal de recompressão, sem sinal
    } else {
      // Para lossless (PNG, BMP): limiares originais mais rígidos
      if(sr<2){
        aiScore+=35;aiSignals.push({labelKey:'aiLblEdgeExtreme',detailKey:'aiDetEdgeExtreme',detailVars:{ratio:report.gradients.sharpRatio},level:'crit'});
      } else if(sr<8){
        aiScore+=25;aiSignals.push({labelKey:'aiLblEdgeSevere',detailKey:'aiDetEdgeSevere',detailVars:{ratio:report.gradients.sharpRatio},level:'crit'});
      } else if(sr<16){
        aiScore+=15;aiSignals.push({labelKey:'aiLblEdgeModerate',detailKey:'aiDetEdgeModerate',detailVars:{ratio:report.gradients.sharpRatio},level:'warn'});
      } else if(sr<22){
        aiScore+=7;aiSignals.push({labelKey:'aiLblEdgeSlight',detailKey:'aiDetEdgeSlight',detailVars:{ratio:report.gradients.sharpRatio},level:'info'});
      }
    }
  }

  // Crominância — escala proporcional (peso máx 18)
  if(report.chroma?.available&&report.chroma.suspicious){
    const detail=[];
    let chromaScore=0;
    if(report.chroma.oversaturated){
      const hsr=parseFloat(report.chroma.highSatRatio);
      const pts=hsr>30?18:hsr>20?14:hsr>10?9:5;
      chromaScore=Math.max(chromaScore,pts);
      detail.push(t('chromaOversatDetail').replace('{ratio}',report.chroma.highSatRatio));
    }
    if(report.chroma.uniformChroma){
      const cbv=parseFloat(report.chroma.cbVariance);
      const pts=cbv<8?16:cbv<12?11:cbv<16?7:4;
      chromaScore=Math.max(chromaScore,pts);
      detail.push(t('chromaUniformDetail').replace('{cb}',report.chroma.cbVariance).replace('{cr}',report.chroma.crVariance));
    }
    aiScore+=chromaScore;
    aiSignals.push({labelKey:'aiLblChromaAnomalies',detailKey:'aiDetChromaAnomalies',detailVars:{detail:detail.join(' · ')},level:'warn'});
  }

  // PNG sem EXIF — peso reduzido (é o mais fraco isolado)
  if(file.type==='image/png'&&file.size>200000&&!report.c2pa?.manifestDetected&&!report.exif.aiSoftware){
    aiScore+=5;aiSignals.push({labelKey:'aiLblPNGNoEXIF',
      detailKey:'aiDetPNGNoEXIF',level:'info'});
  }

  // VETO DE CÂMERA REAL
  // EXIF com Make/Model de câmera física é uma das definições mais confiáveis
  // de foto real — firmware de câmera não pode ser forjado por geradores de IA.
  // Quando presente e sem nenhum sinal de IA nos metadados, a evidência documental
  // supera a heurística de pixel: o score recebe um teto baixo.
  let cameraVeto = false;
  if (report.exif.hasCamera && !report.exif.aiSoftware && !report.c2pa?.manifestDetected) {
    cameraVeto = true;
    // v2.42.0 — era teto absoluto de 15. Mas EXIF não é autenticado: um teto
    // duro deixava qualquer arquivo com Make/Model forjado zerar o score de IA.
    // Agora o EXIF ATENUA em vez de decidir — o sinal de pixel continua
    // pesando, e um score altíssimo não desaba para 15 por causa de um campo
    // de texto. 15 vira piso do teto, não veredito.
    const capped = aiScore >= 70 ? Math.max(15, Math.round(aiScore * 0.45))
                                 : Math.min(aiScore, 15);
    if (aiScore > capped) {
      aiSignals.unshift({
        labelKey:'aiLblCameraConfirmed',
        detail: t('aiVetoDetail').replace('{make}',escapeHTML(report.exif.fields?.Make||'?')).replace('{model}',escapeHTML(report.exif.fields?.Model||'')),
        level: 'info'
      });
    }
    aiScore = capped;
  }

  // VETO DE ARTE VETORIAL / ÍCONE (flat design)
  // Ícones, logos e flat design compartilham traços com IA — sem ruído de
  // sensor, paleta limitada, entropia uniforme — mas NÃO são gerados por IA.
  // Quando os traços de vetor são inequívocos (pouquíssimas cores + sem ruído +
  // bordas nítidas), limitamos o score de IA e esclarecemos. Conservador de
  // propósito (só dispara em vetor óbvio); a probabilidade de origem será
  // recalibrada com mais amostras depois.
  let vectorArtVeto = false;
  if (!isLossy && !cameraVeto && uniqueColors < 2000 &&
      parseFloat(report.entropy.avgNoise) < 1.0 &&
      report.gradients?.available && parseFloat(report.gradients.sharpRatio) > 35) {
    vectorArtVeto = true;
    const cap = 30; // teto BAIXA — é sintético, mas não "gerado por IA"
    if (aiScore > cap) {
      aiSignals.unshift({ labelKey:'aiLblVectorArt', detailKey:'aiDetVectorArt',
        detailVars:{colors:uniqueColors.toLocaleString()}, level:'info' });
      aiScore = cap;
    }
  }

  // VETO DE GRÁFICO / RENDER DIGITAL — vale também em JPEG
  // Texto renderizado, diagramas, capas, arte flat e telas exportadas em JPEG
  // compartilham traços com imagem de IA (paleta pequena, entropia baixa,
  // croma uniforme), mas são apenas imagens DIGITAIS, não GERADAS POR IA.
  // O veto de arte vetorial acima só cobre PNG porque exige ruído quase nulo —
  // algo que a compressão JPEG destrói. Este cobre o caso lossy com critérios
  // robustos à compressão.
  // Motivado por um caso real (18/07/2026): a primeira imagem do Cicada 3301
  // (2012, texto branco sobre preto) recebia "IA ALTA 88" — impossível para a
  // época. Os SINAIS estavam certos (de fato não é fotografia); o RÓTULO é que
  // estava errado. Imagem digital ≠ imagem de IA.
  // Conservador de propósito: só dispara com evidência inequívoca de render.
  const chromaFlat = !!(report.chroma && (report.chroma.uniformChroma ||
    parseFloat(report.chroma.avgSaturation) < 5));
  let digitalRenderVeto = false;
  if (!vectorArtVeto && !cameraVeto && !report.c2pa?.manifestDetected &&
      !report.exif?.aiSoftware && uniqueColors < 2000 &&
      parseFloat(report.entropy.shannon) < 4.0 && chromaFlat) {
    digitalRenderVeto = true;
    const cap = 30; // teto BAIXA — é imagem digital, não "gerada por IA"
    if (aiScore > cap) {
      aiSignals.unshift({ labelKey:'aiLblDigitalRender', detailKey:'aiDetDigitalRender',
        detailVars:{colors:uniqueColors.toLocaleString(), entropy:report.entropy.shannon},
        level:'info' });
      aiScore = cap;
    }
  }

  const aiLevel=aiScore>=70?'ALTA':aiScore>=45?'MÉDIA':aiScore>=20?'BAIXA':'IMPROVÁVEL';
  report.ai={score:Math.min(aiScore,100),level:aiLevel,signals:aiSignals,
    formatCat:fmt.cat,formatExt:fmt.ext,cameraVeto,vectorArtVeto,digitalRenderVeto};

  // CLASSIFICADOR DE ORIGEM — scores independentes de 0 a 100 por categoria.
  // Não somam 100: cada categoria é avaliada isoladamente pelos seus próprios sinais.
  report.origin = computeOrigin(report, file, fmt);

  // Detecção de pipeline de rede social pelo nome do arquivo.
  report.socialPipeline = detectSocialPipeline(file?.name || '', jpegStruct);

  return report;
}

// Detecta se o arquivo passou por uma plataforma de mensagens/rede social,
// identificada pelo padrão de nomenclatura. Essas plataformas recomprimem a
// imagem e removem o EXIF — o que derruba o veto de câmera e faz os sinais de
// pixel dominarem, gerando falsos positivos de "sintética". Esta detecção NÃO
// altera nenhum score; apenas adiciona um aviso contextual para o usuário.
// F9: a assinatura ESTRUTURAL (tabela de quantização + SOF + subamostragem)
// tem PRIORIDADE sobre o nome do arquivo — ela é imune a renomeação, que é o
// caso mais comum no mundo real (arquivos baixados, reenviados, renomeados).
// O nome só entra quando nenhuma estrutura conhecida casa.
function detectSocialPipeline(filename, struct) {
  const byStruct = struct ? identifyJpegPlatform(struct) : null;
  const byName = filename ? matchSocialFilename(filename) : null;
  if (byStruct) {
    // o nome só conta como corroborante se apontar para a MESMA plataforma
    const nameAgrees = !!(byName && byName.platform === byStruct.name);
    return { detected:true, platform:byStruct.name, weak:(byStruct.level!=='alta'),
             byStructure:true, byFilename:nameAgrees, level:byStruct.level };
  }
  if (byName) return { detected:true, platform:byName.platform, weak:!!byName.weak,
                       byStructure:false, byFilename:true };
  return null;
}

// Casamento por padrão de nome de arquivo — sinal FRACO, some ao renomear.
function matchSocialFilename(filename) {
  if (!filename) return null;
  const patterns = [
    { re: /^IMG-\d{8}-WA\d+/i,        platform: 'WhatsApp' },
    { re: /-WA\d{3,}\./i,            platform: 'WhatsApp' },
    { re: /^FB_IMG_\d+/i,            platform: 'Facebook' },
    { re: /^Screenshot_\d+.*Instagram/i, platform: 'Instagram' },
    { re: /^IMG_\d+_\d+\.(jpg|jpeg)$/i, platform: 'Instagram/Telegram', weak: true },
    { re: /^received_\d+/i,          platform: 'Messenger' },
    { re: /^Snapchat-\d+/i,          platform: 'Snapchat' },
  ];
  for (const p of patterns) {
    if (p.re.test(filename)) {
      return { platform: p.platform, weak: !!p.weak };
    }
  }
  return null;
}

// Calcula a probabilidade independente de cada origem possível.
// Categorias: fotografia, screenshot, arte digital (+3D), sintética/IA.
function computeOrigin(r, file, fmt) {
  const isJPEG = fmt.ext === 'JPEG';
  const isPNG  = fmt.ext === 'PNG';
  const exif = r.exif || {};
  const grad = r.gradients || {};
  const chroma = r.chroma || {};
  const entropy = r.entropy || {};
  const color = r.color || {};
  const ai = r.ai || {};

  const sharpRatio = parseFloat(grad.sharpRatio) || 0;       // % bordas nítidas
  const uniqueColors = entropy.uniqueColors || 0;
  const avgNoise = parseFloat(entropy.avgNoise) || 0;
  const regionalVar = r._regionalEntropyVar ?? 2;             // variação de entropia regional

  // Limiar de "ausência de ruído de sensor" adaptado ao formato.
  // JPEG comprime e reduz naturalmente o ruído — fotos reais do celular ficam
  // tipicamente entre 0.5 e 2.0 de ruído médio. Usar < 2 marcava essas fotos
  // como "sem ruído" indevidamente. Para JPEG exigimos < 0.5 (ruído quase nulo,
  // que a compressão sozinha não explica). PNG mantém < 2 (sem compressão, o
  // ruído de sensor deveria estar presente).
  const noiseAbsenceThreshold = isJPEG ? 0.5 : 2;
  const noiseAbsent = avgNoise < noiseAbsenceThreshold;

  // ── FOTOGRAFIA ──
  // Evidências de câmera física: EXIF de câmera, ruído de sensor, gradientes suaves naturais
  let photo = 0; const photoSig = [];
  if (exif.hasCamera) { photo += 60; photoSig.push({labelKey:'sigPhysicalEXIF', weight:60}); }
  if (exif.hasGPS)    { photo += 10; photoSig.push({labelKey:'sigGPS', weight:10}); }
  if (avgNoise >= 2 && avgNoise < 15) { photo += 20; photoSig.push({labelKey:'sigSensorNoise', weight:20}); }
  if (uniqueColors > 50000) { photo += 15; photoSig.push({labelKey:'sigHighChroma', weight:15}); }
  if (isJPEG && exif.found) { photo += 10; photoSig.push({labelKey:'sigJPEGMeta', weight:10}); }
  if (sharpRatio > 20 && sharpRatio < 75) { photo += 5; photoSig.push({labelKey:'sigNaturalGradients', weight:5}); }
  photo = Math.min(photo, 100);

  // ── SCREENSHOT ──
  // Interface digital: bordas perfeitas, paleta limitada de UI, sem ruído, entropia alta e variada
  let screen = 0; const screenSig = [];
  if (isPNG && !exif.hasCamera) { screen += 15; screenSig.push({labelKey:'sigPNGNoCamera', weight:15}); }
  if (sharpRatio > 80) { screen += 30; screenSig.push({labelKey:'sigSharpEdges', weight:30}); }
  if (noiseAbsent) { screen += 20; screenSig.push({labelKey:'sigNoSensorNoise', weight:20}); }
  if (uniqueColors < 5000 && uniqueColors > 100) { screen += 15; screenSig.push({labelKey:'sigUIPalette', weight:15}); }
  if (regionalVar > 3.0) { screen += 15; screenSig.push({labelKey:'sigHighRegionalEntropy', weight:15}); }
  // Dimensões típicas de tela (proporções e larguras comuns)
  const w = r.metadata?.width||0;
  const commonScreenW = [1080,1170,1179,1284,1290,1440,1920,2560,750,828];
  if (commonScreenW.includes(w)) { screen += 20; screenSig.push({labelKey:'sigScreenWidth', labelVars:{w}, weight:20}); }
  if (!exif.found && isPNG) { screen += 10; screenSig.push({labelKey:'sigPNGNoMeta', weight:10}); }
  screen = Math.min(screen, 100);

  // ── ARTE DIGITAL / RENDER 3D ──
  // Feito por humano em software: bordas regulares, paleta controlada, gradientes artificiais.
  // Sinais compartilhados com Screenshot (ausência de ruído, PNG sem câmera) aparecem em
  // ambas as categorias com o mesmo nome — contribuem genuinamente para as duas origens.
  let art = 0; const artSig = [];
  if (noiseAbsent) { art += 20; artSig.push({labelKey:'sigNoSensorNoise', weight:20}); }
  if (sharpRatio > 60 && sharpRatio <= 80) { art += 20; artSig.push({labelKey:'sigRegularSharpEdges', weight:20}); }
  if (uniqueColors < 30000 && uniqueColors > 500) { art += 20; artSig.push({labelKey:'sigControlledPalette', weight:20}); }
  if (chroma.uniformChroma && !chroma.oversaturated) { art += 15; artSig.push({labelKey:'sigControlledChroma', weight:15}); }
  if (isPNG && !exif.hasCamera) { art += 10; artSig.push({labelKey:'sigPNGNoCamera', weight:10}); }
  if (grad.suspicious && sharpRatio > 50) { art += 10; artSig.push({labelKey:'sigArtificialGradients', weight:10}); }
  // Quando o veto de render digital disparou, o peso pertence AQUI, não em
  // "sintética/IA": a evidência é de imagem produzida em software, não de IA.
  if (ai.digitalRenderVeto) { art += 25; artSig.push({labelKey:'sigDigitalRender', weight:25}); }
  art = Math.min(art, 100);

  // ── SINTÉTICA / IA ──
  // Reaproveita o aiScore já calculado. Os sinais detalhados com seus pesos estão no
  // módulo "Detecção de Imagem Sintética" — aqui mostramos um resumo sem pesos redundantes.
  let synth = ai.score || 0; const synthSig = [];
  if (r.c2pa?.manifestDetected) synthSig.push({labelKey:'sigC2PAConfirmed', weight:null});
  if (exif.aiSoftware) synthSig.push({labelKey:'sigAISoftwareEXIF', weight:null});
  if (ai.score >= 45 && !r.c2pa?.manifestDetected && !exif.aiSoftware) synthSig.push({labelKey:'sigSyntheticPixels', weight:null});
  // Quando o veto de gráfico digital limitou o score, a categoria ficava com
  // pontuação e NENHUM sinal explicando — um número sem justificativa visível.
  // Este sinal fecha essa lacuna: diz por que o score existe e por que parou ali.
  if (ai.digitalRenderVeto) synthSig.push({labelKey:'sigSynthCappedByRender', weight:null});

  // Determina a categoria de maior probabilidade.
  // Não há "indeterminado": quando os scores ficam baixos e próximos, o próprio
  // conjunto de números já comunica a incerteza ao usuário.
  const scores = {fotografia:photo, screenshot:screen, arte_digital:art, sintetica:synth};
  let topCat = 'fotografia', topVal = -1;
  for (const [k,v] of Object.entries(scores)) { if (v > topVal) { topVal = v; topCat = k; } }

  return {
    fotografia: photo,
    screenshot: screen,
    arte_digital: art,
    sintetica: synth,
    topCategory: topCat,
    signals: { fotografia:photoSig, screenshot:screenSig, arte_digital:artSig, sintetica:synthSig }
  };
}

// ════════════════════════════════════════
//  THREAT SCORE (mensagem oculta)
// ════════════════════════════════════════
// ════════════════════════════════════════
//  CONSOLIDAÇÃO DO VEREDITO (Etapa 5a)
//  Cruza três sinais — detecção neural (Pro), ataques estruturais RS/WS,
//  e qualidade da extração — para decidir o que mostrar ao usuário de forma
//  honesta. O objetivo central: NUNCA exibir ruído como se fosse mensagem.
//
//  Recebe o que já foi computado e devolve { decodedMsg, decodeStatus, note }
//  possivelmente ajustados. A 'note' é uma observação interpretativa opcional.
// ════════════════════════════════════════
function consolidateVerdict(r, decodedMsg, decodeStatus, fromDeepScan) {
  const out = { decodedMsg, decodeStatus, note: null };

  // Sinais disponíveis
  const neural = r.neuralPro?.verdict || null;
  const neuralStego = !!neural?.stego_detected;
  const neuralMaxP = neural?.max_probability || 0;
  const flagged = neural?.methods_flagged || [];
  const na = r.neuralPro?.neural_analysis || {};
  const rsRate = parseFloat(r.lsb?.rsRate) || 0;   // %
  const wsRate = parseFloat(r.lsb?.wsRate) || 0;   // %
  // WS é instável em cover chapado/sintético; só conta quando confiável.
  const wsReliable = r.lsb?.wsReliable !== false;
  const lsbrDetected = !!r.lsb?.lsbrDetected;
  const printable = parseFloat(r.lsb?.printableRatio) || 0; // %
  const hasHeader = !!r.studio?.hasHeader;
  // Header de QUALQUER ferramenta (STEGO, JOI_LSB1/2, etc.) detectado nos LSBs
  // é prova de mensagem real, mesmo que não seja o protocolo nativo.
  const hasToolHeader = !!(r.lsb?.headerName);

  // Uma "mensagem real" exige uma destas: header (nativo OU de outra ferramenta
  // detectado nos LSBs), ou texto com alta proporção legível (>70%). Caso
  // contrário, é candidata a ruído.
  // Payload robusto extraído conta como mensagem real tanto quanto um header.
  const robustOk = r.studio?.robust === true;
  const looksReal = hasHeader || hasToolHeader || robustOk || printable > 70;

  // ── CONFIABILIDADE DO SINAL NEURAL (alinhado ao computeThreat) ──
  // PRIORIDADE stego: o neural só é vetado por C2PA confirmado (origem IA
  // provada) ou por ser outguess isolado (artefato JPEG). "Parecer sintético"
  // NÃO veta — pode ser a própria esteganografia imitando IA.
  const aiProven = !!(r.c2pa?.manifestDetected);
  const onlyOutguess = flagged.length === 1 && flagged[0] === 'outguess';
  const lsbFamilyHigh = (na.lsbr?.probability >= 0.9) || (na.lsbm?.probability >= 0.9);
  const structuralCorroborates = hasHeader || robustOk || rsRate >= 25 || (wsRate >= 25 && wsReliable) ||
                                  !!r.lsb?.lsbrDetected;

  const neuralReliable = neuralStego && lsbFamilyHigh && !onlyOutguess &&
                         !(aiProven && !structuralCorroborates);

  // ── DETECÇÃO ESTATÍSTICA CONFIRMA EMBEDDING ──
  // A prova de que há mensagem (e não ruído) vem da ESTATÍSTICA dos LSBs, não
  // do texto ser legível ou longo. RS/WS altos, LSBR detectado, ou chi-quadrado
  // anômalo são assinaturas que ruído natural não produz. Quando a estatística
  // confirma, qualquer texto coeso capturado no deep scan é uma mensagem real —
  // mesmo curto, mesmo com printable baixo, mesmo sem header. Isso torna a
  // ferramenta robusta contra fragmentação: cada fragmento embutido acende a
  // estatística, então não há tamanho mínimo de mensagem que escape à detecção.
  const statConfirmsEmbedding = lsbrDetected || rsRate >= 25 || (wsRate >= 25 && wsReliable);

  // Se a estatística confirma E há texto capturado, EXIBE — a estatística é a
  // autorização, não o tamanho/legibilidade do texto. Pode vir com algum ruído
  // junto; o usuário distingue facilmente a mensagem real do ruído ao redor.
  if (fromDeepScan && !looksReal && statConfirmsEmbedding && r.lsb?.foundText) {
    out.decodedMsg = r.lsb.foundText;
    out.decodeStatus = t('verdictStatConfirmedText');
    out.note = t('verdictStatConfirmedNote');
    return out;
  }

  // ── CASO B — Detectado mas NÃO extraível (o problema central) ──
  // Só dispara se o sinal neural é CONFIÁVEL. Em imagem de IA sem corroboração,
  // não afirmamos "detectado mas não extraível" — seria um falso-positivo.
  if (neuralReliable && neuralMaxP >= 0.85 && fromDeepScan && !looksReal) {
    out.decodedMsg = null; // NÃO mostra o ruído como mensagem
    out.decodeStatus = t('verdictDetectedNotExtractable');
    if (!lsbrDetected && rsRate < 25 && (wsRate < 25 || !wsReliable)) {
      out.note = t('verdictAdaptiveMethod');
    } else {
      out.note = t('verdictKeyRequired');
    }
    return out;
  }

  // ── CASO B2 — deep scan deu ruído, mas neural NÃO é confiável ──
  // Não temos evidência confiável de stego. Suprime o ruído mostrado como
  // mensagem, mas sem afirmar que há esteganografia.
  if (fromDeepScan && !looksReal && !neuralReliable) {
    out.decodedMsg = null;
    out.decodeStatus = t('verdictNoReliableMessage');
    return out;
  }

  // ── CASO D — Discordância informativa (só com neural confiável) ──
  // Neural confiável diz stego, estrutural (RS/WS) diz limpo. Informa o
  // provável método adaptativo.
  if (neuralReliable && neuralMaxP >= 0.6 && !lsbrDetected && rsRate < 25 && (wsRate < 25 || !wsReliable)) {
    if (!out.decodedMsg) {
      out.note = t('verdictAdaptiveMethod');
    }
    return out;
  }

  // ── CASO A — Mensagem real: mantém como está. ──
  // ── CASO C — Nada detectado: mantém como está (status "sem conteúdo"). ──
  return out;
}

function computeThreat(r) {
  let score=0; const flags=[];
  const isLossless=r.format?.cat==='lossless'||!r.format;

  // ── SINAIS FORTES DE ESTEGANOGRAFIA (evidência direta) ──
  // Esses pesam alto porque apontam mensagem oculta de forma específica.
  let hasStrongStego = false;

  // ── CONTEXTO C2PA (Opção B, #15a.2) ──
  // C2PA confirmado = prova criptográfica de origem IA. Os sinais MOLES que o próprio
  // conteúdo C2PA produz — strings do manifesto/SVG, anomalia LSB do SynthID, viés de
  // paridade de palette quantizada, suspeita neural — NÃO devem inflar o threat de
  // esteganografia, A MENOS que haja evidência DURA de que uma ferramenta embutiu
  // mensagem. Escotilha de segurança: a evidência dura abaixo (header STEGO, dado após
  // EOF, stegomalware, LSBR estrutural, RS≥25%, cifra ou texto oculto real) desliga a
  // supressão — então um embedding REAL numa imagem C2PA continua acusando.
  const aiProvenC2PA = !!(r.c2pa?.manifestDetected);
  const _printR = parseFloat(r.lsb?.printableRatio) || 0;
  const _realHiddenText = r.lsb?.available && r.lsb?.suspicious && r.lsb?.foundText &&
                          (r.lsb?.headerName || _printR > 70);
  // ⚠️ v2.42.5 — hardStego só aceita evidência ESTRUTURAL ou de EXTRAÇÃO.
  // Antes incluía `lsbrDetected` e `cipherSuspicion`, que são estatísticos e
  // são justamente o que conteúdo C2PA/IA produz. Resultado: a supressão era
  // desligada pelos próprios sinais que ela existe para suprimir — circular.
  // Medido numa imagem C2PA limpa: threat 100, e zerar o C2PA não mudava nada,
  // porque a supressão nunca chegava a rodar.
  //   • `lsbrStrong` (RS>15% sozinho) fica — é o caminho confiável do RS.
  //   • o caminho corroborado (WS+RS fraco) sai — WS dá taxa alta sem stego.
  //   • `cipherSuspicion` sai — uma janela de 512 bits com chi<3.84 entre ~39
  //     janelas, sem correção para comparações múltiplas.
  // Escotilha preservada: header, extração nativa, modo robusto, dado após EOF,
  // stegomalware, RS≥25% e texto oculto real continuam desligando a supressão.
  const hardStego = !!(
    r.strings?.appendedData || r.studio?.hasHeader ||
    r.studio?.nativeExtracted || r.studio?.nativeHeaderMatched ||
    r.studio?.robust === true || r.studio?.robust === 'locked' ||
    r.studio?.robust === 'content-error' ||
    (r.stegomalware||[]).some(m=>m.sev==='crit') ||
    r.lsb?.lsbrStrong || (parseFloat(r.lsb?.rsRate)||0) >= 25 ||
    _realHiddenText
  );
  const c2paExplains = aiProvenC2PA && !hardStego; // sinais moles explicados pelo C2PA
  let c2paSuppressed = false; // algum sinal mole foi rebaixado por contexto C2PA?

  if(r.strings?.appendedData){score+=35;flags.push(t('flagDataAfterEOF'));hasStrongStego=true;}
  // ── EVIDÊNCIA NATIVA — UMA fonte de precedência ──
  // A redação vem do MESMO resolveProtocolState usado pelo badge/accordion. O peso
  // continua refletindo a evidência bruta disponível: header passivo (+40) mantém
  // seu peso mesmo quando uma tentativa ativa também localizou o header, mas a
  // FLAG segue o nível mais forte/mais específico resolvido para não contradizer
  // o painel Protocolo.
  const studioLevel = resolveProtocolState(r).level;
  const studioWeight = r.studio?.nativeExtracted ? 40
    : r.studio?.hasHeader ? 40
    : r.studio?.nativeHeaderMatched ? 20 : 0;
  // A FORÇA vem da evidência bruta, não do rótulo resolvido. Um header passivo
  // continua sendo evidência forte mesmo quando `headerOnly` vence a redação por
  // ser mais específico. Separar estas duas decisões impede que ADICIONAR uma
  // evidência ativa faça o Threat cair e apague sinais corroborantes da mesma imagem.
  if(studioWeight >= 40) hasStrongStego = true;
  if(studioLevel === 'extracted'){
    score+=studioWeight; flags.push(t('flagStudioExtracted'));
  } else if(studioLevel === 'headerOnly'){
    score+=studioWeight; flags.push(t('flagStudioHeaderOnly'));
  } else if(studioLevel === 'passive'){
    score+=studioWeight; flags.push(t('flagStudioHeader'));
  }
  // ── MODO ROBUSTO (F4): o payload foi EXTRAÍDO dos coeficientes DCT ──
  // Extração real é a evidência mais forte que existe — mais forte que qualquer
  // estatística. Sem isto, a ferramenta lia a mensagem e ainda dizia "ameaça 0".
  // 'damaged' é INDÍCIO, não confirmação: o cabeçalho sobreviveu, o corpo não.
  if(r.studio?.robust === true){
    score+=40; flags.push(t('flagRobustPayload')); hasStrongStego=true;
  } else if(r.studio?.robust === 'locked'){
    score+=30; flags.push(t('flagRobustLocked')); hasStrongStego=true;
  } else if(r.studio?.robust === 'content-error'){
    score+=30; flags.push(t('flagRobustContentError')); hasStrongStego=true;
  } else if(r.studio?.robust === 'damaged'){
    score+=20; flags.push(t('flagRobustDamaged'));
  } else if(r.studio?.robustSignature?.suspeito){
    // Assinatura estatística SEM extração: indício, e dos fracos — só dispara
    // com a capacidade quase cheia. Peso menor que o de um payload avariado.
    score+=15; flags.push(t('flagRobustSignature'));
  }

  // ── STEGOMALWARE: a mensagem decodificada parece script/executável ──
  // Sinal específico e forte (roda só sobre conteúdo já decodificado com sucesso).
  // 'crit' = execução/payload inequívoco; 'warn' = indicador suspeito (URL, etc.).
  const _malw = r.stegomalware || [];
  if(_malw.some(m=>m.sev==='crit')){score+=50;flags.push(t('flagStegomalware'));hasStrongStego=true;}
  else if(_malw.length>0){score+=15;flags.push(t('flagStegoIndicators'));}

  // Texto extraído. Distingue texto REAL (header ou alta proporção legível)
  // de ruído de deep scan (printable baixo). Só o primeiro é evidência máxima.
  // Isso mantém coerência com a consolidação, que descarta o ruído — antes,
  // o mesmo ruído inflava o threat aqui e era descartado lá.
  if(isLossless&&r.lsb?.available&&r.lsb?.suspicious){
    if(c2paExplains){ c2paSuppressed = true; } // anomalia LSB = SynthID/manifesto, não soma
    else {
    const printableR = parseFloat(r.lsb.printableRatio) || 0;
    const realText = r.lsb.foundText && (r.lsb.headerName || printableR > 70);
    if(realText){
      score+=60;flags.push(t('flagHiddenText'));hasStrongStego=true;
    } else if(r.lsb.cipherSuspicion){
      score+=35;flags.push(t('flagPossibleCipher'));hasStrongStego=true;
    } else if(r.lsb.foundText){
      // Texto de deep scan com baixa legibilidade = provável ruído.
      // Anomalia LSB real, mas NÃO "texto oculto confirmado". Peso moderado.
      score+=30;flags.push(t('flagAnomalousLSB'));
    } else {
      score+=30;flags.push(t('flagAnomalousLSB'));
    }
    }
  }

  // Ataques estruturais RS/WS detectaram LSB Replacement — evidência forte e específica.
  if(isLossless&&r.lsb?.lsbrDetected){
    // O caminho corroborado (WS + RS fraco) é estatístico; numa imagem com
    // manifesto C2PA ele é explicável pelo próprio conteúdo. O caminho forte
    // (RS>15%) nunca é suprimido.
    if(!r.lsb?.lsbrStrong && c2paExplains){ c2paSuppressed = true; }
    else { score+=45;flags.push(t('flagLSBR'));hasStrongStego=true; }
  }
  else if(isLossless&&r.lsb?.lsbrPossible){
    if(c2paExplains){ c2paSuppressed = true; }
    else { score+=15;flags.push(t('flagLSBRPossible')); }
  }

  if(r.strings?.interesting?.length>0){
    if(c2paExplains){ c2paSuppressed = true; } // strings do manifesto/SVG C2PA, não soma
    else { score+=25;flags.push(t('flagSuspiciousStrings'));hasStrongStego=true; }
  }

  // Bias de paridade — sinal moderado de LSB sequencial.
  if(isLossless&&r.frequency?.biasAnomaly){
    if(c2paExplains){ c2paSuppressed = true; }
    else { score+=20;flags.push(t('flagParityBias')); }
  }

  // Heurística de embedding neural local (frontend) — suspeita leve.
  if(isLossless&&r.lsb?.neuralSuspect){
    if(c2paExplains){ c2paSuppressed = true; }
    else { score+=10;flags.push(t('flagNeuralStego')); }
  }

  // ── DETECÇÃO NEURAL (backend Pro) — COM CONTEXTO DE CONFIANÇA ──
  // PRIORIDADE: a análise esteganográfica é a função-núcleo. O neural NÃO é
  // suprimido por "parecer IA" — porque a própria esteganografia pode fazer
  // uma foto real parecer sintética. O único veto forte é C2PA confirmado
  // (prova criptográfica de origem IA), onde o falso-positivo é quase certo.
  // Os testes mostraram dois artefatos a filtrar:
  //  • outguess isolado dispara ~100% em JPEG (artefato de compressão)
  //  • C2PA-IA confirmada dispara os modelos espaciais sem mensagem real
  const neural = r.neuralPro?.verdict;
  const na = r.neuralPro?.neural_analysis || {};
  if(neural?.stego_detected){
    const maxP = neural.max_probability || 0;
    const flagged = neural.methods_flagged || [];
    const onlyOutguess = flagged.length === 1 && flagged[0] === 'outguess';
    const lsbFamilyHigh = (na.lsbr?.probability >= 0.9) || (na.lsbm?.probability >= 0.9);
    // FP comprovado por baseline limpo: o modelo HILL dispara ~0,99 em arte vetorial
    // chapada SEM mensagem (reage ao tipo de cover, não ao payload). Distinguidor
    // seguro = complexidade do cover: a detecção REAL de HILL (ex.: foto texturizada,
    // HILL 0,747) ocorre em cover NÃO-chapado (biasLowComplexity=false), então o veto
    // abaixo não a alcança. Exige HILL alto SEM corroboração da família LSB.
    const hillDominant = (na.hill?.probability >= 0.9) && !lsbFamilyHigh;
    const lowComplexityCover = r.frequency?.biasLowComplexity === true;

    // Veto forte: origem IA comprovada por C2PA → falso-positivo quase certo.
    const aiProven = !!(r.c2pa?.manifestDetected);

    // Corroboração estrutural (reforça confiança, mas não é obrigatória).
    const rsRate = parseFloat(r.lsb?.rsRate) || 0;
    const wsRate = parseFloat(r.lsb?.wsRate) || 0;
    const structuralCorroborates = hasStrongStego || r.studio?.hasHeader ||
                                   rsRate >= 25 || (wsRate >= 25 && r.lsb?.wsReliable!==false);

    if(c2paExplains){
      c2paSuppressed = true; // C2PA confirmado sem evidência dura → neural não soma (Opção B)
    }
    else if(onlyOutguess && !structuralCorroborates){
      flags.push(t('flagNeuralArtifact')); // artefato, não soma
    }
    else if(aiProven && !structuralCorroborates){
      flags.push(t('flagNeuralUncertainAI')); // C2PA-IA com corroboração ambígua, não soma
    }
    else if(hillDominant && lowComplexityCover && !structuralCorroborates){
      flags.push(t('flagNeuralVectorFP')); // HILL em cover chapado/vetorial → FP, não soma
    }
    else if(lsbFamilyHigh && maxP >= 0.9){
      // Detecção neural forte da família LSB. Conta — esta é a função-núcleo.
      // Peso maior com corroboração; ainda assim significativo sem ela.
      if(structuralCorroborates){
        score += 35; flags.push(t('flagNeuralConfirmed')); hasStrongStego = true;
      } else {
        score += 28; flags.push(t('flagNeuralConfirmed')); hasStrongStego = true;
        // Se a imagem foi classificada como sintética SEM prova C2PA, marca que
        // a esteganografia pode ser a causa do alto synth score (foto real).
        // A nota vai para a SEÇÃO DE ORIGEM, não para as flags do threat.
        if((r.ai?.score || 0) >= 75){ r._stegoMimicsAI = true; }
      }
    }
    else if(maxP >= 0.6){
      score += 12; flags.push(t('flagNeuralLikely'));
    }
  }

  // ── SINAIS AMBÍGUOS (servem para IA E para stego) ──
  // Só contribuem para o THREAT se houver corroboração de stego real.
  // Sozinhos, são características de imagem sintética e vão para o synth score,
  // NÃO devem inflar a suspeita de mensagem oculta.
  if(hasStrongStego){
    if(r.entropy?.noiseAnomaly){score+=12;flags.push(t('flagArtificialNoise'));}
    if(r.entropy?.highEntropy){score+=10;flags.push(t('flagHighEntropy'));}
    if(r.color?.rareSuspicious){score+=8;flags.push(t('flagRareClusters'));}
  }

  // ── SINAL DE ALPHA (específico de stego em PNG, mantém peso) ──
  if(isLossless&&r.color?.alphaAnomaly){score+=15;flags.push(t('flagSuspiciousAlpha'));}

  // Explica ao analista por que sinais moles não pontuaram (transparência da Opção B).
  if(c2paSuppressed){ flags.push(t('flagC2PAExplained')); }

  return {score:Math.min(score,100),flags};
}

// ════════════════════════════════════════
//  SYNTHETIC SCORE (origem sintética)
// ════════════════════════════════════════
function computeSynth(r) {
  // Usa os sinais já calculados no módulo AI do report
  const ai = r.ai;
  if (!ai) return {score:0, level:'—', flags:[]};
  // labelVars precisa ser interpolado aqui também. A UI já fazia; este caminho
  // não, e o relatório exportado saía com o placeholder cru ("Proporção exata
  // {ratio}") enquanto o próprio sinal carregava ratio:"2:3" ao lado.
  const flags = ai.signals.map(s => {
    let txt = s.labelKey ? t(s.labelKey) : (s.label||'');
    if (s.labelVars) for (const [k,v] of Object.entries(s.labelVars)) txt = txt.replace(`{${k}}`, escapeHTML(v));
    return txt;
  });
  const level = ai.level || '—';
  return {score: Math.min(ai.score, 100), level, flags};
}

// ════════════════════════════════════════
//  INTERPRET (regras, sem API)
// ════════════════════════════════════════
function interpretModule(key, r) {
  const {score,flags}=computeThreat(r);

  if(key==='lsb') {
    const cR=parseFloat(r.lsb.chiR),cG=parseFloat(r.lsb.chiG),cB=parseFloat(r.lsb.chiB);
    const pr=parseFloat(r.lsb.printableRatio);
    const minChi=Math.min(cR,cG,cB);
    const spread=Math.max(cR,cG,cB)-minChi;
    let txt='';
    if(r.lsb.lsbrDetected) txt=t('interpLsbRSWS').replace('{rs}',r.lsb.rsRate).replace('{ws}',r.lsb.wsRate);
    else if(r.studio?.hasHeader) txt=t('interpLsbHeader');
    else if(minChi<2) txt=t('interpLsbLowChi');
    else if(spread>2000) txt=t('interpLsbSpread').replace('{chans}', cR+'/'+cG+'/'+cB);
    else if(pr>60) txt=t('interpLsbPrintable').replace('{ratio}', r.lsb.printableRatio);
    else txt=t('interpLsbNormal');
    return txt;
  }

  if(key==='strings') {
    if(r.strings.appendedData) return t('interpStrAppended').replace('{bytes}', r.strings.appendedBytes);
    if(r.strings.interesting.length>0) return t('interpStrInteresting').replace('{count}', r.strings.interesting.length).replace('{types}', r.strings.interesting.slice(0,2).map(s=>s.type).join(', '));
    return t('interpStrNormal').replace('{count}', r.strings.count);
  }

  if(key==='frequency') {
    if(r.frequency.biasAnomaly) return t('interpFreqAnomaly').replace('{bias}', r.frequency.evenOddBias);
    return t('interpFreqNormal').replace('{bias}', r.frequency.evenOddBias);
  }

  if(key==='entropy') {
    let txt=t('interpEntBase').replace('{shannon}', r.entropy.shannon).replace('{colors}', r.entropy.uniqueColors.toLocaleString());
    if(r.entropy.noiseAnomaly) txt+=t('interpEntNoise').replace('{noise}', r.entropy.avgNoise);
    if(r.entropy.highEntropy) txt+=t('interpEntHigh');
    if(!r.entropy.noiseAnomaly&&!r.entropy.highEntropy) txt+=t('interpEntNormal');
    return txt;
  }

  if(key==='color') {
    let txt=t('interpColAlphaBase').replace('{count}', r.color.uniqueAlpha);
    if(r.color.alphaAnomaly) txt+=t('interpColAlphaAnomaly');
    else txt+=t('interpColAlphaNormal');
    if(r.color.rareClusters>0) txt+=t('interpColClusters').replace('{count}', r.color.rareClusters);
    return txt;
  }

  if(key==='studio') {
    // ⚠️ UMA das superfícies do mesmo estado. A v2.42.5 ensinou o Threat a usar a
    // evidência ativa; a v2.42.7 ensinou o badge do Protocolo. Esta nota ficou
    // para trás e continuava lendo só `hasHeader`, então com a senha certa a
    // tela mostrava "decifrado com chave ✓" logo acima de "nenhum texto legível
    // foi recuperado — forneça a chave". Agora as três derivam de
    // `resolveProtocolState`, que é a fonte única também para a nota offline.
    const proto = resolveProtocolState(r);
    if(proto.level === 'extracted')   return t('interpStudioExtracted');
    if(proto.level === 'headerOnly')  return t('interpStudioHeaderOnly');
    if(proto.level === 'passive')     return t('interpStudioHeader').replace('{bytes}', r.studio.payloadBytes);
    if(proto.level === 'generic') {
      const hdr = r.studio.headerName || r.lsb?.headerName;
      if (hdr) return t('interpStudioDeepHeader').replace('{hdr}', hdr);
      return t('interpStudioDeepNoHeader');
    }
    if(proto.level === 'cipher')      return t('interpStudioCipher');
    return t('interpStudioNone');
  }

  return '';
}


// ════════════════════════════════════════
//  PROGRESS INDICATOR
// ════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
//  LEITURA DE ARQUIVO À PROVA DE TRAVAMENTO
//
//  Havia três `new FileReader()` neste módulo e **nenhum `onerror`**. Cada um
//  vivia dentro de `new Promise(res => { r.onload = …; r.readAsArrayBuffer(f) })`
//  — se a leitura falhasse, `onload` nunca disparava, a promessa nunca resolvia
//  e o pipeline parava para sempre. Sem exceção e sem log: **console limpo e
//  barra congelada**, que é exatamente o sintoma do smoke da v2.42.7 (travou em
//  20%, "Strings & bytes brutos", console sem uma linha).
//
//  Este helper fecha as três saídas — erro, cancelamento e silêncio. O timeout
//  existe porque `onerror` cobre a falha declarada, não a leitura que
//  simplesmente nunca volta.
// ─────────────────────────────────────────────────────────────────────────────
const FILE_READ_TIMEOUT_MS = 60000;

function readFileBytes(file, rotulo='arquivo') {
  return new Promise((resolve, reject) => {
    let feito = false;
    const uma = fn => (...a) => { if (feito) return; feito = true; clearTimeout(tm); fn(...a); };
    const r = new FileReader();
    const tm = setTimeout(uma(() => {
      try { r.abort(); } catch(_) {}
      reject(new Error('fileReadTimeout:' + rotulo));
    }), FILE_READ_TIMEOUT_MS);
    r.onload  = uma(e => resolve(new Uint8Array(e.target.result)));
    r.onerror = uma(() => reject(new Error('fileReadError:' + rotulo)));
    r.onabort = uma(() => reject(new Error('fileReadAborted:' + rotulo)));
    try { r.readAsArrayBuffer(file); }
    catch (_) { uma(() => reject(new Error('fileReadThrew:' + rotulo)))(); }
  });
}

const PIPELINE_STEPS = [
  'stepMetaEXIF',
  'stepStrings',
  'stepLSB',
  'stepFrequency',
  'stepEntropy',
  'stepColor',
  'stepProtocol',
  'stepDCT',
  'stepChroma',
  'stepAI',
];
const TOTAL_STEPS = PIPELINE_STEPS.length;

function setProgress(step, label) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
  const el = document.getElementById('dec-status');
  if (!el) return;
  // Cancela qualquer digitação em andamento para não sobrescrever o progresso
  if (termState['dec-status']?.timer) { clearTimeout(termState['dec-status'].timer); termState['dec-status'].timer = null; }
  // label é uma chave i18n (dos PIPELINE_STEPS) — traduz na hora
  const labelText = label ? t(label) : '';
  el.innerHTML =
    `<span class="prompt">&gt;</span> ${t('termProcessing')}<br>` +
    `<span class="term-progress">[${bar}]</span> ${pct}%<br>` +
    `<span class="info">${labelText}</span><span class="term-cursor"></span>`;
  el.scrollTop = el.scrollHeight;
}

// ════════════════════════════════════════
//  EXIF PARSER (leve, browser-only)
// ════════════════════════════════════════
async function parseEXIF(file) {
  // Leitura via readFileBytes: falha vira rejeição, nunca promessa pendente.
  const _bytes = await readFileBytes(file, 'parseEXIF');
  return new Promise(res => {
    const e = { target: { result: _bytes.buffer } };
    (() => {
      const buf = e.target.result;
      const view = new DataView(buf);
      const result = {found: false, fields: {}, aiSoftware: null, hasCamera: false, hasGPS: false};

      try {
        // JPEG: começa com FF D8, APP1 em FF E1
        if (view.getUint16(0) !== 0xFFD8) { res(result); return; }
        let offset = 2;
        while (offset < buf.byteLength - 2) {
          const marker = view.getUint16(offset);
          if (marker === 0xFFE1) { // APP1 — EXIF or XMP
            const segLen = view.getUint16(offset + 2);
            const segData = new Uint8Array(buf, offset + 4, segLen - 2);
            const str = new TextDecoder('ascii', {fatal:false}).decode(segData);

            // XMP — procura por software de IA
            if (str.startsWith('http://ns.adobe.com') || str.includes('xmpmeta') || str.includes('x:xmpmeta')) {
              result.found = true;
              result.fields['Segmento'] = 'XMP detectado';
              // Procura por geradores conhecidos de IA
              const aiTools = [
                {rx:/grok/i, label:'Grok (xAI)'},
                {rx:/dall[- ]?e/i, label:'DALL-E (OpenAI)'},
                {rx:/midjourney/i, label:'Midjourney'},
                {rx:/stable.diffusion|stablediffusion/i, label:'Stable Diffusion'},
                {rx:/firefly/i, label:'Adobe Firefly'},
                {rx:/imagen/i, label:'Imagen (Google)'},
                {rx:/gemini/i, label:'Gemini (Google)'},
                {rx:/flux/i, label:'Flux'},
                {rx:/leonardo/i, label:'Leonardo AI'},
                {rx:/canva/i, label:'Canva AI'},
                {rx:/bing.image|BING/i, label:'Bing Image Creator'},
                {rx:/ideogram/i, label:'Ideogram'},
                {rx:/ai.?generated|generated.?by.?ai|synthetic.?image/i, label:'Declarado como IA'},
              ];
              for (const tool of aiTools) {
                if (tool.rx.test(str)) { result.aiSoftware = tool.label; break; }
              }
              // Extrai campos XMP legíveis
              const xmpFields = [
                {rx:/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i, key:'Criador'},
                {rx:/<xmp:CreatorTool[^>]*>([^<]+)<\/xmp:CreatorTool>/i, key:'Software'},
                {rx:/<photoshop:Source[^>]*>([^<]+)<\/photoshop:Source>/i, key:'Fonte'},
                {rx:/<Iptc4xmpCore:CopyrightNotice[^>]*>([^<]+)/i, key:'Copyright'},
              ];
              for (const f of xmpFields) {
                const m = str.match(f.rx);
                if (m) result.fields[f.key] = m[1].trim().slice(0, 120);
              }
            }

            // EXIF clássico
            if (str.startsWith('Exif\0\0')) {
              result.found = true;
              const exifStart = offset + 4 + 6; // pula 'Exif\0\0'
              const tiffView = new DataView(buf, exifStart);
              const littleEndian = tiffView.getUint16(0) === 0x4949;
              const ifdOffset = tiffView.getUint32(4, littleEndian);
              const numEntries = tiffView.getUint16(ifdOffset, littleEndian);

              const TAGS = {
                0x010F: 'Make', 0x0110: 'Model', 0x0131: 'Software',
                0x013B: 'Artist', 0x8298: 'Copyright', 0x9003: 'DateTimeOriginal',
                0x9286: 'UserComment', 0x0213: 'YCbCrPositioning',
                0x8769: 'ExifIFD', 0x8825: 'GPSIFD',
              };

              for (let i = 0; i < numEntries && i < 40; i++) {
                try {
                  const entryOffset = ifdOffset + 2 + i * 12;
                  const tag = tiffView.getUint16(entryOffset, littleEndian);
                  const type = tiffView.getUint16(entryOffset + 2, littleEndian);
                  const count = tiffView.getUint32(entryOffset + 4, littleEndian);

                  if (tag === 0x8825) { result.hasGPS = true; result.fields['GPS'] = 'presente'; }
                  if (tag === 0x8769) { /* ExifIFD — câmera real */ result.hasCamera = true; }

                  if (type === 2 && TAGS[tag]) { // ASCII string
                    const typeSize = [0,1,1,2,4,8,1,1,2,4,8,4,8];
                    const byteLen = count * (typeSize[type]||1);
                    let valOffset = entryOffset + 8;
                    if (byteLen > 4) valOffset = tiffView.getUint32(entryOffset + 8, littleEndian);
                    try {
                      const valBytes = new Uint8Array(buf, exifStart + valOffset, Math.min(byteLen, 200));
                      const val = new TextDecoder('ascii',{fatal:false}).decode(valBytes).replace(/\0/g,'').trim();
                      if (val) {
                        result.fields[TAGS[tag]] = val.slice(0,120);
                        // Verifica software de IA nos campos EXIF
                        const aiTools = [
                          {rx:/grok/i,label:'Grok (xAI)'},{rx:/dall[- ]?e/i,label:'DALL-E'},
                          {rx:/midjourney/i,label:'Midjourney'},{rx:/stable.diffusion/i,label:'Stable Diffusion'},
                          {rx:/firefly/i,label:'Adobe Firefly'},{rx:/imagen/i,label:'Imagen'},
                          {rx:/flux/i,label:'Flux'},{rx:/leonardo/i,label:'Leonardo AI'},
                          {rx:/ai[- ]generated|generated by/i,label:'Declarado como IA'},
                          {rx:/canva/i,label:'Canva AI'},{rx:/ideogram/i,label:'Ideogram'},
                        ];
                        for (const tool of aiTools) if (tool.rx.test(val)) { result.aiSoftware = tool.label; break; }
                      }
                    } catch(_) {}
                  }
                } catch(_) {}
              }

              // ⚠️ v2.42.0 — o comentário dizia "Make + Model + ExifIFD" e o código
              // fazia `Make OU Model`, descartando o ExifIFD que a linha do tag
              // 0x8769 já havia detectado. Agora o código cumpre o que promete:
              // os três, porque um EXIF montado à mão costuma trazer só Make.
              // Continua sendo EXIF — não autenticado, forjável por qualquer
              // editor. É evidência de apoio, nunca prova (ver aiVetoDetail).
              result.hasExifIFD = result.hasCamera;   // vem do tag 0x8769
              result.hasCamera  = !!(result.fields['Make'] && result.fields['Model'] && result.hasExifIFD);
              result.cameraPartial = !result.hasCamera &&
                                     !!(result.fields['Make'] || result.fields['Model']);
            }
            offset += 2 + segLen;
          } else if ((marker & 0xFF00) === 0xFF00) {
            if (marker === 0xFFDA) break; // SOS — fim dos metadados
            const segLen = view.getUint16(offset + 2);
            offset += 2 + segLen;
          } else { offset++; }
        }
      } catch(_) {}
      res(result);
    })();
  });
}

// ════════════════════════════════════════
//  DCT BLOCK UNIFORMITY (8×8 grid variance)
// ════════════════════════════════════════
// ════════════════════════════════════════
//  F3-C — Esteganálise em JPEG (coeficientes DCT quantizados)
//  Usa jpeg_dct.js (F3-B) para ler os coeficientes reais e produz uma análise
//  HONESTA em camadas: estatísticas descritivas + chi-quadrado rotulado como
//  indicador FRACO de 1ª ordem. Não promete detecção "liga/desliga": o
//  chi-quadrado clássico não pega Steghide/OutGuess/F5 (payload baixo/espalhado)
//  — o caminho forte é a extração real pelo Decoder, integrada à parte.
// ════════════════════════════════════════
// F7: `sharedDec` opcional — coeficientes já decodificados no nível acima.
// Quando vem preenchido, pula o decode (o mesmo arquivo não é decodificado duas
// vezes). Quando vem nulo — inclusive porque o decode falhou lá em cima —, faz
// o decode aqui para produzir a mensagem de erro correta.
function analyzeJpegDCT(jpegBytes, sharedDec){
  let dec=sharedDec||null;
  if(!dec){
    try{ dec=decodeJpegCoefficients(jpegBytes); }
    catch(e){
      const msg=(e&&e.message)||'decode falhou';
      return {available:false, reason:msg};
    }
  }
  let lin;
  try{ lin=jpegCoeffsLinear(dec); }
  catch(_){ return {available:false, reason:'linearização falhou'}; }

  // estatísticas descritivas dos coeficientes AC (pula DC = índice múltiplo de 64)
  let acTotal=0, acNonZero=0, acAbsSum=0, maxAbs=0;
  const hist=new Map(); // valor -> contagem (só AC não-zero)
  for(let i=0;i<lin.length;i++){
    if(i%64===0) continue;         // DC
    acTotal++;
    const v=lin[i];
    if(v!==0){
      acNonZero++; const a=Math.abs(v); acAbsSum+=a; if(a>maxAbs)maxAbs=a;
      hist.set(v,(hist.get(v)||0)+1);
    }
  }
  if(acTotal===0) return {available:false, reason:'sem coeficientes AC'};

  // chi-quadrado sobre pares de valores (PoV: 2k ↔ 2k+1). Indicador FRACO.
  // Mede se as frequências de pares adjacentes foram artificialmente igualadas
  // (assinatura de LSB sequencial tipo Jsteg). NÃO pega embedding espalhado.
  let chi=0, pairs=0;
  for(let k=1;k<=32;k++){
    const n1=hist.get(2*k)||0, n2=hist.get(2*k+1)||0;
    const tot=n1+n2;
    if(tot<5) continue;
    const exp=tot/2;
    chi += ((n1-exp)*(n1-exp))/exp;
    pairs++;
  }
  // p-valor aproximado não é necessário; usamos o chi normalizado por pares como
  // um índice grosseiro. Um chi MUITO baixo (frequências suspeitosamente iguais)
  // é o que indicaria Jsteg — não um chi alto.
  const chiPerPair = pairs>0 ? chi/pairs : null;
  // heurística conservadora: só sinaliza "possível LSB sequencial" se as
  // frequências de pares estiverem MUITO próximas (chiPerPair baixo) COM amostra
  // significativa. Limiar deliberadamente exigente para não gerar falso alarme.
  const firstOrderAnomaly = (chiPerPair!==null && pairs>=8 && chiPerPair < 0.5);

  // distribuição por banda de frequência (baixa/média/alta) — informativo.
  // Dentro de cada bloco 8×8, índice natural 0..63; usamos faixas simples.
  let lowNZ=0, midNZ=0, highNZ=0;
  for(let i=0;i<lin.length;i++){
    const pos=i%64; if(pos===0) continue;
    if(lin[i]===0) continue;
    if(pos<=5) lowNZ++; else if(pos<=20) midNZ++; else highNZ++;
  }

  return {
    available:true,
    // registra o modo de codificação: sem isso não dá para saber, lendo um
    // relatório, se o caminho progressivo foi exercitado
    progressive: !!dec.progressive,
    components: dec.header.components,
    width: dec.header.width, height: dec.header.height,
    acTotal, acNonZero,
    nonZeroRatio: (acNonZero/acTotal),
    distinctValues: hist.size,
    avgAbsCoeff: acNonZero>0 ? (acAbsSum/acNonZero) : 0,
    maxAbsCoeff: maxAbs,
    chi: chi, chiPairs: pairs, chiPerPair: chiPerPair,
    firstOrderAnomaly,
    bandLow: lowNZ, bandMid: midNZ, bandHigh: highNZ,
    // rótulo honesto: o que este resultado significa e NÃO significa
    verdict: firstOrderAnomaly ? 'weakAnomaly' : 'noFirstOrderAnomaly',
  };
}

function analyzeDCT(imageData) {
  const d = imageData.data, w = imageData.width, h = imageData.height;
  const blockW = Math.floor(w / 8), blockH = Math.floor(h / 8);
  if (blockW < 4 || blockH < 4) return {available: false};

  const blockMeans = [];
  // Sample até 200 blocos aleatórios para velocidade
  const sampleX = Math.min(blockW, 20), sampleY = Math.min(blockH, 20);
  const stepX = Math.max(1, Math.floor(blockW / sampleX));
  const stepY = Math.max(1, Math.floor(blockH / sampleY));

  for (let by = 0; by < blockH; by += stepY) {
    for (let bx = 0; bx < blockW; bx += stepX) {
      let sum = 0, count = 0;
      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const idx = ((by*8+py)*w + (bx*8+px)) * 4;
          if (idx < d.length) {
            const gray = d[idx]*0.299 + d[idx+1]*0.587 + d[idx+2]*0.114;
            sum += gray; count++;
          }
        }
      }
      if (count > 0) blockMeans.push(sum / count);
    }
  }

  if (blockMeans.length < 4) return {available: false};

  const mean = blockMeans.reduce((a,b)=>a+b,0) / blockMeans.length;
  const variance = blockMeans.reduce((a,b)=>a+(b-mean)**2,0) / blockMeans.length;
  const stdDev = Math.sqrt(variance);

  // Imagens de IA tendem a ter stdDev de blocos MENOR (mais uniforme)
  // Fotos reais: stdDev > 40; Imagens sintéticas simples: stdDev < 25
  const suspicious = stdDev < 28;

  return {available: true, blockCount: blockMeans.length, stdDev: stdDev.toFixed(2),
    mean: mean.toFixed(1), suspicious};
}

// ════════════════════════════════════════
//  GRADIENT ANALYSIS (edge sharpness)
// ════════════════════════════════════════
function analyzeGradients(imageData) {
  const d = imageData.data, w = imageData.width, h = imageData.height;
  const sampleH = Math.min(h, 300), sampleW = Math.min(w, 300);
  const stepX = Math.max(1, Math.floor(w / sampleW));
  const stepY = Math.max(1, Math.floor(h / sampleH));

  let sharpEdges = 0, softEdges = 0, totalEdges = 0;

  for (let y = 1; y < h-1; y += stepY) {
    for (let x = 1; x < w-1; x += stepX) {
      const idx = (y*w+x)*4;
      const gx = Math.abs(d[idx] - d[idx+4]) + Math.abs(d[idx+1] - d[idx+5]) + Math.abs(d[idx+2] - d[idx+6]);
      const gy = Math.abs(d[idx] - d[(y+1)*w*4+x*4]) + Math.abs(d[idx+1] - d[(y+1)*w*4+x*4+1]);
      const mag = (gx + gy) / 6;
      if (mag > 5) {
        totalEdges++;
        if (mag > 30) sharpEdges++;
        else softEdges++;
      }
    }
  }

  if (totalEdges === 0) return {available: false};
  const sharpRatio = sharpEdges / totalEdges;
  // IA tende a ter menos bordas muito nítidas (suavização de difusão)
  // Fotos reais: sharpRatio > 0.35; IA: sharpRatio < 0.25
  const suspicious = sharpRatio < 0.22;

  return {available: true, totalEdges, sharpRatio: (sharpRatio*100).toFixed(1)+'%',
    sharpEdges, softEdges, suspicious};
}

// ════════════════════════════════════════
//  CHROMINANCE / SATURATION ANALYSIS
// ════════════════════════════════════════
function analyzeChrominance(imageData) {
  const d = imageData.data, total = imageData.width * imageData.height;
  const step = Math.max(1, Math.floor(total / 5000)); // sample 5000 pixels

  let satSum = 0, satHigh = 0, satLow = 0;
  let cbValues = [], crValues = [];

  for (let i = 0; i < total; i += step) {
    const idx = i * 4;
    const r = d[idx]/255, g = d[idx+1]/255, b = d[idx+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const sat = max === 0 ? 0 : (max-min)/max;
    satSum += sat;
    if (sat > 0.6) satHigh++;
    if (sat < 0.1) satLow++;

    // YCbCr
    const cb = 128 - 0.16874*d[idx] - 0.33126*d[idx+1] + 0.5*d[idx+2];
    const cr = 128 + 0.5*d[idx] - 0.41869*d[idx+1] - 0.08131*d[idx+2];
    cbValues.push(cb);
    crValues.push(cr);
  }

  const sampleCount = Math.floor(total / step);
  const avgSat = satSum / sampleCount;
  const highSatRatio = satHigh / sampleCount;

  // Variância de Cb e Cr
  const cbMean = cbValues.reduce((a,b)=>a+b,0)/cbValues.length;
  const crMean = crValues.reduce((a,b)=>a+b,0)/crValues.length;
  const cbVar = Math.sqrt(cbValues.reduce((a,b)=>a+(b-cbMean)**2,0)/cbValues.length);
  const crVar = Math.sqrt(crValues.reduce((a,b)=>a+(b-crMean)**2,0)/crValues.length);

  // IA tende a super-saturar (highSatRatio alto) e ter crominância mais uniforme (cbVar baixo)
  const oversaturated = highSatRatio > 0.15 && avgSat > 0.35;
  const uniformChroma = cbVar < 18 && crVar < 18;
  const suspicious = oversaturated || uniformChroma;

  return {available: true,
    avgSaturation: (avgSat*100).toFixed(1)+'%',
    highSatRatio: (highSatRatio*100).toFixed(1)+'%',
    cbVariance: cbVar.toFixed(2), crVariance: crVar.toFixed(2),
    oversaturated, uniformChroma, suspicious};
}

// ════════════════════════════════════════
//  RENDER RESULTS
// ════════════════════════════════════════
// Accordion exclusivo: abre o item clicado e fecha os irmãos dentro do mesmo
// container, para não acumular vários painéis abertos. Usado pelos módulos
// forenses e pelos indicadores.

// ════════════════════════════════════════
//  F9 — IMPRESSÃO DIGITAL DE ORIGEM (plataforma) E DE FERRAMENTA
// ════════════════════════════════════════
// Perfis medidos em 18/07/2026 a partir de imagens reais passadas por cada
// plataforma. A tabela de quantização é a assinatura principal; SOF,
// subamostragem e sequência de APP corroboram. Ver MEDICAO_REDES_SOCIAIS.md.
const JPEG_PLATFORM_PROFILES = [
  {id:'whatsapp', name:'WhatsApp', sof:'baseline', sub:'420', apps:[0,2],
   luma:[3,2,2,2,2,2,3,2,2,2,3,3,3,3,4,6,4,4,4,4,4,8,6,6,5,6,9,8,10,10,9,8,9,9,10,12,15,12,10,11,14,11,9,9,13,17,13,14,15,16,16,17,16,10,12,18,19,18,16,19,15,16,16,16]},
  // ⚠️ X (Twitter) NÃO ENTRA AQUI — e isso é um ACHADO, não uma omissão.
  // Medição de 18/07/2026: o X faz TRANSCODIFICAÇÃO SEM PERDA. A saída dele é
  // byte a byte idêntica a `jpegtran -progressive -copy none` aplicado ao
  // original (provado com MD5, em 1200x800 e 3000x2000). Ou seja: ele PRESERVA
  // os coeficientes DCT e as TABELAS DE QUANTIZAÇÃO DA ORIGEM, só reescreve a
  // codificação de entropia como progressiva e remove os metadados.
  // Consequência: o X não tem assinatura de quantização própria para casar —
  // tentar identificá-lo pela tabela gera falso positivo em qualquer arquivo do
  // editor de origem (comprovado: um JPEG do Photoshop q12 casava como "X").
  {id:'facebook', name:'Facebook', sof:'progressive', sub:'420', apps:[0,13],
   luma:[9,8,8,16,11,16,16,15,15,16,23,17,18,17,23,24,24,20,20,24,24,26,22,24,23,24,22,26,27,28,27,29,29,27,28,27,28,26,31,32,31,26,28,29,31,34,34,31,29,32,38,38,38,32,38,35,35,38,42,38,42,37,37,30]},
  {id:'instagram', name:'Instagram', sof:'baseline', sub:'420', apps:[1,0,2],
   luma:[8,6,6,7,6,5,8,7,7,7,9,9,8,10,12,20,13,12,11,11,12,25,18,19,15,20,29,26,31,30,29,26,28,28,32,36,46,39,32,34,44,35,28,28,40,55,41,44,48,49,52,52,52,31,39,57,61,56,50,60,46,51,52,50]},
];

// Compara a estrutura do JPEG com os perfis medidos.
// ⚖️ REGRA: isto é INDÍCIO, nunca prova. Uma tabela de quantização diz
// "foi recodificado por algo compatível com X" — não diz que veio de X.
// O nível 'alta' exige que TODOS os corroborantes batam; qualquer divergência
// rebaixa para 'media'. Sem casar a tabela inteira, não afirmamos nada.
function identifyJpegPlatform(st){
  if(!st || !st.qtables || !st.qtables[0]) return null;
  const luma=st.qtables[0];
  const sofNow = st.progressive ? 'progressive' : 'baseline';
  const subNow = st.sub ? ((st.sub[0]===2&&st.sub[1]===2)?'420'
                        : ((st.sub[0]===1&&st.sub[1]===1)?'444':'outro')) : null;
  for(const p of JPEG_PLATFORM_PROFILES){
    let same=true;
    for(let k=0;k<64;k++){ if(luma[k]!==p.luma[k]){ same=false; break; } }
    if(!same) continue;
    // portas DURAS: a plataforma sempre emite o mesmo tipo de SOF e a mesma
    // subamostragem. Divergiu, não é ela — não basta a tabela bater.
    if(p.sof!==sofNow || p.sub!==subNow) continue;
    const corroborated=['sof','sub']; let diverged=0;
    if(p.apps.every(a=>st.apps.indexOf(a)>=0)) corroborated.push('apps'); else diverged++;
    return { id:p.id, name:p.name, level: diverged===0?'alta':'media',
             corroborated, diverged, evidence:'quantTable' };
  }
  return null;
}

// Impressão digital de FERRAMENTA de esteganografia.
// ⚠️ Achado honesto da investigação: a superfície aqui é MUITO menor que a de
// plataforma. Steghide e OutGuess NÃO recodificam o JPEG — preservam a estrutura
// original e por isso não deixam assinatura estrutural. Só o F5/Westfeld
// recodifica com codificador próprio, e o dele grava um comentário identificável.
function identifyJpegToolprint(st){
  const out=[];
  if(st && st.comment && /James R\. Weeks|BioElectroMech/i.test(st.comment)){
    out.push({ tool:'F5 (Westfeld)', id:'f5', level:'media', evidence:'encoderComment' });
  }
  return out;
}
