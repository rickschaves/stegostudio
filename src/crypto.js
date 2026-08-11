const AES_VERSION = 0x01;        // KDF = PBKDF2-SHA256 (legado; só p/ LER imagens antigas)
const AES_VERSION_ARGON2 = 0x02; // KDF = Argon2id (padrão desde a #9; ver deriveAesKeyArgon2)
const PBKDF2_ITERS = 150000;
// Argon2id (RFC 9106) via hash-wasm embutido (wasm base64 inline, offline). Parâmetros
// definidos na frente #9: m=64MiB, t=3, p=1 — resistente a brute-force por GPU/ASIC.
const ARGON2_PARAMS = { parallelism: 1, iterations: 3, memorySize: 65536 }; // memorySize em KiB

async function deriveAesKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:PBKDF2_ITERS, hash:'SHA-256' },
    baseKey, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}

// Deriva a chave AES-256 via Argon2id (KDF v2 = byte de versão 0x02). O wasm é
// carregado/compilado de forma preguiçosa na 1ª chamada (~500ms; depois ~325ms),
// e fica em cache pela sessão. Se o WASM não estiver disponível, LANÇA — nunca
// rebaixa silenciosamente para um KDF mais fraco.
async function deriveAesKeyArgon2(password, salt) {
  if (typeof hashwasm === 'undefined' || !hashwasm || !hashwasm.argon2id) {
    throw new Error('argon2-unavailable');
  }
  const keyBytes = await hashwasm.argon2id({
    password, salt,
    parallelism: ARGON2_PARAMS.parallelism,
    iterations:  ARGON2_PARAMS.iterations,
    memorySize:  ARGON2_PARAMS.memorySize,
    hashLength: 32, outputType: 'binary'
  });
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt','decrypt']);
}

// Cifra texto → Uint8Array auto-contido. Assíncrono (Web Crypto).
async function aesEncrypt(text, password) {
  return aesEncryptBytes(new TextEncoder().encode(text), password);
}

// Cifra BYTES (usado quando o corpo já passou por compressão).
async function aesEncryptBytes(bytes, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKeyArgon2(password, salt); // KDF v2 = Argon2id (#9)
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name:'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(1 + 16 + 12 + ct.length);
  out[0] = AES_VERSION_ARGON2;
  out.set(salt, 1);
  out.set(iv, 17);
  out.set(ct, 29);
  return out;
}

// ─── Compressão do corpo (deflate-raw nativo). Aplicada ANTES da cifragem;
// só é usada se realmente encolher (decidido no encode). O flag FLAG_COMPRESSED
// no header diz ao decoder para descomprimir após decifrar. ───
async function deflateBytes(bytes) {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function inflateBytes(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// Decifra Uint8Array auto-contido → texto. Lança se a senha estiver errada
// (GCM falha a autenticação) ou se o formato não bater.
async function aesDecrypt(bytes, password) {
  return new TextDecoder().decode(await aesDecryptBytes(bytes, password));
}

// Decifra → BYTES crus (sem decodificar texto). Usado quando o corpo pode estar
// comprimido: decifra-se aqui e descomprime-se depois.
async function aesDecryptBytes(bytes, password) {
  if (!bytes || bytes.length < 30) throw new Error('not-aes');
  const ver = bytes[0];
  if (ver !== AES_VERSION && ver !== AES_VERSION_ARGON2) throw new Error('not-aes');
  const salt = bytes.slice(1, 17);
  const iv = bytes.slice(17, 29);
  const ct = bytes.slice(29);
  // Despacha o KDF pelo byte de versão: 0x02 = Argon2id (novo), 0x01 = PBKDF2 (legado).
  const key = ver === AES_VERSION_ARGON2
    ? await deriveAesKeyArgon2(password, salt)
    : await deriveAesKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
  return new Uint8Array(pt);
}

// Detecta se um payload começa com o cabeçalho AES (byte de versão, PBKDF2 ou Argon2id).
function isAesPayload(bytes) {
  return bytes && bytes.length >= 30 &&
         (bytes[0] === AES_VERSION || bytes[0] === AES_VERSION_ARGON2);
}

// ─── Camada de NEGAÇÃO PLAUSÍVEL — cripto da mensagem-isca (decoy) ───────────
// A isca (Opção C) é gravada por LSB no FIM do pool, ancorada num ponto fixo, e
// validada pela TAG do AES-GCM (não por MAGIC). Precisamos de blocos GCM cujo
// TAMANHO seja previsível a partir SÓ da senha, para o decoder localizar a
// âncora sem conhecer a mensagem real. Por isso a isca usa um SALT DERIVADO da
// senha (não aleatório): assim o decoder recria a mesma chave e lê a âncora.
//
// Segurança: o salt fixo-por-senha é aceitável aqui porque (a) cada senha gera
// um salt distinto e (b) o objetivo da isca é ser recuperável sob coação, não
// resistir a ataque de dicionário como a mensagem real. O nonce (iv) do GCM
// continua ALEATÓRIO por bloco (nunca reusado), preservando a segurança do GCM.
//
// Deriva um salt de 16 bytes determinístico a partir da senha (SHA-256 truncado).
async function decoySaltFromPassword(password) {
  const h = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode('STEGO-DECOY-SALT:' + password));
  return new Uint8Array(h).slice(0, 16);
}

// Cifra bytes com AES-256-GCM (Argon2id) usando o salt derivado da senha.
// Saída: [iv(12)][ciphertext+tag]. SEM o byte de versão/salt do aesEncryptBytes,
// porque na isca o salt é recuperável da senha e a versão é sempre Argon2id.
async function decoyGcmEncrypt(bytes, password) {
  const salt = await decoySaltFromPassword(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKeyArgon2(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

// Decifra um bloco [iv(12)][ct+tag] da isca. Retorna null se a tag não validar
// (senha errada OU não há isca ali — apenas ruído). Nunca lança: a falha de
// autenticação É o sinal de "não é esta camada", parte da negação plausível.
async function decoyGcmDecrypt(block, password) {
  try {
    const salt = await decoySaltFromPassword(password);
    const iv = block.slice(0, 12);
    const ct = block.slice(12);
    const key = await deriveAesKeyArgon2(password, salt);
    const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
    return new Uint8Array(pt);
  } catch { return null; }
}

// ─── Cifra XOR legada (mantida só para LER imagens antigas) ───
// Imagens criadas até a v2.6.0 usam XOR. Mantemos decryptXOR para
// compatibilidade na descriptografia; a CRIAÇÃO agora é sempre AES.
function deriveKeystream(key, length) {
  const stream = new Uint8Array(length);
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    stream[i] = (seed >>> 16) & 0xFF;
  }
  return stream;
}
function decryptXOR(bytes, key) {
  const stream = deriveKeystream(key, bytes.length);
  return new TextDecoder().decode(bytes.map((b,i) => b ^ stream[i]));
}

// ════════════════════════════════════════
//  LSB PROTOCOL
// ════════════════════════════════════════
