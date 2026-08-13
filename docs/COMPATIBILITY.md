# Decoder compatibility

What STEGO·STUDIO can read from other tools, and — more usefully — what it
cannot. Support varies by tool, container format and cipher; a blanket "supports
Steghide" would be misleading, so this page states the boundaries.

All of it runs in the browser. These are reimplementations from published
specifications and observed behaviour, validated against samples produced by the
official binaries; none of them ship the original code.

---

## Summary

| Tool | PNG / BMP | JPEG | Encrypted payloads | Notes |
|---|---|---|---|---|
| **STEGO·STUDIO** (own format) | full | full | full | AES-256-GCM, Argon2id |
| **OpenStego** | read | — | **detected, not decrypted** | filename recovered |
| **Steghide** | BMP not implemented | read | **2 of ~129 cipher/mode pairs** | tool confirmed even when decode fails |
| **OutGuess 0.4** | — | read | RC4 as the tool uses it | |
| **F5 (Westfeld)** | — | — | — | detected by encoder comment only |

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

**BMP is not implemented.** Steghide's spatial-domain BMP path is understood but
was not built; JPEG was prioritised because it is what turns up in practice.

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

Detecting **adaptive** steganography — HILL, UNIWARD, J-UNIWARD — requires
trained neural models, which do not run in a browser. This tool does not detect
them at all, and finding nothing here is not evidence that an image is clean. For
that, use a dedicated steganalysis toolbox such as
[Aletheia](https://github.com/daniellerch/aletheia).

Coverless schemes are outside detection by construction: nothing is modified, so
there is no residual for any statistical test to measure.

---

*Last measured against steghide 0.5.1 on 2026-08-11. Numbers here come from
running the official binaries, not from documentation.*
