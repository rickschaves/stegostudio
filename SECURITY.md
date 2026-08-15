# Security

## Project authorization context

STEGO·STUDIO is an open-source project maintained and reviewed on its own codebase
and on fixtures/test files the reviewer is authorised to inspect. Security work in
this repository is framed as **defensive hardening**: code review, vulnerability
remediation, regression testing, compatibility validation and controlled image
forensics. Nothing in the project documentation authorises intrusion into third-party
systems, malware development or unauthorised access.

Review briefs and handoff documents should repeat this context when they may be read
outside the ongoing project conversation, so the purpose is explicit rather than
inferred from isolated terms such as “payload”, “threat”, “KDF” or “steganography”.

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
  similar generally require specialised trained models. Those models can run
  in browsers through WASM/WebGPU; this offline single-file build deliberately
  does **not include them**. Finding nothing here is not evidence that an image
  is clean.
- **C2PA signatures are not cryptographically verified.** The tool detects a
  manifest in the container the standard mandates and reads the declaration
  inside it. It does not check the signature, the certificate chain, or whether
  the content still matches what was signed. A declaration can be copied from a
  genuine file into another one.
- **EXIF is unauthenticated.** Camera fields are ordinary text that any program
  can write. They count as supporting evidence, never as proof of provenance.
- **The header-concealment layer derives from a 32-bit seed.** The message
  itself is AES-256-GCM with an Argon2id-derived key and is unaffected. The
  layer that hides the header's *position and mask* is weaker than that, and is
  scheduled to be replaced with a 256-bit, domain-separated derivation.

  When that lands, it will remove an artificial ceiling — nothing more. **A
  256-bit derivation does not turn a weak password into 256 bits of security.**
  Running any amount of key-stretching over `123456` still leaves you with the
  guessability of `123456`; Argon2id makes each guess expensive, which buys time,
  not entropy. Everything here is bounded by the password you choose. Choose one
  worth the algorithm behind it.
- **Third-party extraction is partial.** OpenStego encrypted payloads are
  identified but not decrypted; Steghide covers 2 of roughly 129 cipher/mode
  pairs and its BMP path is not integrated. Full matrix, with the validation
  basis for each row: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).
- **Plausible-deniability reporting intentionally suppresses layer identity after a
  successful native extraction.** The implementation knows whether the payload was
  recovered from the ordinary native route or from the alternative tail layer, but
  once either route authenticates and yields a message the public Analyzer/JSON uses
  the same `nativeExtracted` evidence class. This is deliberate: exporting the route
  itself would become a distinguisher between two valid passwords. It does not hide
  whether a STEGO·STUDIO payload was recovered; it hides only which internal layer
  produced that authenticated recovery.

## Interaction contract

While an analysis is running, inputs and controls that could change or re-render
its state are deliberately locked. This used to happen by accident — the work
occupies the main thread — but relying on that would mean the guarantee quietly
disappears if the analysis ever becomes smoother or moves to a worker. Internally
each analysis also carries a generation token and works from a snapshot, so a
result belonging to a superseded image is discarded rather than displayed.

## Reporting

Open an issue at https://github.com/rickschaves/stegostudio/issues

If you believe an issue should not be public before a fix ships, say so in a
minimal issue without details and a private channel will be arranged.
