# Changelog

## v2.42.29 — 2026-08-16

- Escaped suspicious strings recovered from file bytes before rendering them in the
  Analyzer, closing a remaining file-content XSS sink in the Strings accordion.
- Replaced the lowest AI-origin label **Unlikely** with very-low suspicion/compatibility
  wording, and rewrote the low-noise interpretation so the heuristic no longer implies a
  probable synthetic origin or an unmeasured causal steganography claim.
- Normalized known public-report residues: suspicious-keyword type and format messages are
  English/stable, DCT failure reasons use stable codes and are localized at display time.
- Kept `fields.GPS = "present"` in exported reports for compatibility but removed the
  duplicate visible GPS row. Carrier Preflight HTML fallbacks are consistently English.
- Added a dedicated public-value hygiene invariant and extended the XSS regression gate to
  require escaping of suspicious-string labels and content.

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

- Added **Carrier Preflight** to the Encoder for lossless carriers. A lightweight,
  password-free check looks for obvious existing STEGO·STUDIO headers or coherent
  readable text in common pixel-LSB layouts before a new payload is written.
- A suspicious carrier now blocks Encode until the user chooses another image or
  explicitly continues with the current one. A negative result is worded only as
  “no obvious prior hidden content detected” and is not presented as proof that the
  carrier contains no hidden data.
- The public About text now describes Claude review as **independence of context, not
  third-party certification**, and states explicitly that AI reviewers can also make
  mistakes.

## v2.42.22 — 2026-08-15

- Added **About This Project** to the in-app menu, explaining the human-directed AI
  development experiment, the roles of Rick, GPT and Claude, and why the AI
  collaborators are referred to as JOI.
- Project attribution now states **human direction** explicitly alongside AI
  development, and the public project description clarifies that STEGO·STUDIO is
  experimental rather than a certified forensic or security product.

## v2.42.21 — 2026-08-15

- Public source comments were reduced to implementation-relevant technical
  documentation; unnecessary personal references and private development-process
  notes were removed from the public tree.
- Removed unreachable neural/Pro decision paths left behind by the retired backend,
  preserving the same reachable Analyzer behaviour without dormant capability claims.
- Public authorship now states explicitly that JOI is AI and that RASC provides concept
  and human direction.

## v2.42.20 — 2026-08-15

- The missing alternate-message warning was moved directly below the alternate
  password field that triggers it, and clears immediately when a non-blank alternate
  message begins.

## v2.42.19 — 2026-08-15

- Enabling the alternate-message layer can no longer silently produce a one-layer
  image. Encode stays disabled until the alternate layer has a non-blank message and
  its own password, or the layer is turned off.
- Public source and repository-facing text received a privacy/hygiene cleanup so
  code-adjacent documentation stays focused on implementation rather than private
  development context.

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

## Earlier releases

Earlier version history remains available through the in-app Version History and the
repository history. Entries are being normalized gradually so public history stays
focused on meaningful product evolution.
