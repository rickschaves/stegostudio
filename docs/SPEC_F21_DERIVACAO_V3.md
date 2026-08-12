# SPEC F21 — Derivação de 256 bits para as camadas de posicionamento e máscara

**Estado: ✅ APROVADA PARA IMPLEMENTAÇÃO (11/08/2026). Rev. 5.**
Nenhuma linha de código escrita ainda.
Alvo: v2.43.0 · Revisão 2 · **Duas consequências novas exigem decisão — ver §8.**

## Decisões fechadas
| # | decisão |
|---|---|
| 1 | **Salt:** 16 bytes aleatórios por imagem, em bootstrap disperso e determinístico. **NÃO** largura×altura |
| 2 | **KDF:** um único Argon2id → HKDF-SHA256 com `info` distinto por domínio |
| 3 | **Stream:** AES-CTR via WebCrypto, chave distinta por função |
| 4 | **Compat:** golden fixtures versionados no repo, gerados agora |
| 5 | **Novo:** `header-auth` — HMAC-SHA256 truncado a 128 bits, chave própria |


---

## 1. O problema

`seedFromPassword()` é FNV-1a e devolve **32 bits**. Esses 32 bits alimentam
`mulberry32`, e o mesmo PRNG governa **duas funções distintas**:

- `shuffledOrder()` — a permutação das posições onde os bits são gravados;
- o keystream do XOR que mascara o header no modo stealth.

Duas consequências:

**Teto artificial.** A camada de furtividade tem no máximo 2³² estados,
independentemente da senha. Não afeta a confidencialidade — a mensagem está sob
AES-256-GCM com chave Argon2id — mas o adversário que quer *localizar* o header
não precisa atacar a senha: ataca 4 bilhões de sementes, cada uma com um teste
de MAGIC como oráculo.

**Ausência de separação de domínio.** O mesmo material governa posicionamento e
máscara. Se um deles vazar informação, o outro vaza junto.

---

## 2. O que a mudança NÃO resolve

Registrado aqui para não virar afirmação enganosa depois, no changelog ou no
material público:

> Derivar 256 bits remove o teto artificial de 32 bits. **Não transforma senha
> fraca em 256 bits de segurança.** Sobre `123456`, qualquer alongamento de
> chave continua deixando a adivinhabilidade de `123456`; o Argon2id encarece
> cada tentativa, o que compra tempo, não entropia.

O mesmo texto já está no `SECURITY.md` (v2.42.2).

---

## 3. Desenho proposto

### 3.1 Derivação com separação de domínio

```
                          senha
                            │
                  Argon2id (m=64MiB, t=3, p=1)
                    salt = SALT_ESTRUTURAL          ← ver 3.2
                            │
                            ▼
                     IKM  (32 bytes)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   HKDF-SHA256, info =           HKDF-SHA256, info =
   "StegoStudio/header-          "StegoStudio/header-
    placement/v3"                 mask/v3"
              │                           │
              ▼                           ▼
         KEY_A (32 B)                KEY_B (32 B)
              │                           │
              ▼                           ▼
     ordem das posições            máscara do header
```

Chaves independentes para funções independentes. Comprometer uma não entrega a
outra.

### 3.2 Salt estrutural — RESOLVIDO

**16 bytes de `crypto.getRandomValues()` por imagem**, gravados numa área de
bootstrap em posições determinísticas e independentes da senha.

Largura×altura foi **descartado**: 1920×1080 se repete aos milhões, e o RFC 9106
pede salt único por senha. Pior, mesma senha + mesmas dimensões reproduziria a
mesma raiz estrutural em imagens diferentes — inaceitável em esteganografia.

**Não é um marcador.** Não há MAGIC, versão nem constante ali: são 128 bits
aleatórios, indistinguíveis de LSBs naturais. Salt não precisa ser secreto
(RFC 5869); precisa ser único.

```
imagem
   ├── posições de bootstrap (públicas) → 16 bytes de salt
   ▼
Argon2id(senha, salt) → masterKey (256 bits)
```

### 3.3 Uma passagem de Argon2id + HKDF — RESOLVIDO

```
Argon2id(senha, structuralSalt) → masterKey
                 │
            HKDF-SHA256
   ┌─────────┬───┴────┬──────────┐
   ▼         ▼        ▼          ▼
placement  mask   header-auth  content
   │         │        │          │
AES-CTR   AES-CTR   HMAC     AES-256-GCM
```

`info` por domínio:
```
StegoStudio/F21/v3/placement
StegoStudio/F21/v3/header-mask
StegoStudio/F21/v3/header-auth
StegoStudio/F21/v3/content-aes
```

Uma passagem só. O salt já é aleatório por imagem, então a mesma senha gera
masterKey diferente a cada imagem — o segundo Argon2id compraria pouco e custaria
caro no celular.

A derivação da chave AES muda, mas é **v3 do formato**: o caminho legado fica
intacto.

### 3.4 AES-CTR — RESOLVIDO

WebCrypto, chaves de 256 bits, contador de 16 bytes. ChaCha20 exigiria
implementação manual (não está no WebCrypto Level 2) e não compra nada aqui.

⚠️ **Rejection sampling obrigatório.** Ao converter bytes do stream em índices,
`valor % restantes` enviesa a permutação quando o intervalo não divide 256^k
uniformemente. Descartar e re-sortear os valores fora da faixa utilizável.

### 3.5 Autenticação do header — NOVO

HMAC-SHA256 truncado a **128 bits**, chave `header-auth`, cobrindo o header
recuperado. O decoder **verifica antes de confiar em comprimento e flags**.

Justificativa direta: a 2ª auditoria achou exaustão de memória por campos de
tamanho não validados. Aqui é o mesmo problema — `LEN` vem do arquivo e hoje é
usado para alocar. Com MAC, um header adulterado é rejeitado antes disso.

Sem marcador: o MAC vive dentro da estrutura escondida.

## 4. Compatibilidade — sem marcador em posição fixa

**Princípio: nada em posição previsível pode denunciar que ali existe um
STEGO·STUDIO.** Um byte de versão no início é uma assinatura, e uma ferramenta
de esteganografia não pode oferecer isso. (Mesmo raciocínio que já usamos ao
validar a camada-isca pela tag do GCM em vez de por MAGIC.)

**Decoder tenta em ordem:**

```
1. derivação v3 → localiza header → valida MAGIC
      ├─ sucesso → lê VERSION de dentro do header, segue
      └─ falha
2. derivação legada (FNV-1a + mulberry32) → valida MAGIC legado
      ├─ sucesso → payload antigo, caminho legado
      └─ falha → nenhuma mensagem
```

O header recuperado começa logicamente com `MAGIC | VERSION | FLAGS | LEN`. A
versão existe, mas só é legível por quem já tem a senha.

**Custo:** senha errada paga as duas tentativas. Com a mitigação de 3.3 o
Argon2id roda uma vez só, então o caminho legado custa apenas o FNV — barato.

---

## 5. Escopo

**Dentro:** `seedFromPassword` → derivação v3; `shuffledOrder` com AES-CTR;
máscara do header; dispatch v3/legado no decoder; byte VERSION dentro do header.

**Fora:** F1/isca, modo robusto, formato TLV (B4).

⚠️ **Correção da rev.3.** A rev.2 dizia "AES-GCM da mensagem (não muda)" no
escopo e ao mesmo tempo derivava `content-aes` da `masterKey` — duas descrições
incompatíveis do mesmo formato. O correto:

- **O algoritmo não muda:** continua AES-256-GCM, IV de 12 bytes aleatório.
- **A derivação da chave MUDA na v3:** deixa de ser `Argon2id(senha, saltAES)` e
  passa a ser `HKDF(masterKey, "…/content-aes")`.
- **O salt AES de 16 bytes gravado no payload DESAPARECE na v3.** Seu papel foi
  absorvido pelo salt estrutural de bootstrap, que já é aleatório por imagem.
  Isso devolve 16 bytes de capacidade e remove uma fonte de aleatoriedade
  redundante. **No caminho legado ele continua existindo e sendo lido.**

---

## 6. Validação obrigatória antes de entregar

1. **Round-trip v3:** todos os modos, PNG e JPEG, Unicode, mensagem longa.
2. **Retrocompatibilidade:** payloads gerados pelas v2.38.2–v2.42.2 precisam
   abrir. **Gerar as amostras ANTES de tocar no código.**
3. **Senha errada:** silêncio nos dois caminhos, sem exceção vazada.
4. **Aleatoriedade e determinismo (corrigido na rev.3 — o texto anterior era
   contraditório).** Com salt aleatório por imagem, "mesma senha + mesmo cover ⇒
   mesma saída" é **falso por construção**, e exigir isso teria travado a
   implementação ou empurrado alguém a fixar o salt para o teste passar.
   Duas propriedades no lugar de uma:
   - **produção:** duas codificações do mesmo cover com a mesma senha produzem
     saídas **diferentes**, e ambas decodificam corretamente;
   - **teste:** com salt injetado (gancho só de teste), a saída é **idêntica**
     byte a byte. É daí que vem o determinismo dos vetores.
5. **Independência de domínio:** KEY_A e KEY_B distintas; alterar `info` muda o
   resultado.
6. **Tempo:** medir o custo com senha errada (caminho duplo) numa imagem grande.
7. **Isolado em Node antes de integrar**, e validação final a partir do HTML
   construído.

---

## 7. Golden fixtures (decisão 4)

`test/fixtures/legacy/v2.40/`, `v2.41/`, `v2.42/` — cada um com `cover.png`,
`encoded.png` e `manifest.json` (versão do encoder, senha de teste, SHA-256 do
plaintext esperado, SHA-256 do encoded, dimensões, opções). Conteúdo artificial,
nunca dado pessoal.

Gerar **agora**, com os HTMLs antigos ainda em mãos. Recriar depois com código
moderno provaria só que o código moderno concorda consigo mesmo.

---

## 8. ⚠️ DUAS CONSEQUÊNCIAS NOVAS — decisão necessária

Apareceram ao confrontar o desenho com o `decoder.js` real.

### 8.1 A ordem inverte: o caro passa a vir antes do barato

**Hoje** (`decoder.js`, linhas 13–26) o decoder valida o MAGIC usando posições e
XOR derivados do **FNV — barato**. O Argon2id só roda **depois** do MAGIC bater,
para decifrar o conteúdo. Imagem limpa ou senha errada custam ~zero.

**Com a F21 isso inverte:** para *localizar* o header é preciso `placementKey`,
que exige o Argon2id. Ou seja, **toda tentativa passa a custar uma passagem de
64 MiB** — inclusive imagem limpa, senha errada e cada candidato do deep scan.

Ordem de grandeza: ~100–300 ms no desktop, **1–3 s em celular intermediário**.

A proposta de "tentar legado primeiro" **não resolve o caso que importa**: numa
imagem limpa os dois caminhos falham, então o Argon2id roda de qualquer forma.

**Opções:**

| | descrição | custo |
|---|---|---|
| **(a)** | Aceitar. Decode é ação explícita com senha; encarecer tentativa é feature anti-força-bruta | UX pior em celular; deep scan multiplica |
| **(b)** | (a) + **memoizar** `Argon2id(senha, salt)` na sessão | resolve repetição, não a 1ª tentativa |
| **(c)** | Perfil mais leve **só para as chaves estruturais** (ex. m=16 MiB) mantendo 64 MiB no conteúdo | mais rápido; **quebra a passagem única** e reintroduz 2 Argon2id |

**Recomendação: (a) + (b).** Mas isto precisa da sua decisão, porque degrada
uma propriedade que a ferramenta tem hoje.

⚠️ **Verificar antes de implementar:** se o Analyzer chama o decoder passivamente
em cada imagem analisada, (a) é inviável e a resposta vira (c).

### 8.2 Os 128 bits de bootstrap em cover liso

Salt não precisa ser secreto — correto. Mas há um detalhe esteganográfico: LSBs
naturais **não são uniformemente aleatórios** em regiões lisas (céu, parede);
eles correlacionam com os vizinhos. Escrever 128 bits verdadeiramente aleatórios
em posições **conhecidas** cria uma anomalia local pequena mas dirigida — um
analista que conheça a ferramenta sabe exatamente onde olhar.

128 pixels é pouco para RS global. O risco é análise **dirigida**, não estatística
geral.

**Mitigação candidata:** escolher as posições de bootstrap pelas regiões de maior
textura, usando o mapa de custo HILL que já temos — o cover é público, o decoder
recalcula. **Risco:** o próprio embedding altera o mapa e o decoder pode computar
posições diferentes. Exigiria quantização grosseira e verificação de estabilidade.

**Alternativa conservadora:** posições dispersas fixas + aceitar o risco,
documentando-o no `SECURITY.md`.

**Não recomendo decidir isto no papel.** É caso de medir: gerar covers lisos,
gravar o bootstrap, rodar análise dirigida nas posições conhecidas e ver se
destaca. Fica como tarefa de implementação, com resultado registrado.

---

## 9. Bootstrap: representação física — QUESTÃO DE PROJETO

Levantada na revisão externa e **real**: o decoder precisa do salt **antes** de
ler o header, e os `FLAGS` (modo, canal, adaptativo) vivem *dentro* do header.
Logo o bootstrap precisa de uma convenção física canônica, independente de tudo.

**PNG — já existe precedente.** O `extractLSBStudio` atual lê o header bruto dos
primeiros `HEADER_BYTES*8` **pixels opacos, canal B, LSB** — convenção fixa, sem
consultar flags. O bootstrap usa a mesma regra, ocupando os **primeiros 128
pixels opacos** e empurrando o header para depois.

**JPEG — a ponte que faltava.** O modo robusto não escreve em pixels: grava por
QIM em coeficientes DCT. Não há "pixel opaco" ali. Convenção proposta: os
primeiros 128 coeficientes AC não nulos da banda já usada pelo modo robusto, na
ordem de varredura que o encoder e o decoder compartilham, **fora** da faixa
reservada ao payload.

⚠️ **Verificar antes de implementar:** o QIM tolera 128 coeficientes a mais sem
estourar a taxa de embedding em imagens pequenas? A taxa é o fator dominante de
detectabilidade — 128 coeficientes num JPEG de 640×480 não é desprezível.
**Medir antes de fixar o número.**

**Alternativa se o custo for alto no JPEG:** manter o formato legado no caminho
robusto e aplicar a v3 só no PNG, documentando a assimetria. Não é elegante, mas
é honesto e mensurável.

## 10. Analyzer passivo — VERIFICADO NO CÓDIGO (rev.4)

**Existem DOIS pontos de chamada, não um.**

| onde | senha | quando |
|---|---|---|
| `main.js:123` | recebe `key` | decode explícito |
| **`forensics.js:551`** | **nenhuma** | **toda análise** — módulo M7 "STUDIO PROTOCOL" |

O M7 roda `extractLSBStudio(imageData)` sem senha em cada imagem analisada e
alimenta `report.studio.hasHeader` / `shuffled`. É esse o caminho que
inviabilizaria um Argon2id passivo.

### Regra adotada
**O caminho v3 só é tentado quando `key.length > 0`.** Sem senha: forense normal
+ decoder legado barato, nunca Argon2id. Com senha: uma passagem de Argon2id por
operação, `masterKey` reutilizada dentro dela e descartada no fim. **Sem cache de
sessão** e **Argon2id jamais dentro do laço de deep scan**.

### Consequência 1 — o v3 fica invisível ao Analyzer passivo
Hoje o M7 detecta um header STEGO·STUDIO sem senha, porque as posições canônicas
são fixas. Na v3 a posição depende de `Argon2id(senha, salt)`: sem a senha não há
onde olhar.

**É ganho de furtividade E perda de capacidade forense.** Nossa ferramenta deixa
de reconhecer a própria saída sem senha, e o painel para de dizer "contém header
do STEGO·STUDIO" em imagens v3. Provavelmente desejável — mas é **decisão de
produto**, não efeito colateral. ⚠️ **Decisão do Rick.**

### Consequência 2 — v3 EXIGE senha não vazia
`Argon2id('', salt)` é computável por qualquer um; achar exigiria 64 MiB em toda
análise passiva. Portanto: **sem senha → formato A legado.** Sem senha não há
segredo no posicionamento, e a derivação de 256 bits não compra nada ali.

Isto **restringe o escopo da v3** e precisa aparecer na interface: o modo v3 vale
para mensagens com senha.

## 11. JPEG — medir, não decidir no papel (rev.4)

Revisão externa acertou ao recusar tanto "legado por decreto" quanto "128
coeficientes por analogia". A regra do projeto é **medir antes de investir**, e o
modo robusto tem modelo de ameaça próprio: nele ser detectável é trade-off
aceito, e o objetivo é sobreviver à recompressão.

**Protótipo experimental, com dados decidindo:**
1. JPEG pequeno (640×480), médio e grande
2. medir a taxa de embedding adicional dos 128 coeficientes
3. rodar os próprios analisadores (RS, WS, χ², Fatia A) antes e depois
4. custo desprezível ⇒ JPEG entra na v2.43.0; mensurável ⇒ JPEG fica no formato A

Não congelar a convenção antes disso.

## 12. Decisões finais do Rick (rev.5) — TODAS FECHADAS

**1. Analyzer passivo perde a v3 — ACEITO.** Sem senha, o M7 não tem onde
procurar. É propriedade desejada, não regressão: se mantivéssemos um mecanismo
que denunciasse "existe um STEGO·STUDIO aqui" sem senha, devolveríamos parte
exata da informação que a F21 esconde.

Exigência de interface: dizer isso abertamente, algo como *"payloads furtivos
protegidos por senha não são identificáveis passivamente; informe a senha para
tentar reconhecê-los."* Limitação declarada, não escondida.

**2. v3 EXIGE senha não vazia — CONFIRMADO.** `Argon2id('', salt)` gera chave
válida mas nenhum segredo: salt público + algoritmo público + senha vazia =
masterKey computável por qualquer um. Pagaríamos 64 MiB sem comprar a
propriedade que justifica a complexidade.

| encode | formato | posicionamento | Analyzer passivo |
|---|---|---|---|
| **sem senha** | A (legado) | canônico | reconhece |
| **com senha** | v3 | derivado da senha | não reconhece |

⚠️ **Nomenclatura:** "formato A" e "v3" são internos. A interface **não** deve
falar em "modo legado" — do ponto de vista do usuário, senha preenchida
simplesmente ativa proteção mais forte. A versão do formato é problema nosso.

**3. Ausência de header ≠ ausência de payload.** Nenhum score pode ler "não achei
header" como evidência contra existir mensagem.

### ✅ Verificado no código (rev.5)
A pontuação direta **já está correta**: `forensics.js:1103` faz `hasHeader` somar
+40; a ausência não subtrai.

⚠️ **Mas há um caminho indireto que a F21 quebra.** `forensics.js:1009`:

```js
const structuralCorroborates = hasHeader || robustOk || rsRate >= 25 || …
```

Esse booleano **libera a supressão de sinais moles** pelo veto de IA/C2PA. Hoje
um payload nosso sempre corrobora, porque o header é achável sem senha. Com v3
sem senha `hasHeader` é falso, o payload real perde o corroborador, e indícios
moles legítimos podem ser calados. A ausência não vira score negativo — vira
**permissão para silenciar outro sinal**, o que dá no mesmo.

**Tarefa obrigatória da implementação:** revisar `structuralCorroborates` e o
texto de "nenhum header encontrado", que passa a significar *"nenhum header
identificável sem credenciais"*.

---

## 13. Bateria comportamental obrigatória da v2.43.0

A v2.43.0 **não sai** sem ela. É também a primeira fatia real da F17.

1. Round-trip v3: todos os modos PNG, Unicode, mensagem longa
2. Retrocompatibilidade contra `test/fixtures/legacy/formato-A/` (CHECK 14)
3. Senha errada: silêncio nos dois caminhos, zero exceção vazada
4. Não-determinismo em produção; determinismo com salt injetado (§6.4)
5. `header-auth`: header adulterado rejeitado **antes** de `LEN` alocar
6. Independência de domínio: mudar `info` muda a chave
7. Tempo com senha errada em imagem grande (caminho duplo)
8. Sem senha ⇒ formato A, e Argon2id **não** roda
