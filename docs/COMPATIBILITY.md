# Decoder compatibility

What STEGO·STUDIO can read from other tools, and — more usefully — what it
cannot. Support varies by tool, container format and cipher; a blanket "supports
Steghide" would be misleading, so this page states the boundaries.

All of it runs in the browser. These are reimplementations from published
specifications and observed behaviour, validated against samples produced by the
official binaries; none of them ship the original code.

---

## Summary

| Tool | PNG / BMP | JPEG | Encrypted payloads | Validation basis |
|---|---|---|---|---|
| **STEGO·STUDIO** (own format) | full | full | full | own round-trip; golden fixtures in `test/fixtures/legacy/` |
| **OpenStego** | read | — | **detected, not decrypted** | real samples, validated when the engine was built |
| **Steghide** | BMP not integrated | read | **2 of ~129 cipher/mode pairs** | official binary 0.5.1, **re-measured 2026-08-11** |
| **OutGuess 0.4** | — | read | RC4 as the tool uses it | real samples when built, incl. a documented field case |
| **F5 (Westfeld)** | — | — | — | prototype validated; integration suspended |

The **Validation basis** column matters: only the Steghide row was re-measured in
the session that produced this page. The others rest on validation done when each
engine was written, recorded in the changelog. That is evidence, not assumption —
but it is older, and you should know which is which.

---

## OpenStego

Reads the payload and recovers the original filename. Password-derived pixel
selection is implemented.

**Limit:** when the payload was written with OpenStego's own encryption layer
enabled, the tool identifies it and reports the filename, but **does not decrypt
the content**. You get confirmation that a message is there and what it was
called, not the message.

## Steghide

The interesting case, because the gap is wide and precisely known.

Implemented: the pseudo-random selector seeded from MD5 of the password, the
lazy Fisher-Yates permutation, the internal EmbData format (24-bit magic, unary
version, cipher and mode fields, zlib, CRC32, filename), and extraction from
JPEG DCT coefficients.

**Cipher coverage is the real boundary.** Steghide's header carries 5 bits of
algorithm and 3 bits of mode — eighteen algorithms across seven modes, roughly
129 combinations. This decoder implements **two**: no encryption, and
rijndael-128 in CBC, which is the default.

Consequently **even the default cipher fails in six of its seven modes**. That
is measured, not estimated: an image encrypted with `rijndael-128/CTR` will not
decode here.

What you get instead is an honest answer rather than silence. When the magic
number matches — which is proof, since it sits at positions derived from the
password itself — the tool reports Steghide and names the exact pair that
blocked it, for example `blowfish/CBC`. You then know to reach for the original
tool rather than wondering whether the file is damaged.

**BMP is not integrated.** The spatial-domain core exists and was validated, but
it is not wired into the browser path: the canvas hands over pixels top-down
while Steghide samples bottom-up, which changes the Selector's position mapping.
JPEG was prioritised because it is what turns up in practice.

## OutGuess 0.4

Reads JPEG payloads including the RC4 layer as the tool applies it. The known
quirk where embedding stops at the image boundary is detected and reported
rather than silently truncating.

## F5 (Westfeld)

**Not implemented.** F5 is detected only through the encoder comment its default
library writes, which is an *indication* and not proof — any file saved by that
same library carries the identical comment. Extraction was suspended on
cost/benefit grounds: rare in practice, expensive by construction.

---

## What none of this covers

Detecting **adaptive** steganography — HILL, UNIWARD, J-UNIWARD — generally
requires specialised trained models. **STEGO·STUDIO does not ship those models
in its offline single-file build**, so it does not detect these methods at all.
Finding nothing here is not evidence that an image is clean.

The limit is a product decision, not a limitation of the web platform: models
can run in a browser via WebAssembly or WebGPU, at a cost in file size and
complexity this build does not pay. For that work use a dedicated steganalysis
toolbox such as [Aletheia](https://github.com/daniellerch/aletheia).

Coverless schemes are outside detection by construction: nothing is modified, so
there is no residual for any statistical test to measure.

---

*Steghide figures measured against the official 0.5.1 binary on 2026-08-11, by
running it — not from documentation. Other rows: see the Validation basis column.*
