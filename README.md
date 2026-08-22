# STEGO·STUDIO

Steganography and image forensics that run entirely on your machine. One HTML
file, no server, no uploads, no build step to use it — open it and it works,
including with the network off.

**https://stegostudio.com**

> **An experiment in human-directed AI software development.**
> STEGO·STUDIO was conceived and is directed by **Rick Chaves, a human with no
> formal programming background**, and is built and reviewed with AI systems —
> primarily GPT and Claude — under human testing, judgment and release decisions.
> It is both a working open-source tool and a case study in how far human-directed
> AI software development can go.
>
> [Read about the experiment](#about-this-experiment).

---

## What it does

**Encoder** — hides an encrypted message inside an image. Either in the pixels
of a PNG, or in the DCT coefficients of a JPEG using a recompression-resistant
mode whose parameters were measured against real social-platform workflows.
Those pipelines change over time, so the measurements — not a universal promise
— define the tested boundary.

For lossless carriers, the Encoder also runs a lightweight **Carrier Preflight**
before writing. It can warn about obvious existing STEGO·STUDIO headers or coherent
readable text in common pixel-LSB layouts. It is deliberately limited: a quiet
preflight is **not proof that the carrier contains no hidden data**.

**Analyzer** — examines any image for traces of hidden data: RS, WS and
chi-square analysis, structural inspection, platform fingerprinting, and a
classifier that estimates whether an image is a photograph, a screenshot,
digital art, or AI-generated.

**Decoder** — reads back what the Encoder wrote, and also attempts extraction
for OpenStego, Steghide and Outguess. Coverage varies by tool, format and cipher;
[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) states the boundaries.
When a compatible decoder recovers an original file, STEGO·STUDIO keeps the
recovered bytes locally so **Save file** can write the exact payload instead of
round-tripping it through UTF-8 text. Binary bytes are not injected into the
public JSON report; text payloads continue to populate `decodedMsg`.

Messages are encrypted with AES-256-GCM using a key derived with Argon2id. New
password-protected lossless writes also use a fresh per-image structural salt and
domain-separated derived keys for header protection/authentication and body order.
The password never leaves the page, because nothing leaves the page. A stronger
structural derivation does not make a weak password strong.

### Exported JSON report

The Analyzer exports `_schema: forensic-report-v2`. On confirmed extraction paths,
`decodedMsg` carries the **full recovered content** and is bounded by carrier
capacity rather than by a small display limit. Before v2.43.5 those confirmed
routes truncated `decodedMsg` at 5,000 characters. Heuristic deep-scan previews
remain intentionally bounded because they are investigative candidates, not
confirmed recovered messages.

`threat.score` uses **0–99 for heuristic suspicion**. Heuristic evidence can reach
99 without proving that content was recovered. The value **100 is reserved for
direct validated recovery** and is paired with the **CONFIRMED** state. Consumers
should use the explicit recovery/confirmation state rather than inventing a lower
numeric threshold as a proxy for confirmation. Recognized legacy LSB framings that
validate their declared structure expose `modules.studio.framedExtracted` (and the
declared byte count in `framedPayloadBytes`) so the report carries the evidence that
justifies this terminal state.

---

## What it does not do

This matters more than the feature list.

The built-in statistical analysis does **not reliably detect content-adaptive
steganography** such as HILL, UNIWARD and J-UNIWARD. LSB Matching can also evade
the structural tests used here. Specialised detection of these methods generally
uses trained steganalysis models. Models can run in browsers through technologies such as WebAssembly or
WebGPU; this offline single-file build deliberately does **not ship those
models** because of their size and complexity. **Finding nothing here is not
evidence that an image is clean.** If you need that level of analysis, use a
dedicated steganalysis toolbox such as
[Aletheia](https://github.com/daniellerch/aletheia) by Daniel Lerch.

The tool also separates what it can *prove* from what it can only *suggest*, and
labels which is which. A number without a visible justification behind it is
treated as a bug, not a feature.

---


## About this experiment

STEGO·STUDIO is, first and foremost, an experiment. It was conceived and is
directed by **Rick Chaves — a human with no formal programming background** — to
explore how far current artificial intelligence systems can go in building
real-world software.

> **The experiment is not whether AI can write code. It is whether a human who
> does not know how to program can direct AI well enough to build, test, audit,
> maintain, and evolve real software.**

The project is developed and reviewed with AI systems, primarily **GPT** and
**Claude**, under human direction, testing, judgment, and final release decisions.
Within the project, Rick affectionately refers to these AI collaborators as
**JOI**. Successes matter, but failures, regressions, disagreements between models,
and the corrections that follow are equally part of the experiment.

### How the experiment works

- **Human direction — Rick:** defines goals, requirements, expected behaviour and
  product decisions; performs real-world testing in browsers and devices; and
  decides what is ready to ship.
- **GPT / JOI:** used primarily for architecture, implementation, integration,
  documentation, testing and technical analysis during development.
- **Claude / JOI:** frequently used in a separate AI review context to challenge
  assumptions, look for regressions and try to find flaws in proposed solutions.
  This is independence of context, not third-party certification.
- **Validation:** AI findings are not accepted simply because an AI produced them.
  Important claims are reproduced, discussed and tested before they become part of
  the product. AI reviewers also make mistakes; findings can be corrected,
  withdrawn or rejected when the evidence does not support them.

### What this project is not

STEGO·STUDIO **is not a certified professional forensic, security, or steganalysis
product**. It is experimental, educational and research-oriented. Do not rely on
it as the sole basis for critical security or forensic decisions.

Being open source is part of the experiment: the code, limitations and
product-facing technical claims can be inspected, tested and challenged.

### Why “JOI”?

**JOI** is Rick's affectionate name for the AIs collaborating on the project. JOI
is not presented as a human developer; the name represents the artificial
intelligence systems participating in development and review.

---

## Building

The published file is committed under `HTML_PRODUCAO/`, so you do not need to
build anything to use the tool. To build it yourself:

```sh
node unpack_assets.js   # recreates src/fonts/ from ASSETS_BASE64.md
node build.js           # assembles dist/stego_studio_v<VERSION>.html
node test.js            # full offline regression harness
```

No package install or bundler is required. The build vendors Acorn 8.15.0 (MIT) under
`tools/vendor/` only to identify JavaScript comments safely before producing the final
artifact; the parser is **not** included in the published HTML. `build.js` assembles the
JavaScript source modules, the stylesheet and an inlined Argon2id WebAssembly bundle into a single file,
then **refuses to emit** anything that would reach the network at runtime. The final
HTML also carries a restrictive Content Security Policy: browser script networking is
blocked with `connect-src 'none'`, executable inline scripts are pinned to build-time
SHA-256 hashes, and the Argon2 WebAssembly bundle receives only the narrower
`'wasm-unsafe-eval'` permission rather than general JavaScript `eval`.

Binary assets (fonts, icons) are stored as base64 with SHA-256 checksums in
`ASSETS_BASE64.md`; `unpack_assets.js` restores them and verifies every hash
before writing.

The repository also ships a no-install GitHub Actions workflow (`.github/workflows/regression.yml`) that rebuilds the single-file artifact and runs the full Node 22 regression harness on pushes and pull requests. The harness is intentionally broad, but it is not a proof of security and does not replace real-browser/device testing.

---

## Repository layout

```
src/            JavaScript modules + styles.css + hash-wasm.js
tools/vendor/   build-only vendored parser + license; not shipped in the HTML
template.html   page markup; the build injects CSS and JS into it
build.js        the build
test.js         regression harness (build, security gates, round-trips, malformed corpus, fixtures, ...)
HTML_PRODUCAO/  the published single-file build
docs/           compatibility notes and social-platform measurements
```

`docs/SOCIAL_PLATFORM_MEASUREMENTS.md` summarizes measured social-platform image
pipelines and the limits of those measurements. The sturdier-mode parameters are
grounded in those tests rather than in a universal promise.

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

You may use, study, modify and redistribute this. If you distribute a modified
version, that version must also be free software under the same license. For a
tool whose entire premise is that you can verify what runs on your own machine,
a derivative nobody can inspect would defeat the point.

---

*Concept and human direction by RASC. Developed with JOI, an AI.*
