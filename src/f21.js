// ════════════════════════════════════════
//  F21 v3 — derivação estrutural forte (PNG/lossless com senha)
// ════════════════════════════════════════
// Este módulo implementa somente o formato v3 descrito em
// internal/SPEC_F21_DERIVACAO_V3_REV7.md. O formato legado continua em
// encoder.js/decoder.js e não é reescrito aqui.
//
// Invariantes centrais:
// - um Argon2id por camada principal v3;
// - HKDF separa ordem do corpo, máscara, autenticação e conteúdo;
// - HMAC do header é verificado ANTES de confiar em mode/len/iv;
// - produção usa salt/IV aleatórios; determinismo existe apenas por parâmetro
//   explícito de teste, nunca por estado global da UI.

const F21_VERSION = 0x03;
const F21_STRUCTURAL_SALT_BYTES = 16;
const F21_HEADER_CORE_BYTES = 24;
const F21_HEADER_TAG_BYTES = 16;
const F21_MASKED_HEADER_BYTES = 40;
const F21_PREFIX_BYTES = F21_STRUCTURAL_SALT_BYTES + F21_MASKED_HEADER_BYTES;
const F21_PREFIX_BITS = F21_PREFIX_BYTES * 8; // 448 bits lógicos de bootstrap
const F21_BOOTSTRAP_STC_W = 4;
const F21_BOOTSTRAP_STC_SEED = 0xF21B0057;
const F21_PREFIX_CARRIER_PIXELS = F21_PREFIX_BITS * F21_BOOTSTRAP_STC_W; // 1792 B-LSB carriers
const F21_BODY_MAX = 5_000_000;
const F21_GCM_TAG_BYTES = 16;
const F21_CONTENT_IV_BYTES = 12;
const F21_HKDF_SALT = new Uint8Array(32); // zero salt, decisão normativa mantida na Rev.7
const F21_CTR_COUNTER = new Uint8Array(16);
const F21_CTR_CHUNK_BYTES = 65536; // múltiplo de 16; não faz parte do wire format
const F21_HEADER_DOMAIN = 'StegoStudio/F21/v3/header';
const F21_CONTENT_DOMAIN = 'StegoStudio/F21/v3/content';
const F21_DOMAIN_LABELS = Object.freeze({
  bodyOrder:  'StegoStudio/F21/v3/body-order',
  headerMask: 'StegoStudio/F21/v3/header-mask',
  headerAuth: 'StegoStudio/F21/v3/header-auth',
  contentAes: 'StegoStudio/F21/v3/content-aes',
});
const F21_MAGIC = new Uint8Array([0x53,0x54,0x45,0x47,0x4F]); // "STEGO"
const _f21Utf8 = new TextEncoder();

function f21Concat(...parts) {
  let n = 0;
  for (const p of parts) n += p?.length || 0;
  const out = new Uint8Array(n);
  let off = 0;
  for (const p of parts) { if (p?.length) { out.set(p, off); off += p.length; } }
  return out;
}

function f21BytesEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function f21FixedBytes(value, length, name) {
  const v = value instanceof Uint8Array ? new Uint8Array(value) : null;
  if (!v || v.length !== length) throw new Error(`f21-${name}-length`);
  return v;
}

function f21RandomBytes(length, fixed, name) {
  if (fixed !== undefined && fixed !== null) return f21FixedBytes(fixed, length, name);
  return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveF21Master(password, structuralSalt) {
  if (!password || password.length === 0) throw new Error('f21-password-required');
  const salt = f21FixedBytes(structuralSalt, F21_STRUCTURAL_SALT_BYTES, 'salt');
  if (typeof hashwasm === 'undefined' || !hashwasm?.argon2id) throw new Error('argon2-unavailable');
  const out = await hashwasm.argon2id({
    password,
    salt,
    parallelism: ARGON2_PARAMS.parallelism,
    iterations: ARGON2_PARAMS.iterations,
    memorySize: ARGON2_PARAMS.memorySize,
    hashLength: 32,
    outputType: 'binary'
  });
  return new Uint8Array(out);
}

async function f21Hkdf(masterKey, label) {
  const ikm = f21FixedBytes(masterKey, 32, 'master');
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name:'HKDF', hash:'SHA-256', salt:F21_HKDF_SALT, info:_f21Utf8.encode(label)
  }, base, 256);
  return new Uint8Array(bits);
}

async function deriveF21Keys(masterKey) {
  const keys = {
    bodyOrderKey:  await f21Hkdf(masterKey, F21_DOMAIN_LABELS.bodyOrder),
    headerMaskKey: await f21Hkdf(masterKey, F21_DOMAIN_LABELS.headerMask),
    headerAuthKey: await f21Hkdf(masterKey, F21_DOMAIN_LABELS.headerAuth),
    contentAesKey: await f21Hkdf(masterKey, F21_DOMAIN_LABELS.contentAes),
  };
  return keys;
}

function f21CounterBytes(blockCounter) {
  let x = BigInt(blockCounter);
  if (x < 0n || x >= (1n << 128n)) throw new Error('f21-counter-range');
  const out = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) { out[i] = Number(x & 0xFFn); x >>= 8n; }
  return out;
}

async function f21ImportAesCtr(keyBytes) {
  return crypto.subtle.importKey('raw', f21FixedBytes(keyBytes, 32, 'ctr-key'), {name:'AES-CTR'}, false, ['encrypt']);
}

// Stream AES-CTR de bytes zero. `chunkBytes` é deliberadamente variável nos testes:
// a sequência total precisa ser idêntica independentemente do tamanho do buffer interno.
async function f21CtrStreamBytes(keyBytes, length, chunkBytes=F21_CTR_CHUNK_BYTES) {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error('f21-stream-length');
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 16 || (chunkBytes % 16) !== 0) {
    throw new Error('f21-stream-chunk');
  }
  const key = await f21ImportAesCtr(keyBytes);
  const out = new Uint8Array(length);
  let outOff = 0, blockCounter = 0n;
  while (outOff < length) {
    // Todas as chamadas intermediárias terminam em fronteira de bloco. A última
    // pode ser parcial; o contador seguinte não é reutilizado porque a função termina.
    const take = Math.min(chunkBytes, length - outOff);
    const counter = f21CounterBytes(blockCounter);
    const zeros = new Uint8Array(take);
    const stream = new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-CTR', counter, length:128}, key, zeros));
    out.set(stream, outOff);
    outOff += take;
    blockCounter += BigInt(Math.ceil(take / 16));
  }
  return out;
}

async function f21CtrXor(keyBytes, bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  const stream = await f21CtrStreamBytes(keyBytes, src.length);
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] ^ stream[i];
  return out;
}

async function f21HmacFull(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', f21FixedBytes(keyBytes, 32, 'hmac-key'),
    {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

async function f21HeaderTag(headerAuthKey, structuralSalt, headerCore) {
  const full = await f21HmacFull(headerAuthKey, f21Concat(
    _f21Utf8.encode(F21_HEADER_DOMAIN),
    f21FixedBytes(structuralSalt, F21_STRUCTURAL_SALT_BYTES, 'salt'),
    f21FixedBytes(headerCore, F21_HEADER_CORE_BYTES, 'header-core')
  ));
  return { full, truncated:full.slice(0, F21_HEADER_TAG_BYTES) };
}

function f21BuildHeaderCore({modeFlags, stcW=0, bodyLen, contentIv}) {
  if (!Number.isInteger(modeFlags) || modeFlags < 0 || modeFlags > 255) throw new Error('f21-mode-byte');
  if (!Number.isInteger(stcW) || stcW < 0 || stcW > 255) throw new Error('f21-stcw-byte');
  if (!Number.isInteger(bodyLen) || bodyLen < F21_GCM_TAG_BYTES || bodyLen > F21_BODY_MAX) throw new Error('f21-body-len');
  const iv = f21FixedBytes(contentIv, F21_CONTENT_IV_BYTES, 'iv');
  const core = new Uint8Array(F21_HEADER_CORE_BYTES);
  core.set(F21_MAGIC, 0);
  core[5] = F21_VERSION;
  core[6] = modeFlags & 0xFF;
  core[7] = stcW & 0xFF;
  new DataView(core.buffer).setUint32(8, bodyLen >>> 0, true);
  core.set(iv, 12);
  return core;
}

function f21ParseHeaderCore(headerCore) {
  const core = f21FixedBytes(headerCore, F21_HEADER_CORE_BYTES, 'header-core');
  return {
    magic:core.slice(0,5),
    version:core[5],
    modeFlags:core[6],
    stcW:core[7],
    bodyLen:new DataView(core.buffer, core.byteOffset, core.byteLength).getUint32(8, true),
    contentIv:core.slice(12,24),
  };
}

// Só deve ser chamado DEPOIS de a HMAC do header validar. Aqui os campos deixam
// de ser bytes não confiáveis e passam a comandar seleção de motor/capacidade.
function f21ValidateParsedHeader(h, opaqueCount=null) {
  if (!f21BytesEqual(h.magic, F21_MAGIC) || h.version !== F21_VERSION) return false;
  if (h.modeFlags & 0x80) return false;
  const mode = h.modeFlags & ~(FLAG_SHUFFLED|FLAG_ADAPTIVE|FLAG_STEALTH|FLAG_COMPRESSED|FLAG_STC|FLAG_HILLV2);
  const shuffled = !!(h.modeFlags & FLAG_SHUFFLED);
  const adaptive = !!(h.modeFlags & FLAG_ADAPTIVE);
  const stealth = !!(h.modeFlags & FLAG_STEALTH);
  const stc = !!(h.modeFlags & FLAG_STC);
  const hillV2 = !!(h.modeFlags & FLAG_HILLV2);
  if (!stealth || (mode !== MODE_B && mode !== MODE_RGB)) return false;
  if (h.bodyLen < F21_GCM_TAG_BYTES || h.bodyLen > F21_BODY_MAX) return false;
  if (stc) {
    if (mode !== MODE_B || h.stcW < 1 || h.stcW > STC_WMAX || shuffled || adaptive || hillV2) return false;
  } else {
    if (h.stcW !== 0 || !shuffled) return false;
    if (adaptive) {
      if (mode !== MODE_B || !hillV2) return false;
    } else if (hillV2) return false;
  }
  if (opaqueCount !== null) {
    if (!Number.isSafeInteger(opaqueCount) || opaqueCount < 0) return false;
    if (f21UsedOpaquePixels(h.modeFlags, h.stcW, h.bodyLen * 8) > opaqueCount) return false;
  }
  return true;
}

function f21UsedOpaquePixels(modeFlags, stcW, bodyBits) {
  const mode = modeFlags & ~(FLAG_SHUFFLED|FLAG_ADAPTIVE|FLAG_STEALTH|FLAG_COMPRESSED|FLAG_STC|FLAG_HILLV2);
  const stc = !!(modeFlags & FLAG_STC);
  const adaptive = !!(modeFlags & FLAG_ADAPTIVE);
  if (!Number.isSafeInteger(bodyBits) || bodyBits < 0) throw new Error('f21-body-bits');
  if (stc) return F21_PREFIX_CARRIER_PIXELS + bodyBits * stcW;
  if (mode === MODE_RGB && !adaptive) return F21_PREFIX_CARRIER_PIXELS + Math.ceil(bodyBits / 3);
  return F21_PREFIX_CARRIER_PIXELS + bodyBits;
}

// Fronteira física contígua reservada para a camada alternativa F1. HILL não-STC
// escolhe pixels por custo em todo o pool restante; sua CONTAGEM não informa o
// maior índice tocado. Falhar fechado impede uma futura combinação HILL+F1 de
// sobrepor camadas silenciosamente.
function f21TailReservationBoundary(modeFlags, stcW, bodyBits) {
  if (modeFlags & FLAG_ADAPTIVE) throw new Error('f21-adaptive-tail-boundary-noncontiguous');
  return f21UsedOpaquePixels(modeFlags, stcW, bodyBits);
}

function f21ContentAad(structuralSalt, headerCore) {
  return f21Concat(_f21Utf8.encode(F21_CONTENT_DOMAIN),
    f21FixedBytes(structuralSalt, F21_STRUCTURAL_SALT_BYTES, 'salt'),
    f21FixedBytes(headerCore, F21_HEADER_CORE_BYTES, 'header-core'));
}

async function f21ImportAesGcm(keyBytes) {
  return crypto.subtle.importKey('raw', f21FixedBytes(keyBytes, 32, 'gcm-key'),
    {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

async function f21EncryptContent(plainBytes, contentAesKey, structuralSalt, headerCore, contentIv) {
  const key = await f21ImportAesGcm(contentAesKey);
  const iv = f21FixedBytes(contentIv, F21_CONTENT_IV_BYTES, 'iv');
  const aad = f21ContentAad(structuralSalt, headerCore);
  return new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM', iv, additionalData:aad, tagLength:128}, key,
    plainBytes instanceof Uint8Array ? plainBytes : new Uint8Array(plainBytes || 0)));
}

async function f21DecryptContent(cipherBody, contentAesKey, structuralSalt, headerCore, contentIv) {
  const key = await f21ImportAesGcm(contentAesKey);
  const iv = f21FixedBytes(contentIv, F21_CONTENT_IV_BYTES, 'iv');
  const aad = f21ContentAad(structuralSalt, headerCore);
  const pt = await crypto.subtle.decrypt(
    {name:'AES-GCM', iv, additionalData:aad, tagLength:128}, key,
    cipherBody instanceof Uint8Array ? cipherBody : new Uint8Array(cipherBody || 0));
  return new Uint8Array(pt);
}

async function f21SampleIndex(m, nextUint32) {
  if (!Number.isSafeInteger(m) || m < 1 || m > 0x100000000) throw new Error('f21-sample-range');
  const R = 0x100000000;
  const limit = Math.floor(R / m) * m;
  let x;
  do { x = (await nextUint32()) >>> 0; } while (x >= limit);
  return x % m;
}

// Fisher-Yates com rejection sampling. No wire v3 esta função permuta BYTES do
// corpo (não bits): o ciphertext já é pseudoaleatório e a granularidade por byte
// reduz em 8× a memória da ordem. No teto de 5 MB, Uint32Array <= ~20 MB.
// O consumo do stream é independente do chunk interno porque cada refill começa
// no contador AES correspondente ao próximo bloco ainda não consumido.
async function f21ShuffledOrder(n, bodyOrderKey, chunkBytes=F21_CTR_CHUNK_BYTES) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xFFFFFFFF) throw new Error('f21-order-size');
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  if (n < 2) return order;
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 16 || (chunkBytes % 16) !== 0) throw new Error('f21-stream-chunk');
  const key = await f21ImportAesCtr(bodyOrderKey);
  let buf = new Uint8Array(0), pos = 0, blockCounter = 0n;
  const refill = async () => {
    const counter = f21CounterBytes(blockCounter);
    buf = new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-CTR', counter, length:128}, key, new Uint8Array(chunkBytes)));
    pos = 0;
    blockCounter += BigInt(chunkBytes / 16);
  };
  const nextUint32 = async () => {
    if (pos + 4 > buf.length) await refill();
    const x = (buf[pos] | (buf[pos+1] << 8) | (buf[pos+2] << 16) | (buf[pos+3] << 24)) >>> 0;
    pos += 4;
    return x;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = await f21SampleIndex(i + 1, nextUint32);
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  return order;
}

async function f21CreatePacket(plainBytes, password, {modeFlags, stcW=0, structuralSalt=null, contentIv=null}={}) {
  const salt = f21RandomBytes(F21_STRUCTURAL_SALT_BYTES, structuralSalt, 'salt');
  const iv = f21RandomBytes(F21_CONTENT_IV_BYTES, contentIv, 'iv');
  const source = plainBytes instanceof Uint8Array ? plainBytes : new Uint8Array(plainBytes || 0);
  const bodyLen = source.length + F21_GCM_TAG_BYTES;
  const headerCore = f21BuildHeaderCore({modeFlags, stcW, bodyLen, contentIv:iv});
  const parsed = f21ParseHeaderCore(headerCore);
  if (!f21ValidateParsedHeader(parsed)) throw new Error('f21-header-invalid');

  const masterKey = await deriveF21Master(password, salt);
  const keys = await deriveF21Keys(masterKey);
  masterKey.fill(0); // best effort; JavaScript não garante limpeza física da memória

  const body = await f21EncryptContent(source, keys.contentAesKey, salt, headerCore, iv);
  if (body.length !== bodyLen) throw new Error('f21-gcm-length');
  const tag = await f21HeaderTag(keys.headerAuthKey, salt, headerCore);
  const plainHeader = f21Concat(headerCore, tag.truncated);
  const maskedHeader = await f21CtrXor(keys.headerMaskKey, plainHeader);
  return { structuralSalt:salt, headerCore, headerTag:tag.truncated, headerTagFull:tag.full,
    plainHeader, maskedHeader, body, bodyOrderKey:keys.bodyOrderKey, contentIv:iv,
    modeFlags, stcW, bodyLen };
}

// Verificação isolada usada também pelos testes hostis: recebe chaves já derivadas,
// autentica os 24 bytes crus e só DEPOIS interpreta/valida os campos.
async function f21VerifyHeaderWithKeys(structuralSalt, maskedHeader, keys, opaqueCount=null) {
  const salt = f21FixedBytes(structuralSalt, F21_STRUCTURAL_SALT_BYTES, 'salt');
  const masked = f21FixedBytes(maskedHeader, F21_MASKED_HEADER_BYTES, 'masked-header');
  const plainHeader = await f21CtrXor(keys.headerMaskKey, masked);
  const headerCore = plainHeader.slice(0, F21_HEADER_CORE_BYTES);
  const receivedTag = plainHeader.slice(F21_HEADER_CORE_BYTES);
  const expected = await f21HeaderTag(keys.headerAuthKey, salt, headerCore);
  if (!f21BytesEqual(receivedTag, expected.truncated)) return null;
  const parsed = f21ParseHeaderCore(headerCore);
  if (!f21ValidateParsedHeader(parsed, opaqueCount)) return null;
  return { parsed, headerCore, bodyOrderKey:keys.bodyOrderKey, contentAesKey:keys.contentAesKey,
    structuralSalt:salt, plainHeader };
}

// Retorna null na senha errada/header aleatório. Nenhum campo do header é usado
// antes de a tag HMAC de 16 bytes ser comparada.
async function f21OpenHeader(structuralSalt, maskedHeader, password, opaqueCount=null) {
  if (!password || password.length === 0) return null;
  const salt = f21FixedBytes(structuralSalt, F21_STRUCTURAL_SALT_BYTES, 'salt');
  const masterKey = await deriveF21Master(password, salt);
  const keys = await deriveF21Keys(masterKey);
  masterKey.fill(0);
  return f21VerifyHeaderWithKeys(salt, maskedHeader, keys, opaqueCount);
}

async function f21DecryptOpenedBody(cipherBody, opened) {
  if (!opened?.parsed || !opened?.contentAesKey || !opened?.headerCore) throw new Error('f21-opened-required');
  const body = cipherBody instanceof Uint8Array ? cipherBody : new Uint8Array(cipherBody || 0);
  if (body.length !== opened.parsed.bodyLen) throw new Error('f21-body-length');
  return f21DecryptContent(body, opened.contentAesKey, opened.structuralSalt,
    opened.headerCore, opened.parsed.contentIv);
}
