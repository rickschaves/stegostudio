# `spread/` — vetores congelados do wire P1A (`STC_W_FLAG_SPREAD = 0x20 no w-byte STC`)

Nova família de fixture, criada quando a v2.43.28_R2 interna passou a espalhar o pool
candidato do STC. A família anterior (`legacy/formato-A/`, `v3/`) permanece intacta:
o wire sequencial continua sendo lido e continua sendo testado.

## O que está congelado

Além dos vetores de cursor, `manifest.json` prende hashes de `cover.png`, `encoded_passwordless.png`, `encoded_f21.png` e `plain.txt`. O CHECK 84 precisa decodificar os dois PNGs e recuperar exatamente o plaintext congelado.


`spread_vectors.json` guarda, para sete configurações de `(start, available, count,
width, height, stcW)`:

- o `seed` público devolvido por `stcSpreadSeed()`;
- os oito primeiros e os quatro últimos índices lógicos escolhidos;
- o SHA-256 da sequência completa, serializada como `Int32Array` little-endian.

Os índices são **lógicos**: posições na lista de pixels opacos, não offsets de pixel.

## Por que existe, separado do CHECK 83

O CHECK 83 faz encode → decode dentro da mesma build. Isso prova que os dois lados
concordam entre si — e é exatamente por isso que ele não detecta deriva de wire: se
alguém mudar o seed, o jitter ou a estratificação, encoder e decoder mudam juntos, o
round-trip continua verde, e toda imagem já escrita para de abrir em silêncio.

Recriar estes vetores com o código atual só provaria que o código atual concorda
consigo mesmo. Por isso eles são gerados **uma única vez** e não são regenerados.

## Se o CHECK 84 ficar vermelho

Não regenere o JSON para fazer o teste passar. Duas leituras possíveis:

1. **A mudança de wire foi deliberada.** Então ela precisa de decisão registrada, de
   sinalização de formato (o wire novo tem de ser distinguível do antigo na imagem) e
   de uma **nova** família de fixture ao lado desta, que fica onde está.
2. **É regressão.** Corrigir o código.

## Cobertura das sete configurações

| caso | por que está aqui |
|---|---|
| payload de 1% | o caso que motivou a P1A; pool muito espalhado |
| cover 128×128, `stcW=16` | `stcW` máximo |
| `count == available` | degeneração para a sequência contígua |
| `start = 1792` | pool F21, começando após o bootstrap |
| cover grande, payload pequeno | razão `count/available` mínima |
| `count == available - 1` | um único estrato de tamanho 2 |
| `count == 1` | estrato único cobrindo o pool inteiro |

## Origem

Os sete vetores de **cursor** foram gerados na candidata v2.43.28 INTERNA_FIX (SHA-256 `d5f31520…`) e permanecem válidos porque a R2 não alterou a estratificação. A R2 acrescenta `manifest.json` + dois PNGs imutáveis (`passwordless` e `F21`) para congelar também a localização do sinal no w-byte e a capacidade de abrir imagens já escritas.
