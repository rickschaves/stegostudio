// Decide se a MENSAGEM FINAL veio de uma rota nativa autenticada.
// É função pura de propósito: o harness consegue exercitar a MESMA regra usada
// em produção, inclusive o caso em que um header nativo foi visto mas quem acabou
// produzindo `decodedMsg` foi um motor de terceiro. `headerMatched` não promove
// extração sozinho; ele continua servindo apenas ao estado `headerOnly`.
function resolveNativeEvidence({ decodedMsg, nativeHeaderMatched=false, nativePayloadRecovered=false, nativeLayerRecovered=false }) {
  if (decodedMsg && (nativePayloadRecovered || nativeLayerRecovered)) return { level:'extracted' };
  if (nativeHeaderMatched) return { level:'headerOnly' };
  return { level:'none' };
}

// O texto público de sucesso é independente do método. Método/proteção vivem
// nas linhas próprias do módulo; este helper decide apenas se houve recuperação
// completa, parcial ou se o status específico da rota deve ser preservado.
function resolveRecoveredStatusKind(decodedMsg, studio, nativePayloadRecovered=false, nativeLayerRecovered=false, recoveredFile=false) {
  if (!decodedMsg && !recoveredFile) return 'none';
  const tp = !studio?.thirdParty ? 'none'
    : studio?.foreignEncrypted ? 'identified'
    : studio?.foreignTruncated ? 'partial' : 'recovered';
  if (recoveredFile && tp==='recovered' && !decodedMsg) return 'file';
  if (nativePayloadRecovered || nativeLayerRecovered || studio?.framedExtracted===true || studio?.robust===true || tp==='recovered') return 'recovered';
  if (tp==='partial') return 'partial';
  return 'none';
}

// Feedback de senha em JPEG precisa ser honesto sobre uma limitação estrutural:
// no modo robusto clássico, a própria ordem/dither dos coeficientes depende da
// senha. Com uma senha errada, o decoder normalmente não encontra nem o header,
// então não há como distinguir de forma forte entre "senha errada" e "este JPEG
// não contém um payload compatível". O helper abaixo mantém o alerta visual sem
// transformar essa ambiguidade em uma afirmação forense falsa.
function resolveJpegPasswordFeedback({keyProvided=false, decodedMsg=null, recoveredFile=null, robustState=null, toolprint=[]}={}) {
  if (!keyProvided || decodedMsg || recoveredFile) return 'none';
  if (robustState === 'locked') return 'wrong';
  if (robustState) return 'none'; // damaged/content-error já têm diagnóstico próprio
  const confirmedTool = Array.isArray(toolprint) && toolprint.some(x => x && x.level === 'confirmado');
  if (confirmedTool) return 'none';
  return 'inconclusive';
}

// Normaliza uma extração nativa bem-sucedida para UM estado público.
// `nativeHeaderMatched` é útil apenas enquanto temos "header localizado, conteúdo
// não recuperado". Depois que uma mensagem nativa sobrevive à consolidação, a
// evidência pública passa a ser `nativeExtracted` independentemente da rota que
// a encontrou. Assim, duas senhas válidas não expõem qual caminho interno venceu.
function markNativeExtracted(report) {
  const studio = {...(report.studio || {}), nativeExtracted:true};
  delete studio.nativeHeaderMatched;
  report.studio = studio;
  return studio;
}

// Abre o payload interno transportado pelo JPEG robusto. O envelope externo
// (robust.js) autentica sua própria estrutura/CRC e corrige o transporte via RS,
// mas isso NÃO basta para declarar que o conteúdo interno é uma mensagem válida.
// `robust:true` só pode nascer depois desta função devolver state:'ok'.
async function openRobustInnerPayload(p, key) {
  if (!(p instanceof Uint8Array) || p.length < 10) return {state:'contentError', plain:null};
  for (let i=0;i<MAGIC.length;i++) {
    if (p[i] !== MAGIC[i]) return {state:'contentError', plain:null};
  }

  const modeByte = p[5];
  const len = (p[6] | (p[7]<<8) | (p[8]<<16) | (p[9]<<24)) >>> 0;
  // O wire clássico não admite corpo vazio, truncamento nem trailing bytes:
  // buildPayload() produz exatamente 10 + len bytes.
  if (len <= 0 || 10 + len !== p.length) return {state:'contentError', plain:null};

  const comp = !!(modeByte & FLAG_COMPRESSED);
  const body = p.slice(10);
  const aesBody = isAesPayload(body);
  let plain = null;
  let state = 'ok';

  if (aesBody) {
    if (key.length > 0) {
      try { plain = await aesDecryptBytes(body, key); }
      catch (_) { state = 'locked'; }
    } else {
      state = 'needsKey';
    }
  } else {
    plain = body;
  }

  if (plain && comp) {
    try { plain = await inflateBytes(plain); }
    catch (_) { plain = null; state = 'contentError'; }
  }

  // Conteúdo vazio não é conteúdo recuperado. A tag GCM prova que quem cifrou
  // tinha a chave, não que existe mensagem; o gate de legibilidade abaixo já
  // rejeita o vazio no ramo não-AES, então esta checagem uniformiza os dois.
  if (plain && plain.length === 0) {
    plain = null;
    state = 'contentError';
  }

  // Premissa atual do produto: payload robusto não-AES é texto vindo do textarea.
  // O gate é aplicado ao plaintext FINAL (após eventual inflate). Se um dia o
  // Encoder aceitar arquivo/binário sem senha, esta regra deve ser revisitada.
  if (plain && !aesBody && isReadableText(plain) <= 0.7) {
    plain = null;
    state = 'contentError';
  }

  return {state, plain, passwordUsed:state==='ok' && aesBody && key.length>0};
}



// ════════════════════════════════════════
//  PUBLIC REPORT ALLOWLIST
// ════════════════════════════════════════
// `report` é o estado de trabalho interno do Analyzer. Ele pode ganhar campos
// auxiliares no futuro; o JSON público NÃO deve herdar automaticamente esses
// campos. Esta projeção é a fronteira explícita de exportação: só caminhos
// listados abaixo podem sair em `lastReport.modules` / Export JSON.
//
// Mesmo que uma refatoração futura crie acidentalmente um campo interno de rota
// ou depuração, ele não atravessa esta fronteira sem uma alteração consciente
// da allowlist.
const PUBLIC_REPORT_SCHEMA = {
  format: {cat:true, ext:true, encOk:true, msg:true, webp:true},
  metadata: {filename:true, size:true, type:true, formatCategory:true, width:true, height:true, pixels:true, lastModified:true},
  strings: {
    count:true,
    interesting:[{str:true,type:true}],
    adversarial:[{str:true,reasonKey:true}],
    appendedData:true, appendedBytes:true, note:true
  },
  jpegDCT: {
    available:true, reason:true, progressive:true, components:true, width:true, height:true,
    acTotal:true, acNonZero:true, nonZeroRatio:true, distinctValues:true, avgAbsCoeff:true,
    maxAbsCoeff:true, chi:true, chiPairs:true, chiPerPair:true, firstOrderAnomaly:true,
    bandLow:true, bandMid:true, bandHigh:true, verdict:true
  },
  toolprint:[{
    tool:true, id:true, level:true, evidence:true, algoName:true, modeName:true,
    supported:true, usedEmptyPassword:true
  }],
  lsb: {
    available:true, note:true, chiR:true, chiG:true, chiB:true, bestMode:true,
    printableRatio:true, decodedSample:true, suspicious:true, foundText:true,
    headerName:true, cipherSuspicion:true, rsRate:true, wsRate:true,
    lsbrDetected:true, lsbrStrong:true, lsbrPossible:true, wsReliable:true,
    neuralSuspect:true, neuralEntSim:true, neuralHfSim:true, neuralAvgHF:true
  },
  frequency: {
    spikes:true, evenOddBias:true, biasAnomaly:true, biasReliable:true,
    biasLowComplexity:true, dominantRGB:[true]
  },
  entropy: {
    shannon:true, uniqueColors:true, avgNoise:true, noiseAnomaly:true,
    noiseThreshold:true, highEntropy:true
  },
  color: {
    uniqueAlpha:true, alphaAnomaly:true, partialAlpha:true, rareClusters:true,
    rareSuspicious:true, rareDetails:[true]
  },
  studio: {
    hasHeader:true, payloadBytes:true, shuffled:true, available:true, note:true,
    robustSignature:{razao:true, limiar:true, blocos:true, suspeito:true},
    robust:true, robustCorrected:true,
    thirdParty:true, foreignFile:true, foreignEncrypted:true, foreignTruncated:true,
    genericMode:true, deepScan:true, headerName:true,
    framedExtracted:true, framedPayloadBytes:true,
    nativeExtracted:true, nativeHeaderMatched:true
  },
  dct: {available:true, reason:true, blockCount:true, stdDev:true, mean:true, suspicious:true},
  gradients: {available:true, reason:true, totalEdges:true, sharpRatio:true, sharpEdges:true, softEdges:true, suspicious:true},
  chroma: {
    available:true, reason:true, avgSaturation:true, highSatRatio:true,
    cbVariance:true, crVariance:true, oversaturated:true, uniformChroma:true, suspicious:true
  },
  exif: {
    available:true, readError:true, found:true,
    fields:{
      Segmento:true, Criador:true, Software:true, Fonte:true, Copyright:true,
      Make:true, Model:true, Artist:true, DateTimeOriginal:true, UserComment:true,
      YCbCrPositioning:true, GPS:true
    },
    aiSoftware:true, hasCamera:true, hasGPS:true, noExif:true,
    hasExifIFD:true, cameraPartial:true
  },
  c2pa: {
    available:true, readError:true, found:true, manifestDetected:true,
    aiGenerator:true, ca:true, certDate:true, digitalSourceType:true,
    manifestPresent:true, signals:[true], rawSoftware:true,
    genName:true, genVersion:true, signerCN:true, actionDescriptions:[true],
    hasManifest:true, hasSvg:true, manifestLen:true, svgLen:true
  },
  _regionalEntropyVar:true,
  ai: {
    score:true, level:true,
    signals:[{
      labelKey:true, detailKey:true, detail:true, level:true,
      detailVars:{
        w:true, h:true, extra:true, signals:true, software:true, noise:true,
        ext:true, colors:true, count:true, spread:true, std:true, ratio:true,
        detail:true, entropy:true
      },
      labelVars:{ratio:true}
    }],
    formatCat:true, formatExt:true, cameraVeto:true, vectorArtVeto:true, digitalRenderVeto:true
  },
  origin: {
    fotografia:true, screenshot:true, arte_digital:true, sintetica:true, topCategory:true,
    signals:{
      fotografia:[{labelKey:true,labelVars:{w:true},weight:true}],
      screenshot:[{labelKey:true,labelVars:{w:true},weight:true}],
      arte_digital:[{labelKey:true,labelVars:{w:true},weight:true}],
      sintetica:[{labelKey:true,labelVars:{w:true},weight:true}]
    }
  },
  socialPipeline: {
    detected:true, platform:true, weak:true, byStructure:true, byFilename:true, level:true
  },
  stegomalware:[{key:true, sev:true, snippet:true}]
};

function projectPublicReportValue(value, schema) {
  if (value === null) return null;
  if (schema === true) {
    const type = typeof value;
    return (type === 'string' || type === 'number' || type === 'boolean') ? value : undefined;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) return undefined;
    const itemSchema = schema[0];
    return value.map(item => projectPublicReportValue(item, itemSchema)).filter(item => item !== undefined);
  }
  if (!schema || typeof schema !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const key of Object.keys(schema)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const projected = projectPublicReportValue(value[key], schema[key]);
    if (projected !== undefined) out[key] = projected;
  }
  return out;
}

function serializePublicModules(report) {
  return projectPublicReportValue(report || {}, PUBLIC_REPORT_SCHEMA) || {};
}

function createPublicLastReport(report, decodedMsg, decodeStatus) {
  const modules = serializePublicModules(report);
  const threat = computeThreat(report);
  const synth = computeSynth(report);
  return {
    timestamp:new Date().toISOString(),
    threat:{score:threat.score, flags:[...(threat.flags || [])]},
    synth:{score:synth.score, level:synth.level, flags:[...(synth.flags || [])]},
    origin:modules.origin || null,
    decodedMsg:decodedMsg ?? null,
    decodeStatus:typeof decodeStatus === 'string' ? decodeStatus : '',
    modules
  };
}
// PUBLIC REPORT ALLOWLIST — END

let _analisando = false;   // guarda de reentrância
document.getElementById('btn-analyze').addEventListener('click', async ()=>{
  if(!decID||!decFile) return;
  // O botão é desabilitado durante a execução, mas esta guarda também protege
  // contra qualquer caminho excepcional que tente iniciar outra análise antes
  // de a anterior ter encerrado completamente.
  if(_analisando) return;
  _analisando = true;
  setAnalysisBusy(true);   // contrato de interação, não efeito colateral da thread
  const processingStartedAt = processingNow();
  clearProcessingTime('dec-processing-time');

  // ── SNAPSHOT ──
  // A partir daqui a execução usa SÓ estas cópias. Se a imagem trocar no meio,
  // a análise termina coerente consigo mesma (tudo de A) em vez de misturar o
  // arquivo de A com o preview de B — e o portão `obsoleta()` impede que ela
  // publique qualquer coisa.
  // Cada operação recebe uma geração própria para invalidar resultados e
  // re-renderizações pertencentes a uma análise anterior, mesmo na mesma imagem.
  bumpAnalysisGeneration();
  const run     = analysisGeneration;
  const runID   = decID;
  const runFile = decFile;
  const runFmt  = decFmt;
  const key     = document.getElementById('dec-key').value;
  const obsoleta = () => run !== analysisGeneration;
  document.getElementById('results-area').classList.remove('visible');
  document.getElementById('export-wrap').classList.remove('visible');
  document.getElementById('btn-analyze').disabled=true;

  try {
    setProgress(0, 'Iniciando pipeline...');
    // ── Decode DCT compartilhado: uma única leitura por análise ──
    // Os consumidores JPEG compartilham a mesma leitura de coeficientes. `decFmt`
    // vem dos magic bytes do upload; se o decode compartilhado falhar, cada
    // consumidor recebe null e aplica seu tratamento específico.
    let sharedDec=null, jpegBytes=null;
    if(runFmt && runFmt.ext==='JPEG' && runFile){
      try{
        jpegBytes=new Uint8Array(await runFile.arrayBuffer());
        sharedDec=decodeJpegCoefficients(jpegBytes);
      }catch(_){ sharedDec=null; }
    }
    const report = await runForensics(runID, runFile, setProgress, sharedDec);
    // report.format foi corrigido por magic bytes (pega .jfif, MIME errado, etc.)
    // — tem precedência sobre o decFmt detectado no upload (só por extensão).
    const fmt = report.format || runFmt;

    // Decode attempt
    let decodedMsg=null, decodeStatus=t('decStatusNoStudio');
    let recoveredFile=null; // bytes crus recuperados por motor externo; estado LOCAL, fora do report público
    let passwordIgnored=false; // senha fornecida, mas a recuperação vencedora usou o caminho sem senha
    let decodedFromDeepScan=false; // true quando a msg veio da investigação profunda (pode ser ruído)
    // As duas rotas nativas usam flags LOCAIS simétricas. `nativeHeaderMatched`
    // fica no relatório como evidência estrutural, mas nunca é usado para provar
    // que a mensagem final veio do nosso protocolo. Isso evita contaminação por
    // um motor de terceiro que rode depois de uma falha do payload nativo.
    let nativeHeaderMatched=false;
    let nativePayloadRecovered=false;
    let nativeLayerRecovered=false;
    // A rota genérica pode concluir provisoriamente "chave não revelou texto"
    // antes da tentativa de camada alternativa. O efeito visual é adiado até
    // todas as rotas terminarem para evitar um falso aviso de senha errada.
    let pendingKeyFlash=false;
    const isLossless=fmt&&fmt.cat==='lossless';

    if(!isLossless){
      decodeStatus=t('decStatusLSBUnavailable')+fmt.ext+t('decStatusLossySuffix');
      // ── MOTOR DE TERCEIRO: Steghide em JPEG (domínio DCT) ──
      // JPEG não tem LSB espacial, mas pode conter dados do Steghide nos
      // coeficientes DCT. Lê os bytes crus do arquivo e tenta o motor Steghide
      // (com a senha informada, ou sem senha). Uma extração real tem precedência
      // sobre a mensagem padrão de "indisponível".
      if(fmt.ext==='JPEG' && runFile){
        try{
          // Reusa os bytes e os coeficientes obtidos no topo do fluxo.
          // Se o arquivo só foi reconhecido como JPEG pelo relatório (o decFmt
          // do upload pode divergir em casos de borda), faz o decode localmente;
          // o caminho autônomo continua disponível.
          const bytes = jpegBytes || new Uint8Array(await runFile.arrayBuffer());
          let dec = sharedDec;
          if(!dec){ try{ dec=decodeJpegCoefficients(bytes); }catch(_){ } }
          // ── MODO MAIS RESISTENTE — tentado antes dos motores de terceiros ──
          // Tem assinatura própria e CRC no cabeçalho, então é o teste mais
          // específico e o de menor risco de falso positivo. O estado
          // 'damaged' é o caso honesto: o cabeçalho sobreviveu ao caminho e o
          // corpo não — dizer isso é melhor do que dizer "nada encontrado".
          try{
            let rb = robustExtract(bytes, key);
            let robustUsedEmptyPassword=false;
            // Se o usuário informou uma senha para um JPEG robusto criado sem senha,
            // a senha não deve impedir a recuperação. Só fazemos fallback para o
            // plano vazio quando a tentativa informada não reconheceu envelope algum.
            if(key.length>0 && rb.status==='none'){
              const rbNoKey=robustExtract(bytes, '');
              if(rbNoKey.status!=='none'){ rb=rbNoKey; robustUsedEmptyPassword=true; }
            }
            if(rb.status === 'ok'){
              // O envelope robusto já foi confirmado (magic + CRC + RS). Daqui em
              // diante uma falha do conteúdo NÃO pode apagar essa evidência nem
              // cair no status genérico "nada encontrado". Isso importa também
              // para arquivos hostis/malformados em que a senha do plano externo e
              // a senha AES interna não sejam a mesma, mesmo que nosso Encoder use
              // uma única senha para as duas camadas.
              const opened = await openRobustInnerPayload(rb.payload, key);
              if(opened.state === 'ok' && opened.plain){
                decodedMsg = new TextDecoder().decode(opened.plain);
                decodeStatus = t('rbDecFound');
                if(robustUsedEmptyPassword && !opened.passwordUsed) passwordIgnored=true;
                report.studio = {...report.studio, robust:true, robustCorrected:rb.errosCorrigidos};
              } else if(opened.state === 'locked'){
                decodeStatus = t('rbDecLocked');
                report.studio = {...report.studio, robust:'locked', robustCorrected:rb.errosCorrigidos};
              } else if(opened.state === 'needsKey'){
                decodeStatus = t('rbDecNeedsKey');
                report.studio = {...report.studio, robust:'locked', robustCorrected:rb.errosCorrigidos};
                flashKey('missing');
              } else {
                decodeStatus = t('rbDecContentError');
                report.studio = {...report.studio, robust:'content-error', robustCorrected:rb.errosCorrigidos};
              }
            } else if(rb.status === 'damaged'){
              decodeStatus = t('rbDecDamaged');
              report.studio = {...report.studio, robust:'damaged'};
            }
          }catch(_){ /* não é payload robusto — segue para os motores de terceiros */ }
          const shRes = (decodedMsg||recoveredFile) ? null : await shDecodeJpeg(bytes, key, dec);
          if(shRes && shRes.data instanceof Uint8Array && shRes.data.length>0){
            decodedMsg=typeof shRes.text==='string' && shRes.text.length>0 ? shRes.text : null;
            recoveredFile=(shRes.fileName || shRes.binary)
              ? {bytes:shRes.data, fileName:shRes.downloadName||shRes.fileName||'steghide_payload.bin', mime:shRes.mime||'application/octet-stream', source:'Steghide'}
              : null;
            if(key.length>0 && shRes.usedEmptyPassword) passwordIgnored=true;
            decodeStatus=t('decStatusSteghide');
            report.studio={...report.studio, thirdParty:'Steghide', foreignFile:shRes.fileName||null};
          }
          // ── MOTOR DE TERCEIRO: OutGuess (mesmo domínio DCT) ──
          // Só tenta se o Steghide não achou nada. Sem magic próprio, o motor
          // só reporta extrações que pareçam conteúdo real (sem falso positivo).
          if(!decodedMsg && !recoveredFile){
            const ogRes=ogDecodeJpeg(bytes, key, dec);
            if(ogRes && ogRes.data instanceof Uint8Array && ogRes.data.length>0){
              decodedMsg=typeof ogRes.text==='string' && ogRes.text.length>0 ? ogRes.text : null;
              recoveredFile=ogRes.binary
                ? {bytes:ogRes.data, fileName:ogRes.downloadName||'outguess_payload.bin', mime:ogRes.mime||'application/octet-stream', source:'OutGuess'}
                : null;
              if(key.length>0 && ogRes.usedDefaultKey) passwordIgnored=true;
              decodeStatus=ogRes.truncated?t('decStatusOutGuessPartial'):t('decStatusOutGuess');
              report.studio={...report.studio, thirdParty:'OutGuess', foreignTruncated:!!ogRes.truncated};
            }
          }
        }catch(_){ /* não é Steghide/OutGuess ou falhou — mantém a msg padrão */ }
        // Em JPEG, o status padrão ("LSB indisponível") apenas REPETE a nota do
        // módulo logo acima. Troca por algo que informa de fato: quais motores
        // foram tentados e qual foi o resultado.
        if(!decodedMsg && !recoveredFile){
          if(!report.studio?.robust) decodeStatus=t('decStatusJpegNoneFound');
          // Identificação confirmada sem extração. O magic do Steghide vive em
          // posições derivadas da senha: se ele bate, confirma a ferramenta mesmo
          // quando o conteúdo não pôde ser lido. Só roda depois das tentativas de
          // extração para não duplicar uma evidência mais forte.
          try{
            const sh=shIdentifyJpeg(bytes, key, dec);
            if(sh) report.toolprint=[...(report.toolprint||[]),
              { tool:'Steghide', id:'steghide', level:'confirmado',
                evidence:'magic', algoName:sh.algoName, modeName:sh.modeName,
                supported:sh.supported, usedEmptyPassword:sh.usedEmptyPassword }];
          }catch(_){}
          // Se há assinatura estatística do modo robusto mas nada foi extraído,
          // a causa provável é recompressão a mais — copiar-e-colar é a mais
          // comum, porque o sistema recodifica a imagem ao colar. A dica aparece
          // exatamente para quem colou em vez de salvar o arquivo.
          try{ const sig=robustSignature(sharedDec);
               if(!report.studio?.robust && sig && sig.suspeito) decodeStatus=t('decStatusRobustLostPaste'); }catch(_){}
        }
      }
    } else {
      let studioPayload=extractLSBStudio(runID,key);
      if(!studioPayload && key.length>0){
        try{ studioPayload=await extractLSBStudioV3(runID,key); }catch(e){
          if(e?.message==='argon2-unavailable') throw e;
          studioPayload=null;
        }
      }
      if(studioPayload && studioPayload.needsPassword){
        // Corpo embaralhado por senha, mas nenhuma senha foi informada.
        decodeStatus=t('decStatusShuffledNeedsKey');decodedMsg=null;flashKey('missing');
      } else if(studioPayload){
        // Header do STEGO·STUDIO LOCALIZADO com a senha. O M7 do forensics roda
        // sem senha e não enxerga payload furtivo, então é aqui que isso precisa
        // ser registrado — sem isso o threat fica idêntico com senha certa e
        // errada.
        //
        // ⚠️ Isto é evidência ESTRUTURAL, não extração. Seis ramos abaixo ainda
        // podem terminar com `decodedMsg=null`: GCM falhando em corpo corrompido,
        // payload cifrado sem senha, inflate falhando. A confirmação de extração
        // é gravada só depois, quando existe mensagem de verdade — mesma
        // distinção que o modo robusto já faz entre `true` e `'damaged'`.
        nativeHeaderMatched=true;
        const comp = !!studioPayload.compressed;
        const studioUsedPasswordForFraming = !!studioPayload.passwordUsedForFraming;
        const isF21 = studioPayload.v3 === true;
        const isAes = !isF21 && isAesPayload(studioPayload);
        // Descomprime se o flag FLAG_COMPRESSED estiver setado; null se falhar.
        const inflateIfNeeded = async (bytes) => {
          if(!comp) return bytes;
          try{ return await inflateBytes(bytes); }catch(_){ return null; }
        };
        if(isF21){
          // A autenticação do header já provou a senha antes de qualquer leitura
          // variável. O corpo GCM pode ainda falhar por adulteração/dano.
          if(studioPayload.bodyAuthenticated && studioPayload.plainBytes){
            let bytes=await inflateIfNeeded(studioPayload.plainBytes);
            if(bytes!==null){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusDecryptedKey');
              nativePayloadRecovered=true;
            } else {
              decodeStatus=t('decStatusProtectedDamaged');decodedMsg=null;
            }
          } else {
            decodeStatus=t('decStatusProtectedDamaged');decodedMsg=null;
          }
        } else if(key.length>0){
          if(isAes){
            // Formato novo: AES-GCM (autenticado). Decifra → (descomprime) → texto.
            let bytes=null;
            try{ bytes=await aesDecryptBytes(studioPayload,key); }catch(_){ bytes=null; }
            if(bytes!==null) bytes=await inflateIfNeeded(bytes);
            if(bytes!==null){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusDecryptedKey');
              nativePayloadRecovered=true;
            } else {
              decodeStatus=t('decStatusCipherWrongKey');decodedMsg=null;pendingKeyFlash=true;
            }
          } else if(comp){
            // Comprimido mas não cifrado: a chave é ignorada (compressão ≠ cripto).
            const bytes=await inflateIfNeeded(studioPayload);
            if(bytes!==null && isReadableText(bytes)>0.7){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusPlainKeyIgnored');
              if(!studioUsedPasswordForFraming) passwordIgnored=true;
              nativePayloadRecovered=true;
            } else {
              decodeStatus=t('decStatusCipherWrongKey');decodedMsg=null;pendingKeyFlash=true;
            }
          } else {
            // Não-AES e não comprimido → tenta XOR legado; senão texto puro.
            let attempt=decryptXOR(studioPayload,key);
            if(isReadableText(new TextEncoder().encode(attempt))<=0.7) attempt=null;
            if(attempt!==null){
              decodedMsg=attempt;decodeStatus=t('decStatusDecryptedKey');nativePayloadRecovered=true;
            } else {
              const plain=new TextDecoder('utf-8',{fatal:false}).decode(studioPayload);
              if(isReadableText(studioPayload)>0.7){decodedMsg=plain;decodeStatus=t('decStatusPlainKeyIgnored');if(!studioUsedPasswordForFraming) passwordIgnored=true;nativePayloadRecovered=true;}
              else{decodeStatus=t('decStatusCipherWrongKey');decodedMsg=null;pendingKeyFlash=true;}
            }
          }
        } else {
          // Sem chave: se for payload AES, avisa que precisa de senha.
          if(isAes){
            decodeStatus=t('decStatusCipherFound');decodedMsg=null;flashKey('missing');
          } else {
            const bytes=await inflateIfNeeded(studioPayload);
            if(bytes!==null && isReadableText(bytes)>0.7){
              decodedMsg=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
              decodeStatus=t('decStatusPlainNoCipher');
              nativePayloadRecovered=true;
            } else {
              decodeStatus=t('decStatusCipherFound');decodedMsg=null;flashKey('missing');
            }
          }
        }
      } else {
        const maxBytes=Math.min(Math.floor(runID.width*runID.height/8),8000);
        const generic=extractLSBRaw(runID,maxBytes);
        const hasC2PA=report.c2pa?.found||report.c2pa?.manifestDetected;

        // Framing histórico validado: magic + comprimento coerente + UTF-8 íntegro.
        // É recuperação direta, não candidato de janela deslizante; uma senha
        // informada não participa deste formato e é explicitamente ignorada.
        if(generic.framed){
          decodedMsg=generic.framed.text;
          decodeStatus=t('decStatusFramedRecovered').replace('{mode}',translateMode(generic.mode));
          decodedFromDeepScan=false;
          if(key.length>0) passwordIgnored=true;
          report.studio={...report.studio,
            genericMode:generic.mode, deepScan:false,
            headerName:generic.framed.headerName,
            framedExtracted:true, framedPayloadBytes:generic.framed.payloadBytes};
        }
        // Com chave: tenta decifrar os bytes brutos (AES novo ou XOR legado)
        else if(key.length>0){
          let decrypted=null;
          if(isAesPayload(generic.bytes)){
            try{ decrypted=await aesDecrypt(generic.bytes,key); }catch(_){ decrypted=null; }
          } else {
            const x=decryptXOR(generic.bytes,key);
            if(isReadableText(new TextEncoder().encode(x))>0.7) decrypted=x;
          }
          if(decrypted!==null){
            decodedMsg=decrypted.replace(/\0+$/,'').slice(0,1000);
            decodeStatus=t('decStatusDecryptedVia').replace('{mode}',translateMode(generic.mode));
          } else {
            decodeStatus=t('decStatusKeyNoText');
            decodedMsg=null; pendingKeyFlash=true;
          }
        }
        // Sem chave: usa o investigador de janela deslizante
        // Mínimo de 12 caracteres (mesmo critério do módulo LSB) para evitar
        // exibir ruído estatístico curto como mensagem decodificada.
        else if(generic.foundText && generic.foundTextLength >= 12 && !hasC2PA){
          let msg = generic.foundText;
          const isJoiHeader = /^JOI_LSB/i.test(generic.headerName || '');
          // Remove headers de ferramentas conhecidas no início (JOI_LSB2, STEGO, etc.)
          msg = msg.replace(/^(JOI_LSB\d?|STEGO|LSB|STEG)[\x00-\x20]*/i, '');
          // Remove caracteres de controle e nulls
          msg = msg.replace(/[\x00-\x1F]/g, '').trim();
          // Compatibilidade heurística para variantes antigas que tenham header
          // reconhecido, mas não satisfaçam o framing estrutural validado acima.
          if (isJoiHeader && msg.length > 1) {
            msg = msg.slice(1).trim();
          }
          // Remove um possível byte de pontuação solto no início (resíduo de header)
          msg = msg.replace(/^['"`´]/, '').trim();
          // Remove cauda residual: 1-2 caracteres soltos logo após uma pontuação
          // final (ex: "...PEOPLE DO.m" → "...PEOPLE DO."). É o início do lixo
          // binário que colou na ilha de texto.
          msg = msg.replace(/([.!?])[A-Za-z]{1,2}$/, '$1');
          decodedMsg = msg.slice(0,1000);
          decodeStatus = t('deepInvestText').replace('{mode}',translateMode(generic.mode));
          decodedFromDeepScan = true; // marca origem: investigação profunda (candidata a ruído)
          report.studio={...report.studio,genericMode:generic.mode,deepScan:true,headerName:generic.headerName||null};
        }
        else if(hasC2PA && generic.printableRatio>0.35){
          decodeStatus=t('decStatusC2PAData');
        }
        else {
          decodeStatus=t('decStatusNoReadable');
        }
      }
    }

    // ── NEGAÇÃO PLAUSÍVEL: sonda da mensagem-isca (decoy) ──
    // Se uma senha foi informada mas NENHUMA mensagem real decodificou com ela,
    // pode ser a senha da mensagem alternativa (gravada no fim via AES-GCM). A
    // sonda SEMPRE roda nesse caso — não depende de flag (marcar a isca vazaria
    // sua existência). A tag do GCM valida: sem isca ou senha errada → null,
    // sem falsa leitura. Rodada só quando lossless (LSB só existe aí).
    if(isLossless && key.length>0 && !decodedMsg){
      let decoyMsg=null;
      try{ decoyMsg=await extractDecoyTail(runID,key); }catch(_){ decoyMsg=null; }
      if(decoyMsg!==null){
        decodedMsg=decoyMsg;
        decodeStatus=t('decStatusDecryptedKey');
        decodedFromDeepScan=false; // veio de camada válida (GCM autenticado), não é ruído
        nativeLayerRecovered=true; // local: não exporta qual camada/rota venceu
      }
    }

    // ── MOTOR DE TERCEIRO: OpenStego (RandomLSB) ──
    // Roda quando NÃO decodificamos uma mensagem nossa confiável (ou só ruído de
    // deep scan). Se a imagem for OpenStego, extrai de verdade (com a senha, ou
    // sem senha via seed fixa). Uma extração real de terceiro tem precedência
    // sobre ruído especulativo de deep scan.
    if(isLossless && (!decodedMsg || decodedFromDeepScan)){
      let osRes=null;
      try{ osRes=await osDecodeMessage(runID,key); }catch(_){ osRes=null; }
      if(osRes){
        if(osRes.data instanceof Uint8Array && osRes.data.length>0){
          decodedMsg=typeof osRes.text==='string' && osRes.text.length>0 ? osRes.text : null;
          recoveredFile=(osRes.fileName || osRes.binary)
            ? {bytes:osRes.data, fileName:osRes.downloadName||osRes.fileName||'openstego_payload.bin', mime:osRes.mime||'application/octet-stream', source:'OpenStego'}
            : null;
          if(key.length>0 && osRes.usedEmptyPassword) passwordIgnored=true;
          decodeStatus=t('decStatusOpenStego');
          decodedFromDeepScan=false; // extração real (magic OpenStego bateu), não é ruído
          report.studio={...report.studio, thirdParty:'OpenStego', foreignFile:osRes.fileName||null};
        } else if(osRes.encrypted){
          // identificado como OpenStego, mas com cifra AES (não suportada ainda):
          // não mostramos texto, mas sinalizamos a origem honestamente.
          decodeStatus=t('decStatusOpenStegoEnc');
          report.studio={...report.studio, thirdParty:'OpenStego', foreignEncrypted:true, foreignFile:osRes.fileName||null};
        }
      }
    }

    // Decode Status descreve o RESULTADO; método/proteção vivem nas linhas
    // próprias do módulo. Normaliza apenas recuperações diretas confiáveis;
    // deep scan e estados de erro preservam suas mensagens específicas.
    const recoveredStatusKind=resolveRecoveredStatusKind(decodedMsg, report.studio, nativePayloadRecovered, nativeLayerRecovered, !!recoveredFile);
    const normalizedDecodeStatus = recoveredStatusKind==='file' ? t('decStatusFileRecovered')
      : (recoveredStatusKind==='recovered' ? t('decStatusRecovered')
      : (recoveredStatusKind==='partial' ? t('decStatusRecoveredPartial') : null));
    if(normalizedDecodeStatus) decodeStatus=normalizedDecodeStatus;

    // ── CONSOLIDAÇÃO INICIAL (sem neural ainda) ──
    // Roda mesmo sem backend: se o decode produziu ruído de deep scan, suprime
    // já aqui em vez de mostrar o ruído como mensagem.
    {
      const c0 = consolidateVerdict(report, decodedMsg, decodeStatus, decodedFromDeepScan);
      decodedMsg = c0.decodedMsg;
      decodeStatus = c0.decodeStatus;
    }
    // Extração nativa CONFIRMADA: a mensagem FINAL precisa ter vindo de uma das
    // duas rotas nativas que registraram recuperação local. `nativeHeaderMatched`
    // NÃO entra neste portão: um header pode ter casado e falhado, e depois um
    // OpenStego legítimo pode fornecer `decodedMsg`. Nesse caso o estado correto é
    // headerOnly + terceiro, nunca nativeExtracted.
    // A decisão é consumida DIRETAMENTE da função pura. Não existe variável
    // intermediária de nível que uma refatoração posterior possa sobrescrever entre
    // a regra testada e o portão que publica a evidência.
    if (resolveNativeEvidence({decodedMsg, nativeHeaderMatched, nativePayloadRecovered, nativeLayerRecovered}).level === 'extracted') {
      markNativeExtracted(report);
    } else if (resolveNativeEvidence({decodedMsg, nativeHeaderMatched, nativePayloadRecovered, nativeLayerRecovered}).level === 'headerOnly') {
      // Só publica a evidência do header DEPOIS que todas as rotas terminaram.
      // Assim ela não contamina a autoria de uma mensagem recuperada por terceiro.
      report.studio = {...report.studio, nativeHeaderMatched:true};
    }

    // Só agora sabemos se o aviso provisório de chave realmente deve aparecer.
    // Uma extração nativa alternativa ou de terceiro bem-sucedida cancela o flash;
    // identificação de ferramenta de terceiro também cancela, porque "insira a
    // chave" seria enganoso quando a limitação é de compatibilidade do decoder.
    if (pendingKeyFlash && !decodedMsg && !report.studio?.thirdParty) {
      flashKey('wrong');
    } else if (fmt?.ext === 'JPEG') {
      const jpegKeyFeedback = resolveJpegPasswordFeedback({
        keyProvided:key.length>0,
        decodedMsg,
        recoveredFile,
        robustState:report.studio?.robust || null,
        toolprint:report.toolprint || []
      });
      if (jpegKeyFeedback === 'wrong') flashKey('wrong');
      else if (jpegKeyFeedback === 'inconclusive') flashKey('jpeg');
    }

    // ── PORTÃO ──
    // Última chance antes de publicar. Se a imagem trocou durante os awaits,
    // este resultado é da imagem ANTERIOR: descartar em silêncio é o correto,
    // porque exibi-lo ao lado do preview novo é pior que não exibir nada.
    // Nada abaixo daqui é gravado ou renderizado se a execução ficou obsoleta.
    if (obsoleta()) return;

    report.stegomalware = decodedMsg ? detectStegomalware(decodedMsg) : [];
    lastReport=createPublicLastReport(report, decodedMsg, decodeStatus);
    // Guarda os argumentos do render para poder refazê-lo ao trocar de idioma
    lastRenderArgs = {report, decodedMsg, decodeStatus, passwordIgnored, recoveredFile, gen: run};
    renderResults(report,decodedMsg,decodeStatus,{passwordIgnored,recoveredFile});
    showProcessingTime('dec-processing-time', processingNow() - processingStartedAt);
    // Rola até o topo dos resultados para o usuário ver os scores imediatamente,
    // sem precisar rolar manualmente. Funciona tanto no scroll da coluna direita
    // (desktop) quanto no scroll do painel inteiro (mobile).
    requestAnimationFrame(() => {
      const results = document.getElementById('results-area');
      if (results) {
        if (window.innerWidth > 760) {
          const y = results.getBoundingClientRect().top + window.scrollY - 22;
          window.scrollTo({ top: y, behavior: 'smooth' });
        } else {
          results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });

    const {score:tScore}=computeThreat(report);
    const col=tScore>60?'err':tScore>30?'warn':'ok';
    // Origem mais provável
    const origin=report.origin||{};
    const topVal=origin[origin.topCategory]||0;
    // Mostra resultado completo no terminal, incluindo o status de decodificação.
    // Reconstrói via t() para que a troca de idioma reaplique o texto traduzido.
    const buildComplete = () => {
      const catNames={fotografia:t('catFotografia'),screenshot:t('catScreenshot'),arte_digital:t('catArte'),sintetica:t('catSintetica')};
      const topName=catNames[origin.topCategory]||'—';
      return [
        {text:t('termAnalysisComplete'), cls:col},
        {text:`Threat: ${tScore}/100`, cls:'info'},
        {text:`${t('termOriginProbable')}: ${topName} (${topVal})`, cls:'info'},
        {text:`${t('termDecodeStatus')}: ${decodeStatus}`, cls: decodedMsg ? 'ok' : 'info'}
      ];
    };
    termRedraw['dec-status'] = () => termWrite('dec-status', buildComplete(), {instant:true});
    termWrite('dec-status', buildComplete());

  } catch(e) {
    setStatus('dec-status','✗ Erro: '+e.message,'err');
    console.error('STEGO·STUDIO erro:', e);
  } finally {
    _analisando = false;
    // setAnalysisBusy(false) libera a UI e JÁ recalcula o botão pelo estado
    // real. A linha `disabled=false` que existia aqui desfazia esse cálculo no
    // instante seguinte — uma execução obsoleta terminando reabilitava o botão
    // mesmo sem imagem carregada.
    setAnalysisBusy(false);
  }
});

// ════════════════════════════════════════
//  EXPORT JSON
// ════════════════════════════════════════
document.getElementById('btn-export-json').addEventListener('click',()=>{
  if(!lastReport) return;
  const payload={_tool:'STEGO·STUDIO v2.43.20',_schema:'forensic-report-v2',
    _hint:t('exportHintJSON'),
    ...lastReport};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const name=(lastReport.modules?.metadata?.filename||'imagem').replace(/\.[^.]+$/,'');
  a.href=url;a.download=`stegoscan_${name}_${Date.now()}.json`;a.click();
  URL.revokeObjectURL(url);
});

/* Overlay do mapa de vazamento sobre a imagem do Analyzer. */
function positionLeakOverlay(){
  const img=document.getElementById('leak-img'), hm=document.getElementById('leak-heatmap');
  if(!img||!hm) return;
  const bw=img.clientWidth, bh=img.clientHeight, nw=img.naturalWidth||1, nh=img.naturalHeight||1;
  const sc=Math.min(bw/nw, bh/nh)||1, dw=nw*sc, dh=nh*sc;       // object-fit:contain -> retângulo real
  hm.style.left=(img.offsetLeft+(bw-dw)/2)+'px';
  hm.style.top=(img.offsetTop+(bh-dh)/2)+'px';
  hm.style.width=dw+'px'; hm.style.height=dh+'px';
}
function toggleLeakOverlay(){
  const hm=document.getElementById('leak-heatmap'), btn=document.getElementById('leak-toggle');
  if(!hm||!btn||!decID) return;
  if(hm.classList.contains('on')){ hm.classList.remove('on'); btn.textContent=t('heatmapShow'); return; }
  if(hm.dataset.built!=='1'){
    const w=decID.width, h=decID.height;
    const cols=Math.max(8,Math.min(20,Math.round(w/32))), rows=Math.max(6,Math.min(16,Math.round(h/32)));
    const mp=rsResidualMap(decID.data,w,h,cols,rows,true);        // max sobre canais (imagem arbitrária)
    hm.style.gridTemplateColumns='repeat('+cols+',1fr)';
    hm.innerHTML=mp.map(function(v){ const a=Math.min(v/0.22,1).toFixed(2); return '<span style="background:rgba(150,220,255,'+a+')"></span>'; }).join('');
    hm.dataset.built='1';
  }
  positionLeakOverlay();
  hm.classList.add('on'); btn.textContent=t('heatmapHide');
}

/* Overlay do mapa de vazamento sobre a imagem gerada pelo Encoder. */
function positionEncOverlay(){
  const img=document.getElementById('enc-out-prev'), hm=document.getElementById('enc-heatmap');
  if(!img||!hm) return;
  if(!img.complete||!img.naturalWidth){ img.addEventListener('load',positionEncOverlay,{once:true}); return; }
  const bw=img.clientWidth, bh=img.clientHeight, nw=img.naturalWidth, nh=img.naturalHeight;
  const sc=Math.min(bw/nw, bh/nh)||1, dw=nw*sc, dh=nh*sc;
  hm.style.left=(img.offsetLeft+(bw-dw)/2)+'px'; hm.style.top=(img.offsetTop+(bh-dh)/2)+'px';
  hm.style.width=dw+'px'; hm.style.height=dh+'px';
}
function toggleEncOverlay(){
  const hm=document.getElementById('enc-heatmap'), btn=document.getElementById('btn-enc-heatmap');
  if(!hm||!btn||!encOutID) return;
  if(hm.classList.contains('on')){ hm.classList.remove('on'); btn.textContent=t('encMapShow'); return; }
  if(hm.dataset.built!=='1'){
    const w=encOutID.width, h=encOutID.height;
    const cols=Math.max(8,Math.min(20,Math.round(w/32))), rows=Math.max(6,Math.min(16,Math.round(h/32)));
    const mp=rsResidualMap(encOutID.data,w,h,cols,rows);
    hm.style.gridTemplateColumns='repeat('+cols+',1fr)';
    hm.innerHTML=mp.map(function(v){ const a=Math.min(v/0.22,1).toFixed(2); return '<span style="background:rgba(150,220,255,'+a+')"></span>'; }).join('');
    hm.dataset.built='1';
  }
  positionEncOverlay();
  hm.classList.add('on'); btn.textContent=t('encMapHide');
}

/* Event wiring. Este bloco roda no fim do <body>, quando o DOM estático já existe. */
(function wireEvents(){
  const on = (sel, ev, fn) => { const el = typeof sel==='string' ? document.querySelector(sel) : sel; if (el) el.addEventListener(ev, fn); };

  on('.tab.enc', 'click', () => switchTab('enc'));
  on('.tab.dec', 'click', () => switchTab('dec'));
  bindMobileTabSwipe();
  on('#settings-gear', 'click', (e) => toggleSettingsMenu(e));
  on('#settings-help', 'click', () => { showHelpModal(); closeSettingsMenu(); });
  on('#settings-changelog', 'click', () => { showChangelogModal(); closeSettingsMenu(); });
  on('#settings-about', 'click', () => { showAboutModal(); closeSettingsMenu(); });
  on('#lang-en', 'click', () => setLang('en'));
  on('#lang-pt', 'click', () => setLang('pt'));
  on('#decoded-copy', 'click', () => { copyDecodedMessage(); });
  on('#decoded-save', 'click', () => saveDecodedMessage());
  on('#enc-message-expand', 'click', () => openEncMessageEditor('enc-msg'));
  on('#enc-decoy-message-expand', 'click', () => openEncMessageEditor('enc-decoy-msg'));
  on('#enc-message-close', 'click', () => closeEncMessageEditor());
  on('#enc-message-modal-text', 'input', () => syncEncMessageTargetFromModal());

  // Overlays: fechar só ao clicar no fundo (event.target === o próprio overlay)
  on('#help-overlay', 'click', (e) => { if (e.target === e.currentTarget) hideHelpModal(); });
  on('#help-close-btn', 'click', () => hideHelpModal());
  on('#changelog-overlay', 'click', (e) => { if (e.target === e.currentTarget) hideChangelogModal(); });
  on('#changelog-close-btn', 'click', () => hideChangelogModal());
  on('#about-overlay', 'click', (e) => { if (e.target === e.currentTarget) hideAboutModal(); });
  on('#about-close-btn', 'click', () => hideAboutModal());
  on('#enc-message-overlay', 'click', (e) => { if (e.target === e.currentTarget) closeEncMessageEditor(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('enc-message-overlay')?.classList.contains('visible')) closeEncMessageEditor(); });

  // Accordion dos módulos forenses é gerado dinamicamente -> delegação no document.
  document.addEventListener('click', (e) => {
    const header = e.target.closest && e.target.closest('.module-header');
    if (header) {
      toggleAccordionItem(header);
      const item=header.parentElement, hm=item.querySelector('#leak-heatmap');
      if(hm && item.classList.contains('open') && !hm.classList.contains('on')) requestAnimationFrame(toggleLeakOverlay);
    }
  });

  // O módulo de vazamento é dinâmico, portanto o toggle usa delegação no document.
  document.addEventListener('click', (e)=>{ if(e.target.closest && e.target.closest('.leak-toggle')) toggleLeakOverlay(); });
  document.addEventListener('click', (e)=>{ if(e.target.closest && e.target.closest('.enc-map-toggle')) toggleEncOverlay(); });
})();
