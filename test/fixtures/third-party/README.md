# Third-party immutable fixtures

These files are frozen external/interoperability inputs. They are not generated
by STEGO·STUDIO during the test run.

## `cicada3301_first_message.jpg`

- Source: Wikimedia Commons, `File:Cicada3301's First Message.jpg`.
- Frozen dimensions/size at import: 509×503, 29,261 bytes.
- Commons describes it as the first Cicada 3301 message and marks the file public domain.
- The production OutGuess decoder must recover the complete 535-byte embedded
  payload with `foreignTruncated:false` semantics.
- SHA-256 of the recovered UTF-8 text:
  `7dbf268b1b356527cf4a2dc105c0dd1f6d2d703291dda24dd9e98e22851d6f40`.

## `clean/` negative JPEG corpus

Eight deterministic JPEGs without embedded payloads are frozen as negative
controls (solid, checker, graphic, noise and photo-like patterns at varied JPEG
qualities). The production OutGuess compatibility decoder must return `null`
for every one of them. This negative corpus accompanies the real Cicada positive
fixture because a complete OutGuess recovery can now become terminal forensic
evidence; the positive case alone would not constrain false positives.

The test runtime is offline and zero-dependency: this fixture is committed once
and no external tool/network access is required by CI.

F17 does **not** claim that this single binary fixture exhausts third-party
compatibility. OpenStego and Steghide still have directed engine contracts and
historical validation; adding immutable binaries from those tools remains a
useful corpus expansion rather than a reason to weaken this fixture.
