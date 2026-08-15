# STEGO·STUDIO — Pacote completo do repositório (v2.42.16)

Tudo que o pacote de trabalho precisa, sincronizado para a **v2.42.16 candidata
a smoke curto + rechecagem externa final**. Código público GPL-3.0 em `github.com/rickschaves/stegostudio`.

## Estado do deploy — conferir, não presumir

| onde | estado conhecido em 14/08/2026 |
|---|---|
| Cloudflare (produção) | **v2.42.2** — último estado confirmado nos documentos |
| GitHub working tree | Rick informou que o **HTML v2.42.10** foi atualizado; não inferir docs/Release |
| GitHub Release | **v2.42.2** — último estado confirmado |
| v2.42.11 | smoke manual passou, mas a revisão independente encontrou bloqueadores antes da publicação |
| v2.42.12 | smoke + rechecagem independente passaram; não publicada para incorporar a limpeza final sem reemitir hash |
| v2.42.13 | smoke funcional passou; único achado foi o destaque de senha errada recortado em duas barras verticais |
| v2.42.14 | smoke visual passou; rechecagem externa não encontrou blocker, mas apontou resíduos de coerência |
| v2.42.15 | smoke passou; rechecagem achou blocker de monotonicidade do Threat |
| este pacote | **v2.42.16** — fecha o blocker e endurece as catracas finais; aguarda smoke + rechecagem |

Nunca colapse Cloudflare, working tree e Release numa única versão sem conferir.

## O que mudou na v2.42.16

A v2.42.15 passou no smoke, mas a rechecagem independente encontrou um blocker:
com `hasHeader` já presente, adicionar `nativeHeaderMatched` podia trocar o rótulo
para `headerOnly` e, por acidente, desligar `hasStrongStego`. A mesma imagem caía
de Threat 70 para 40 e perdia três corroboradores.

A v2.42.16:

- separa **força** da evidência de **redação** do estado de protocolo;
- mantém `hasStrongStego` quando `studioWeight >= 40`, mesmo se `headerOnly` vencer
  o rótulo mais específico;
- adiciona ao CHECK 16 o fixture sem `cipherSuspicion` que teria pego a regressão;
- elimina a variável intermediária de nível no fechamento F1;
- catraca todas as propriedades top-level escritas em `report` no handler;
- exige statements exatos de `decStatusDecryptedKey` nas rotas principal/alternativa,
  impedindo sufixos invisíveis diferentes no JSON;
- registra explicitamente o contexto defensivo/autorizado em SECURITY, Bastão e
  mapa documental.

Não houve mudança de KDF, wire format, Encoder, Decoder, STC, HILL, robust codec,
SPEC F21 ou medições de redes sociais.

## O que mudou na v2.42.15

A rechecagem independente da v2.42.14 declarou **nenhum blocker**, mas encontrou
resíduos reais da mesma família de inconsistência. A v2.42.15 os fecha antes de
encerrar a série 2.42.x:

- Threat usa `resolveProtocolState()` para escolher a redação da evidência nativa;
  CHECK 16 cobre todas as oito combinações de `nativeExtracted`,
  `nativeHeaderMatched` e `hasHeader`;
- a nota de limitação offline não aparece ao lado de evidência já confirmada;
- a pista robusta JPEG preserva um payload já confirmado quando o conteúdo interno
  cifrado/comprimido não abre, em vez de afirmar “nada encontrado”;
- `flashKey()` usa timer único e `clearKeyFlash()`: chamadas repetidas não deixam
  placeholder/estado preso e **Limpar análise** remove o aviso;
- o aviso de chave usa contorno + ícone `⚠` + texto visível, portanto não depende só
  de cor;
- CHECK 18 ganhou catraca global do handler para novas escritas de
  `report.studio`/`decodeStatus` e proibição de mutação posterior via `lastReport`.

Não houve mudança de KDF, wire format, Encoder, STC, HILL, SPEC F21 ou medições de
redes sociais.

## O que mudou na v2.42.14

O smoke da v2.42.13 passou funcionalmente. Os relatórios das duas senhas válidas
continuaram publicamente equivalentes e o Console ficou limpo de exceções da
aplicação. Rick observou apenas que o feedback de senha errada aparecia como duas
linhas verticais laranja, em vez de contornar o campo inteiro.

A causa era puramente de CSS/DOM: `flashKey()` aplicava `box-shadow` ao input interno,
mas `.key-field` usa `overflow:hidden` e recortava topo/base da sombra. A v2.42.14
aplica a classe `key-flash` ao contêiner completo. Não há mudança de Decoder, F1,
evidência, KDF, Encoder ou formato de arquivo. O CHECK 18 ganhou uma guarda contra
o retorno do efeito ao input interno.

## O que mudou na v2.42.13

A rechecagem independente da v2.42.12 confirmou os quatro bloqueadores anteriores
como fechados e não encontrou blocker novo. Restaram pequenas inconsistências que
valia fechar antes de encerrar a série 2.42.x:

- três falhas da rota do header com **chave presente** ainda chamavam `flashKey()`
  antes de F1/terceiros terminarem; agora também usam `pendingKeyFlash`;
- `computeThreat` passou a usar a mesma precedência de evidência do Protocolo:
  `nativeExtracted > hasHeader > nativeHeaderMatched`;
- quando há extração autenticada + header público, o relatório preserva também a
  contagem `payloadBytes` já conhecida sem senha;
- CHECK 18 passou a exigir o **call site real** de `resolveNativeEvidence`, um único
  portão de `markNativeExtracted` e uma catraca na região final de
  `report.studio`/`decodeStatus`; as três mutações executadas pela revisão agora
  deixam o build vermelho;
- o round-trip sintético foi rotulado com seu escopo real: **MODE_B furtivo pelo
  codec PNG de produção**; fallback canvas/outros modos ficam para F17;
- uma frase viva em inglês (`decGuideAdaptive`) e o fallback correspondente do
  template ainda citavam o Modo Pro removido; foram sincronizados com o produto
  100% client-side atual.

A otimização de timing da F1 continua fora desta versão. A revisão mostrou que a
segunda derivação Argon2id é redundante e pode ser memoizada sem mudar o wire
format, mas performance será tratada numa frente própria para não misturar
correção de coerência com otimização.

## CHECK 18 — o que ele prova agora

O CHECK 18 continua sendo **um gate específico**, não uma suíte de segurança completa.
Ele agora combina:

1. vetores históricos reais da v2.29.0 — retrocompatibilidade de formato/cripto;
2. round-trip sintético 64×64 por uma portadora PNG real, com transparência —
   cobre `opaquePixels()`, âncora da cauda, offsets e codec PNG;
3. execução da função pura `resolveNativeEvidence()` numa tabela-verdade,
   inclusive `header nativo falhou → OpenStego recuperou texto`;
4. prova estática de que o pipeline **chama** essa função e possui um único portão
   de promoção nativa;
5. catraca na região final de `report.studio`/`decodeStatus`, além de guardas de
   flash adiado e precedência do renderer/Threat.

Harness esperado: **18/18 invariantes**. O CHECK 18 também executa um vetor JPEG robusto hostil para garantir que evidência externa já confirmada não seja apagada por falha do conteúdo interno. O smoke no navegador continua obrigatório.

## Estrutura

- `src/` — 16 módulos JavaScript + `styles.css` + `hash-wasm.js` + fontes;
- `template.html`, `build.js`, `test.js` — build e validação;
- `test/fixtures/` — fixtures legados e relatórios congelados;
- `test/check_layered_fixture.js` — vetores históricos F1;
- `test/check_layered_roundtrip.js` — round-trip sintético F1 por PNG;
- `test/check_robust_evidence.js` — vetor JPEG robusto hostil: envelope externo confirmado + AES interno divergente;
- `docs/STEGO_STUDIO_CHANGELOG.md` — histórico por versão;
- `docs/ROADMAP_STEGO_STUDIO.md` — fila/estado das frentes;
- `docs/STEGO_STUDIO_CONTEXTO_BASTÃO.md` — fonte de verdade operacional;
- `docs/DOCUMENTACAO_MAPA.md` — precedência e função dos documentos;
- `docs/COMPATIBILITY.md` — limites atuais dos motores de terceiros;
- `docs/MEDICAO_REDES_SOCIAIS.md` — caderno cronológico de medições;
- `docs/SPEC_F21_DERIVACAO_V3.md` — **Rev.5 histórica; não implementar antes da Rev.6**;
- `README.md`, `SECURITY.md`, `CONTRIBUTING.md` — documentação pública em inglês;
- `HTML_PRODUCAO/` — um único HTML de produção da versão corrente.

## Como buildar

```sh
node unpack_assets.js
node build.js
node test.js            # 18 invariantes
```

## Deploy Cloudflare

O pacote `STEGO_STUDIO_CLOUDFLARE_v2.42.16.zip` deve conter **11 arquivos na
raiz**: `index.html` + 10 estáticos. Upload direto no Cloudflare Pages substitui
o diretório inteiro; subir só `index.html` pode apagar favicons, OG image e
`sitemap.xml`.

## Bump de versão — cinco pontos

1. `build.js` — `VERSION`;
2. `src/main.js` — `_tool` do JSON;
3. `template.html` — versão no logo;
4. `src/ui.js` — primeira entrada do changelog da interface;
5. `docs/STEGO_STUDIO_CHANGELOG.md` — entrada histórica.

Nunca fazer substituição global cega de número de versão em documentação histórica.

## Estado técnico resumido

- **F1 / duas mensagens:** criptografia e retrocompatibilidade intactas; estado público simétrico preservado. v2.42.16 fecha também a regressão de monotonicidade do Threat e as catracas finais do pipeline.
- **Analyzer busy-state:** decisão permanente desde v2.42.10.
- **Steghide:** produto lê JPEG; BMP histórico não integrado; sem-cifra e
  rijndael-128/CBC são os pares decodificados atualmente.
- **C2PA:** manifesto detectado não significa assinatura validada; F16 pendente.
- **F21:** **não implementada**. A SPEC Rev.6 documental vem antes de qualquer v3.
- **Encoder:** lentidão percebida continua investigação, não regressão confirmada.
- **Timing F1:** camada alternativa ainda deriva a mesma chave Argon2id duas vezes;
  é trabalho redundante memoizável sem mudar o formato. Tratar como otimização separada.

## Próximo gate

1. smoke curto da v2.42.16: `2414`/`1424` corretas; `9999` com contorno + `⚠` + texto;
2. usar **Limpar análise** durante o aviso e confirmar que o estado some sem reaparecer;
3. rechecagem externa final focada no blocker **.15→.16** e nas catracas N3′/V4/V3;
4. sem blocker, sincronizar Cloudflare/GitHub/Release com a v2.42.16;
5. depois, SPEC F21 Rev.6 documental. QoL de Enter/swipe fica para uma rodada separada.

O padrão obrigatório de entrega de toda versão está definido no
`docs/STEGO_STUDIO_CONTEXTO_BASTÃO.md`: ZIP completo, HTML solto, ZIP Cloudflare,
`GITHUB_v<VER>.md` e `REVISAO_v<VER>.md` para auditoria externa.
