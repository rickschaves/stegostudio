# F4 / F9 — Medição real dos canais de rede social

Iniciado em 18/07/2026. WhatsApp medido; Instagram, Facebook e X em andamento.

Teste executado pelo Rick com imagens reais. 20 arquivos, 3 formatos de origem
(baseline, baseline optimized, progressivo — todos Photoshop qualidade 12),
2 tamanhos e as 2 qualidades de envio do WhatsApp.

## FATOS MEDIDOS

### 1. Redimensionamento — existe um teto, e abaixo dele NÃO redimensiona
| origem | envio | volta como |
|---|---|---|
| **1200×800** | padrão | **1200×800 — INALTERADO** |
| 3000×2000 | padrão | 1600×1066 |
| 3000×2000 | HD | 2560×1706 |

### 2. O canal NORMALIZA tudo — prova por hash
Os três formatos de origem produzem saída **byte a byte idêntica** (mesmo MD5):
- 1200×800 (os 3) → `8370552aa4683deb49ffb799ae9923de`
- 3000×2000 padrão (os 3) → `6af3fe9e22aa51a953c144375c6b73d3`
- 3000×2000 HD (os 3) → `5373585e097273597641bedeef3c75a1`

**Conclusão:** o WhatsApp decodifica para pixels e re-codifica com pipeline
próprio fixo. O formato de origem é **irrelevante** — inclusive progressivo,
que volta como baseline.

### 3. Tabela de quantização FIXA e agora CONHECIDA
Idêntica em 1200×800, padrão e HD:
- **luma:** `[3,2,2,2,2,2,3,2, 2,2,3,3,3,3,4,6, ...]` — soma 592
- **croma:** `[3,3,3,4,3,4,8,4, 4,8,16,11,9,11,16,16, ...]`
(referência: Photoshop q12 tem soma luma 95 — quase sem perda)

### 4. Grade de blocos preservada
1200×800 = 150×100 blocos de 8×8 exatos. Sem redimensionamento, a grade DCT
se mantém alinhada — condição necessária para sobrevivência em domínio DCT.

### 5. LSB morre como previsto
PNG com mensagem enviado como FOTO volta como JPEG → payload LSB destruído.
Confirma o aviso que a ferramenta já dá.
### 6. ✅ Envio como DOCUMENTO preserva a mensagem — CONFIRMADO
Confirmado pelo Rick (teste pessoal com terceiro, nas primeiras versões da
ferramenta): PNG com mensagem enviado pelo WhatsApp **como documento/arquivo**
chegou íntegro e o destinatário **recuperou a mensagem perfeitamente**.

Isso **valida a recomendação que a ferramenta já faz** na barra rolante
("envie como arquivo/documento para preservar os LSBs") — que até então nunca
tinha sido verificada. Consequência importante: **o modo LSB atual já tem um
canal funcional de ponta a ponta**. O modo robusto (F4) não é a única saída
para compartilhar; ele resolve o caso de quem **não pode** ou não quer usar o
envio como documento.

## O QUE ISSO MUDA

**Para a F4:** o problema deixa de ser "robustez geral contra recompressão" e
vira **"sobreviver a UMA requantização com tabela conhecida, sem redimensionar,
com grade alinhada"**. É um problema muito mais fechado e tratável.
Escopo honesto do modo robusto: *"sobrevive à recompressão do WhatsApp quando a
imagem está abaixo do teto de redimensionamento"* — não "sobrevive a redes
sociais". E o produto pode ajudar: o modo robusto pode **redimensionar ele
mesmo** para abaixo do teto, em vez de deixar a plataforma fazer isso.

**Para a F9:** o `detectSocialPipeline` atual identifica plataforma **só pelo
nome do arquivo** — quebra assim que alguém renomeia (aconteceu com os arquivos
deste teste e com a imagem do Cicada, de nome UUID). Agora temos a tabela de
quantização real do WhatsApp: dá para detectar pela **estrutura do arquivo**,
robusto a renomeação. Primeiro alvo concreto da F9.

## PRÓXIMO PASSO PROPOSTO (barato, antes de investir 3-4 sessões)
**Experimento de viabilidade em Python**, usando a tabela real medida acima:
imagem → DCT → embutir QIM → IDCT → salvar com a tabela do WhatsApp → recarregar
→ DCT → extrair. Isso responde "a F4 funciona?" **sem** precisar construir antes
o codificador JPEG em JS (a Fatia A, que é a cara). Se o payload sobreviver com
ECC, a frente se justifica; se não sobreviver, economizamos 3-4 sessões.


---

# PROTOCOLO PARA AS DEMAIS PLATAFORMAS (Instagram, Facebook, X)

**⚡ Simplificação derivada do dado:** como ficou PROVADO que o formato de origem
é irrelevante (saídas byte a byte idênticas), **não é preciso repetir os três
formatos**. Basta **um formato por tamanho** — corta ~2/3 dos envios.

**Por plataforma, enviar apenas 2 imagens:**
1. `jpg_1200x800_01` (baseline) — testa se existe teto sem redimensionamento
2. `jpg_3000x2000_01` (baseline) — testa o comportamento acima do teto

**Uma verificação extra, em UMA plataforma só** (sugiro o Instagram): enviar
também o `_03` (progressivo), para confirmar se a normalização observada no
WhatsApp vale em geral. Se der saída idêntica ao baseline, generalizamos.

**Anotar para cada arquivo que voltar:**
- Plataforma e **caminho** usado (feed, story, mensagem direta, documento).
  Caminhos diferentes costumam ter pipelines diferentes.
- Opção de qualidade, se a plataforma oferecer (como o padrão/HD do WhatsApp).
- ⭐ **O nome de arquivo ORIGINAL que a plataforma atribuiu**, antes de renomear.
  Isso alimenta o cruzamento com o `detectSocialPipeline`, que hoje só olha nome.

**Atenção:** algumas plataformas devolvem **WebP** em vez de JPEG (ou variam
conforme o caminho de download: app vs navegador). Se voltar WebP, isso também é
dado — significa que naquele canal não há coeficiente DCT de JPEG para preservar,
e o modo robusto não se aplica ali.

---

# RODADA 2 — X, FACEBOOK E INSTAGRAM (18/07/2026)

Instagram enviado como **mensagem direta**; X e Facebook como **post no feed**.

## A. REDIMENSIONAMENTO — três de quatro preservam 1200×800

| plataforma | 1200×800 → | 3000×2000 → |
|---|---|---|
| **X** | **1200×800 (preserva)** | **3000×2000 (PRESERVA!)** |
| **WhatsApp** | **1200×800 (preserva)** | 1600×1066 / 2560×1706 (HD) |
| **Facebook** | **1200×800 (preserva)** | 2048×1365 |
| **Instagram (DM)** | **1080×720 (REDUZ)** | 1080×720 |

**⭐ Conclusão de produto:** com saída de **largura ≤ 1080 px, NENHUMA das quatro
redimensiona.** É um número concreto para o modo robusto mirar.
**O X não redimensiona nem 3000×2000** — surpresa boa.

## B. AGRESSIVIDADE DA COMPRESSÃO (soma da tabela luma — maior = pior)

| plataforma | soma luma | croma | leitura |
|---|---|---|---|
| **X** | **95** (109 em 3000×2000) | 166 | quase sem perda — e **4:4:4**, sem subamostragem de croma |
| Photoshop q12 (origem) | 95 | — | referência |
| **WhatsApp** | 592 | 891 | moderado |
| **Facebook** | 1693 | 1420 | agressivo |
| **Instagram** | **1858** | **2780** | **o pior caso** |

O X entrega qualidade equivalente à origem. O Instagram é ~20× mais agressivo.

## C. NORMALIZAÇÃO DO FORMATO DE ORIGEM (baseline vs progressivo)
Confirmada em X, Facebook e Instagram(1200×800): saída **byte a byte idêntica**.
⚠️ **Exceção:** Instagram com 3000×2000 deu bytes DIFERENTES (148324 vs 155493)
apesar da mesma dimensão final. Sugere etapa de redimensionamento no cliente,
não determinística. **Vale repetir esse caso** para confirmar.

## D. BANCO DE FINGERPRINTS (para a F9) — quatro plataformas distinguíveis

| plataforma | SOF | subamostr. | assinatura de marcadores | luma[0:8] |
|---|---|---|---|---|
| **WhatsApp** | SOF0 baseline | 4:2:0 | APP0→APP2→DQT×2→SOF0→DHT×4 | `3,2,2,2,2,2,3,2` |
| **X** | **SOF2 progressivo** | **4:4:4** | APP0→DQT×2→SOF2→DHT×2 | `1,1,1,1,1,1,1,1` |
| **Facebook** | **SOF2 progressivo** | 4:2:0 | APP0→**APP13**→DQT(1 seg)→SOF2→DHT | `9,8,8,16,11,16,16,15` |
| **Instagram** | SOF0 baseline | 4:2:0 | **APP1**→APP0→APP2→DQT×2→SOF0→DHT×4 | `8,6,6,7,6,5,8,7` |

**Peculiaridade do Facebook:** um único segmento DQT com **luma em 8 bits e
croma em 16 bits** (Pq=0 e Pq=1 misturados, len=196). Isso por si só já é
assinatura — quase nenhum codificador faz isso.

As quatro são separáveis com folga por: SOF + subamostragem + sequência de
marcadores + tabela. Detector estrutural viável, **imune a renomeação**.

## E. ⚠️ ACHADO CRÍTICO PARA A FERRAMENTA HOJE (não é F4)
**Facebook e X entregam JPEG PROGRESSIVO.** O nosso leitor DCT não suporta
progressivo — então, para imagens vindas dessas duas plataformas:
- o módulo **Analyzer-JPEG fica cego** (retorna `available:false`);
- o **Decoder não consegue nem tentar** Steghide/OutGuess.

Ou seja: **metade das principais plataformas produz imagens que a nossa camada
DCT não consegue abrir.** Isso reposiciona o suporte a progressivo — hoje ele é
só uma "mensagem amigável" e passa a ser uma lacuna de cobertura real.

---

# ⭐⭐ ACHADO MAIOR — O X (TWITTER) NÃO RECOMPRIME. ELE TRANSCODIFICA SEM PERDA.

## A prova
`jpegtran -progressive -copy none` aplicado ao original do Photoshop produz um
arquivo **byte a byte idêntico** ao que o X devolve — **mesmo MD5**, nos dois
tamanhos testados:
- 1200×800 → `c21a1695542d9ae4f4d47cb9a740076a` (847.729 bytes, ambos)
- 3000×2000 → `15b4153632182e545721f35bb5d56011` (2.562.719 bytes, ambos)

O X portanto: **preserva os coeficientes DCT bit a bit**, **preserva as tabelas
de quantização da origem**, reescreve apenas a codificação de entropia como
progressiva, e remove os metadados (`-copy none`). Não há requantização.

Isso explica os números da rodada anterior: a "tabela do X" com soma 95 era, na
verdade, a tabela do **Photoshop q12**. E explica por que 3000×2000 não foi
redimensionado — ele não reprocessa a imagem, só reembala.

## CONSEQUÊNCIA 1 — para a F4 (modo robusto)
**Esteganografia em domínio DCT sobrevive ao X INTACTA.** Steghide e OutGuess
passam pelo X sem perder nada. Para o X, o modo robusto é **desnecessário** —
o que já temos bastaria, se conseguíssemos ler o resultado.

## CONSEQUÊNCIA 2 — para a ferramenta HOJE (a mais importante)
**Somos cegos exatamente na plataforma que preserva tudo.** O X devolve
PROGRESSIVO, e o nosso leitor DCT não abre progressivo. Ou seja: a única grande
plataforma que preserva payloads em DCT é justamente aquela cujas imagens a
nossa camada DCT não consegue abrir.

➡️ **Suporte a JPEG progressivo sobe de "mensagem amigável" para prioridade
alta.** Sem ele: Facebook e X (duas das quatro) ficam sem Analyzer-JPEG e sem
tentativa de Steghide/OutGuess — e o X é o caso onde haveria mais a recuperar.

## CONSEQUÊNCIA 3 — para a F9 (fingerprint)
**O X não tem assinatura de quantização própria** — ele carrega a da origem.
Tentar identificá-lo pela tabela gera **falso positivo garantido** em qualquer
arquivo do editor que gerou o original (comprovado: um JPEG do Photoshop q12
casava como "X"). Por isso o X foi **deliberadamente deixado de fora** do banco
de perfis. É achado, não omissão.

Regra de projeto derivada: **só entra no banco a plataforma que RECODIFICA com
tabela própria.** Quem preserva a origem não é identificável assim — e dizer
isso é mais honesto do que chutar.

## Estado do detector (F9, fatia 1)
`jpegStructure()` (parser estrutural, funciona em progressivo) +
`identifyJpegPlatform()` com portas duras de SOF e subamostragem.
**Validação: 11/11, zero falso positivo** — acerta WhatsApp, Facebook e
Instagram nos dois tamanhos, e corretamente **não afirma nada** para o X e para
os originais do Photoshop (baseline e progressivo).


---

# RODADA 3 — TESTE DE CAMPO COM PAYLOAD REAL (19/07/2026)

Duas imagens 1080×720 com payload QIM real, postadas nas quatro plataformas.
Resultado completo em `RESULTADO_TESTE_CAMPO_F4.md`. O que muda aqui:

## ✅ CONFIRMADO
- **Envelope de 1080 px:** as dez voltaram em 1080×720 exatos. Nenhuma
  plataforma redimensionou. O número vale.
- **Tabelas de Facebook (1693/1420) e Instagram (1858/2780):** extraídas dos
  arquivos de campo, **batem exatamente** com as da rodada 2. A medição anterior
  estava correta.

## ⚠️ CORREÇÃO 1 — o WhatsApp NÃO recomprime em 1080×720
Os arquivos voltaram **byte a byte idênticos** (mesmo MD5), **inclusive
enviados como foto** — tabela única de soma 369, que é a NOSSA.

Na rodada 1, 1200×800 voltou recomprimido com tabela própria (soma 592). Logo
**existe um limiar entre 1080 e 1200 px**. O WhatsApp inclusive avisou que não
havia opção HD "porque a original não está em HD" — ele classificou 1080×720
abaixo do patamar de processamento.

⚠️ **Implicação forte, ainda NÃO confirmada:** se isso valer em geral, o **modo
LSB atual sobreviveria ao WhatsApp enviado como foto** em 1080×720, sem modo
robusto nenhum. Antes de virar alegação de produto, exige teste controlado:
PNG com LSB, 1080×720, como foto, de um aparelho para OUTRO, pelo app do
celular.

## ⚠️ CORREÇÃO 2 — o X não é sempre sem perda
Tratamento diferente para as duas imagens do mesmo envio:
- imagem B (ruidosa): 1 tabela, soma 369 (a nossa) → sem perda, como na rodada 2
- imagem A (foto): 2 tabelas, somas 1109/1666, 323 KB → **recomprimiu**

A conclusão *"o X transcodifica sem perda"* vale **às vezes**, não sempre. O
critério de decisão dele é desconhecido. Para a F4 é benigno: mesmo
recomprimindo, deu 0,00% de BER em todos os Δ.

➡️ Para a F9 nada muda: o X continua fora do banco de fingerprints, e agora por
um motivo a mais — ele não tem sequer comportamento estável.

## 🆕 O Facebook faz algo além de requantizar
Ruído residual nos coeficientes de 8,67, contra 3,46 do Instagram — ~1,5× mais
do que a tabela dele sozinha explica. Grade 8×8 alinhada, sem atenuação. Sugere
segunda passada de codificação ou filtro interno. Não sabemos o quê; sabemos
quanto, e o modelo gaussiano com esse σ reproduz o BER medido.
