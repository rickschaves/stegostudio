# Security

## Threat model

This tool exists to open images you have reason to distrust. **Every byte read
from a file is treated as hostile** — metadata, decoded payloads, structural
fields. Anything drawn from a file and shown on screen is escaped before it
reaches the page.

Everything runs in your browser. Nothing is uploaded, and the build refuses to
emit a file that would contact the network at runtime.

## Known limits

These are design limits, not oversights. Stating them plainly is more useful
than implying coverage that does not exist.

- **Adaptive steganography is not detected.** HILL, UNIWARD, J-UNIWARD and
  similar need trained neural models, which do not run in a browser. Finding
  nothing here is not evidence that an image is clean.
- **C2PA signatures are not cryptographically verified.** The tool detects a
  manifest in the container the standard mandates and reads the declaration
  inside it. It does not check the signature, the certificate chain, or whether
  the content still matches what was signed. A declaration can be copied from a
  genuine file into another one.
- **EXIF is unauthenticated.** Camera fields are ordinary text that any program
  can write. They count as supporting evidence, never as proof of provenance.
- **The header-concealment layer derives from a 32-bit seed.** The message
  itself is AES-256-GCM with an Argon2id-derived key and is unaffected. The
  layer that hides the header's *position* is weaker than that, and is scheduled
  to be replaced with a 256-bit derivation.
- **Third-party extraction is partial.** See the compatibility notes in the
  changelog: OpenStego encrypted payloads are identified but not decrypted, and
  Steghide support covers a small subset of its cipher and mode combinations.

## Reporting

Open an issue at https://github.com/rickschaves/stegostudio/issues

If you believe an issue should not be public before a fix ships, say so in a
minimal issue without details and a private channel will be arranged.
