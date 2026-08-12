# STEGO·STUDIO — Histórico de versões

> **Nota sobre numeração:** a partir da v2.10 o projeto adotou **semver puro**
> (maior.menor.patch). As versões antigas (v1.0 → v2.9.1) seguem a numeração
> original. Veja o marco "Troca de versionamento" abaixo. A organização final
> da numeração antiga fica a critério do Rick.

---

## v2.42.1 — 2026-08-11
**Hardening: os sinks de XSS que a v2.42.0 deixou passar**

Segunda auditoria externa, no site publicado e no GitHub. **Sete dos oito
achados eram reais** — a maioria falha de execução minha na v2.42.0.

### 🔴 Quatro sinks de XSS remanescentes
A v2.42.0 escapou `row()` e o changelog declarou *"tudo que vem do arquivo agora
é escapado"*. **Faltaram quatro caminhos:**

| sink | dado |
|---|---|
| `hl()` no painel C2PA | `signerCN`, `genName`, `genVersion` — CBOR/ASN.1 do arquivo |
| `detailVars` / `labelVars` | `{software}` = campo Software do EXIF, cru |
| `c2pa.signals` no render | sinais montados com pedaços do manifesto |
| `c2paDetail` no forensics | `aiGenerator`, `digitalSourceType`, `ca`, `certDate` |

**A causa raiz é metodológica:** escapei os caminhos que já haviam quebrado, em
vez de **enumerar todos os pontos onde dado de arquivo é exibido**. E o
invariante, escrito com a mesma lógica, exercitava só `row()` — ficou verde com
quatro furos abertos. **Um invariante que testa apenas o caminho já corrigido dá
falsa segurança.**

### O invariante refeito
Agora tem três camadas:
1. **Payloads** contra `row()`/`rowHTML()` (como antes).
2. **Varredura estática:** percorre cada `${...}` do HTML construído com
   contagem de chaves, isola o conteúdo direto (sem interpolações aninhadas) e
   exige `escapeHTML` quando há campo conhecidamente vindo do arquivo. Ignora
   guardas de condicional e invólucros que escapam internamente.
3. **Escapes nomeados:** trechos literais que precisam existir (`hl()`, laço de
   `signals`, `decodedSample`) — dentro de um helper o parâmetro se chama `val`
   ou `s`, e a varredura por nome de campo não alcança.

⚠️ **A primeira versão da varredura tinha furo:** casava o trecho inteiro, então
num `${a ? ... ${b} ...}` um `escapeHTML` em torno de `a` absolvia `b`.
Descoberto por injeção de falha. **Validado com 5 regressões distintas, todas
detectadas.**

### 🟠 Textos que ainda mentiam
- **C2PA:** `aiLblC2PAConfirmed` ("C2PA CONFIRMADO — Origem sintética
  certificada") e `aiDetC2PAConfirmed` sobreviveram à v2.42.0. Mais
  `c2paFPNote`, `flagNeuralUncertainAI`, `flagC2PAExplained` dizendo
  "certificada". Todos corrigidos.
- **Modo Pro** (removido na v2.40.0): 6 textos ainda o recomendavam, incluindo
  "tente novamente quando o modo Pro estiver online" — ao lado da promessa de
  que nada é enviado a servidor.
- **"Firmware não é forjável por IA":** sobrevivia em `helpS5a` (EN+PT) e
  `helpS3d`. O código da v2.42.0 já sabia que era falso; o texto não.
- **17 fallbacks estáticos do `template.html`** ressincronizados com o `i18n` —
  eles aparecem antes do JS rodar.

### 🟠 Asserção offline
O comentário dizia "formas EXATAS de metadado"; o padrão aceitava **qualquer
caminho** em `stegostudio.com` — `/api/exfil` passava. Trocado por **conjunto
fechado de URLs exatas** (2 endereços) + namespaces XML. Verificado por tabela.

### 🟡 Limites contra arquivo hostil
`pngDecodeRGBA` alocava a partir de largura×altura do IHDR **sem validação**:
65535×65535 pede ~17 GB. Tetos de **80 MP** e **512 MB** de raster
descomprimido, checados antes de alocar, com erro legível.

### 🟡 LSB Matching com CSPRNG
`Math.random()` escolhia ±1 por pixel. A direção faz parte do padrão que um
esteganalista observa. Agora vem de `crypto.getRandomValues` com buffer de 4 KB.
Distribuição verificada em 20 mil amostras (desvio 122).

### Achado 8 — parcialmente cache
A auditoria disse que `HTML_PRODUCAO/` tinha só a v2.41.0. **Era cache do
GitHub** — o Rick confirmou a v2.42.0 no repo, e eu reproduzi o mesmo cache
("1 Commit" com 3 pushes feitos). **Mas a segunda metade era real:** o
`README.md` dizia "11 invariants". Corrigido.

### Não corrigido nesta versão
**Semente de 32 bits do header** (FNV-1a → mulberry32). Real, mas afeta
**furtividade**, não confidencialidade — a mensagem segue sob AES-256-GCM com
Argon2id. A correção muda o formato do payload e exige byte de versão para
retrocompatibilidade: **v2.43.0, ver F21**.

### Repositório em inglês
Novos: **`CONTRIBUTING.md`** e **`SECURITY.md`** (modelo de ameaça, limites
conhecidos declarados, canal de reporte). O `CONTRIBUTING` documenta a
transição: inglês no que o leitor externo encontra; changelog (2.002 linhas) e
comentários de código seguem em português, convertidos aos poucos.

### Validação
Harness **12/12**, i18n **694/694**. Os três achados da primeira auditoria
reconferidos contra os mesmos arquivos forjados.

---

## v2.42.0 — 2026-08-11
**Hardening de segurança: XSS, C2PA falso e veto de EXIF**

Resposta a uma auditoria externa. Os três achados foram **reproduzidos com
arquivos forjados** antes de qualquer correção — nada aceito só na leitura.

### 🔴 1. XSS via metadados (P0, estava em PRODUÇÃO)
`row()` interpolava `val` em HTML sem escape, e a linha 545 passava
`r.exif.fields[k]` — texto cru vindo do arquivo. **Reproduzido:** JPEG com
`Make = <img src=x onerror=alert(1)>` produzia a tag intacta no DOM.

Correção de duas peças:
- `row()` escapa **sempre**; markup interno legítimo migra para `rowHTML()`,
  tornando a decisão visível na chamada.
- `escapeHTML()` passou a escapar **aspas** (`"` e `'`) além de `& < >` — dado
  do arquivo também é interpolado dentro de atributos, onde uma aspa solta
  fecha o atributo e abre espaço para um handler.

**Vetor que a auditoria não viu:** `r.lsb.decodedSample` — conteúdo
**decodificado do próprio arquivo** — também ia cru para o HTML. Escapado.
(`decodedMsg` já usava `textContent`, correto.)

**Correção técnica à auditoria:** `<script>` via `innerHTML` **não executa** nos
navegadores. O vetor real é handler de evento (`onerror`), que é o que passou.

**12º invariante:** `XSS: metadados hostis saem como texto` extrai `escapeHTML`,
`row` e `rowHTML` do HTML construído e roda 6 payloads. Validado por **dupla
injeção de falha** (remover escape da `row`; tirar aspas do `escapeHTML`).
As duas primeiras versões do check tinham falso positivo — procuravam
`onerror=` na string, acusando `&lt;img onerror=...&gt;`, que é o resultado
correto. O invariante certo: nenhum metacaractere cru sobrevive.

### 🔴 2. C2PA "confirmado" sem validação
`text.includes('JUMB')` em qualquer ponto dos bytes bastava. **Reproduzido:**
71 bytes num comentário JPEG → `confirmed=true`, `aiGenerator='Midjourney'`.
E isso alimentava supressão de sinais **moles** de esteganografia.

- **Estrutura, não texto:** nova `findC2PAContainers()` exige o marcador no
  **APP11** (JPEG) ou chunk **caBX** (PNG), que é onde a norma põe o JUMBF.
- **Renome:** `confirmed` → `manifestDetected` em 13 pontos. O nome mentia.
- **Textos (EN+PT):** de "prova criptográfica" para "encontrou a declaração,
  não conferiu a assinatura"; badge de `CONFIRMADO — IA CERTIFICADA` para
  `MANIFESTO DE IA DETECTADO`.

**Discriminação verificada:** APP11 legítimo → detecta; comentário forjado →
não; arquivo limpo → silêncio.

**Validação criptográfica real → F16 no ROADMAP.**

### 🟠 3. Veto de câmera por EXIF não autenticado
Dois defeitos:
- **Código contradizia o próprio comentário.** O comentário dizia "Make + Model
  + ExifIFD"; o código fazia `Make || Model`, **descartando o ExifIFD** que a
  linha do tag 0x8769 já havia detectado. Agora exige os três.
- **Teto absoluto de 15** virava veredito a partir de texto forjável. Agora
  atenua proporcionalmente (`score≥70 → max(15, score*0.45)`): EXIF pesa, mas
  não apaga sinal de pixel forte.
- **Texto removido:** "firmware de câmera não é forjável por IA" — falso, em
  duas línguas. Substituído por "EXIF é escrito por software e não é
  autenticado".

### Frase final do harness
De "TODOS OS N TESTES PASSARAM — seguro para build/deploy" para "INVARIANTES
PASSARAM — build consistente para deploy", com ressalva explícita de que **não
é suíte de segurança**. A auditoria estava certa: os invariantes provam
consistência de build, não segurança do software.

### Validação
Harness **12/12**, i18n **694/694**. Três achados reproduzidos e re-testados
contra os mesmos arquivos forjados. Controle negativo em C2PA legítimo.

---

## v2.41.0 — 2026-08-11
**Licença GPL-3.0 e código-fonte publicado**

Fecha a F14. O repositório está no ar: **github.com/rickschaves/stegostudio**

### A dívida que existia
O rodapé exibia **"Opensource Code"** como texto solto — sem `href`, sem licença
nomeada, sem repositório por trás. **Afirmação sem justificativa visível, que é
exatamente o que tratamos como bug em qualquer outro texto da interface.**

### O que mudou
- **`LICENSE`** — texto canônico da GPL-3.0 (copiado de
  `/usr/share/common-licenses/GPL-3`, não transcrito).
- **Rodapé** (EN+PT) — nomeia a licença e o endereço do código.
- **Aviso de copyright no artefato** — `Copyright (C) 2026 RASC` + termos da GPL
  no topo do bloco de script. **O HTML único É a distribuição**, então o aviso
  precisa viajar dentro dele, não só no repositório.
- **`README.md` público** — reescrito; o anterior documentava o Pro Backend
  removido. Abre com o que a ferramenta faz e **fecha com o que ela não faz**,
  encaminhando ao Aletheia.
- **`.gitignore`** — barra binários reconstruíveis (`src/fonts/`, `deploy/`,
  `dist/`), o backend inteiro e os documentos internos (roadmap, contextos).

### Por que GPL e não MIT
A ferramenta existe para que a pessoa possa **auditar o que roda na máquina
dela**. Um derivado fechado destrói essa garantia. A GPL funciona bem neste caso
específico: o JS é **entregue ao navegador de cada visitante**, o que é
distribuição — o buraco do SaaS não se aplica. E é reversível: autor solo pode
relicenciar para MIT depois; o contrário não.

### 🔒 Segredo removido antes da publicação
A chave de API morta do Modo Pro estava em `STEGO_STUDIO_CONTEXTO_ORIGINAL.md`.
O `.gitignore` já a excluía, mas **depender de configuração para não vazar
segredo é frágil** — um `git add -f` bastaria. Substituída por placeholder.
**Regra: segredo não se protege com .gitignore; se remove do conteúdo.**

### A asserção offline pegou o autor pela SEGUNDA vez
`<https://www.gnu.org/licenses/gpl-3.0.html>` no aviso de licença fez o build
recusar publicar. Um comentário não busca nada — mas **a regra lê texto, não
intenção**, e afrouxá-la para acomodar um caso confortável é como asserções
morrem. Reescrito sem esquema. Primeira vez foi o link do Aletheia (v2.40.0).

### Validação
Harness **11/11**, i18n **694/694**, build **874.603 bytes**. Repositório
verificado no ar: público, GPL-3.0 detectada pelo GitHub, README renderizado,
sem arquivos de backend.

---

## v2.40.0 — 2026-08-11
**Remoção do Modo Pro: a ferramenta passa a ser offline sem exceção**

Decisão do Rick (11/08/2026): o Modo Pro era o único ponto que contradizia a
identidade da ferramenta, e na prática o servidor quase nunca subia.

### O que saiu
`src/pro.js` (400 linhas) deletado. Com ele:
- `PRO_BACKEND_URL` / `PRO_API_KEY` / health check contra `api.stegostudio.com`
- `ProState` e toda a fase neural do `main.js` (`callProBackend`,
  `renderNeuralSection`, `startProAnim`/`stopProAnim`, re-consolidação neural)
- badge PRO + tooltip no `template.html`; 34 blocos de CSS; 20 chaves i18n
  (10 pares EN/PT); `detectProBackend()` no `files.js`; linha de status no
  `terminal.js`

**Efeito colateral resolvido:** a chave de API e a URL do backend saíram do HTML.
Elas nunca foram segredo — o próprio código documentava que serviam de
quebra-molas contra bots, com rate limiting da Cloudflare como defesa real — mas
agora a questão simplesmente não existe, junto com toda a discussão de licença
vinculada ao Aletheia.

### ⚠️ A armadilha que quase levou junto
`renderAdversarialWarning()` e `renderStegomalwareWarning()` moravam no
`pro.js`, **mas nenhuma das duas é neural nem depende de servidor** — operam
sobre texto já extraído, no navegador. Apagar o módulo inteiro teria removido em
silêncio a detecção de stegomalware. Extraídas para **`src/warnings.js`** antes
da remoção, junto com `CALIBRATION_MODE`. Os detectores continuam onde sempre
estiveram (`detectAdversarialContent` em `forensics.js`, `detectStegomalware`
em `decoder.js`); o módulo novo só apresenta.

Contagem de módulos permanece **16** (`pro.js` → `warnings.js`).

### 🐛 A asserção offline tinha um furo
`build.js` recusa publicar se houver dependência de rede. Mas a exceção era
`/schema\.org|w3\.org|ns\.adobe\.com|stegostudio\.com|npmjs\.com/` — padrão
solto, sem âncora, que casava **qualquer** subdomínio. `api.stegostudio.com`
passava direto. **O build anunciava "0 dependências de rede em runtime" enquanto
havia uma, à vista, há versões.**

Agora ancorado a formas exatas. Verificado por tabela:

| URL | antes | agora |
|---|---|---|
| `https://api.stegostudio.com` | ✅ passava | ❌ barrada |
| `https://stegostudio.com/` | ✅ | ✅ |
| `https://www.stegostudio.com/og-image.png` | ✅ | ✅ |
| `https://evil-stegostudio.com` | ✅ passava | ❌ barrada |
| `https://stegostudio.com.attacker.net` | ✅ passava | ❌ barrada |

**A regra nova pegou o próprio autor:** ao creditar o Aletheia eu pus um
`<a href>` para o GitHub e o build recusou na hora. Um link não é dependência de
runtime — mas num arquivo offline ele é inútil de qualquer forma, então virou
texto. A asserção estar estrita o bastante para me barrar é o comportamento
desejado.

### Texto de Limitações reescrito (EN + PT)
Antes: "não detectamos HILL/UNIWARD no navegador — para isso existe o modo Pro".
Agora: **não detectamos, ponto**; o limite é permanente; ausência de detecção
não é evidência de imagem limpa; e quem precisa desse nível é encaminhado ao
**Aletheia, de Daniel Lerch (MIT)** — que é a ferramenta que o backend removido
de fato usava. Crédito que faltava, agora explícito.

### Validação
Harness **11/11**, i18n **694/694**, build **871.753 bytes** (era 890.822 —
menos 19 KB). Zero resíduo de `PRO_API_KEY`, `PRO_BACKEND_URL`,
`api.stegostudio.com`, `ProState` ou `callProBackend` em `src/`, `template.html`
e `build.js`.

---

## v2.39.0 — 2026-08-11
**F9 fatia 2: impressão digital de FERRAMENTA (CONFIRMADO vs INDÍCIO)**

Fecha a pendência aberta desde a v2.35.0.

### O painel
`renderToolprint()` em `results.js`, host `#toolprint-panel`. **Só aparece
quando `decodedMsg` é nulo** — decisão do Rick: extração bem-sucedida já é a
prova mais forte, repetir vira ruído.

Dois níveis, separados por **quatro sinais independentes** (o Rick é daltônico,
cor nunca decide sozinha):
| | ícone | palavra | borda | cor |
|---|---|---|---|---|
| CONFIRMADO | `✓` | "Confirmado" | 4px sólida | `--enc` |
| INDÍCIO | `?` | "Indício" | 2px tracejada | `--dim` |

Remova a cor e os dois continuam separáveis.

### CONFIRMADO — Steghide via magic
`shIdentifyJpeg()` estava escrita e **nunca havia sido chamada**. Auditoria
explicou por quê: no caminho do Decoder ela é redundante com `shExtractCore`,
que já testa o mesmo magic. **O valor está na janela "magic bate, extração
falha"** — e essa janela é grande.

O magic vive em posições derivadas da senha, então casar é **prova**. Ligada
apenas no ramo em que todos os motores já falharam.

### Nomear a cifra que nos derrotou
`shIdentifyJpeg()` passou a devolver `algoName`, `modeName` e `supported`.
**Enums mapeados por MEDIÇÃO** (embed real com steghide 0.5.1, um por
combinação), não por documentação — ver F12 no ROADMAP para as tabelas.

O cabeçalho tem 5 bits de algoritmo **e 3 de modo**; o modo era descartado
(`// EncMode ignorado`). Implementamos 2 das ~129 combinações. Agora a interface
diz o par exato: "cifrada com `blowfish/CBC`, e este decodificador implementa
apenas sem-cifra e rijndael-128/CBC".

### 🐛 shInflate — promessa rejeitada sem tratamento
`w.write(bytes)` e `w.close()` sem `await` nem `.catch()`: quando o fluxo
falhava, rejeitavam **depois** da função retornar → `unhandledrejection` no
navegador. Reproduzível com Steghide em ECB e senha certa. Corrigido com
`.catch(()=>{})` nas duas.

### Validação (steghide 0.5.1 real, instalável no sandbox)
- **12/12** algoritmos nomeados corretamente, todos com `supported:false`.
- **0 falsos positivos** em 4 controles: capa limpa (com e sem senha), senha
  errada em CBC e em blowfish.
- **Painel:** visível em blowfish, CTR e sem-senha; **oculto** quando a extração
  funciona, na capa limpa e com senha errada.
- **0 promessas vazadas** (era 1 antes do conserto).
- Harness **11/11**, i18n **704/704**, validado a partir do HTML construído.

### Fora de escopo (→ F12 no ROADMAP)
Implementar as outras cifras. O degrau barato (7 modos do rijndael-128, sobre o
AES que já temos) e o caro (17 algoritmos em JS do zero) estão dimensionados lá.

---

## v2.38.2 — 2026-08-10
**Blindagem do build: a injeção parou de comer caracteres**

Defeito de pipeline, invisível no produto e silencioso por natureza.

### O defeito
`build.js` montava o HTML único com `.replace(marcador, conteudo)` passando o
conteúdo como **string**. Nessa forma o JavaScript interpreta `$$`, `$&`,
`` $` ``, `$'` e `$<nome>` como padrões de substituição e os consome. O
`hash-wasm.js` tem **3 ocorrências de `$$`** — no formatador da string PHC do
Argon2 (`` `$argon2${tipo}$v=19$${C}$${...}` ``) — e as três eram engolidas a
cada build. Sem exceção, sem aviso, sem diferença observável na ferramenta.

### Por que não quebrou nada
`crypto.js` chama `hashwasm.argon2id({… outputType:'binary'})`. O formatador
afetado nunca é executado. Auditados os 16 módulos e o `styles.css`: **zero**
ocorrências de padrões `$`. O dano era latente, não ativo.

### A correção
Substituição por **função**, que entrega o texto literal:

```js
.replace('/*BUILD:STYLES*/',   () => css)
.replace('/*BUILD:HASHWASM*/', () => hashwasm)
.replace('/*BUILD:APP*/',      () => app)
```

Saída de 876.292 → 876.295 bytes: exatamente os 3 `$` restaurados.

### O invariante novo (harness 10 → 11)
`injeção literal dos blocos (sem consumo de $)` — confere `html.includes(fonte)`
para os 18 blocos (16 módulos + `styles.css` + `hash-wasm.js`) e nomeia quem
divergiu. **Confirmado por regressão deliberada:** reintroduzido o `.replace`
por string, o teste falha apontando `hash-wasm.js`; restaurado, 11/11.

### Lição registrada
O defeito produzia ferramenta funcional e bateria de testes limpa — por isso
sobreviveu. Toda transformação do build precisa de invariante que compare
**saída contra fonte**, não só que a saída seja sintaticamente válida.

---

## v2.38.1 — 2026-07-20
**Dois consertos vindos de teste de campo do Rick**

- **Redimensionamento à toa (`rbTargetSize`):** o modo resistente cortava toda
  imagem para múltiplo de 8 (`w - w%8`), reduzindo 460×460 para 456×456 mesmo
  dentro do envelope. O encoder já trata blocos 8×8 parciais nas bordas (a DCT
  direta replica a borda), então o corte era zelo desnecessário. Agora, dentro
  do envelope, a dimensão sai **idêntica**; o múltiplo de 8 só se aplica quando
  há redução real. Validado: 460×460→460×460, 463×457→463×457, 1200×1600→808×1080.
- **Copiar-colar destrói a mensagem resistente (não é bug, é física):** ao copiar
  uma imagem, o SO a decodifica para bitmap e a reencoda ao colar — recompressão
  a mais, antes de a ferramenta receber qualquer coisa. Os coeficientes DCT
  originais já se perderam. Novo `decStatusRobustLostPaste`: quando o Decoder vê
  a assinatura estatística do modo robusto mas não extrai nada, explica a causa
  provável e orienta a **salvar o arquivo** em vez de copiar. O guia rápido
  (`encGuideWa`) recebeu o mesmo aviso.

---

## v2.38.0 — 2026-07-20
**Fatia A: o Analyzer acusa o modo robusto — F4 CONCLUÍDA**

`robustSignature(dec)` em `robust.js`. Detecta o QIM em imagem de terceiro, sem
senha e sem extração.

### O sinal
O QIM força cada coeficiente usado a um ponto do reticulado, e zero quase nunca
é um deles — a taxa de zeros na banda 6–21 desaba. Sozinha ela não serve: capas
limpas variam de **14% a 74%** de zeros nessa banda. A razão contra a banda
vizinha (22–35) **da mesma imagem** cancela o conteúdo da capa.

### Calibração (46 imagens limpas)
5 capas × 7 qualidades (q60…q100) + 10 fotos reais de WhatsApp, Facebook,
Instagram e X.

| | razão |
|---|---|
| menor entre as limpas | **0,147** |
| maior em stego 100% cheio | **0,092** |
| limiar adotado | **0,120** |

**Resultado: 0 falsos positivos em 46 · 5/5 detectados a 100% de preenchimento.**

### Limite honesto, dito na própria flag
| taxa | acusados |
|---|---|
| 100% | 5/5 |
| 50% | 0/5 (menor razão 0,150) |
| ≤25% | 0/5 |

Abaixo de ~50% o sinal cai dentro da variação natural entre capas. Isso é
consequência da tese central do projeto aplicada a nós mesmos: **taxa de
embutimento domina detectabilidade**. Por isso o peso no score é **15** —
menor que o de payload avariado (20) e bem menor que o de extração confirmada
(40). É indício, e dos fracos. Silêncio dele **não é atestado de limpeza**.

### Também nesta versão
- **Guia rápido reescrito** (`encGuide3`, `encGuideDecoy`, `encGuide5`,
  `encGuideTip`, `encGuideWa`). O `encGuideWa` mandava enviar como arquivo e
  nunca como foto — conselho que o modo resistente tornou obsoleto.

---

## v2.37.4 — 2026-07-20
**O aviso da mensagem alternativa migra para o formulário**

Ideia do Rick, e melhor que a implementação anterior: o aviso de que a isca só
existe no PNG aparecia apenas no painel de resultado — ou seja, **depois** que a
escolha já tinha sido feita.

- Novo `decoyPngOnlyWarn`, dentro de `#enc-decoy-fields`, logo abaixo da caixa
  de digitação da mensagem alternativa. Como o bloco inteiro é mostrado e
  escondido pelo interruptor da negação plausível, o aviso aparece e some junto
  — **sem uma linha de JS**.
- O texto não apenas informa a limitação: diz o que fazer com ela (guardar e
  enviar o PNG, se a negação plausível é o objetivo).
- O aviso do painel de resultado (`rbDecoyNote`) foi mantido: um alcança quem
  está decidindo, o outro alcança quem está baixando.
- `id="enc-decoy-pngonly"` entrou na lista de alvos de DOM do `test.js`.

### Também na v2.37.4 (mesma versão, a pedido do Rick, para não poluir o histórico)
- **A área de saída é limpa ao clicar em codificar.** Antes, as imagens do
  encode anterior ficavam na tela até as novas nascerem — e por ~1 s pareciam
  ser o resultado novo.
- A limpeza virou uma função única, `resetEncOutputs()`, usada nos **dois**
  caminhos (clique em codificar e troca da imagem portadora). Antes eram duas
  listas paralelas de elementos a esconder, e listas paralelas divergem na
  primeira coisa que se adiciona a uma delas — foi exatamente o que aconteceu
  quando o modo robusto entrou.
- A âncora de rolagem passa a ser sempre o placeholder, que é onde a saída nova
  vai nascer. A lógica de escolher entre painel e placeholder ficou obsoleta.

- **O aviso da mensagem alternativa nunca aparecia.** Reaproveitei a classe
  `.key-warning`, que **nasce com `display:none`** — os avisos de senha são
  alternados por JS. Um aviso estático, cuja visibilidade vem do bloco pai,
  ficava invisível para sempre. Criado o modificador `.key-warning.kw-static`.
  Varredura confirmou que os outros três avisos da ferramenta são alternados por
  JS e estão corretos.
- **Guarda no `test.js`:** falha se o aviso estático perder o `.kw-static` ou se
  a regra sumir do CSS. É a segunda vez na mesma sessão que uma visibilidade
  dependente de padrão de CSS passa despercebida — não dá para renderizar aqui,
  então a asserção mira a causa.

⚠️ Como a versão não foi bumpada, **existem três arquivos `v2.37.4` diferentes**.
Vale o mais recente; descarte os anteriores.

---

## v2.37.3 — 2026-07-20
**Varredura de textos: tudo passa a bater com o que a ferramenta faz**

Depois do modo robusto entrar, a ferramenta continuava se descrevendo como
só-PNG em vários lugares — inclusive nos primeiros que um usuário novo lê.

- **`termWillConvertPng`** anunciava conversão para PNG. Reescrito para as duas saídas.
- **`ticker`** (2 itens): "a saída é sempre um PNG sem perda" e "envie como
  arquivo para preservar os LSBs" — os dois falsos agora. Reescritos.
- **`encKeyWarn`**: falava só dos LSBs; a senha protege as duas imagens.
- **`encGuide1`** e **`helpS2b`**: reescritos para o par de saídas.
- **`helpDecB`**: o Decoder lê o modo resistente — agora está na lista.
- **`tagline1`** e a meta description: definiam a ferramenta como LSB.
- **Seção nova na ajuda** (`helpRbTitle` + `helpRbA..E`): as duas imagens, o
  envelope de 1080 px, o Reed-Solomon, a origem de campo dos parâmetros, e o
  limite da mensagem alternativa. i18n 687 → 693 chaves.
- **CSS:** `.rb-head` usava `var(--line)`, que **não existe** na paleta. O
  navegador descartava a declaração de borda e sobrava o espaço reservado pela
  margem, afastando o título da imagem. Corrigido para `--border`, com o respiro
  delegado ao `--out-gap`.

---

## v2.37.2 — 2026-07-20
**Texto secundário legível, e um ritmo só para os painéis**

- **Contraste (medido, não estimado):** `--dim` era `#3d4560` e media **1,87:1**
  contra `--surface2`, 1,99:1 contra `--surface` e 2,10:1 contra `--bg`. O piso
  da WCAG para texto normal é **4,5:1** — errava por mais de 2×. Elevado para
  `#7c85a3`: **4,84 / 5,16 / 5,44:1**. Mantém o tom azulado e o papel de tom
  secundário. Afeta as notas do programa inteiro (31 usos), não só os painéis
  novos. A única ocorrência não-textual (uma borda) foi fixada no tom antigo,
  para nada mudar fora do texto.
- **Espaçamento:** o `#rb-body` é um contêiner intermediário entre o
  `.download-wrap` e os blocos — o `gap` do flex parava nele, e por isso o botão
  de download e o relatório de trocas encostavam nos vizinhos enquanto os
  demais respiravam. Criado `--out-gap`, aplicado ao contêiner externo, ao
  `#rb-body` e às listas de estatística das duas colunas.

⚠️ **Nota de processo:** a v2.37.1 foi empacotada duas vezes com conteúdo
diferente (a segunda com a correção do vazamento dos painéis). Isso quebra a
regra de que versão identifica build. O arquivo válido é o desta versão em
diante; qualquer `v2.37.1` baixado antes deve ser descartado.

---

## v2.37.1 — 2026-07-20
**O Analyzer enxerga o que o Decoder lê**

Ajustes de campo depois do primeiro teste real da v2.37.0 (Rick, com postagem
pelo WhatsApp: mensagem recuperada com **zero bytes corrigidos** pelo RS).

- **Conserto de fundo:** o score de ameaça só consultava `studio.hasHeader`, do
  LSB. Um JPEG com payload robusto **extraído** dava `threat: 0` com
  `decodedMsg` preenchido — justificativa visível sem número. Agora
  `studio.robust === true` soma 40 (como o header do LSB) e marca stego forte;
  `'damaged'` soma 20 como **indício**. Mesmos dois pontos corrigidos em
  `consolidateVerdict` (`looksReal` e `structuralCorroborates`).
- **Layout:** as duas saídas passam a ficar lado a lado, cada bloco
  autocontido (imagem, download, estatísticas, relatório). As dicas de escolha
  de imagem saíram para baixo das duas, centralizadas.
- **Nota de redimensionamento:** encurtada e movida para dentro do bloco
  "Tamanho de saída", junto do número que explica.
- **Mensagem alternativa:** é embutida nos pixels (`embedDecoyTail`), e a imagem
  resistente é gerada da capa LIMPA — logo ela nunca carregou a isca. Não era
  falha de extração. A interface agora declara isso no painel resistente.

### Correção da própria v2.37.1 (mesma sessão, antes do deploy)
- **Os painéis apareciam antes do encode.** A regra `.out-pair > .download-wrap`
  introduzida no layout novo tem especificidade 0,2,0 e vencia o
  `.download-wrap{display:none}` (0,1,0) — o bloco ficava visível com a página
  ainda vazia. Passou a exigir `.visible`.
- As dicas de escolha de imagem, que antes viviam DENTRO do bloco escondido,
  ficaram soltas ao serem movidas para fora. Agora têm visibilidade própria,
  ligada ao resultado.
- **Reset ao trocar a imagem portadora** só escondia o bloco do PNG; o bloco
  resistente e as dicas ficavam órfãos na tela. Corrigido.
- **Guarda de regressão no `test.js`:** especificidade de CSS não é testável sem
  navegador, então o teste passou a mirar a causa conhecida — falha se
  `.out-pair > .download-wrap` aparecer sem `.visible`, ou se `.enc-tips-solo`
  não começar oculta.

---

## v2.37.0 — 2026-07-19
**Modo robusto: duas imagens na saída (F4, Fatia I)**

O Encoder passa a entregar **duas imagens**, as duas com a mesma mensagem:
a **mais furtiva** (PNG/LSB, o comportamento de sempre) e a **mais resistente**
(JPG, payload nos coeficientes DCT via QIM), que sobrevive à publicação em rede
social. Nenhuma é melhor — elas trocam coisas diferentes, e a interface diz isso.

### Motor (fatias W1, W2, W4 + DCT direta)
- `imageToJpegCoefficients` — DCT direta. Validada contra a libjpeg: nenhum
  coeficiente difere por mais de **1** em nenhum bloco; qualidade +0,01 dB.
- `robust.js` — QIM com dither **inteiro** (múltiplo do passo de quantização),
  Reed-Solomon GF(256) entrelaçado, protocolo com cabeçalho de parâmetros fixos.
- Saturação em |v| ≤ 1023, limite do JPEG baseline descoberto na W1.

### Parâmetros, todos vindos de medição de campo
- **Envelope 1080 px** — acima disso as plataformas redimensionam e encolher
  15% já destrói 25% dos bits.
- **Δ = 80** — no Facebook, Δ=64 ainda deixa 0,15% de erro.
- **nsym = 32** — AES-GCM morre com UM bit trocado; ECC não é opcional.
- **Tabela de emissão q80** — quanto mais grossa, MENOR o custo do embutimento
  (5,5 dB em q95 contra 1,4 dB em q80, e arquivo 45% menor).
- Capacidade útil: **20,7 KB** em 1080×720. Emissão ~1 s, leitura ~250 ms.

### Interface
- Relatório de **dois eixos** (resistência ao canal · discrição) em vez de nota
  única, para que as duas saídas não sejam comparadas na mesma régua.
- Quando a mensagem não cabe, diz com números quanto precisa e quanto cabe, e
  aponta o caminho alternativo. Nunca gera imagem quebrada.
- O Decoder lê o modo robusto automaticamente e distingue **avariado** de
  **ausente** — "há uma mensagem aqui, mas não sobreviveu ao caminho".

### Validação
- Protocolo completo sobrevive às tabelas reais de WhatsApp, Facebook e
  Instagram, e ao X. Ida e volta com Argon2id + AES-GCM + deflate: íntegra.
- Senha errada → recusa, sem vazamento. Imagem limpa → sem falso positivo.
- Reed-Solomon: 1.200/1.200 corrigidos e **600/600 recusaram** quando o estrago
  passa da capacidade. Nunca devolve mensagem errada como se fosse certa.
- i18n 684/684. O teste de eventos ganhou os 7 alvos de DOM do modo robusto.

---

## v2.36.1 — 2026-07-19
**Fundação: o escritor JPEG (fatia W1 da F4)**

A camada de coeficientes DCT era só de leitura desde a F3-B. Agora a ferramenta
também **escreve**: `encodeJpegCoefficients(dec, opts)` reconstrói um JPEG
baseline válido a partir dos coeficientes quantizados, possivelmente modificados.
É a peça sem a qual o Modo Robusto não existe — ele precisa gravar o payload QIM
direto nos coeficientes, sem passar por pixels, onde ele se perderia.

- **Validação dupla, 11 amostras:** round-trip pelo nosso decoder E leitura pela
  **libjpeg** (`coefdump` + `djpeg`). Zero divergência de coeficiente em todas.
  Amostras: 4:2:0, 4:2:2, 4:4:4, tons de cinza, dimensões ímpares, restart
  markers e arquivos reais do Steghide.
- **Casos de uso reais testados:** entrada progressiva → saída baseline (0
  divergências), 2.048 blocos com coeficientes deliberadamente modificados (0
  divergências), e valores extremos.
- **Tabelas de Huffman ótimas** (algoritmo da libjpeg, com achatamento para 16
  bits) em vez das padrão do Annex K: arquivos ~11% menores e, mais importante,
  **sem a assinatura de codificador ingênuo** — todo codificador real otimiza.
- **Falha alto e claro:** coeficiente fora da faixa do baseline (|v| > 1023) faz
  o escritor recusar com mensagem acionável, em vez de corromper em silêncio.
  É uma restrição real que o embutidor QIM vai ter de respeitar (saturar).
- **Higiene:** o relatório forense passa a registrar se o JPEG era progressivo.
  Sem isso não dava para saber, lendo um relatório, qual caminho foi usado.
- **Nada muda para o usuário.** Isto é fundação; o Modo Robusto ainda está sendo
  construído.

**Bug pego pelo ritual:** a validação a partir do módulo passou, mas a partir do
HTML final quebrou (`ZIGZAG is not defined`) — o `node --check` não vê referência
indefinida. Reforça a regra: validar sempre a partir do build final.

---

## v2.36.0 — 2026-07-19
**JPEG progressivo: o leitor DCT finalmente abre**

O leitor de coeficientes DCT recusava JPEG progressivo (SOF2) desde que foi
escrito. O ponto cego pesava mais do que parecia: **Facebook e X publicam
progressivo**. Nessas imagens o Analyzer-JPEG não mostrava nada e o Decoder nem
tentava Steghide ou OutGuess — justamente no **X**, que a medição provou ser a
única plataforma que preserva os payloads byte a byte.

- O leitor agora **acumula os múltiplos scans** de um progressivo, cobrindo os
  quatro casos (DC primeira e refinamento, AC primeira e refinamento), mais
  **EOB runs** e **aproximação sucessiva** (Ah/Al).
- **Validado coeficiente a coeficiente contra a libjpeg** — mesmo método da
  F3-B. **30 casos**: progressivo, progressivo com restart markers, 4:2:0,
  4:2:2, 4:4:4, tons de cinza, dimensões ímpares (37×53, 101×67) e arquivos
  reais do Steghide. Todos os coeficientes de todos os blocos idênticos.
- **A partir do HTML final: 6/6**, incluindo a **extração real de uma mensagem
  do Steghide num arquivo progressivo**, ponta a ponta.
- **Nada mudou para JPEG baseline.** Equivalência provada contra o leitor
  anterior em 11 arquivos, bloco a bloco, ANTES da integração.
- Removidos os textos que diziam que progressivo não era suportado (aviso do
  painel DCT e item dos limites honestos na ajuda) — passariam a mentir. A chave
  i18n `jdctProgressive` virou órfã e foi eliminada: **660 chaves**.

**Oráculo:** os gabaritos da F3-B serviram sem alteração, porque
`jpegtran -progressive` não altera um único coeficiente — o que dá validação
**dupla**: contra a libjpeg e contra o nosso próprio leitor baseline.

---

## v2.35.2 — 2026-07-18
**O aviso de plataforma para de mentir sobre como detectou**

- O texto do aviso tinha **"(identificado pelo nome do arquivo)" escrito fixo**,
  de quando o nome era o único método. Mesmo quando a detecção vinha da
  estrutura, ele insistia em creditar o nome — e ainda contradizia a linha
  acrescentada na v2.35.0.
- Reorganizado: primeiro **o que** foi detectado e **por que isso importa**
  (EXIF removido → veto de câmera não atua → score sintético infla); depois
  **como** foi detectado, listando só os métodos que de fato dispararam.
- **Decode Status em JPEG deixa de repetir a nota** logo acima. Em vez de
  "LSB indisponível", agora informa o que interessa: *"Steghide e OutGuess
  tentados — nada encontrado"*.

Os três pontos vieram do Rick testando a v2.35.1 em produção.

---

## v2.35.1 — 2026-07-18
**Para de esconder o resultado da extração em JPEG**

Num JPEG, o módulo **Protocolo** exibia apenas *"Protocolo STEGO·STUDIO usa LSB
— indisponível em JPEG"* e mais nada. Mas os motores **Steghide** e **OutGuess**
tinham sido tentados assim mesmo, e o resultado deles era **descartado**.

- A linha **Decode Status** agora aparece sempre, inclusive quando o protocolo
  próprio não se aplica.
- Isso também torna verdadeira a nota do painel de coeficientes DCT: ela aponta
  para essa linha, que até agora não existia em JPEG — justamente o formato onde
  a nota é exibida.

**Origem:** terceira vez que o Rick pega o mesmo texto. As duas primeiras
correções mexeram na frase; esta mexeu no que estava faltando na tela.

---

## v2.35.0 — 2026-07-18
**Reconhece a plataforma pelo próprio arquivo (F9, fatia 1)**

A ferramenta agora identifica que uma imagem passou por **WhatsApp**, **Facebook**
ou **Instagram** lendo a **estrutura do arquivo** — tabelas de quantização, tipo
de codificação e subamostragem. Antes isso era deduzido só pelo nome do arquivo,
que some assim que alguém renomeia ou rebaixa a imagem.

- Perfis medidos de imagens reais passadas por cada plataforma (ver
  `MEDICAO_REDES_SOCIAIS.md`). **11/11 nos módulos, 5/5 a partir do HTML final,
  zero falso positivo.**
- O painel de origem agora diz **de onde veio a evidência**: estrutura (sobrevive
  a renomeação) ou nome do arquivo (frágil).
- O parser estrutural funciona em **JPEG progressivo**, ao contrário do leitor de
  coeficientes — e é justamente aí que a identificação mais serve, já que
  Facebook e X publicam progressivo.

**⚠️ X/Twitter ficou de fora de propósito.** A medição provou que ele **não
recomprime**: faz transcodificação sem perda (saída byte a byte idêntica a
`jpegtran -progressive -copy none`), preservando as tabelas da origem. Não tem
assinatura própria — e afirmar que tem gerava falso positivo comprovado em
qualquer JPEG intocado do mesmo editor.

**Correção:** a nota do painel de coeficientes DCT apontava para um "painel de
decodificação" que não existe com esse nome. Agora nomeia os lugares reais da
tela e cobre os dois casos — onde a mensagem aparece quando algo é encontrado, e
onde fica o resultado quando não é. (Achado do Rick, segunda vez que ele pega
esse mesmo texto.)

---

## v2.34.0 — 2026-07-18
**Dizendo com clareza o que faz — e o que não faz (F8)**

Auditoria de toda a cópia visível. A ferramenta ganhou três motores de terceiro,
o Analyzer-JPEG e a correção de "imagem digital ≠ IA" em poucas versões, e o
texto não acompanhou. Seis achados:

**Nova seção na ajuda: "O Decoder — o que ele lê, e o que não lê".** Lista o que
é realmente lido (protocolo próprio, OpenStego, Steghide, OutGuess), o que não é
**com o motivo de cada um** (F5/Westfeld: raro e caro por construção; conteúdo
trancado pela senha de outra ferramenta) e os limites honestos: LSB inaproveitável
em JPEG, progressivo não suportado, e o chi-quadrado dos coeficientes DCT sendo
indicador fraco, não detector.

**Correções de afirmações erradas:**
- O modal dizia que a ferramenta tinha **duas** funções, enquanto o cabeçalho
  logo acima dizia ENCODER · ANALYZER · DECODER.
- A barra rolante afirmava que o investigador profundo *"recupera mensagens de
  qualquer ferramenta"*. Ele não faz isso — varre por texto legível quando não há
  cabeçalho conhecido.
- O painel de coeficientes DCT mandava "usar o Decoder", num app de um botão só
  que já o havia rodado, e citava apenas o Steghide.
- A mensagem do terminal sobre JPEG citava só a extração Steghide.
- A categoria *sintética* podia exibir score sem nenhum sinal explicando, quando
  o veto de gráfico digital limitava esse score.

**Origem dos achados 3 e 6:** perguntas e relatórios de produção do Rick. O item
3 nasceu de "como o usuário usaria o Decoder, se só há um botão?".

---

## v2.33.3 — 2026-07-18
**Mais rápido ainda: uma leitura por análise (F7, ação 1b — frente concluída)**

A v2.33.2 impediu que os dois motores do Decoder repetissem o mesmo trabalho.
Esta termina o serviço: o **Analyzer também** decodificava o mesmo JPEG por
conta própria. Agora a imagem é decodificada **uma vez por análise**, no topo do
fluxo, e o resultado desce para tudo que precisa dele.

- Ganho medido **sobre a v2.33.2**: **-22%** (512×512), **-43%** (Full HD),
  **-25%** (2000×1500).
- **Nada mudou no que a ferramenta encontra ou reporta.** Equivalência 5/5,
  módulo a módulo.
- O caminho do **JPEG progressivo** foi preservado exatamente. Ele depende de o
  decode FALHAR para produzir a mensagem amigável — por isso o fallback
  decodifica de novo quando os coeficientes compartilhados vêm nulos.
- Todas as funções seguem **autônomas**: os parâmetros de coeficientes são
  opcionais e cada uma decodifica sozinha se preciso.

**Descoberta que simplificou o trabalho:** temia-se precisar de um cache com
chave segura entre Analyzer e Decoder. Ao mapear, descobriu-se que eles não são
fluxos separados — são o mesmo botão. Bastou decodificar antes e passar adiante.

---

## v2.33.2 — 2026-07-18
**Decoder mais rápido em JPEG (F7, ação 1)**

Ao ler um JPEG, o Decoder fazia o mesmo trabalho pesado duas vezes: o motor
Steghide decodificava os coeficientes DCT, não achava nada, e o motor OutGuess
decodificava exatamente a mesma coisa do zero. Agora decodifica uma vez e
compartilha.

- Ganho medido: **-18%** (512×512), **-32%** (Full HD), **-21%** (2000×1500).
- **Nada mudou no que o Decoder encontra.** Equivalência provada motor a motor,
  em imagem do Steghide, do OutGuess e limpa: com e sem compartilhamento, os
  resultados são idênticos (6/6).
- As funções dos motores seguem **autônomas**: o parâmetro de coeficientes é
  opcional; sem ele, cada uma decodifica sozinha como antes.

**Origem:** uma pergunta do Rick — "de 1 em 1 não vamos deixar o Decoder lento
demais?". A medição mostrou que o medo já era realidade (2,4 s numa foto limpa
de 2000×1500) e que boa parte era desperdício nosso.

**Ainda na mesa:** o Analyzer (`analyzeJpegDCT`) decodifica o mesmo arquivo uma
terceira vez. Fica para a próxima fatia da F7, porque compartilhar entre os dois
fluxos exige uma decisão de desenho de cache.

---

## v2.33.1 — 2026-07-18
**Imagem digital não é imagem de IA**

Correção de uma afirmação errada da ferramenta, encontrada no próprio marco do
Cicada 3301: a imagem de 2012 recebeu **"IA ALTA 88"** — impossível para a época.

O diagnóstico não foi "sinal errado". Os sinais estavam certos: paleta de 480
cores, entropia 1,86, crominância chapada, sem EXIF. O problema é que **todos
eles dizem apenas "isto não é uma fotografia"** — nenhum é específico de IA. Uma
imagem fotorrealista gerada por IA teria paleta rica e ruído plausível, e
pontuaria BAIXO nesses mesmos sinais. O módulo era, na prática, um detector de
"não-fotográfica" com rótulo de "IA".

- **Novo veto de gráfico/render digital, que funciona também em JPEG.** O veto
  de arte vetorial (v2.13.8) exigia ruído quase nulo e por isso só valia em PNG —
  a compressão JPEG destrói esse critério. O novo usa paleta pequena, entropia
  muito baixa e crominância chapada, que sobrevivem à compressão.
- Quando dispara, limita o score de IA a BAIXA, **explica o porquê** e joga o
  peso para **arte digital**, não para "sintética/IA".
- **Prova dura continua valendo:** manifesto C2PA ou EXIF nomeando um gerador de
  IA desligam o veto. Heurística não derruba evidência.
- Detecção de IA fotorrealista, fotografia e screenshot seguem inalteradas.
- Custo assumido: ilustração *flat* genuinamente de IA passa a ser limitada a
  BAIXA. Os sinais continuam todos visíveis — o score é limitado, não zerado.

---

## v2.33.0 — 2026-07-18
**Decoder agora lê OutGuess (F5)**

Terceiro motor de terceiro do Decoder — e o que destrava casos famosos, já que
o **Cicada 3301** usa OutGuess.

- Funciona **sem senha** (o OutGuess usa a chave default `"Default key"`) e
  **com senha**, quando houver.
- Reimplementado da spec/fonte oficial (BSD — lógica reimplementada, sem copiar
  código), validado contra amostras reais do binário: 10/10 em mensagens de 5 a
  800 bytes, com e sem chave.
- **Sem falso positivo:** o OutGuess não tem magic próprio, então o motor só
  reporta uma extração que pareça conteúdo real. Validado: imagem limpa → nada,
  senha errada → nada, JPEG do Steghide → nada (não confunde os motores).

**Descobertas de engenharia reversa** (cravadas testando contra o binário):
são **dois streams RC4 independentes** — `MD5("Seeding"+chave)` escolhe as
posições, `MD5("Encryption"+chave)` cifra os dados; a chave default não é vazia,
é a string `"Default key"`; o bitmap percorre os coeficientes em ordem de **MCU**
(entrelaçada, diferente do Steghide) pulando os de valor 0 e 1; e os dados são
decifrados com o keystream **reiniciado do zero** (não continuando após o
cabeçalho).

**Caso de borda tratado com honestidade:** o OutGuess 0.4 tem um bug em que o
iterator ultrapassa a capacidade da imagem e o último byte da mensagem nunca
chega a ser embutido (o embed tem guarda e para). O binário oficial "recupera"
esse byte lendo memória não inicializada. Nós recuperamos o resto e **avisamos**,
em vez de exibir um caractere corrompido como se fosse real.

Com OpenStego, Steghide e OutGuess, o Decoder cobre as três ferramentas de
terceiro mais comuns.

### ⭐ Marco: Cicada 3301 decodificado (18/07/2026)
A primeira imagem do **Cicada 3301** (2012) foi decodificada pela ferramenta em
produção. A mensagem saiu **completa** — o book code e a URL do subreddit
`r/a2e7j6ic78h0j` — com status `recovered from OutGuess ✓` e sem truncamento.

Dois detalhes que valem registro:
- O módulo de **stegomalware** pegou a URL *dentro do payload recuperado*: o
  pipeline inteiro operou junto (formato → motor certo → extração → análise).
- O **Analyzer-JPEG deu `noFirstOrderAnomaly`** (chi²/par = 5,52) numa imagem
  com 500+ bytes embutidos — e esse é o resultado CERTO. O OutGuess usa *foiling*
  estatístico que preserva o histograma DCT justamente para derrotar o chi².
  A decisão da v2.32.0 de rotular o chi² como indicador FRACO, em vez de
  vendê-lo como detector, foi validada contra um adversário desenhado para
  enganá-lo.

---

## v2.32.1 — 2026-07-17
**Correções: detecção de JPEG por magic bytes, progressivo, terminal**

Três correções a partir de feedback de uso real:
- **Detecção por assinatura (magic bytes):** o formato passa a ser detectado
  pelos primeiros bytes do arquivo, não só extensão/MIME. Arquivos `.jfif`,
  `.jpe`, JPEGs com MIME errado/ausente, ou até um PNG com nome `.jpg`, agora
  são classificados corretamente. Isso destrava a análise DCT + Steghide para
  esses casos (antes eram tratados como lossless e não recebiam análise JPEG).
- **JPEG progressivo:** mensagem clara e amigável (a análise DCT hoje é para
  baseline; progressivo está planejado), em vez de um erro cru. Strings,
  metadados e IA seguem funcionando.
- **Terminal:** não avisa mais que JPEG está "indisponível" — reflete que
  análise DCT, Steghide, IA e metadados funcionam para JPEG.

---

## v2.32.0 — 2026-07-17
**Analyzer inspeciona coeficientes DCT do JPEG (F3-C)**

Para JPEG, o Analyzer deixa de dizer só "indisponível" e passa a ler os
coeficientes DCT quantizados reais (via a base `jpeg_dct.js`), reportando:
- estatísticas descritivas: não-zeros, valores distintos, média |coeficiente|,
  distribuição por banda de frequência (baixa/média/alta);
- qui-quadrado de primeira ordem, **rotulado honestamente** como indicador
  fraco — pega Jsteg / alta taxa, mas NÃO Steghide/OutGuess/F5.

**Decisão de honestidade (documentada):** a investigação mostrou que o
qui-quadrado clássico não detecta o Steghide (payload <0,1% dos coeficientes,
espalhado). Em vez de fingir um "detector", o módulo mostra o que sabe e diz
com todas as letras que ausência de sinal ≠ imagem limpa, apontando o Decoder
(que extrai de verdade) como o caminho forte para Steghide. Validado nos dois
sentidos: silencioso para Steghide (sem falso positivo), dispara para Jsteg de
alta taxa simulado (chi/par 22.8 → 0.36).

Isso responde à lacuna que motivou a frente: fotos JPEG (ex. a foto real de
celular) passam a ter análise útil e honesta, não só metadados/EXIF.

---

## v2.31.0 — 2026-07-17
**Decoder agora lê Steghide (BMP + JPEG/DCT, com AES-256)**

Segundo motor de terceiro do Decoder, e o mais elaborado até agora. Recupera
mensagens escondidas pelo **Steghide** (0.5.x):

- **BMP** (domínio espacial) e **JPEG** (domínio DCT — coeficientes, não pixels).
- **AES-256-CBC**, que o Steghide usa por padrão: informando a senha, a mensagem
  é recuperada com nome de arquivo e tudo. Arquivos sem senha são lidos
  automaticamente.
- Núcleo reimplementado do zero da spec/fonte oficial (GPLv2, sem copiar código),
  validado contra amostras reais do binário: BMP sem cifra 3/3, BMP+AES 4/4,
  JPEG (sem cifra + AES) 5/5, integrado com WebCrypto 4/4.

**Descobertas de engenharia reversa** (não documentadas; cravadas testando
contra o binário): o "rijndael-128" do Steghide é na verdade **AES-256** (o 128
é o tamanho de bloco); a chave é `MD5(pw) || MD5(pw || MD5(pw))`; e o Steghide
cifra por padrão mesmo sem senha.

**Base compartilhada JPEG/DCT (`jpeg_dct.js`):** esta versão introduz um motor
que lê coeficientes DCT quantizados direto no navegador (reimplementa o
essencial do `jpeg_read_coefficients` da libjpeg), validado coeficiente a
coeficiente contra a libjpeg. É a fundação para a futura esteganálise em JPEG
(F3-C) e o Modo Robusto (F4). Primeiro consumidor: o próprio Steghide-JPEG.

---

## v2.30.0 — 2026-07-16
**Decoder agora lê imagens do OpenStego (RandomLSB)**

Primeiro motor de terceiro do Decoder. Recupera mensagens escondidas pelo
**OpenStego** (v0.8.x, algoritmo RandomLSB), não só o formato próprio do
STEGO·STUDIO:

- Imagens **sem senha** são lidas automaticamente (o OpenStego usa uma seed fixa
  quando não há senha).
- Imagens **com senha** são recuperadas quando o usuário informa a senha (no
  OpenStego, a senha por padrão só embaralha as posições — não cifra).
- Quando a imagem usa a **cifra AES opcional** do OpenStego, o Decoder identifica
  a origem honestamente e orienta a abrir no OpenStego com a senha, em vez de
  fingir extração.

Algoritmo reimplementado a partir da especificação/fonte oficial (GPLv2 — lógica
reimplementada, sem cópia de código), validado contra amostras reais geradas pelo
openstego.jar. Inclui uma MD5 síncrona embutida (a seed do OpenStego depende de
MD5) e uma reimplementação fiel do java.util.Random.

Próximos motores planejados: Steghide, OutGuess, F5.

---

## v2.29.1 — 2026-07-16
**Negação plausível — ajustes de UI**

- O campo **Proteção** agora mostra "texto puro (sem senha)" quando não há chave,
  enfatizando que uma mensagem sem senha é trivialmente recuperável.
- Quando a **segunda mensagem** está ligada e preenchida mas sem senha, o botão
  **Ocultar** fica desabilitado com um alerta inline (a mensagem alternativa é
  sempre cifrada, então exige senha própria). A mensagem do terminal, se
  alcançada, agora diz "senha alternativa obrigatória".

---

## v2.29.0 — 2026-07-15
**Negação plausível: uma segunda mensagem oculta**

O encoder passa a embutir uma **segunda mensagem independente** na mesma imagem,
aberta por uma senha diferente (recurso opcional, desligado por padrão). Se
alguém forçar você a revelar a senha da imagem, você entrega a **senha
alternativa** — ela revela uma mensagem inofensiva, enquanto sua mensagem real
permanece protegida e **indetectável mesmo para quem tem o código-fonte da
ferramenta**.

Arquitetura (Opção C — assimétrica):

- **Mensagem real** — mantém a furtividade STC completa, gravada a partir do
  início do pool (posições de menor custo HILL).
- **Mensagem-isca** — gravada por LSB a partir do **fim** do pool, cifrada com
  AES-256-GCM (Argon2id, salt derivado da senha). Validação pela **tag do GCM**,
  não por MAGIC — nenhum marcador denuncia que existe uma segunda camada.
- As duas camadas **nunca se sobrepõem** (colisão é checada e rejeitada com erro
  claro); cada uma decodifica só com a sua senha. Capacidade compartilhada
  dinamicamente (o que a real não usa fica livre para a isca).
- **Sem flag de "tem isca"** no header: marcar a existência da isca seria um
  distinguidor. O decoder sempre sonda a âncora do fim quando há senha; a tag do
  GCM decide. Segurança por Kerckhoffs: o esquema aguenta o adversário conhecer
  o algoritmo inteiro — o único segredo é a senha.

UI: toggle opt-in abaixo do campo de senha, com explicação em linguagem leiga,
segundo campo de mensagem/senha, aviso em tempo real se as duas senhas forem
iguais, e dica para a isca ser plausível. Nomenclatura por função ("mensagem
alternativa"), não por técnica ("decoy").

Validação: núcleo provado isolado em Node (protótipos 1a/1b, arquitetura de
âncoras em pontas opostas) + harness integrado com as funções reais dos módulos
(11/11: real+isca convivem, isolamento cruzado, sem falsa leitura em 200/500
senhas aleatórias, colisão rejeitada, UTF-8 íntegro). `test.js`: 10/10.
i18n 620/620.

Refinamentos de UI (mesma versão): o liga/desliga da 2ª mensagem virou um
**switch ON/OFF** igual ao do Modo de Alta Capacidade; títulos da seção seguem
o padrão `//` do resto do site; o campo da senha alternativa ganhou o mesmo
visual do campo de senha principal (ícone 🔑 + botão limpar) e uma **barra de
força de senha** própria; o medidor de capacidade agora **soma os caracteres da
isca** em tempo real; ao clicar em Ocultar, o Status já mostra um indicador de
trabalho e a página rola imediatamente para a área de saída (antes só rolava ao
terminar); e o Guia Rápido ganhou um passo explicando a segunda mensagem.

## v2.28.3 — 2026-07-04
**Dicas viram um segundo quadro na coluna direita**

As dicas "Como escolher a imagem" saíram da faixa de largura total e viraram um segundo quadro na
coluna direita, abaixo do relatório de furtividade — mesmo estilo, preenchendo o espaço vazio para
as duas colunas equilibrarem em altura. Lista de coluna única.

## v2.28.2 — 2026-07-04
**Layout do encoder reequilibrado**

- Botão do mapa e legenda desceram para baixo da imagem (onde o mapa aparece); a nota ficou logo
  abaixo do veredito; imagem maior; espaçamento do download corrigido.
- Legenda do mapa passou a dizer **"menos detectável → mais detectável"** (mais claro que "limpo →
  vaza") nos dois — encoder e analyzer. Botão do encoder: **"Ver mapa de furtividade"**.

## v2.28.1 — 2026-07-04
**Saída do encoder em duas colunas; mapa como overlay**

- Saída reorganizada em duas colunas (imagem + download + infos à esquerda, relatório à direita);
  download no topo, sem rolagem.
- O mapa de vazamento virou um **overlay sobre a imagem gerada** (como no Analyzer), acionado por
  botão; só calcula sob demanda (encode mais leve). O veredito subiu para logo abaixo das barras.
- No Analyzer, o mapa liga sozinho ao abrir o módulo, com o botão para desligar/religar.

## v2.28.0 — 2026-07-04
**Painel de vazamento: imagem maior, legenda e dicas separadas**

- O mapa do Analyzer saiu da miniatura do drop e virou um **módulo próprio** nos resultados, com
  imagem maior, overlay e legenda. Desktop em duas colunas; celular empilha.
- Dicas conscientes do contexto: Encoder mostra "Como escolher a imagem" (para quem esconde);
  Analyzer mostra "Como ler este mapa" (interpretação forense, para quem procura).
- Terminologia: **"piso de detecção" → "limite de detecção"**. Mapa do encoder unificado no mesmo
  ciano do Analyzer.

## v2.27.1 — 2026-07-04
**Indicador "Trabalhando…" para o encoder nunca parecer travado**

Após codificar, a análise roda na thread principal e congelava a UI por um instante. Agora o botão
de Encode mostra um spinner **"Trabalhando…"** que anima na thread de composição — continua girando
mesmo enquanto o JavaScript bloqueia. Fica no próprio botão (ideal no celular). Respeita
prefers-reduced-motion.

## v2.27.0 — 2026-07-04
**Overlay do mapa de vazamento no Analyzer (roadmap #22 — completo)**

Fecha o #22: o mapa de vazamento, que na v2.26.0 apareceu no encoder, agora também se
**sobrepõe direto na imagem carregada no Analyzer**.

- **overlay no Analyzer** — Um botão "Ver mapa de vazamento" sobrepõe, na imagem analisada, um
  destaque das regiões onde o sinal RS é mais forte. Alinhado à imagem (o retângulo real é
  calculado, tratando o letterbox do `object-fit:contain`). Regiões limpas ficam **transparentes**
  (a imagem aparece); regiões que vazaram ganham um **brilho ciano** — pista por brilho, acessível
  ao daltonismo vermelho-verde.
- **sob demanda** — calculado só no primeiro clique (RS por célula, máximo sobre os três canais,
  pra pegar embed em qualquer canal). Zero custo pra quem não abrir. `rsResidualMap()` ganhou um
  parâmetro `allCh` pra isso.
- **validação** — teste funcional com jsdom confirmou liga/desliga, construção da grade e a
  localização (metade com mensagem acende mais que a limpa). `test.js`: i18n 597/597, versão
  consistente, offline intacto.

---

## v2.26.0 — 2026-07-03
**Mapa de vazamento: veja onde o sinal é mais forte (roadmap #22, lado do encoder)**

Complementa o auto-report da v2.25.0 — depois de dizer *quão* furtiva a saída ficou, agora mostra
*onde* ela vazou.

- **mapa de vazamento** — Abaixo das barras do relatório de furtividade, uma grade em escala de
  cinza onde as células mais **claras** marcam onde o sinal RS é mais forte na imagem. Vê-se de
  relance quais regiões entregaram a mensagem (áreas lisas acendem, áreas com textura ficam
  escuras). Escala de **luminância** — acessível ao daltonismo. `rsResidualMap()` (novo, em
  `decoder.js`) roda o RS por célula da grade, reaproveitando o detector existente.
- **escopo (honesto)** — esta é a versão **lado do encoder** ("onde a *minha* saída vazou"). O
  overlay completo no Analyzer (mapa alinhado sobre qualquer imagem carregada) segue pendente no #22.
- **validação** — teste funcional confirmou a localização (região limpa ~0,16 vs região com
  mensagem ~0,75 numa base suave). Coberto pelo `test.js`: i18n **595/595**, versão consistente,
  offline intacto.

---

## v2.25.0 — 2026-07-03
**O encoder agora avalia a própria furtividade (auto-report / roadmap #21)**

Fecha o ciclo **codificar→detectar→melhorar** dentro do app: ao gerar a imagem, o encoder
roda o próprio arsenal estatístico na saída e diz quão detectável ela ficou.

- **relatório de furtividade da saída** — Após codificar, `analyzeOutputStealth()` (novo, em
  `decoder.js`) roda RS e WS na imagem recém-gerada e mostra, abaixo das infos de sempre, um
  quadro com: estimativa RS/WS, um selo em palavra (**Furtiva / No limite / Detectável**) e um
  veredito com orientação. Usa **os mesmos limiares do Analyzer** (RS/WS > 15% detectável, > 8%
  no limite), então o encoder nunca diz "furtivo" onde o Analyzer diria "detectado". Roda
  automático em segundo plano (a imagem aparece na hora; o veredito preenche logo depois) e é à
  prova de falha — se der erro, o quadro some e o encode continua normal.
- **régua visual** — cada métrica tem uma barra com a **marca do piso de detecção (~15%)**: bate
  o olho e vê se passou da linha. As barras **enchem animadas** ao aparecer.
- **cores por faixa** — verde (≤8%), amarelo (8–15%) e vermelho (>15%) na barra e no número; o
  selo e o veredito seguem a mesma lógica. O veredito **Detectável pulsa** numa moldura vermelha
  (alarme por **movimento**, acessível ao daltonismo; respeita `prefers-reduced-motion`).
- **honestidade** — um aviso deixa claro que mede a *nossa* saída com o *nosso* arsenal; não é
  garantia de indetectabilidade contra toda ferramenta.
- **acessibilidade e clareza** — contraste dos rótulos do encoder corrigido (de `--dim`, quase o
  fundo, para `--neutral`); linguagem dos veredictos suavizada para o leigo ("imagem com mais
  detalhes" no lugar de "cover ruidoso/texturizado"; sem "payload" nas frases). Espaçamento dos
  blocos de saída padronizado em **14px**.
- **validação** — coberto pelo `test.js`: paridade i18n **593/593**, versão consistente, offline
  intacto, mais teste isolado da lógica do veredito (limiares + gating do WS).

---

## v2.24.0 — 2026-07-03
**Fonte modular + pipeline de build + offline de verdade (sem mudança de lógica)**

Reorganização estrutural do projeto. A **lógica-núcleo** (codificação, detecção,
cripto, forense) foi **verificada byte a byte** contra a v2.23.1 — nenhuma função de
`embedLSB`, `extractLSBStudio`, `rsAttack`, `wsAttack`, `stcEmbed`, `hillCostMap`,
`aes*`, `runForensics`, `computeThreat` etc. mudou.

- **fonte modular (`src/`)** — O HTML monolítico (~6.500 linhas de lógica num único
  `<script>`) foi fatiado em módulos por responsabilidade: `crypto.js`, `encoder.js`,
  `hill.js`, `stc.js`, `decoder.js`, `forensics.js`, `png_codec.js`, `terminal.js`,
  `files.js`, `i18n.js`, `ui.js`, `pro.js`, `results.js`, `main.js`, mais `styles.css`
  e o blob `hash-wasm.js`. **HILL e STC em módulos próprios** desde já, para isolar o
  trabalho futuro em custo adaptativo e syndrome-trellis.
- **pipeline de build (`build.js`)** — Script Node simples (sem bundler pesado)
  concatena os módulos na ordem-fonte, injeta CSS e fontes e gera o **único HTML
  autônomo** `stego_studio_v2.24.0.html`. *Source modular, build standalone, runtime
  offline.* A distribuição continua sendo **um arquivo** que abre no navegador sem
  instalar nada.
- **novo — fontes 100% offline** — As três tipografias (IBM Plex Mono, IBM Plex Sans,
  Bebas Neue) agora vêm **embutidas** como `@font-face` woff2 base64 (subset latino,
  5 faces: 400/600 das duas Plex + 400 da Bebas). Antes o `@import` do Google Fonts
  fazia a UI cair para fallback do sistema offline — inclusive o terminal monoespaçado.
  Só os pesos usados de fato (o 300 pedido era morto; 500/700 já arredondavam para
  400/600 no online), então a aparência é **idêntica** à da versão online. O `build.js`
  **falha duro** se qualquer dependência de rede voltar a entrar (+~124KB no arquivo).
- **onclick → addEventListener** — Os 13 handlers inline (12 estáticos no HTML + 1
  dinâmico do accordion forense) migraram para `addEventListener`, conectados uma vez
  no load por um `wireEvents()`, com **delegação no `document`** para o accordion
  gerado em runtime. Comportamento verificado idêntico (inclusive o "fechar só ao
  clicar no fundo" dos modais) via teste jsdom. Marcação limpa, pronta para os
  escopos do fonte modular.
- **validação** — Equivalência multiset linha a linha (6.146 linhas de código, zero
  diferença), `node --check` por módulo e no HTML final, paridade i18n **579/579**,
  e teste funcional dos eventos.

> **Fora desta versão, de propósito:** o **favicon inline** (hoje em caminho relativo,
> dá 404 ao abrir o arquivo solto) — item pequeno para uma próxima. Extrair i18n e
> changelog para JSON também fica como evolução futura do build.

---

## v2.23.1 — 2026-07-02
**Correções de documentação no HTML + limpeza de i18n**

- **corrigido (ajuda + ticker)** — Removida a afirmação desatualizada de que "só
  formatos sem perda servem para codificar". Desde o aceite universal de portadora
  (v2.18.2), qualquer imagem que o navegador decodifica (**inclusive JPEG**) é aceita
  como cover e sempre salva como um **PNG novo sem perda** — o *lossless* importa na
  **saída**, não na entrada. Reescrito nos 6 pontos onde a ideia vivia: `helpS2b`
  (inline + dicts EN/PT), `ticker[2]` (EN/PT) e o fallback do `encGuide1`.
- **reescrito (seção "Proteção e furtividade")** — O modal descrevia **três modos
  selecionáveis** (adaptativo / STC / header furtivo) que não existem mais na UI.
  Reescrito para a ferramenta real: **um** checkbox ("Modo de Alta Capacidade") e
  **auto-seleção de dois caminhos** — furtivo padrão (**STC sobre mapa HILL**, canal
  azul; o "adaptativo" foi absorvido pelo STC) vs. **capacidade (RGB)**. Deixado
  explícito que o **header oculto é automático** sempre que há senha (`stealth =
  cipher`), não um modo à parte. As camadas da senha (AES-256-GCM, embaralhamento,
  header oculto) e os dois caminhos são descritos como o que a ferramenta faz sozinha.
- **esclarecido (Limitações)** — A seção de limites do detector agora menciona o
  **modo Pro opcional** (servidor Aletheia): modelos neurais treinados podem mirar
  métodos adaptativos/neurais como HILL e SteganoGAN, como camada **separada,
  opcional e ainda probabilística** — o núcleo no navegador segue estatístico e
  offline (`helpS6a`, `helpS6c`, `helpS3d`). De quebra, sincronizado o fallback inline
  do `helpS6c`, que divergia do dicionário desde uma versão anterior.
- **corrigido (ticker)** — A mensagem sobre a chave opcional não sugere mais que
  "qualquer extrator LSB lê" uma mensagem sem chave; agora enquadra a chave como
  **cifragem (AES-256) + embaralhamento da ordem dos bits**.
- **limpeza (i18n)** — Removida a chave órfã `termNotSupported` (EN + PT), nunca
  referenciada no código.
- **renomeado (UI)** — O toggle de alta capacidade passou de **"Priorizar
  capacidade"** para **"Modo de Alta Capacidade"** ("High Capacity Mode" em inglês) —
  rótulo e todas as referências na UI (dicas, aviso de auto-troca, guia rápido e ajuda).
  Apenas cópia de UI; o comportamento do modo é idêntico.
- **validação** — `node --check` OK; i18n **579/579** (a chave `helpProtStc` que
  entrou e a `termNotSupported` que saiu se cancelam). Sem mudança de lógica — apenas
  textos de UI/ajuda e o array de changelog interno do HTML. Testado e aprovado.

## v2.23.0 — 2026-06-30
**Argon2id no lugar do PBKDF2 (KDF memory-hard) — #9**

- **mudado (cripto)** — A chave AES-256 derivada de senha passa de **PBKDF2-SHA256 (150k)**
  para **Argon2id** (RFC 9106, `m=64MiB, t=3, p=1`) — muito mais resistente a brute-force por
  GPU/ASIC. Argon2id é o padrão para todos os novos encodes.
- **offline / single-file** — A Web Crypto não tem Argon2, então embutimos o `hash-wasm`
  (Argon2id) como **bundle UMD com o WASM em base64 inline** (~29KB, ~6% do arquivo) — nada
  de CDN, a ferramenta segue arquivo único e 100% offline. Expõe `globalThis.hashwasm`.
- **retrocompatibilidade (byte de versão de KDF)** — O envelope cripto já tinha um byte de
  versão; agora ele despacha o KDF no decode: **`0x02` = Argon2id (novo)**, **`0x01` = PBKDF2
  (imagens cifradas antes da v2.23)**. Imagens antigas continuam decodificando. Se o WASM não
  estiver disponível, o encode LANÇA — nunca rebaixa silenciosamente para um KDF mais fraco.
  A detecção de senha errada (AES-GCM) é a mesma.
- **decisão (Rick)** — WASM (vs. JS puro). Medido: WASM **+29KB**; JS puro seria **inviável**
  (~8 min por derivação — os próprios mantenedores do "argon2id JS puro" desistiram por isso).
  Custo de UX do WASM: ~500ms na 1ª derivação da sessão (compila o wasm), ~325ms depois.
- **validação** — (1) o bundle standalone embutido produz saída **idêntica** à lib hash-wasm
  completa (já validada contra o vetor PHC), determinística e offline; (2) round-trip com as
  funções REAIS extraídas do HTML: encode Argon2id → decode bate (acentos+emoji), imagem
  PBKDF2 antiga ainda decodifica, senha errada lança nos dois KDFs, `isAesPayload` aceita os
  dois; (3) `node --check` no principal E no bundle; i18n 579/579. Testado e aprovado.

## v2.22.0 — 2026-06-29
**Mapa de custo HILL canônico (#11) — melhor posicionamento furtivo**

- **mudado (embedding)** — O mapa de custo do adaptativo/STC (`hillCostMap`) passou do
  custo simplificado (`1/|R|` + uma média 3×3) para o **HILL canônico** (Li et al. 2014):
  `ξ = |R| ⊛ L1(3×3)` (suaviza o resíduo passa-alta ANTES do inverso) e
  `ρ = (1/ξ) ⊛ L2(15×15)` (espalha o custo DEPOIS). O duplo low-pass (pequeno antes,
  grande depois) **agrupa os mínimos de custo nas regiões texturizadas** — a propriedade que
  dá ao HILL a resistência à steganálise estrutural e neural. Implementado com box-blur
  **separável O(n)** (somas correntes) para o 15×15 não pesar (~230ms/MP).
- **retrocompatibilidade (flag)** — O adaptativo RECALCULA o custo no decode, então mudar o
  mapa quebraria imagens adaptativas antigas. Resolvido com **`FLAG_HILLV2 = 0x40`**: embeds
  adaptativos novos marcam o bit e usam o V2; imagens adaptativas pré-v2.22 (sem o bit)
  decodificam com o mapa **legado** preservado (`hillCostMapLegacy`). O **STC** usa o V2 no
  encode e decodifica por **síndrome** (independente de custo), então todas as imagens STC —
  antigas e novas — decodificam sem precisar de flag.
- **validação** — Funções extraídas do HTML e testadas em Node: (1) **determinismo** — a
  ordem por custo é idêntica após virar 4308 LSBs do canal azul → round-trip do adaptativo
  intacto; (2) **sanidade** — textura custa 49 vs 136 na região lisa, 100% dos pixels mais
  baratos na textura; (3) **V1 ≠ V2** (10797/10800 posições diferentes) → prova que a versão
  por flag é necessária e roteia certo (antigo→V1, novo→V2). `node --check` OK; i18n 579/579.
  Testado e aprovado.

## v2.21.0 — 2026-06-29
**Detecção de HEIC + aviso claro (#18)**

- **novo (compat)** — Arquivos **HEIC/HEIF (Apple)** agora são detectados pela assinatura
  **ftyp** (brands HEVC: heic/heix/hevc/hevx/heim/heis/hevm/hevs) e geram mensagem clara
  ("converta para PNG ou JPEG") no encoder E no decoder, em vez de **falhar em silêncio** — o
  navegador não decodifica HEIC (exceto Safari). **AVIF é deixado de fora de propósito**
  (navegadores modernos o decodificam normalmente; brands ambíguos como `mif1`/`msf1` também
  não são bloqueados, para não pegar AVIF por engano).
- **bônus** — `loadToCanvas` agora tem callback de erro: além do HEIC, qualquer imagem que
  falhe ao decodificar mostra mensagem genérica clara (antes o `.catch` só fazia
  `console.error`, sem feedback ao usuário). Helper `showLoadError(painel, motivo)`.
- **validação** — `isHeic` validado 8/8 em Node (HEIC heic/heix/hevc → true; AVIF/PNG/JPEG/
  mif1 → false). i18n 579/579 (chaves `termHeicUnsupported`, `termDecodeFailed`). Testado.

## v2.20.0 — 2026-06-28
**Changelog no app restaurado (modal de histórico de versões)**

- **novo (UI)** — O **modal de histórico de versões voltou ao site** (engrenagem →
  "Histórico de versões"), no formato original da v2.9.1. Tinha sido removido na v2.10
  (sobraram só CSS e o rótulo do menu, órfãos); agora a máquina inteira foi reconstruída
  (`renderChangelog`/`showChangelogModal`/`hideChangelogModal`, modal HTML, item de menu).
- **estrutura** — Dois arrays: `CHANGELOG` (era semver, v2.20.0 → v2.10, 22 entradas) e
  `CHANGELOG_LEGACY` (pré-semver, v2.9.1 → v1.0, 29 entradas verbatim da v2.9.1). O render
  emite o bloco semver → um **divisor** ("o versionamento passou a semver a partir da
  v2.10") → o bloco Legacy, cada entrada com sufixo **"— Legacy"** (palavra igual nos dois
  idiomas, conforme pedido). 51 entradas no total.
- **decisão (Rick)** — Corte do semver = **v2.9.1 inclusive** e tudo antes vira Legacy.
- **validação** — Bloco testado isolado em Node antes de integrar; smoke test do render real
  extraído do HTML (51 `cl-entry`, v2.10 presente, divisor e relabel OK); `node --check` OK;
  i18n 577/577. Feito em 2 partes (máquina+recentes+Legacy, depois o miolo v2.13.9→v2.10)
  para não arriscar trabalho pela metade. Testado e aprovado.

## v2.19.2 — 2026-06-28
**Calibração de falso-positivo C2PA (Opção B) + ajustes de UI (#15a.2, #1, #2)**

- **mudado (forense, #15a.2)** — **"Rebaixar e explicar" para C2PA.** Quando a imagem é
  certificada por C2PA como gerada por IA E não há **evidência DURA** de stego (header STEGO,
  dado após EOF, stegomalware, LSBR estrutural, RS≥25%, cifra ou texto oculto real), os
  sinais que o próprio conteúdo C2PA produz — strings do manifesto/SVG, anomalia LSB do
  SynthID, viés de paridade, disparo neural — **deixam de inflar o threat** e viram a flag
  `flagC2PAExplained` ("inconclusivo"). **Escotilha de segurança:** a evidência dura ignora a
  supressão, então um embedding REAL numa imagem C2PA continua acusando. Validado em Node: a
  selfie sintética caiu de **threat 90 → 0**; "C2PA + mensagem real (header)" → **threat 100,
  não suprimido**. O aviso `c2paFPNote` abaixo do score foi mantido.
- **UI (#1)** — A dica da área de drop do Encoder não lista mais formatos (coerente com o
  aceite universal do #17).
- **UI (#2)** — Campos do C2PA agora renderizados inline (`RÓTULO: valor`) em vez de
  rótulo-esquerda/valor-direita.

## v2.19.0 — 2026-06-28
**Veto de falso-positivo neural em cover chapado/vetorial (#15a)**

- **mudado (forense)** — Fechado o terceiro buraco da leitura diferencial do `neuralPro`: o
  modelo **HILL dispara ~0,99 em arte vetorial chapada mesmo sem mensagem** (artefato de tipo
  de cover, provado por baseline limpo). Agora, quando HILL está alto sem corroboração da
  família LSB **e** o cover é de baixa complexidade (`biasLowComplexity`), o sinal vira
  `flagNeuralVectorFP` ("inconclusivo") e para de somar ao threat.
- **distinguidor seguro** — A detecção REAL de HILL ocorre em cover texturizado
  (`biasLowComplexity=false`), então o veto não a alcança. Validado em Node: 06001 vetor
  **12 → 0**; foto Samsung-STC (HILL 0,747) **intacta (52)**. Os vetos de OutGuess-em-JPEG e
  C2PA-confirmado já existiam; este completa o trio.

## v2.18.2 — 2026-06-28
**Encoder aceita qualquer entrada (converte p/ PNG) + conserto de bug + botão de download (Frente #17)**

- **mudança de política** — O encoder agora aceita **qualquer imagem que o navegador
  decodifica** como portadora (JPEG, etc.), não só lossless. A saída é SEMPRE um PNG novo
  (remontado na mão), então entrada lossy é segura — os LSBs do JPEG não importam, a
  mensagem é embutida nos pixels decodificados e salva num PNG sem perda.
- **aviso (não bloqueio)** — Para entrada não-lossless: badge âmbar + aviso no terminal
  ("{ext} será convertido e salvo como um NOVO PNG, não o original editado"). Guia do
  passo 1 atualizado (antes dizia "JPEG não serve" — confundia entrada com saída).
- **conserto de bug (estado do botão)** — Causa-raiz: `checkEncReady` recebia a validade do
  formato como **parâmetro transitório**, então digitar/apagar a senha revalidava sem ela e
  re-habilitava "Ocultar mensagem" num formato antes bloqueado. Agora a validade é **estado
  persistente** (`encFormatOk`), setado no load e consultado sempre; cada load reseta o
  estado antes de decodificar (decode falho → botão travado). Os 2 caminhos de load (colar +
  arrastar) foram unificados no helper `onEncCarrierLoaded` p/ não divergirem.
- **UX — botão de download** — "Baixar imagem PNG" voltou a ser **preenchido** (fundo verde/
  texto preto, classe `.btn .btn-enc`), igual ao "Ocultar mensagem" — chama mais atenção
  (era outline: fundo preto, texto colorido). (v2.18.1 testou um badge `JPEG→PNG`, revertido
  na v2.18.2 — ficou pequeno e o aviso do terminal já basta; nota de acessibilidade: badge
  por cor sozinho não serve p/ usuário daltônico, mas o terminal cobre o sinal.)
- **validação** — `node --check` OK; i18n 574/574 (chave `termWillConvertPng`); zero resíduo
  do esquema antigo. Testado e aprovado em produção (decode recupera; JPEG pequeno em foto
  real → neural 0 em todos os modelos, datapoint a mais p/ a tese).

## v2.17.0 — 2026-06-28
**Parser do manifesto C2PA — campos destacados + resumo legível (Frente #16, b.2)**

- **novo (forense)** — Quando há manifesto C2PA, o módulo "Autenticidade C2PA" agora
  **lê e destaca** os campos-chave logo abaixo do bloco "ASSINATURA DIGITAL C2PA":
  **Signatário** (`common_name` do cert leaf), **Gerador** (`name`) e **Versão** (`version`).
- **resumo legível `.txt`** baixável ao lado do `.c2pa` cru (resolve o `.c2pa` que o Notepad
  quebra): signatário, CA, gerador, versão, digitalSourceType, data do cert e descrições de
  ação (ex.: Gemini → "Created by Google Generative AI.", "Applied imperceptible SynthID
  watermark."), com nota de que o `.c2pa` é o artefato autoritativo.
- **conserto de bug** — `digitalSourceType` saía como LIXO (`"imperceptible"` no Gemini,
  `"jumbIjumd…"` no GPT, pela regex antiga); agora sai correto (`trainedAlgorithmicMedia`)
  ancorado na URL IPTC.
- **abordagem (corrigida pela pergunta do Rick)** — NÃO é parser CBOR completo: é leitura
  **ancorada na chave** respeitando só o tamanho do tstr CBOR (`name`/`version` = par
  adjacente do claim_generator_info) + leitura do Subject CN no cert X.509 (OID `55 04 03`,
  pulando certs de CA/Root/ICA/TSA → pega o leaf signatário). Helpers: `cborReadTstr`,
  `c2paGenerator`, `c2paSignerCN`, `c2paDigitalSourceType`, `c2paActionDescriptions`.
- **padronização GPT × Gemini** — layout canônico (mesmos campos p/ ambos; ausente não
  aparece, sem quebrar). SVG só no GPT/Trufo (Gemini usa SynthID no pixel, não `<svg>` nos
  bytes — fiel à realidade). Signatário por exclusão (heurística validada nos 2; 3º
  fornecedor pode exigir ajuste com amostra).
- **validação** — extração validada isolada em Node contra os **2 manifestos reais**
  (GPT/Trufo e Gemini/Google), 8/8 campos; reconfirmada com as **funções reais do HTML**;
  `node --check` OK; i18n **573/573** (7 chaves novas). Testado e aprovado em produção.
- **nota i18n** — "Content Credentials" no título do módulo fica em inglês de propósito
  (nome de marca oficial da CAI). (v2.17.1 que traduzia foi descartada.)

## v2.16.0 — 2026-06-28
**Extração de assets C2PA — watermark SVG + manifesto JUMBF (Frente #16, b.1)**

- **novo (forense)** — Quando há C2PA/watermark, o módulo "Autenticidade C2PA" agora
  **extrai, exibe e baixa** os assets embutidos: preview da **watermark SVG** (renderizado
  sanitizado via `<img>` blob — não executa script — sobre fundo xadrez) + botões de
  download do **SVG** (`c2pa_watermark.svg`) e do **manifesto JUMBF** (`c2pa_manifest.c2pa`).
- **recorte nos BYTES** (não no texto decodificado com `{fatal:false}`, onde índice de char
  ≠ índice de byte): SVG por `<svg…</svg>` (guarda de viewBox), manifesto pelo **superbox
  JUMBF** (length 32-bit BE antes do tipo `jumb`; sanidade ignora menções textuais como
  "jumbf manifest"). Helpers `bytesIndexOf`, `extractSvgBytes`, `extractJumbfBox`.
- **assets FORA do JSON exportado** — só flags pequenas (`hasSvg`, `hasManifest`, `svgLen`,
  `manifestLen`) entram no relatório; os bytes vão pro global `C2PA_ASSETS` (não incha o
  `.json` nem vaza binário).
- **validação** — recorte testado isolado em Node (SVG exato, JUMBF exato, ignora `jumb`
  falso, casos negativos → null) + reconfirmado com as **funções reais do HTML**; `node
  --check` OK; i18n **566/566** (5 chaves novas EN+PT). Confirmado em produção (selfie
  Trufo): preview aparece, downloads íntegros.
- **a seguir (b.2, ROADMAP #16):** parser CBOR/JUMBF p/ destacar `common_name` (CA),
  `name` e `version` (gerador) sob a assinatura + preview legível do manifesto.

## v2.15.0 — 2026-06-27
**STC (Syndrome-Trellis Codes) — embedding consciente de custo (Frente #13)**

- **novo (furtividade)** — O corpo passa a ser embutido por **STC**: em vez de escrever
  1 bit/pixel em ordem (LSB-matching) ou na ordem de custo (adaptativo), o STC escolhe,
  via Viterbi sobre um trellis de 2^h estados, o conjunto de alterações de **menor custo
  HILL total** sujeito a `H·y = m`. **O decode é por síndrome (`m = H·y`), independente
  de custo** — não recalcula HILL nem reordena nada, logo é mais robusto que o adaptativo.
  **STC virou o modo de furtividade PADRÃO** (substituiu o adaptativo); "Priorizar
  capacidade" continua RGB. Nenhuma UI nova.
- **ganho** — ~3,4 bits/mudança vs ~2,0 do LSB-matching → **~40% menos pixels alterados**
  pra mesma mensagem, todas concentradas em textura (menor custo). Capacidade idêntica à
  do adaptativo (STC com w=1 = 1 bit/px opaco); o encoder pega o maior `w`(=1/α) que cabe.
- **formato** — `FLAG_STC=0x20`; `h=8` (ótimo memória/eficiência); byte de `w` no header
  (cifrado junto no modo furtivo — keystream posição-baseado); Ĥ determinística por seed.
  Path do Viterbi **bit-packed** (~n·2^h/8 bytes) para limitar memória no navegador.
- **validação** — Núcleo isolado em Node: **custo exatamente ótimo vs força bruta** (4000
  casos), round-trip exato. Integração testada com as **funções reais do HTML** (10/10):
  STC sem senha, STC furtivo (extrai com senha, não revela sem), alfa parcial, e
  **regressão** do modo RGB. `node --check` OK; i18n **561/561** (chave `encModeStc`).
- **confirmado em produção** — Online (Cloudflare), **Brave com Shields LIGADO**: ida-e-volta
  OK com e sem senha (chi 5000.00 limpo → anti-farbling + STC juntos). Caso com senha
  (STC + header furtivo + AES) → **threat score 0, zero flags, header invisível**.
- **campanha de validação (backend Aletheia ligado) — 2 achados** (detalhe no ROADMAP):
  (1) **STC é detecção REAL** mas dominada pelo cover — na 1ª foto com baseline neural ≈ 0
  (Samsung c/ EXIF), HILL 0→0,747 com STC; em fotos texturizadas (WhatsApp/Fuji), HILL ~0
  com a mesma mensagem. Confirma "cover/taxa dominam" com ressalva (detector casado-com-HILL
  pega em cover liso). (2) **Falso positivo neural por tipo de cover** (HILL→vetor; LSBR/LSBM
  →sintético-C2PA; OutGuess→JPEG foto), provado por baseline limpo → leitura do `neuralPro`
  deve ser DIFERENCIAL. Abriu frentes #15 (calibração), #16 (extrair C2PA/SVG), #17 (UX
  não-PNG), #18 (HEIC). Clássicos (RS/WS/chi/header) impecáveis em toda a campanha.

## v2.14.0 — 2026-06-27
**Leitura/escrita de pixels em JS puro (anti-farbling) — mudança estrutural de I/O**

- **corrigido (crítico)** — Imagens da própria ferramenta falhavam **online**
  (Cloudflare/https) mas funcionavam **offline** (file://): sem senha não exibiam a
  mensagem ("precisa de senha"); com senha davam "chave incorreta". Mesma máquina,
  mesmo arquivo, mesmo código. **Causa-raiz:** proteção anti-fingerprint de canvas
  (Brave Shields / "farbling"; também Firefox `resistFingerprinting` e extensões)
  injeta ruído de ±1 no `getImageData`/`toDataURL` em páginas **https** e **isenta
  `file://`** — o que **vira LSBs** e, como o AES-GCM é tudo-ou-nada, derruba a
  decifragem (1 bit basta) e a leitura do header. Cravado nos relatórios forenses:
  o MESMO arquivo dava chi-quadrado 5000.00 offline e ~4988 online, e o
  `decodedSample` ganhava bytes que **não existem no arquivo**.
- **solução** — Os pixels passaram a ser lidos e escritos **fora do canvas 2D**, via
  um **codec PNG em JS puro**. Decode = bytes do PNG → inflate (`DecompressionStream`)
  → desfiltra (None/Sub/Up/Average/Paeth) → RGBA; suporta colorType 0/2/3/4/6 em 8-bit
  (+ paleta sub-8). Encode = RGBA → filtro None → deflate (`CompressionStream`) →
  chunks IHDR/IDAT/IEND + CRC32. O `loadToCanvas` (alimenta decoder e analisador) e a
  **saída do encoder** não tocam mais no canvas para PNG; o canvas vira só **fallback**
  (JPG/WEBP, ou PNG entrelaçado/16-bit) e preview. **Bônus:** imune também a
  gerenciamento de cor (ICC) e à premultiplicação de alfa do canvas, de uma vez.
- **validação** — Codec testado isolado em Node: decode bate **pixel a pixel com o
  Pillow** (RGBA8/RGB8/Gray8/paleta, com alfa parcial e filtros adaptativos), round-trip
  encode→decode **LSB-exato** (o que o AES exige), e o Pillow abre o PNG gerado.
  `node --check` OK; paridade i18n **560/560**. Confirmado em produção: com o Brave
  Shields **LIGADO**, decifra normalmente.
- **nota de deploy (resolvido na mesma fase)** — Um **build contaminado** (imagem de
  teste `06006` pré-carregada na área de upload) estava sendo servido pelo Cloudflare;
  reimplantado o HTML verificado (md5 conferido). Reforça a disciplina de conferir o
  md5 do que vai pro ar — e filtra qualquer `data:image` chumbado antes do deploy.

## v2.13.1 – v2.13.9 — 2026-06-23 → 2026-06-26
**Série de patches sobre o Encoder reorganizado: bug crítico do alfa, embedding em
pixels opacos e calibração da detecção.**

### Bug crítico do alfa → embedding em PIXELS OPACOS (v2.13.6 → v2.13.7)
- **corrigido (crítico)** — Imagens da própria ferramenta não decodificavam ("nenhum
  conteúdo legível nos LSBs"). Causa: o canvas do navegador **zera o RGB de pixels
  transparentes** (premultiplicação de alfa). Em covers RGBA (ex.: ícones do dataset,
  com o pixel 0,0 transparente), o header era escrito em pixel transparente e
  **destruído ao salvar**. Confirmado nos bits (header zerado no arquivo).
- **solução** — O embedding passou a usar **apenas pixels opacos** (`alpha==255`),
  endereçados via `opaquePixels(d)`. O alfa nunca é tocado → **transparência e
  aparência 100% preservadas** (saída visualmente idêntica), round-trip lossless.
  Header = primeiros 80 pixels opacos; corpo = opacos seguintes (adaptativo ordena
  por custo entre os opacos). A capacidade passou a contar `encOpaque` (pixels opacos).
  Provado em Node com corrupção de canvas simulada. *(O achatamento de alfa sobre
  fundo branco — v2.13.6 — foi descartado por alterar a imagem visível.)*

### Calibração da detecção (v2.13.8)
- **calibrado** — Validado com baseline (limpo vs stego). **WS bloqueado em cover
  chapado** (`wsReliable=!lowComplexity`): dava 53–80% sem stego. Detecção virou
  **RS-primária**; o WS nunca dispara sozinho nem corrobora veredito/neural em arte
  vetorial. **Viés par/ímpar** suprimido em cover chapado (a paleta quantizada gera o
  viés sozinha). **Veto de arte vetorial** no painel de IA (limita o score a BAIXA e
  esclarece "vetorial, não IA"). Resultado: cover limpo 35→**0** (FP zerado);
  pequena+senha 35→**0** (idêntica ao limpo = furtividade comprovada); grande segue
  95–100 (detecção real via RS).

### Comportamento do toggle de capacidade (v2.13.3 → v2.13.4)
- **corrigido** — "Priorizar capacidade" não mudava o número exibido. Agora
  **desligado = furtivo** (teto ~32k) e **ligado = RGB** (~98k). O furtivo nunca é
  abandonado em silêncio.
- **adicionado** — **Auto-switch reversível**: mensagem grande demais para o furtivo
  liga a capacidade sozinha + aviso âmbar sob o campo de mensagem; volta ao furtivo se
  encurtar (estado `encMaxcapManual` separa escolha manual de forçada).

### Dica de cover ruim + correções de UI (v2.13.9, v2.13.1/.2/.5)
- **adicionado** — **Dica de cover ruim para furtividade**: aviso sob o campo de
  imagem ("Dica:…") quando o cover é chapado (`isLowTextureCover`). Sugestão, não
  bloqueio.
- **corrigido** — Tags `<b>` cruas nos hints novos → `data-i18n-html` (v2.13.1);
  negrito invisível na cor apagada → CSS de cor clara em `.hint-text b` (v2.13.2);
  frase de furtividade inteira em negrito nos dois idiomas (v2.13.9); referência ao
  "modo adaptativo" removida do aviso de ocupação alta (v2.13.5); mensagem de viés
  não-confiável estava **hardcoded em PT** e dizia "lossy" em PNG → virou i18n com o
  motivo correto (lossy vs cover chapado) (v2.13.9).

## v2.13.0 — 2026-06-23
**Encoder reorganizado: furtividade por padrão (tese estratégica)**

- **mudado** — De 4 controles (alta capacidade, adaptativo, furtivo, + senha) para
  **1 controle opcional** ("Priorizar capacidade", desligado por padrão). Aplica a
  tese de furtividade: o usuário leigo sai com o máximo de discrição sem poder se
  sabotar com uma opção mais fraca.
- **adicionado** — **Auto-seleção de modo**: o encoder escolhe sozinho o modo mais
  furtivo que couber, subindo a escada Adaptativo → Padrão (B) → RGB só quando
  necessário (helper puro `selectEmbedMode`, testado em Node; capacidades batem
  exatamente com o `embedLSB`). "Priorizar capacidade" inverte para RGB direto.
- **mudado** — **Header furtivo agora é automático** sempre que há senha (sem caixa).
  Como a compressão, não tem downside, então deixou de ser opcional.
- **mudado** — Medidor de capacidade usa o teto RGB (a escada sobe até ele); stats
  do resultado mostram o modo efetivamente escolhido (Adaptativo/Padrão/RGB).
- **mantido** — Internas de `embedLSB`/`buildPayload`/decode intactas: só mudou
  QUAL modo é escolhido. Totalmente retrocompatível (flags armazenados idênticos).
- Guia (encGuide4) reescrito e novos textos de explicação sob o controle. EN/PT
  (paridade i18n 552/552).

## v2.12.1 — 2026-06-22
**Detecção de stegomalware**

- **adicionado** — Novo módulo que sinaliza quando a mensagem oculta
  **decodificada** tem cara de script ou executável. Roda **só sobre conteúdo
  já extraído com sucesso** (não sobre bytes brutos), o que mantém o falso
  positivo baixo. Achados críticos: PowerShell/IEX e comando codificado,
  baixar-e-executar (`curl|bash`, `certutil`), reverse shell (`/dev/tcp`, `nc -e`),
  JavaScript ofuscado (`eval(atob(...))`), injeção de `<script>`/`<iframe>`/PHP,
  WScript/`CreateObject`/macro autoexec e cabeçalho de executável (MZ/ELF/shebang).
  Indicadores de atenção: URL, endereço de criptomoeda e blob Base64 grande.
- **adicionado** — Banner de alerta dedicado (☣) listando os achados com
  severidade (Crítico/Suspeito) e o trecho casado; o resultado entra no threat
  score (achado crítico = sinal forte) e no JSON exportado (campo `stegomalware`).
  Textos em EN e PT (paridade i18n: 548/548).

## v2.12.0 — 2026-06-22
**Compressão automática do payload (mais capacidade)** — marco da série 2.12,
por introduzir uma mudança (retrocompatível) no formato dos dados embutidos.

- **adicionado** — O corpo da mensagem agora é comprimido com `deflate-raw`
  (`CompressionStream` nativo) **antes** da cifragem, aumentando a capacidade útil
  da imagem. É automático e seguro: comprime e **só usa o resultado se ele
  realmente for menor** (mensagens curtas ou já aleatórias seguem sem compressão).
  Sinalizado por um novo bit `FLAG_COMPRESSED` (0x10) no byte de modo do header.
- **alterado** — Cifragem/decifragem ganharam variantes em bytes
  (`aesEncryptBytes`/`aesDecryptBytes`) para encaixar a compressão na ordem certa
  (comprime → cifra no encode; decifra → descomprime no decode).
- **compatibilidade** — Totalmente retrocompatível: imagens criadas antes têm o
  bit `FLAG_COMPRESSED` em 0, então o decoder simplesmente não descomprime e as lê
  como antes. A camada é ortogonal ao modo furtivo, ao AES e ao adaptativo.

## v2.11.8 — 2026-06-22
**Medidor de força de senha no Encoder**

- **adicionado** — Indicador de força da senha (barra + rótulo Fraca / Média /
  Forte / Excelente) abaixo do campo de senha do Encoder, atualizado em tempo
  real. Heurística própria leve (estimativa de entropia por comprimento × tamanho
  do alfabeto, com penalidades para senhas comuns, caractere repetido e
  sequências de teclado) — sem depender do zxcvbn (~400 KB), preservando o arquivo
  único. Textos em EN e PT (paridade i18n: 532/532).

## v2.11.7 — 2026-06-21
**Blindagem dos riscos latentes restantes da detecção de C2PA**

- **corrigido** — Mesma classe do falso positivo da v2.11.5: a `parseC2PA` ainda
  varria o arquivo inteiro (incluindo os pixels) em três pontos. Agora a **data
  de certificado** e o **nome de software** (`rawSoftware`) só são lidos quando há
  evidência C2PA real (`c2paEvidence`), e a detecção de **SVG-watermark** (Trufo e
  afins) passou a exigir `viewBox` a até ~200 caracteres do `<svg>` — evita casar
  bytes espalhados por acaso no lixo dos pixels.

## v2.11.6 — 2026-06-21
**Aviso de detectabilidade (max-fill) no Encoder**

- **adicionado** — Alerta separado do medidor de capacidade: avisa quando a
  mensagem ocupa mais de ~25% (atenção) ou >50% (alto) da capacidade da imagem,
  mesmo que caiba. Embedding pesado é o maior delator para a steganálise
  estatística/neural. Inspirado no teto de 25% do StegX. Textos em EN e PT
  (paridade i18n mantida em 527/527).

## v2.11.5 — 2026-06-21
**Correção de falso positivo de C2PA**

- **corrigido** — A `parseC2PA` "confirmava" um gerador de IA (ex.: "Grok (xAI)")
  apenas por casar o nome no texto bruto do arquivo, inclusive nos pixels —
  independentemente de existir um manifesto C2PA real. Tokens curtos como "grok"
  apareciam por acaso no lixo binário e contaminavam o relatório inteiro
  (synth / origin / C2PA). Agora o gerador só é identificado quando há evidência
  C2PA real (`c2paEvidence`).

## v2.11.4 — 2026-06-21
**Autenticação do Modo Pro (frontend)**

- **adicionado** — O frontend passa a enviar o header `X-API-Key` em toda chamada
  ao `/analyze` do backend (constante `PRO_API_KEY`). Não é segredo (o frontend é
  client-side), mas barra bots/scanners que não enviam a chave; deve casar com a
  `STEGO_API_KEY` do backend.

## Backend Pro v0.4.0 → v0.4.5 — 2026-06-20/21
**Segurança, observabilidade e robustez do backend**

- **adicionado** — Autenticação do `/analyze` por chave de API (header
  `X-API-Key` lido da env `STEGO_API_KEY`, comparação com `hmac.compare_digest`);
  fail-open com aviso no log se a chave não estiver definida. Defesa de recurso
  complementar via **rate limiting na Cloudflare** (10 req / 10s por IP). (v0.4.0)
- **adicionado** — Rota `/robots.txt` (`Disallow: /`) para tirar a API do índice
  do Google. (v0.4.0)
- **alterado** — Logs unificados no horário de Brasília (`America/Sao_Paulo`),
  inclusive os acessos do Uvicorn (`POST /analyze ... 401`), via `LOG_CONFIG`;
  startup migrado de `on_event` para `lifespan` (fim do DeprecationWarning).
  (v0.4.1–0.4.2)
- **adicionado** — Logs persistidos em arquivo diário datado em `~/stego-logs/`
  (dia atual `server.log`; dias anteriores `server-AAAA-MM-DD.log`; rotação à
  meia-noite, mantém 30 dias; pasta via env `STEGO_LOG_DIR`). (v0.4.3–0.4.4)
- **adicionado** — Warm-up dos modelos no boot (compila os grafos do TensorFlow
  na inicialização → primeira análise real já rápida) e encaminhamento dos avisos
  do TensorFlow pros nossos logs (carimbados e arquivados, visíveis para
  monitoramento), filtrando só o ruído cosmético de `retracing`. (v0.4.5)
- **corrigido** — `/analyze` devolve 400 (não 500) quando a entrada é inválida
  (base64 ou imagem ilegível). (v0.4.2)
- **corrigido** — Cabeçalho do `server.py` e README atualizados: o método
  canônico de subir é o `~/start.sh` (configura CUDA/cuDNN e exporta a chave);
  README/requirements reconciliados com a realidade da v0.4.x. (v0.4.2)

> Esta linha de backend parte do endurecimento de leitura da v0.3.0 (Pillow
> tolerante a chunks malformados sem reencodar; tetos de pixel/upload anti-DoS;
> CORS limpo) — registrado no ROADMAP em ✅ CONCLUÍDO.

## v2.11.3 — 2026-06-20
**SEO no domínio novo + reordenação do guia do Encoder**

- **corrigido** — Tags de URL apontavam para o domínio antigo
  (stegostudio.pages.dev): `rel="canonical"`, `og:url`, `og:image`,
  `twitter:image` e o `url` do JSON-LD agora apontam para
  https://stegostudio.com/. (A canonical errada fazia o Google indexar o
  domínio antigo no lugar do novo.)
- **adicionado** — robots.txt e sitemap.xml para stegostudio.com (arquivos
  servidos na raiz do site). Sitemap com URL única — o app é uma só página
  client-side; hreflang não se aplica (EN/PT trocam no JS, mesma URL).
- **alterado** — Ordem dos passos do guia do Encoder: agora 1 (carregar) → 2
  (escolher modo de embedding) → 3 (digitar mensagem) → 4 (chave) → 5 (gerar).
  Escolher o modo antes faz o medidor de capacidade já refletir RGB/adaptativo.

## v2.11.2 — 2026-06-20
**Guias rápidos atualizados (adaptativo + furtivo)**

- **adicionado** — Guia do Encoder agora cobre os modos de embedding (Padrão,
  alta capacidade RGB, Adaptativo/anti-detecção) e o Modo furtivo (header
  cifrado, exige chave); o passo da chave passa a mencionar o embaralhamento
  da ordem dos bits.
- **adicionado** — Guia do Decoder explica que a chave revela mensagens em modo
  furtivo (sem ela, indistinguíveis de ruído) e ganha um aviso de que stego
  adaptativo / LSB matching pode manter o Threat Score modesto mesmo com
  mensagem presente — a análise neural Pro detecta melhor esses casos.
- **corrigido** — Texto "XOR" remanescente no inline default do guia do encoder
  e no tagline do header (ambos sobrescritos pelo i18n, que já dizia AES-256,
  mas errados no código). Atualizados para AES-256.
- **corrigido** — Ordem dos passos do guia do Decoder alinhada entre o inline
  default e os blocos i18n EN/PT (chave antes de origem; antes o inline estava
  invertido).

## v2.11.1 — 2026-06-20
**Refino de UX e layout**

- **alterado** — Scroll automático ao gerar a imagem: quando o encode termina, a
  página rola suavemente até a imagem gerada (centralizada). Resolve o caso do
  desktop, onde a coluna de opções é longa e o resultado ficava acima da dobra.
  No mobile o comportamento já era natural.
- **corrigido** — Espaçamentos uniformes entre os blocos do resultado: a
  distância entre mensagem→scores estava colada, e adversarial→neural e
  neural→indicadores estavam grandes (margens somando). Todos os blocos agora
  usam o mesmo `margin-top` (14px), tomando como referência a distância
  scores→adversarial.

## v2.11 — 2026-06-20
**Modo furtivo (header cifrado por senha)**

- **adicionado** — Modo furtivo: cifra o cabeçalho da mensagem (MAGIC + modo +
  tamanho) com um keystream derivado da senha. Normalmente o cabeçalho carrega a
  assinatura "STEGO" que outras ferramentas usam para detectar que há algo
  embutido; no modo furtivo essa assinatura é cifrada e some. Sem a senha, o
  cabeçalho é indistinguível de ruído; com a senha certa, o MAGIC reaparece e
  se auto-valida (senha errada → não bate → rejeitado). **Exige senha.**
- **adicionado** — Toggle "Modo furtivo (header oculto)" no Encoder, com a regra
  de exigir senha (avisa e foca o campo se ligado sem senha).
- **adicionado** — Seção "Proteção e furtividade" no "Como funciona", reunindo as
  quatro camadas de segurança (AES, embaralhamento, adaptativo, furtivo) e como
  se combinam.
- **alterado** — Modo adaptativo renomeado de "(furtivo)" para "(anti-detecção)"
  para evitar ambiguidade com o novo modo furtivo.
- **corrigido** — Dica da senha que ainda dizia "XOR" atualizada para "AES-256-GCM".

## v2.10 — 2026-06-19/20
**Embedding adaptativo (modo anti-detecção por custo HILL)**

- **adicionado** — Modo adaptativo: esconde a mensagem em regiões de textura/ruído
  da imagem usando um mapa de custo HILL, onde as alterações são quase invisíveis
  à análise estrutural (RS/WS). Muito mais difícil de detectar que o LSB
  sequencial. O decodificador recalcula o mesmo mapa de custo (sobre os 7 bits
  superiores, para que o embedding não o desloque) e acha exatamente as mesmas
  posições.
- **adicionado** — O usuário escolhe o método: toggle no Encoder entre Padrão
  (maior capacidade) e Adaptativo (anti-detecção). O método padrão segue
  intocado e compatível. Adaptativo é mutuamente exclusivo com a alta capacidade
  (RGB), pois usa só o canal azul.
- **adicionado** — O adaptativo combina com AES e embaralhamento por senha:
  posicionamento em textura + conteúdo cifrado + ordem dos bits embaralhada.
- **validado** — Testado contra outras ferramentas, que não conseguem decodificar
  a imagem (nem a mensagem sem senha) — furtividade real confirmada no mundo real.
- **removido** — Changelog retirado do site (mantido apenas como documento).

---

## ⚙ TROCA DE VERSIONAMENTO (entre v2.9.1 e v2.10)

A numeração foi reorganizada aqui. Até a **v2.9.1**, o projeto misturava duas
leituras que colidiam: "decimais por dezenas" (v2.01...v2.09, v2.10...v2.22) e
semver (v2.3...v2.9). O problema central: **v2.09 e v2.9 são numericamente a
mesma coisa**, e ambas teriam "2.10" como sucessor — uma ambiguidade real.

A partir da **v2.10**, adotou-se **semver puro**:
- **maior.menor.patch** (ex: 2.11.1)
- recurso novo / capacidade nova → sobe o **menor** (2.11, 2.12...)
- correção / ajuste / polish → sobe o **patch** (2.10.1, 2.11.1...)
- reescrita radical → sobe o **maior** (3.0)
- régua: **o impacto na capacidade do usuário, não o tamanho do diff**
- forma enxuta para versões maiores: "2.10" (não "2.10.0"); terceiro número só
  em patches

> As versões abaixo (v1.0 → v2.9.1) preservam a numeração original do site.
> A reorganização final do histórico antigo, se desejada, fica para depois.

---

## v2.9.1 — 2026-06-19
**Refino de UI: limpar senha no encoder, borda da tabela, destaque adversarial**

- **adicionado** — Botão limpar na senha do Encoder: um "x" limpa a chave de
  codificação (visível só quando há texto), igual ao Decoder. A chave do encoder
  é mantida entre tentativas (não é limpa ao trocar de imagem).
- **corrigido** — Borda superior da tabela de indicadores: agora que a tabela
  está separada dos scores, o topo dela volta a ser fechado (borda completa +
  cantos arredondados).
- **alterado** — Aviso adversarial: a string encontrada agora é destacada (fundo
  próprio em caixa, fonte maior), com o motivo como rótulo menor acima.

## v2.9.0 — 2026-06-19
**Extração de mensagem sem header (estatística autoriza a exibição)**

- **adicionado** — Mensagens sem header de ferramenta agora são exibidas: quando
  a estatística dos LSBs (RS/WS/qui-quadrado) confirma embedding, qualquer texto
  coeso recuperado pelo deep scan é mostrado como mensagem real — mesmo curto,
  mesmo com printable baixo, mesmo sem header STEGO/JOI. A prova de que é
  mensagem vem da estatística, não de o texto ser longo ou totalmente legível.
- **adicionado** — Resistente à fragmentação: como é a detecção estatística (não
  o tamanho do texto) que autoriza a exibição, dividir a mensagem em pedaços
  minúsculos não escapa à detecção — cada fragmento embutido acende a estatística
  dos LSBs. O texto recuperado pode incluir algum ruído ao redor, que o usuário
  distingue facilmente da mensagem real.

## v2.8.2 — 2026-06-19
**Correção do aviso C2PA (independente do offline, sob o threat)**

- **corrigido** — Aviso de falso-positivo C2PA agora funciona offline: estava
  preso à seção neural e só aparecia no modo Pro. Agora é independente dos
  modelos neurais e aparece abaixo do threat score sempre que o C2PA é confirmado
  — como o C2PA é detectado na análise offline, o aviso aparece com ou sem o
  backend Pro.

## v2.8.1 — 2026-06-19
**Lote de correções de UX**

- **adicionado** — Aviso de falso-positivo C2PA: quando uma imagem é certificada
  como gerada por IA (C2PA) e os modelos neurais disparam, uma nota agora explica
  que os scores podem ser falsos positivos (os modelos são treinados em fotos
  reais).
- **adicionado** — Senha do Decoder: botão limpar: um "x" limpa a chave (visível
  só quando há texto), e o campo é limpo automaticamente ao carregar uma nova
  imagem para que uma chave anterior não afete a próxima análise.
- **corrigido** — Os botões dos diálogos Limpar/Limpar Análise (Confirmar/Cancelar)
  agora são traduzidos para o inglês.
- **corrigido** — Accordion Protocolo: "Texto recuperado" agora condiz com o
  veredito consolidado em vez de contradizer o status de decode (mostra
  "detectado, não extraível" quando o corpo foi descartado como ruído).

## v2.8.0 — 2026-06-19
**Embaralhamento de posições por senha**

- **adicionado** — Embaralhamento de posições (PRNG): com senha, a ordem em que
  os bits da mensagem são embutidos é embaralhada por um PRNG semeado pela senha
  (Fisher-Yates). Mesmo quem sabe que é LSBM e extrai os bits na ordem física
  obtém uma sequência embaralhada — sem a senha não há como remontá-la.
- **adicionado** — Defesa em profundidade: combinado com o AES-256-GCM, a senha
  agora protege em duas camadas — o conteúdo é cifrado E as posições dos bits são
  embaralhadas. O cabeçalho continua legível para a ferramenta ainda detectar que
  há uma mensagem (protegida) presente.
- **alterado** — Compatível com versões anteriores: imagens sem embaralhamento
  são decodificadas exatamente como antes.

## v2.7.0 — 2026-06-18
**Criptografia AES-256-GCM (substitui XOR)**

- **adicionado** — Criptografia de verdade: a chave opcional agora cifra mensagens
  com AES-256-GCM (chave derivada via PBKDF2, 150k iterações) em vez da cifra XOR
  fraca. Mesmo que os bits sejam extraídos, o conteúdo é ilegível sem a senha.
- **adicionado** — Detecção de adulteração: o GCM autentica os dados — senha
  errada ou qualquer modificação é detectada e reportada como chave incorreta.
- **alterado** — Imagens cifradas com o XOR antigo ainda podem ser decifradas
  (compatível com versões anteriores).

## v2.6.0 — 2026-06-18
**Detecção de conteúdo adversarial**

- **adicionado** — Aviso de conteúdo adversarial: uma nova camada sinaliza texto
  embutido no arquivo que parece projetado para manipular analistas ou sistemas
  de IA — instruções em estilo prompt injection e afirmações contra-forenses
  (ex: "nenhum conteúdo oculto"). É aditiva e estrutural, não uma lista fixa de
  frases, então pega variações e nunca suprime o que a ferramenta já mostra
  (dados C2PA, URLs, etc. seguem visíveis e sem marcação).
- **adicionado** — Aviso de segurança distinto, separado do veredito de
  esteganografia — conteúdo adversarial manipula o analista; esteganografia
  esconde dados. O aviso não altera o threat score.

## v2.5.10 — 2026-06-18
**Escala graduada de indício neural**

- **corrigido** — Interpretação por método agora graduada em 5 níveis: Nenhum
  (0%), Mínimo (1-19%), Fraco (20-40%), Moderado (41-84%), Forte (85-100%).
  Corrige o texto que chamava 20% de "nenhum indício" — apenas 0% é "nenhum".

## v2.5.9 — 2026-06-18
**Refino de UI — accordions exclusivos + interpretação neural mais clara**

- **alterado** — Accordions exclusivos: abrir um módulo forense ou método neural
  agora fecha os outros, então os painéis não ficam mais todos abertos acumulados.
- **corrigido** — Interpretação de alta confiança precisa: a explicação por método
  não afirma mais que ataques estruturais (RS/WS) podem corroborar métodos
  adaptativos — para LSBM/HILL/etc. agora explica que os ataques estruturais não
  os detectam, então o modelo neural é o detector confiável.
- **alterado** — O rodapé da seção neural agora mantém a dica de toque (esquerda)
  e o tempo de processamento (direita) na mesma linha; o texto da interpretação
  de 0% foi esclarecido.

## v2.5.8 — 2026-06-18
**Barras neurais clicáveis (interpretação por método)**

- **adicionado** — Barras de método clicáveis: cada barra de probabilidade neural
  (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide) agora expande ao toque para
  explicar o que é o método e como ler sua probabilidade — transformando números
  crus em contexto investigativo.

## v2.5.7 — 2026-06-18
**Validação UTF-8 da ilha (corrige detecção de mensagem)**

- **corrigido** — Validação de UTF-8 bem-formado: a correção anterior aceitava
  qualquer byte alto, o que fazia o lixo binário da cauda se fundir à ilha de
  texto e fazia algumas mensagens deixarem de ser detectadas. O detector agora
  valida sequências UTF-8 corretas, então mensagens acentuadas extraem por
  completo E mensagens seguidas de ruído binário continuam sendo detectadas.
- **corrigido** — Caractere de ruído na cauda removido: um caractere residual do
  lixo binário colado à mensagem (ex: "...DO.m") agora é removido quando aparece
  logo após pontuação final.

## v2.5.6 — 2026-06-18
**Correções na extração de mensagem (acentos + byte de tamanho)**

- **corrigido** — Mensagens com acentos não são mais truncadas: o detector de
  ilha de texto quebrava em caracteres multibyte UTF-8 (á, é, ç, ã...), cortando
  a mensagem no meio da palavra. Agora aceita bytes de continuação/início UTF-8,
  então mensagens em português/espanhol são extraídas por completo.
- **corrigido** — Byte de tamanho residual removido: formatos de ferramenta
  (JOI/STEGO) colocam um byte de tamanho logo após o header que vazava como
  caractere fantasma no início da mensagem (ex: "QEsta..."). Agora é removido
  quando há header de ferramenta conhecido.
- **alterado** — Buffer de captura da mensagem aumentado de 120 para 1000
  caracteres para evitar truncar mensagens mais longas.

## v2.5.5 — 2026-06-18
**Correções de regressão — headers JOI + nota offline**

- **corrigido** — Mensagens com headers de terceiros voltam a ser exibidas:
  mensagens LSB com header de ferramenta (ex: JOI_LSB1/2) estavam sendo
  suprimidas como ruído porque só o header nativo STEGO era reconhecido. Qualquer
  header de ferramenta detectado agora conta como mensagem real.
- **corrigido** — Nota de limitação offline não aparece mais com o Pro online: um
  bug de escopo fazia a nota aparecer mesmo com o servidor neural conectado.

## v2.5.4 — 2026-06-18
**Nota de limitação do modo offline**

- **adicionado** — Nota de limitação do modo offline: quando o modo Pro está
  indisponível e há suspeita parcial, a ferramenta agora informa que a análise
  offline detecta principalmente LSB Replacement e anomalias estruturais,
  enquanto métodos adaptativos (LSB Matching, HILL) podem passar despercebidos
  até o modo Pro neural estar online. Nenhum score é alterado — apenas comunica
  os limites da detecção offline.

## v2.5.3 — 2026-06-18
**Correções no fluxo de veredito + posição da nota**

- **corrigido** — Threat score agora reflete a detecção neural: o score
  exibido/exportado era calculado antes da fase neural terminar, deixando stego
  real (ex: foto real com mensagem de outra ferramenta) subnotificado. O score
  agora é recalculado após os resultados neurais chegarem.
- **corrigido** — Ruído não é mais exibido como mensagem offline: a consolidação
  do veredito agora roda mesmo sem o servidor Pro, então o ruído de deep scan é
  suprimido em vez de exibido como mensagem oculta.
- **alterado** — A nota "esteganografia pode parecer sintética" foi movida do
  threat score para a seção de origem, e também é exibida dentro do módulo
  Probabilidade de Origem.

## v2.5.2 — 2026-06-17
**Calibração neural — menos falsos positivos**

- **corrigido** — Falsos positivos neurais reduzidos: imagens de IA/sintéticas
  disparavam os modelos espaciais (LSBR/LSBM/HILL) a ~100% mesmo sem mensagem
  oculta. O sinal neural agora é desconfiado em imagens de IA e exige corroboração
  para elevar o threat score.
- **corrigido** — Artefato do OutGuess filtrado: o modelo OutGuess disparava a
  100% em JPEGs comuns (artefato de compressão). Um sinal isolado de OutGuess sem
  corroboração estrutural agora é ignorado.
- **alterado** — A detecção neural agora contribui para o threat score apenas com
  corroboração estrutural (RS/WS, header ou texto legível), com pesos contidos
  para evitar inflação do score.

## v2.5.1 — 2026-06-17
**Consolidação de veredito honesto + recalibração de ameaça**

- **corrigido** — Fim do ruído exibido como mensagem: quando os modelos neurais
  detectam esteganografia mas a extração sequencial só produz ruído, a ferramenta
  agora diz isso honestamente em vez de mostrar o ruído como se fosse a mensagem
  oculta.
- **alterado** — Threat score recalibrado: sinais que indicam origem sintética/IA
  (ruído de sensor baixo, clusters de cor rara) não inflam mais sozinhos o score
  de ameaça de esteganografia — só contam quando corroborados por evidência real
  de stego.
- **adicionado** — Detecção neural agora alimenta o threat score de forma
  inteligente: detecção neural de alta confiança reforça o score; confiança
  parcial contribui moderadamente.
- **adicionado** — Nota interpretativa quando os sinais neural e estrutural
  (RS/WS) discordam — indicando provável método adaptativo ou LSB matching que
  exige a chave original para extrair.

## v2.5 — 2026-06-16
**Análise neural via backend Pro**

- **adicionado** — Análise neural (Pro): quando o servidor está disponível, as
  imagens são analisadas por 6 modelos EfficientNet B0 treinados no ALASKA2
  (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide).
- **adicionado** — Nova seção de resultados neurais abaixo do Threat Score, com
  uma barra de probabilidade por método e um veredito consolidado.
- **adicionado** — Status ao vivo no terminal: anuncia o modo Pro quando o
  servidor está online e mostra os métodos sendo processados durante a análise.
- **alterado** — A análise continua 100% funcional offline: a camada neural é
  aditiva e degrada graciosamente se o servidor estiver indisponível.

## v2.4 — 2026-06-15
**Encoder RGB de alta capacidade + detecção neural**

- **adicionado** — Modo alta capacidade (RGB) no encoder: espalha a mensagem
  pelos 3 canais de cor, triplicando a capacidade (~3 bits/pixel).
- **adicionado** — Heurística de embedding neural no analisador: sinaliza a
  assinatura tipo GAN de métodos como o SteganoGAN. Mostrada honestamente como
  suspeita, não prova.
- **alterado** — O header do encoder agora registra o modo, então a decodificação
  continua automática e imagens antigas ainda decodificam.
- **adicionado** — Modal de ajuda: notas sobre o modo RGB e sobre a heurística
  neural.

## v2.3 — 2026-06-15
**Encoder LSB Matching + ataques estruturais**

- **alterado** — Encoder trocou LSB Replacement por LSB Matching (LSBM), muito
  mais difícil de detectar estatisticamente.
- **adicionado** — Ataques estruturais RS e WS que detectam especificamente o LSB
  Replacement (OpenStego, OpenPuff) e estimam a taxa de embedding.
- **corrigido** — Tradução: "CA signatária" e fragmentos de detalhe de crominância
  agora localizam corretamente.

## v2.22 — 2026-06-14
**SEO + versão pública**

- **adicionado** — robots.txt e sitemap.xml com hreflang bilíngue; verificação no
  Google Search Console.
- **alterado** — Guia rápido do Decoder reordenado para um fluxo mais claro.

## v2.21 — 2026-06-13
**Interface bilíngue completa (EN/PT)**

- **adicionado** — Internacionalização EN/PT completa de toda a interface, com
  troca de idioma ao vivo que re-renderiza os resultados.
- **adicionado** — Dropdown de engrenagem com a ajuda e o seletor de idioma;
  ajuda agora acessível no mobile.
- **alterado** — Veredito de origem por IA e notas de heurística reorganizados e
  traduzidos.
- **corrigido** — Corrigido "Undefined" nos scores de Probabilidade de Origem;
  falhas do terminal e do accordion ao trocar idioma.

## v2.20 — 2026-06-12
**Classificador de Probabilidade de Origem (4 categorias)**

- **adicionado** — Classificador de origem em 4 categorias: Foto, Screenshot,
  Arte Digital, IA — cada uma com seu score e veredito de origem mais provável.
- **adicionado** — Detector de pipeline de rede social (recompressão de WhatsApp,
  Facebook, Instagram) e detectores de screenshot e arte digital.
- **alterado** — Limiares calibrados contra 21 fotos reais para reduzir falsos
  positivos em fotografia.

## v2.18 — 2026-06-11
**Investigador profundo de texto LSB**

- **adicionado** — Investigador de janela deslizante que varre todos os modos de
  extração LSB pela maior sequência de texto legível, funcionando com qualquer
  codificador.

## v2.15 — 2026-06-11
**Módulo C2PA + EXIF expandido**

- **adicionado** — Parser C2PA / Content Credentials: lê o manifesto e identifica
  15+ geradores de IA conhecidos e autoridades certificadoras.
- **adicionado** — EXIF expandido: detecção de software de IA, identificação de
  câmera real, GPS e dados de certificado.

## v2.12 — 2026-06-10
**Análise de crominância, DCT e gradientes**

- **adicionado** — Módulos de crominância (YCbCr), uniformidade de blocos DCT e
  gradientes para identificar traços de imagem sintética.

## v2.09 — 2026-06-10
**Primeira pontuação de origem sintética**

- **adicionado** — Score de IA (0–100) a partir de dimensões típicas de geradores,
  ausência de EXIF de câmera, ausência de ruído de sensor e entropia regional
  uniforme.

## v2.0 — 2026-06-09
**Encoder adicionado → renomeado STEGO·STUDIO**

- **adicionado** — Encoder LSB: esconde mensagens no canal azul com cifra XOR
  opcional. A ferramenta passa a ler+escrever e é renomeada STEGO·STUDIO.
- **adicionado** — Interface em duas abas: Encoder e Analyzer·Decoder.

## v1.0 — 2026-06-08
**STEGO·SCAN — protótipo inicial**

- **adicionado** — Primeiro analisador forense com 8 módulos (metadados, strings
  ocultas, chi-quadrado LSB, OCR/QR, frequência, entropia, anomalias de cor) e um
  relatório narrativo por IA.
- **adicionado** — Threat Score ponderado e a interface dark cyberpunk.
