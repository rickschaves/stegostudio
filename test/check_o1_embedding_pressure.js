const fs=require('fs'), path=require('path'), vm=require('vm');
function assert(c,m){ if(!c) throw new Error(m); }
const root=path.join(__dirname,'..');
const files=fs.readFileSync(path.join(root,'src','files.js'),'utf8');
const i18n=fs.readFileSync(path.join(root,'src','i18n.js'),'utf8');
const tpl=fs.readFileSync(path.join(root,'template.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src','styles.css'),'utf8');
const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');

function sliceFn(src,name,next){
  const asyncNeedle='async function '+name+'(';
  const plainNeedle='function '+name+'(';
  let a=src.indexOf(asyncNeedle);
  if(a<0) a=src.indexOf(plainNeedle);
  assert(a>=0,'função ausente: '+name);
  let b=-1;
  if(next){
    const a2=src.indexOf('async function '+next+'(',a+1);
    const p2=src.indexOf('function '+next+'(',a+1);
    b=a2>=0 && p2>=0 ? Math.min(a2,p2) : Math.max(a2,p2);
  }
  return src.slice(a,b>=0?b:src.length);
}

const ctx={TextEncoder,Uint8Array,Math,Number,console};
ctx.F21_GCM_TAG_BYTES=16;
ctx.F21_PREFIX_CARRIER_PIXELS=448;
ctx.HEADER_BYTES=10;
ctx.MODE_RGB=1;
ctx.MODE_B=0;
ctx.STC_WMAX=16;
ctx.deflateBytes=async b=>b;
vm.createContext(ctx);
vm.runInContext(`
function pickStcW(bodyBits, availBodyPx){ if(bodyBits===0)return 1; const fit=Math.floor(availBodyPx/bodyBits); if(fit<1)return 0; return Math.min(STC_WMAX,fit); }
${sliceFn(files,'selectEmbedMode','prepareEncMainBody')}
${sliceFn(files,'prepareEncMainBody','computeEmbeddingPressure')}
${sliceFn(files,'computeEmbeddingPressure','hideEmbeddingPressure')}
`,ctx);

(async()=>{
  // Preparação física: compressão só entra quando reduz; cifra acrescenta tag GCM.
  ctx.deflateBytes=async b=>new Uint8Array(Math.max(1,b.length-3));
  let p=await ctx.prepareEncMainBody('abcdefghij',false);
  assert(p.compressed===true && p.bodyBytes.length===7 && p.bodyStoredBytes===7 && p.bodyBits===56,'preparo comprimido divergiu');
  p=await ctx.prepareEncMainBody('abcdefghij',true);
  assert(p.compressed===true && p.bodyStoredBytes===23 && p.bodyBits===184,'tag GCM não entrou no corpo preparado');
  ctx.deflateBytes=async b=>new Uint8Array(b.length+5);
  p=await ctx.prepareEncMainBody('abc',false);
  assert(p.compressed===false && p.bodyBytes.length===3,'compressão maior foi aceita');

  // STC: os tiers seguem a liberdade real do código (w), não percentuais de "detecção".
  const low=ctx.computeEmbeddingPressure(500,10088,false,false,0);
  assert(low.path==='stc' && low.stcW===16 && low.tier==='low','tier baixo/w=16 divergiram');
  assert(Math.abs(low.poolPct-80)<1e-9,'poolPct w=16 divergente');
  const mod=ctx.computeEmbeddingPressure(2500,10088,false,false,0);
  assert(mod.stcW===4 && mod.tier==='moderate','tier moderado/w=4 divergiram');
  const hi=ctx.computeEmbeddingPressure(4000,10088,false,false,0);
  assert(hi.stcW===2 && hi.tier==='high','tier alto/w=2 divergiram');
  const max=ctx.computeEmbeddingPressure(6000,10088,false,false,0);
  assert(max.stcW===1 && max.tier==='max','tier máximo/w=1 divergiram');

  // RGB não inventa w: mostra ocupação objetiva de slots.
  const rgb=ctx.computeEmbeddingPressure(15000,10088,false,true,0);
  assert(rgb.path==='rgb' && rgb.tier==='rgb' && rgb.stcW===undefined,'RGB ganhou STC fictício');
  assert(rgb.slotPct>49 && rgb.slotPct<51,'ocupação RGB inesperada');

  // Camada alternativa entra como carga física adicional, sem alterar o w da principal.
  const dec=ctx.computeEmbeddingPressure(500,10088,false,false,800);
  assert(dec.stcW===16 && dec.decoyBits===800 && dec.totalCarrierPct>low.totalCarrierPct,'isca não entrou na carga física');

  // Integração: medidor e operação real compartilham a mesma preparação do corpo.
  assert(files.includes('const prepared=await prepareEncMainBody(msg,cipher);'),'medidor não usa prepareEncMainBody');
  assert(files.includes('const preparedMain = await prepareEncMainBody(msg, cipher, encMark);'),'encode não usa prepareEncMainBody');
  assert(files.includes('scheduleEmbeddingPressure();'),'updateCap deixou de invalidar detalhes quando eles estão abertos');
  assert(ui.includes("if (typeof hideEmbeddingPressure === 'function') hideEmbeddingPressure();"),'limpar Encoder não fecha/invalida detalhes técnicos');
  assert(!files.includes('pct>50') && !files.includes('pct>25'),'avisos genéricos antigos de 25/50% sobreviveram');

  // P1B R2: opt-in real. Fechado, digitação não pode preparar/comprimir payload.
  const sched=sliceFn(files,'scheduleEmbeddingPressure','getEncNormalizedMessage');
  const gate=sched.indexOf('if(!encPressureOpen) return;');
  const normalize=sched.indexOf("const msg=getEncNormalizedMessage('enc-msg');");
  assert(gate>=0 && normalize>gate,'gate opt-in precisa ocorrer antes de normalizar/preparar o texto');
  assert(sched.includes('immediate?0:650'),'detalhes abertos perderam debounce para digitação pesada');
  const toggle=sliceFn(files,'toggleEmbeddingPressure','scheduleEmbeddingPressure');
  const closeBranch=toggle.indexOf('if(!encPressureOpen){');
  assert(closeBranch>=0 && toggle.indexOf('encPressureLast=null;',closeBranch)>closeBranch,
    'fechar detalhes não limpa a medição anterior antes da próxima abertura');
  assert(main.includes("on('#enc-pressure-toggle', 'click', () => toggleEmbeddingPressure());"),'ícone de detalhes não está ligado ao toggle');
  assert(!i18n.includes("if (typeof scheduleEmbeddingPressure === 'function') scheduleEmbeddingPressure();"),'troca de idioma voltou a recomprimir payload');
  assert(i18n.includes("if (typeof updateCap === 'function') updateCap();") && i18n.includes("refreshEmbeddingPressureLanguage"),'idioma não atualiza contador visível/detalhes cacheados');

  // UI/claims: ícone discreto após Capacidade; painel oculto até opt-in; texto não depende só de cor.
  for(const id of ['enc-pressure-toggle','enc-pressure','enc-pressure-tier','enc-pressure-metrics']) assert(tpl.includes(`id="${id}"`),'UI P1B ausente: '+id);
  assert(/capacity-label[\s\S]{0,300}fieldCapacity[\s\S]{0,300}enc-pressure-toggle/.test(tpl),'ícone não fica imediatamente associado ao título Capacidade');
  assert(/id="enc-pressure-toggle"[^>]*aria-expanded="false"/.test(tpl),'detalhes técnicos não começam fechados');
  assert(/id="enc-pressure" style="display:none"/.test(tpl),'painel técnico não começa oculto');
  assert(css.includes('.capacity-info-btn') && css.includes('.embedding-pressure') && css.includes('.ep-tier[data-tier="high"]'),'estilo P1B/ícone ausente');
  assert(css.includes('.ep-metrics { margin-top:4px; font-size:0.6rem') && css.includes('@media (max-width:600px)') && css.includes('.ep-head { align-items:flex-start; flex-wrap:wrap; }'),'P1B deixou de ser compacto/adaptável no mobile');
  assert((i18n.match(/encPressureTitle:/g)||[]).length===2 && (i18n.match(/encPressureOpen:/g)||[]).length===2,'i18n P1B sem paridade nominal');
  assert(i18n.includes('optional technical details') && i18n.includes('detalhes técnicos opcionais'),'ajuda não deixa claro que a P1B é opt-in');
  assert(i18n.includes('not a probability of detection') && i18n.includes('não é probabilidade de detecção'),'disclaimer de probabilidade ausente');
  assert(i18n.includes('effective STC width') && i18n.includes('largura STC efetiva'),'guia técnico não explica w');
  assert(i18n.includes('Highly repetitive text can compress') && i18n.includes('Texto muito repetitivo pode comprimir'),'painel não explica a divergência caracteres × carga física');
  assert(!/encPressure[^\n]{0,220}(undetectable|indetectable|indetectável|seguro)/i.test(i18n),'pressão recebeu claim de segurança/detectabilidade');

  process.stdout.write('O1-E2 embedding pressure OK — opt-in/lazy + shared prepared payload + STC w tiers + objective RGB slots + explicit non-probability');
})().catch(e=>{ console.error(e); process.exit(1); });
