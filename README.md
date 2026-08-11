# STEGO·STUDIO

Steganography and image forensics that run entirely on your machine. One HTML
file, no server, no uploads, no build step to use it — open it and it works,
including with the network off.

**https://stegostudio.com**

---

## What it does

**Encoder** — hides an encrypted message inside an image. Either in the pixels
of a PNG, or in the DCT coefficients of a JPEG so the message survives the
recompression that social platforms apply when you post a picture.

**Analyzer** — examines any image for traces of hidden data: RS, WS and
chi-square analysis, structural inspection, platform fingerprinting, and a
classifier that estimates whether an image is a photograph, a screenshot,
digital art, or AI-generated.

**Decoder** — reads back what the Encoder wrote, and also attempts extraction
for OpenStego, Steghide and Outguess.

Messages are encrypted with AES-256-GCM using a key derived with Argon2id. The
password never leaves the page, because nothing leaves the page.

---

## What it does not do

This matters more than the feature list.

The tool **cannot** reliably detect modern adaptive steganography — HILL,
UNIWARD, J-UNIWARD and similar. Detecting those takes trained neural models,
which do not run in a browser. **Finding nothing here is not evidence that an
image is clean.** If you need that level of analysis, use a dedicated
steganalysis toolbox such as [Aletheia](https://github.com/daniellerch/aletheia)
by Daniel Lerch.

The tool also separates what it can *prove* from what it can only *suggest*, and
labels which is which. A number without a visible justification behind it is
treated as a bug, not a feature.

---

## Building

The published file is committed under `HTML_PRODUCAO/`, so you do not need to
build anything to use the tool. To build it yourself:

```sh
node unpack_assets.js   # recreates src/fonts/ from ASSETS_BASE64.md
node build.js           # assembles dist/stego_studio_v<VERSION>.html
node test.js            # 11 invariants
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
test.js         11 invariants (syntax, i18n parity, offline guarantee, ...)
HTML_PRODUCAO/  the published single-file build
docs/           changelog and the social-platform measurements
```

`docs/MEDICAO_REDES_SOCIAIS.md` records what WhatsApp, X, Facebook and Instagram
actually do to an uploaded image — measured from real posts, not estimated. The
robust-mode parameters come from those numbers.

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

You may use, study, modify and redistribute this. If you distribute a modified
version, that version must also be free software under the same license. For a
tool whose entire premise is that you can verify what runs on your own machine,
a derivative nobody can inspect would defeat the point.

---

*Idealizado por RASC e desenvolvido por JOI.*
