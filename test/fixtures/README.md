# Golden fixtures

Imagens **realmente produzidas** por uma versão histórica do encoder, guardadas
para provar, daqui a anos, que o decoder ainda abre o que a ferramenta escreveu.

Recriar um payload "parecido" com código moderno provaria apenas que o código
moderno concorda consigo mesmo. Por isso estes arquivos são gerados uma vez e
**nunca regenerados**.

## Por formato, não por release

Medido em 11/08/2026: as seis funções que definem o formato do payload
(`buildPayload`, `seedFromPassword`, `shuffledOrder`, `xorHeader`, `mulberry32`,
`extractLSBStudio`) são **idênticas da v2.35.2 à v2.42.16** (reconferido em 14/08/2026). Um conjunto cobre a
família inteira.

- `legacy/formato-A/` — v2.35.2 … v2.42.16

Quando a F21 mudar o formato, criar `formato-B/` e **manter A intacto**.

## Conteúdo

`cover.png` sintético e determinístico (sem dado pessoal), `encoded_*.png` nos
modos plain, shuffled e stealth, e `manifest.json` com senha de teste, plaintext,
SHA-256 de tudo e as opções usadas.

## F1 / duas camadas

`layered/v2.29.0/` guarda dois vetores compactos extraídos de uma imagem real
criada na v2.29.0: o payload AES-GCM nativo (79 bytes) e a cauda LSB da camada
alternativa (80 bytes). Eles preservam ciphertext/tags históricos sem colocar o
PNG original de 15,97 MB no repositório. O CHECK 18 decifra o payload nativo e
executa `extractDecoyTail` real contra a cauda alternativa.
