## v2.43.20 — 2026-08-19
**More readable JPEG password feedback**

- The inconclusive JPEG password notice now stays visible for eight seconds, giving slower readers more time without changing the underlying diagnosis or Threat semantics.

## v2.43.19 — 2026-08-19
**Honest JPEG password feedback**

- JPEG analysis now gives explicit key-field feedback when a supplied password does not open any compatible payload.
- The warning is deliberately non-categorical: the robust JPEG slot plan itself is password-dependent, so a wrong password is structurally indistinguishable from many JPEGs with no supported protected payload. The UI says the password **may** be incorrect instead of presenting that ambiguity as proof.
- Confirmed robust/tool states, damage states and successful recovery keep their more specific status and do not receive the generic warning.

## v2.43.18 — 2026-08-18
**Browser-enforced offline boundary**

- The standalone HTML now includes a restrictive Content Security Policy: script-initiated network connections are blocked by the browser, executable inline scripts are pinned to build-time SHA-256 hashes, and frames, objects, workers and form submissions are disabled while the local blob/data resources required by the tool remain available.
- Argon2 WebAssembly uses the narrower `wasm-unsafe-eval` permission; general JavaScript `eval` remains blocked. The CSP complements the existing sanitization and build-time offline allowlist rather than replacing them.

# Changelog

## v2.43.17 — 2026-08-18
**Orientação pública alinhada ao comportamento atual**

- O ticker superior, os dois Guias rápidos e o **Como funciona** agora descrevem os mesmos limites atuais do produto. O JPG resistente é uma segunda saída condicional calibrada para fluxos de publicação medidos, não uma garantia universal de redes sociais; a mensagem alternativa continua exclusiva do PNG.
- As orientações de formato, senha e recuperação agora refletem o que o navegador realmente consegue decodificar, tratam HEIC/HEIF como dependente do navegador e deixam explícitos os limites de contêiner/cifra/modo dos motores de terceiros.
- As explicações de LSB/proteção distinguem o caminho STC/HILL, rotas sequenciais com LSB Matching e escrita adaptativa, mantendo recuperação direta confirmada separada de evidência heurística.

---

## v2.43.16 — 2026-08-18
**Cleaner Encoder output heading**

- The Encoder output now uses **GENERATED IMAGE** with the same visual hierarchy as the Analyzer/Decoder **RESULT** heading. The redundant `//` prefix was removed from the main heading while the processing-time label keeps its technical marker.

## v2.43.15 — 2026-08-18
**Consistent confirmed recovery**

- Direct structured legacy recovery that reaches Threat 100 now also displays **CONFIRMED** instead of HIGH.
- Processing-time values keep the seconds unit lowercase (`1.27 s` / `1,27 s`).


## v2.43.14 — 2026-08-18
**Structured legacy LSB recovery**

- Recognized **JOI_LSB** and **Steg/v1** messages are now parsed from their declared framing and payload length instead of relying only on sliding-window text cleanup. Complete structured recovery can reach **100 / CONFIRMED**; header-like or heuristic text without valid framing remains below the terminal state.

## v2.43.13 — 2026-08-18
**Visible processing time**

- Encoder and Analyzer/Decoder now show the total processing time directly beside the result heading. The measurement is local to the current operation, resets on the next run, and is not embedded in generated images or exported in the forensic report.

## v2.43.12 — 2026-08-18
**Cleaner stegomalware previews**

- Self-contained stegomalware indicators such as embedded URLs, crypto addresses and long Base64 blobs now show only the matched indicator instead of repeating unrelated surrounding message text. Patterns whose match is only a trigger, such as script injection, keep a short Unicode-safe context so the relevant code remains visible.

## v2.43.11 — 2026-08-18
**Unicode-safe warnings and better recovered filenames**

- Stegomalware context previews no longer split emoji or other supplementary Unicode characters at crop boundaries, keeping warning snippets readable and safely persistible from exported reports.
- Long recovered-file names now preserve their final extension when **Save file** shortens the name, so formats such as `.zip`, `.png` and `.pdf` remain identifiable after download.
- The **Password ignored** notice is shorter and now states that the message was recovered without a password when the supplied password was not needed by the winning recovery path.

## v2.43.10 — 2026-08-18
**Clearer Threat semantics and richer stegomalware context**

- Threat **100** is now reserved for direct confirmed recovery. Strong heuristic evidence without a validated recovery can still reach **99 / HIGH**, but no longer shares the terminal number used by **CONFIRMED** results.
- Stegomalware warnings now show a short, bounded context around the detected pattern instead of only the regex fragment that triggered it. Recovered code remains displayed as inert text and is never interpreted as HTML.

## v2.43.9 — 2026-08-18
**Byte-exact recovered files and more accurate password context**

- **Password ignored** is no longer shown when the supplied password was actually required to reveal a concealed header or reconstruct a shuffled legacy payload. The notice now explains that the recovered message does not require the supplied password.
- Files recovered through compatible third-party methods now preserve their original bytes when saved. Binary payloads are presented as recovered files instead of lossy UTF-8 text, while genuine text remains readable and copyable; declared compressed content is only offered after successful decompression.

## v2.43.8 — 2026-08-17
**Clearer password handling and consistent modal scrollbars**

- If a password is supplied but recovery succeeds through an unprotected/default-password path, the decoded-message panel now says **Password ignored** so the user cannot mistake an unused password for a validated one. Unprotected robust JPEG recovery also falls back correctly when an unnecessary password was entered.
- The **How it works**, **Version history** and **About this project** modals now use the same styled internal scrollbar language as the rest of the interface.

## v2.43.7 — 2026-08-17
**Stronger direct-recovery evidence and smaller PNG output**

- Complete direct recovery through supported compatible methods such as OutGuess, Steghide and OpenStego now closes Threat at **100 / CONFIRMED**, matching direct STEGO·STUDIO recovery. Identification without recovered content and partial/truncated recovery remain below the terminal state.
- Successful Decode Status now uses the same **Message recovered ✓** wording across native PNG, robust JPEG and compatible third-party methods; the identified method and protection remain separate evidence.
- PNG output now uses adaptive lossless row filtering before DEFLATE. This can substantially reduce output size on many images without changing a single decoded pixel or the hidden payload.
- The Encoder expanded editor now works identically for the real and alternative messages, with compact in-field controls, matching styled scrollbars and a capacity-aware counter when a carrier is available.

## v2.43.6 — 2026-08-17
**Format-aware steganalysis and safer message editing**

- The Analyzer now shows only the steganalysis family that applies to the file: lossless images use a single **format / LSB** accordion, while JPEG uses **JPEG / DCT**. Decode Status appears in the applicable surface instead of inside an unavailable protocol panel.
- The JPEG / DCT panel now uses **Method identified** for STEGO·STUDIO Robust, OutGuess, Steghide or other compatible recovery paths, while robust-mode error states remain separate. Supporting DCT wording and frequency-band labels were aligned with the new layout.
- Long recovered messages keep their original line breaks in a bounded, styled scroll area with **Copy** and **Save TXT**. The Encoder message field can open a larger synchronized editor for composing formatted text without changing the message.
- EXIF read failures are now treated as **unknown** by the origin classifier instead of being scored and labeled as missing camera metadata.

## v2.43.5 — 2026-08-17
**Richer JPEG evidence and better long-message handling**

- Recovered messages are no longer silently cut at 5,000 characters on robust-JPEG and supported third-party extraction paths. Long messages stay complete in the report while the on-screen box uses an internal scroll, with **Expand**, **Copy** and **Save TXT** controls.
- The JPEG/DCT accordion now shows JPEG structure, direct robust-mode status, Reed-Solomon corrections and third-party engine evidence in the same place, so a confirmed robust recovery has a visible explanation even when first-order DCT statistics look normal.
- Encoder character counts now use the exact trimmed text that will actually be encoded, keeping the capacity meter and post-encode statistics consistent.
- EXIF/XMP badges now distinguish unavailable metadata, partial camera identification and metadata that exists without a complete camera ID, making analytically relevant cases visible in text instead of relying only on color.

## v2.43.4 — 2026-08-17
**Stricter confirmed robust-JPEG recovery**

- An authenticated but empty robust-JPEG payload is no longer treated as recovered content or promoted to **100 / CONFIRMED**. Valid password-protected and compressed robust messages continue to decode normally.

## v2.43.3 — 2026-08-17
**Safer robust-JPEG recovery validation**

- Malformed, truncated or unreadable inner content in a STEGO·STUDIO robust JPEG can no longer be promoted to **100 / CONFIRMED**. Valid password-protected and compressed no-password robust messages remain supported.

## v2.43.2 — 2026-08-17
**Confirmed Threat aligned for robust JPEG**

- A successfully recovered STEGO·STUDIO robust JPEG now shows the same **100 / CONFIRMED** Threat state as a directly recovered native PNG. Passive JPEG analysis and failed/no-password attempts keep their existing scores.

## v2.43.1 — 2026-08-17
**Robust JPEG restored, confirmed Threat, faster mobile swipe**

- Password-protected encodes once again generate the sturdier JPEG companion image. Protected PNG keeps the new F21 structure, while the robust JPEG keeps its existing compatible payload format.
- When a native STEGO·STUDIO PNG/lossless message is directly recovered, Threat now shows **100 / CONFIRMED**. Passive scores and failed/absent-password analyses keep their existing heuristic weights.
- High Capacity Mode now describes its trade-off without promising that every RGB output will score as more detectable. It prioritizes room over minimizing embedding changes and can leave stronger statistical traces, especially with larger payloads; STC remains the stealth-oriented default.
- Mobile tab switching now accepts a short fast flick and needs a much shorter normal drag. Vertical scrolling, system edge gestures, reversal before release and touch-click suppression remain preserved.

## v2.43.0 — 2026-08-16
**Stronger protection for password-protected PNG payloads**

- New password-protected lossless images use a fresh per-image structural salt and independent derived keys for header protection, body order where applicable, and AES-GCM content. The previous 32-bit structural seed is no longer used by this PNG path; effective security still depends on password strength.
- Protected header data is authenticated before its mode or declared body size is trusted. If the header is valid but the protected body is damaged, the Decoder now reports that distinction instead of treating it as an ordinary failed recovery.
- Existing STEGO·STUDIO images remain decodable. New images saved without a password keep the existing format. A passive analysis without the password may not identify the new protected PNG header; that absence is not treated as evidence that no hidden content exists.
- Password-protected PNG capacity now accounts for the stronger bootstrap overhead, so very small carriers may have less usable room than before.
- The Encoder stealth self-check now reports only what the built-in checks measured; passing its threshold is no longer described as being statistically indistinguishable from noise.

## v2.42.35 — 2026-08-16
**Smoother mobile swipe**

- Mobile swipe can now start across almost the whole working panel, including image drop areas, buttons, labels and accordion headers. Normal taps still act normally; once a horizontal drag is clearly established, the panel follows the finger and the accidental click that would follow the swipe is suppressed.
- Changing tabs now requires a substantially longer drag. Short or indecisive movements return to the current tab instead of changing it.
- Switching tabs no longer restarts the terminal typing animation, reducing unnecessary work during repeated mobile navigation.

## v2.42.34 — 2026-08-16
**Interactive mobile swipe**

- The mobile swipe follows the finger continuously: the current panel moves out while the neighbouring panel enters at the same rate, and reversing the finger reverses the interface before release.
- Releasing early snaps back; crossing the commit distance completes the transition smoothly. Vertical scrolling remains native until horizontal intent is clear, and browser/system edge space stays reserved.
- The neighbouring panel is anchored to the live mobile viewport during the gesture. Mobile browser chrome changes no longer cancel a valid swipe, and an explicit tab tap immediately clears any pending swipe animation.

## v2.42.33 — 2026-08-16
**First mobile swipe**

- Introduced the first optional mobile swipe between Encode and Analyze · Decode. The initial implementation changed tabs after a completed horizontal gesture while keeping the visible tabs as the canonical controls.
- The first swipe preserved vertical scrolling, rejected multi-touch/cancelled sequences and reserved browser/system edge gestures.

## v2.42.32 — 2026-08-16
**Safer Analyzer result rendering**

- Additional Analyzer values are now displayed safely as text. Crafted file content in these result surfaces cannot be interpreted as HTML markup.
- Unknown header-like prefixes found during deep scan remain untrusted and are displayed safely as text.
- Legacy forensic-report-v2 values remain unchanged for compatibility.

## v2.42.31 — 2026-08-16
**Safer display of forensic values**

- More forensic result fields are now displayed safely as text, including Strings notes and types, detected header names, rare-color details, social-platform labels and AI format labels.

## v2.42.30 — 2026-08-16
**Clearer AI labels and safer unavailable messages**

- Vector/icon and digital-graphic AI labels no longer imply likelihood or a negative origin verdict; they describe observed patterns while keeping the heuristic score capped.
- Unavailable Protocol and LSB notes are now displayed safely as text.

## v2.42.29 — 2026-08-16
**Security and semantic cleanup**

- Suspicious strings recovered from file bytes are escaped before rendering, so crafted file content can no longer become markup in the Strings panel.
- The lowest AI-origin state uses very-low suspicion/compatibility wording instead of **Unlikely**, and low-noise interpretation no longer implies a probable synthetic origin or an unmeasured causal steganography claim.
- Known public-report format/string/DCT values no longer leak Portuguese prose; DCT failure reasons use stable codes and are localized only when displayed.
- GPS is shown once in the EXIF panel while the existing `fields.GPS = "present"` report field remains for compatibility. Carrier Preflight fallbacks are consistently English before i18n applies.

## v2.42.28 — 2026-08-15

- EXIF software metadata is no longer described as confirmation of AI generation. It is
  presented as supporting evidence because metadata can be edited or copied.
- A quiet LSB Replacement result no longer implies a low probability of hidden content.
  The Analyzer states only that no LSB Replacement signal was detected and explicitly
  leaves LSB Matching and content-adaptive embedding open.
- Carrier Preflight now states its main blind spots in the Encoder itself: a quiet result
  may miss password-protected or content-adaptively placed payloads, including some
  STEGO·STUDIO outputs.
- Replaced **Likely origin** with **Highest compatibility**, clarified the LSB Matching
  versus content-adaptive distinction in the limitation note, and made exported GPS
  presence language-neutral.

## v2.42.27 — 2026-08-15

- Reworked public steganalysis limits to distinguish **LSB Matching** from
  **content-adaptive** methods such as HILL, UNIWARD and J-UNIWARD. These methods
  are described as able to evade the built-in analysis rather than categorically
  undetectable; known STEGO·STUDIO formats may still be recognised or decoded.
- Removed the claim that C2PA or “full spectral analysis” provides definitive AI-origin
  confirmation. Content Credentials are now described as provenance evidence that
  requires cryptographic validation, and image-forensic indicators remain heuristic.
- Renamed **Origin Probability** to **Origin Compatibility** so the 0–100 values are
  not presented as calibrated probabilities. Zero Threat is now labelled **No signals**
  rather than **Clean**.
- Removed the remaining unused i18n strings from retired neural/Pro and obsolete UI paths.

## v2.42.26 — 2026-08-15

- Protocol and LSB extraction-mode labels are now localized consistently, so the English UI displays `Channel R/G/B` instead of exposing the internal Portuguese mode names.
- Human-readable categorical values shown after accordion row labels now use consistent sentence case in English and Portuguese.
- Both Carrier Preflight action buttons now provide a visible hover response.

## v2.42.25 — 2026-08-15

- Fixed the Protocol panel so a recovered native payload is no longer described as
  having used a supplied password when the content was actually plaintext. Recovery
  and encryption state are now reported separately.
- Standardized current user-facing credential terminology on **password**. Encryption
  describes the hidden message/payload; **cryptographic key** is reserved for the
  derived key itself or cipher-specific technical context.
- Shortened Carrier Preflight actions and kept the two choices side by side.


## v2.42.24 — 2026-08-15

- Strong LSB statistics no longer promote a headerless readable-looking byte island to
  recovered content. RS/WS/chi-square may support that embedding occurred, but do not
  authenticate a particular text candidate as the payload.
- When structural LSB evidence is strong but no reliable message or known protocol is
  recovered, the Analyzer now reports **LSB embedding evidence** and keeps any text
  island explicitly separate as an unvalidated candidate.

## v2.42.23 — 2026-08-15

- Added **Carrier Preflight** to the Encoder for lossless carriers. A lightweight, password-free check looks for obvious existing STEGO·STUDIO headers or coherent readable text in common pixel-LSB layouts before a new payload is written.
- A suspicious carrier blocks Encode until the user chooses another image or explicitly continues with the current one. A negative result is presented only as “no obvious prior hidden content detected”, not as proof that the carrier is clean.

## v2.42.22 — 2026-08-15

- Added **About This Project** to the in-app menu, explaining the project scope and making clear that STEGO·STUDIO is experimental rather than a certified forensic or security product.

## v2.42.20 — 2026-08-15

- The missing alternate-message warning was moved directly below the alternate
  password field that triggers it, and clears immediately when a non-blank alternate
  message begins.

## v2.42.19 — 2026-08-15

- Enabling the alternate-message layer can no longer silently produce a one-layer image. Encode stays disabled until the alternate layer has a non-blank message and its own password, or the layer is turned off.

## v2.42.18 — 2026-08-15

- Pressing **Enter** in either Encoder password field starts Encode when the Encode
  action is available. Multiline message fields keep their normal Enter behaviour.
- Pressing **Enter** in the Analyzer/Decoder password field starts Analyze when the
  action is available. The shortcut respects disabled/busy state, repeated key events
  and IME composition.

## v2.42.17 — 2026-08-14

- Exported forensic reports now pass through an explicit public schema before they are
  written to JSON. Documented report fields are preserved while unknown internal fields
  are excluded from the export boundary.

## v2.42.16 — 2026-08-14

- Fixed a case where adding an active header match could make the same image receive a
  lower Threat score. Evidence strength now remains monotonic while the visible label
  still follows the most specific protocol state.

## v2.42.15 — 2026-08-14

- Native evidence labels were made consistent across Threat, Protocol and explanatory
  surfaces.
- Confirmed sturdier-mode JPEG evidence is preserved when encrypted or compressed inner
  content cannot be opened, instead of falling through to “nothing found”.
- Wrong-key feedback now uses a deterministic timer and multiple visual/text channels,
  and is reliably cleared when the password or analysis is reset.

## v2.42.14 — 2026-08-14

- The wrong-key highlight now frames the complete password control instead of appearing
  as two clipped vertical lines.

