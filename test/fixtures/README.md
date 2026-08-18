# Golden fixtures

These files were produced by historical STEGO·STUDIO builds and are kept so future
Decoder versions can prove that they still open data written by older releases.

Recreating an equivalent payload with current code would only prove that current code
agrees with itself, so golden fixtures are generated once and are not regenerated.

## Grouped by wire format

The six functions that defined the legacy payload format (`buildPayload`,
`seedFromPassword`, `shuffledOrder`, `xorHeader`, `mulberry32`,
`extractLSBStudio`) remained byte-compatible across the recorded format-A range.

- `legacy/formato-A/` — historical format-A family

When a future wire format changes, add a new fixture family and keep the older family
intact.

## Contents

The legacy fixture set contains deterministic synthetic covers, encoded samples for the
supported modes, and manifests with **test-only passwords/plaintext** plus SHA-256 hashes
and encoder options. The values are fixtures, not credentials.

## Layered-message fixtures

`layered/v2.29.0/` stores compact historical vectors extracted from a real v2.29.0
carrier: the native AES-GCM payload and the alternative-layer LSB tail. Keeping the
compact vectors preserves historical ciphertext/tags without carrying the original
large PNG in the public repository.

## `third-party/`

Corpus binário externo imutável para interoperabilidade. O primeiro fixture é o JPEG público do primeiro desafio Cicada 3301, usado para prender a extração OutGuess real. Veja `third-party/README.md` para proveniência, hash e limites declarados.
