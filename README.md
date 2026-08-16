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

Messages are encrypted with AES-256-GCM using a key derived with Argon2id. The
password never leaves the page, because nothing leaves the page.

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
node test.js            # 22 invariants
```

No bundler and no dependencies. `build.js` concatenates 16 JavaScript modules,
the stylesheet and an inlined Argon2id WebAssembly bundle into a single file,
then **refuses to emit** anything that would reach the network at runtime.

Binary assets (fonts, icons) are stored as base64 with SHA-256 checksums in
`ASSETS_BASE64.md`; `unpack_assets.js` restores them and verifies every hash
before writing.

---

## Repository layout

```
src/            16 modules + styles.css + hash-wasm.js
template.html   page markup; the build injects CSS and JS into it
build.js        the build
test.js         22 invariants (syntax, i18n parity, offline guarantee, XSS, report schema, ...)
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
