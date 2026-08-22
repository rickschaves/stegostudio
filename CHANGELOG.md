# Changelog

## v2.44.0 — 2026-08-21

**Smaller, faster core with wider STC distribution**

### Added

- **Optional technical embedding-pressure details are available from the small information button beside Capacity.** The normal flow stays image → message → Hide message, and the extra metrics are not prepared until the panel is opened.

### Changed

- **The single-file app is substantially smaller and large-image work uses less temporary memory.** HILL, JPEG/DCT analysis, compatible JPEG recovery and the optional leak map were tightened while preserving the offline single-file model and existing decoding paths.
- **New lossless STC messages without an alternative layer spread eligible carriers across the remaining opaque image instead of concentrating them near one end.** Older sequential STC images remain readable; changing dimensions or transparency after encoding can invalidate the spread selection.
- **The standalone History window now keeps the 10 newest releases and links to the complete changelog.** Full history remains available without carrying the entire archive inside the runtime.

### Fixed

- **Mobile and large-image responsiveness use less retained memory and unnecessary work.** Decoder-to-Encoder swipe, result scrolling, long message-field scrolling and output cleanup were tightened without changing message or report formats.

## v2.43.21 — 2026-08-19

**Better mobile scrolling and accessible password feedback**

### Fixed

- **On mobile, vertical scrolling can now start inside the recovered-message box and continue into the surrounding results panel when appropriate.** Long recovered messages keep their bounded internal scroll, while short messages no longer behave like a dead area for page movement.
- **Temporary password feedback is now announced through a dedicated screen-reader status region.** The visual hint keeps its existing timing, while expiration and language refresh do not re-announce the default hint.

### Security

- **The published security guidance now states the CSP boundary more explicitly.** `connect-src 'none'` is defense in depth against script-initiated connections, not a claim that browser navigation or every possible exfiltration path is sandboxed by the page policy.

## v2.43.20 — 2026-08-19

**More readable JPEG password feedback**

### Fixed

- **The inconclusive JPEG password notice now remains visible for eight seconds.** The longer window improves readability without changing the diagnosis: a failed password attempt can still mean either an incorrect password or no compatible protected JPEG payload.
- **Existing missing/wrong-password flashes keep their five-second duration.** Only the JPEG-specific inconclusive state receives the longer reading window.

## v2.43.19 — 2026-08-19

**Honest JPEG password feedback**

### Fixed

- **JPEG analysis now gives explicit feedback when a supplied password opens no compatible payload.** Because the robust JPEG slot plan itself depends on the password, the tool does not falsely claim that the password is definitely wrong; it says the password may be incorrect or the image may not contain a supported protected payload.
- **Specific evidence keeps priority over the generic notice.** Confirmed robust/tool states, damage states and successful recovery retain their own diagnosis, and this UI hint does not change Threat, Protocol or the public forensic report.

## v2.43.18 — 2026-08-18

**Browser-enforced offline boundary**

### Security

- **The single-file build now carries a restrictive Content Security Policy.** Script-initiated network connections are blocked by the browser, executable inline scripts are pinned to build-time SHA-256 hashes, and frames, objects, workers and form submissions are disabled while the local blob/data resources needed by the tool remain available.
- **Argon2 WebAssembly is allowed through the narrower wasm-only execution permission while general JavaScript `eval` remains blocked.** The CSP is defense in depth and complements, rather than replaces, file-derived text sanitization and the build-time offline allowlist.

## v2.43.17 — 2026-08-18

**Guidance aligned with current behavior**

### Changed

- **The top ticker, both Quick Guides and How it works now describe the same current boundaries.** The sturdier JPG is presented as a conditional second output calibrated to measured publication workflows, not as a universal social-platform guarantee; the optional alternative message is correctly described as PNG-only.
- **Format, password and recovery guidance is more precise.** Inputs are limited by what the browser can decode, HEIC/HEIF is treated as browser-dependent, third-party coverage follows the documented container/cipher/mode limits, and direct confirmed recovery remains distinct from heuristic evidence.
- **The LSB and protection explanations now match the actual paths used by the Encoder.** STC/HILL, sequential LSB Matching and adaptive writes are described as different strategies instead of attributing one write method to the whole product.

## v2.43.16 — 2026-08-18

**Cleaner Encoder output heading**

### Changed

- **The Encoder output now uses GENERATED IMAGE with the same visual hierarchy as the Analyzer/Decoder RESULT heading.** The redundant // prefix was removed from the main heading while the amber processing-time label keeps its technical marker.

## v2.43.15 — 2026-08-18

**Consistent confirmed recovery**

### Fixed

- **Direct structured legacy recovery now shows 100 / CONFIRMED consistently instead of 100 / HIGH.** Direct native, robust, framed and supported third-party recovery now converge on the same terminal visual state; identified, locked, partial and heuristic-only states remain below it.
- **Processing-time values keep the seconds unit lowercase.** English and Portuguese continue to use their respective decimal separators.

## v2.43.14 — 2026-08-18

**Structured legacy LSB recovery**

### Fixed

- **Recognized `JOI_LSB[0-9]?` and `Steg/v1` messages are now parsed from their declared framing and payload length instead of relying only on generic deep-scan text cleanup.** Promotion requires the full declared byte range and valid UTF-8 payload content.
- **A complete structured recovery can reach 100 / CONFIRMED, while invalid framing, a header-like prefix or heuristic text remains below the terminal state.** These historical framings have no known MAC/signature, so confirmation means direct payload recovery from the recognized structure, not cryptographic proof of authorship or tamper resistance.

## v2.43.13 — 2026-08-18

**Visible processing time**

### Added

- **Encoder and Analyzer/Decoder now show the total processing time directly beside the result heading.** Values below one second use integer milliseconds; longer operations use seconds with two decimal places.
- **The timing belongs only to the current local operation.** Starting a new operation, loading another image or clearing the analysis removes the previous value; switching EN/PT reformats the decimal separator without re-measuring.
- **Timing is presentation-only.** It is not embedded in generated images, written to local storage or exported through `forensic-report-v2`.

## v2.43.12 — 2026-08-18

**Cleaner stegomalware previews**

### Fixed

- **Self-contained stegomalware indicators no longer repeat unrelated surrounding message text.** URLs, crypto addresses and long Base64 blobs show only the matched indicator, while script-like triggers keep the short Unicode-safe context needed to show the relevant code.

## v2.43.11 — 2026-08-18

**Unicode-safe warnings and better recovered filenames**

### Changed

- **The Password ignored notice is shorter and clearer.** When the supplied password was not needed by the winning recovery path, the panel now states that the message was recovered without a password.

### Fixed

- **Stegomalware context previews no longer split emoji or other supplementary Unicode characters at the crop boundary.** Warning snippets stay readable in the interface and remain safe to persist from exported reports.
- **Long recovered-file names now keep their final extension when Save file shortens the name.** Formats such as .zip, .png and .pdf remain identifiable after download.

## v2.43.10 — 2026-08-18

**Clearer Threat semantics and richer stegomalware context**

### Changed

- **Threat 100 is now reserved for direct confirmed recovery.** Strong heuristic evidence without a validated recovery can still reach 99 / HIGH, but no longer shares the terminal number used by CONFIRMED results.

### Fixed

- **Stegomalware warnings now show useful bounded context around the detected pattern instead of only the fragment that triggered the rule.** Recovered code remains inert text and is never interpreted as HTML.

## v2.43.9 — 2026-08-18

**Byte-exact recovered files and more accurate password context**

### Fixed

- **Password ignored is no longer shown when the supplied password was actually required to reveal a concealed header or reconstruct a shuffled legacy payload.** The note now explains that the recovered message does not require the supplied password.
- **Files recovered through compatible third-party methods now preserve their original bytes for saving.** Binary payloads are presented as recovered files instead of lossy UTF-8 text, while genuine text remains readable and copyable; declared compressed content is only offered after successful decompression.

## v2.43.8 — 2026-08-17

**Clearer password handling and consistent modal scrollbars**

### Changed

- **How it works, Version history and About this project now use the same styled internal scrollbar language as the rest of the interface.**

### Fixed

- **If a password is supplied but recovery succeeds without using it, the decoded-message panel now says Password ignored.** An unnecessary password no longer looks like a validated password, and unprotected robust JPEG can fall back to its no-password path.

## v2.43.7 — 2026-08-17

**Stronger direct-recovery evidence and smaller PNG output**

### Changed

- **Complete direct recovery through supported compatible methods now closes Threat at 100 / CONFIRMED.** Identification without recovered content and partial/truncated recovery remain below the terminal state.
- **Successful Decode Status now uses the same Message recovered ✓ wording across recovery methods.** The identified method and protection remain separate evidence.
- **PNG output now uses adaptive lossless row filtering before DEFLATE.** This can substantially reduce output size on many images without changing decoded pixels or the hidden payload.

### Fixed

- **The expanded Encoder editor now covers both real and alternative messages consistently.** Compact in-field controls no longer compete with the scrollbar, manual textarea resizing is removed, and the modal shows carrier capacity when available.

## v2.43.6 — 2026-08-17

**Format-aware steganalysis and safer message editing**

### Added

- **The Encoder message field can open a larger synchronized editor.** Real line breaks and Unicode formatting are preserved, while literal sequences such as \n remain literal text. Recovered messages keep the bounded scroll view with Copy and Save TXT.

### Changed

- **The Analyzer now shows only the steganalysis family that applies to the file.** Lossless images use one format / LSB accordion, while JPEG uses JPEG / DCT; Decode Status now lives in the applicable surface instead of an unavailable panel.
- **JPEG / DCT now reports Method identified instead of separate native/third-party rows.** STEGO·STUDIO Robust and compatible third-party methods share the same public label, while locked, damaged and invalid robust states remain separate.

### Fixed

- **An EXIF read failure is no longer scored as missing camera metadata by the origin classifier.** Unreadable metadata is treated as unknown instead of generating absence labels and weights.

## v2.43.5 — 2026-08-17

**Richer JPEG evidence and better long-message handling**

### Added

- **The JPEG / DCT panel now brings JPEG structure and direct extraction evidence together.** It shows robust-mode state, Reed-Solomon corrections and third-party engine evidence, explaining why a direct recovery can be CONFIRMED even when simple DCT statistics look normal.

### Changed

- **EXIF/XMP badges now call out camera-identification gaps in words.** Unavailable metadata, partial camera IDs and metadata with no complete camera ID are distinct states, so the warning no longer depends on color alone.

### Fixed

- **Recovered messages are no longer silently cut at 5,000 characters on robust-JPEG and supported third-party extraction paths.** Long messages stay complete in the report while the on-screen box uses internal scroll plus Expand, Copy and Save TXT controls.
- **Encoder character counts now match the exact trimmed text that will be encoded.** The capacity meter and the post-encode statistics no longer disagree because of leading/trailing whitespace.

## v2.43.4 — 2026-08-17

**Stricter confirmed robust-JPEG recovery**

### Fixed

- **An authenticated but empty robust-JPEG payload is no longer treated as recovered content or promoted to 100 / CONFIRMED.** Valid password-protected and compressed robust messages continue to decode normally.

## v2.43.3 — 2026-08-17

**Safer robust-JPEG recovery validation**

### Fixed

- **Malformed, truncated or unreadable inner content in a STEGO·STUDIO robust JPEG can no longer be promoted to 100 / CONFIRMED.** Valid password-protected and compressed no-password robust messages remain supported.

## v2.43.2 — 2026-08-17

**Confirmed Threat aligned for robust JPEG**

### Fixed

- **A successfully recovered STEGO·STUDIO robust JPEG now shows the same 100 / CONFIRMED Threat state as a directly recovered native PNG.** Passive JPEG analysis and failed/no-password attempts keep their existing scores.

## v2.43.1 — 2026-08-17

**Robust JPEG restored, confirmed Threat, faster mobile swipe**

### Changed

- **When a native STEGO·STUDIO PNG/lossless message is directly recovered, Threat now shows 100 / CONFIRMED.** Passive scores and failed/absent-password analyses keep their existing heuristic weights.
- **High Capacity Mode now describes its trade-off without promising that every RGB output will score as more detectable.** It prioritizes room over minimizing embedding changes and can leave stronger statistical traces, especially with larger payloads; STC remains the stealth-oriented default.
- **Mobile tab switching now accepts a short fast flick and needs a much shorter normal drag.** Vertical scrolling, system edge gestures, reversal before release and touch-click suppression remain preserved.

### Fixed

- **Password-protected encodes once again generate the sturdier JPEG companion image.** Protected PNG keeps the new F21 structure, while the robust JPEG keeps its existing compatible payload format.

## v2.43.0 — 2026-08-16

**Stronger protection for password-protected PNG payloads**

### Changed

- **New password-protected lossless images now use a fresh structural salt for every encode and independent derived keys for header protection, body ordering where applicable, and AES-GCM content.** The previous 32-bit structural seed is no longer used by this PNG path; effective security still depends on password strength.
- **Existing STEGO·STUDIO images remain decodable.** New images saved without a password keep the existing compatible format. A passive analysis without the password may not identify the newer protected PNG header, and that absence is not treated as evidence that no hidden content exists.
- **Password-protected PNG capacity now accounts for the stronger bootstrap overhead.** Very small carriers can therefore have less usable room than before.

### Fixed

- **The Encoder stealth self-check now says only what its built-in checks measured.** Passing its threshold is no longer described as being statistically indistinguishable from noise.

### Security

- **Protected header data is authenticated before its mode or declared body size is trusted.** If the header is valid but the protected body is damaged, the Decoder reports that distinction instead of treating it as an ordinary failed recovery.

## v2.42.35 — 2026-08-16

**Smoother mobile swipe**

### Changed

- **Mobile swipe now starts across almost the whole working panel, including image drop areas, buttons, labels and accordion headers.** A normal tap still acts normally; once a horizontal drag is clearly established, the panel follows the finger and the accidental click that would follow the swipe is suppressed.
- **Changing tabs now requires a substantially longer drag.** Short and indecisive movements return to the current tab, making accidental tab changes much less likely.

### Fixed

- **Switching tabs no longer restarts the terminal typing animation.** The existing terminal state is preserved, reducing unnecessary work and making repeated swipes feel smoother on mobile.

## v2.42.34 — 2026-08-16

**Interactive mobile swipe**

### Changed

- **The mobile swipe now follows the finger continuously.** The current panel moves out while the neighboring panel enters at the same rate; reversing the finger reverses the interface before release.
- **Releasing early snaps back; crossing the commit distance completes the transition smoothly.** Vertical scrolling remains native until horizontal intent is clear, and browser/system edge space stays reserved.

### Fixed

- **The neighboring panel is anchored to the live mobile viewport during the gesture.** Mobile browser chrome changes no longer cancel a valid swipe, and an explicit tab tap immediately clears any pending swipe animation.

## v2.42.33 — 2026-08-16

**First mobile swipe**

### Added

- **Introduced the first optional mobile swipe between Encode and Analyze · Decode.** The initial implementation changed tabs after a completed horizontal gesture while keeping the visible tabs as the canonical controls.

### Fixed

- **The first swipe preserved vertical scrolling, rejected multi-touch/cancelled sequences and reserved browser/system edge gestures.**

## v2.42.32 — 2026-08-16

**Safer Analyzer result rendering**

### Changed

- **Legacy forensic-report-v2 values remain unchanged for compatibility.**

### Fixed

- **Additional Analyzer values are now displayed safely as text.** Crafted file content in these result surfaces cannot be interpreted as HTML markup.
- **Unknown header-like prefixes found during deep scan remain untrusted and are displayed safely as text.**

## v2.42.31 — 2026-08-16

**Safer display of forensic values**

### Fixed

- **More forensic result fields are now displayed safely as text.** This includes Strings notes and types, detected header names, rare-color details, social-platform labels and AI format labels.

## v2.42.30 — 2026-08-16

**Clearer AI labels and safer unavailable messages**

### Fixed

- **Vector/icon and digital-graphic AI labels no longer imply likelihood or a negative origin verdict.** They describe observed patterns while keeping the heuristic score capped.
- **Unavailable Protocol and LSB notes are now displayed safely as text.**

## v2.42.29 — 2026-08-16

**Security and semantic cleanup**

### Fixed

- **The lowest AI-origin state now uses very-low suspicion/compatibility wording instead of “Unlikely”.** Low-noise interpretation no longer implies a probable synthetic origin or an unmeasured causal steganography claim.
- **Public report values no longer leak Portuguese prose in the known format/string/DCT paths.** DCT failure reasons use stable codes and are localized only when displayed.
- **GPS is shown once in the EXIF panel while the existing `fields.GPS = "present"` report field is retained for compatibility.** Carrier Preflight fallbacks are also consistently English before i18n applies.

### Security

- **Suspicious strings recovered from file bytes are escaped before being rendered.** Crafted file content can no longer become markup in the Strings panel.

## v2.42.28 — 2026-08-15

**Final semantic alignment of forensic wording**

### Changed

- **Carrier Preflight now exposes its main blind spots at the decision point.** A quiet preflight warns that password-protected or content-adaptively placed payloads may still be missed.
- **Origin wording now says Highest compatibility instead of Likely origin, and exported GPS presence uses a language-neutral token.**

### Fixed

- **EXIF software metadata is no longer described as confirmation of AI generation.** It is now explicitly supporting evidence because metadata can be edited or copied.
- **A quiet LSB Replacement result no longer implies a low probability of hidden content.** The Analyzer now states only what the test found and reminds that LSB Matching or content-adaptive embedding may still be present.

## v2.42.27 — 2026-08-15

**Public claims aligned with measured coverage**

### Changed

- **Steganalysis limits now distinguish LSB Matching from content-adaptive methods such as HILL.** The help no longer says these methods are categorically undetectable; it says they may evade the built-in analysis, while known STEGO·STUDIO formats may still be recognised or decoded.
- **AI-origin wording no longer presents C2PA or spectral analysis as definitive confirmation.** Content Credentials are described as provenance evidence that requires cryptographic validation, and heuristic image signals are explicitly non-conclusive.
- **Origin Probability is now Origin Compatibility.** The 0–100 values are identified as heuristic compatibility scores rather than calibrated probabilities, and a zero Threat state is labelled “No signals” instead of “Clean”.

## v2.42.26 — 2026-08-15

**Accordion localization and Carrier Preflight hover polished**

### Fixed

- **Extraction modes in the Protocol accordion are now localized instead of exposing the internal Portuguese channel name in English.** Human-readable row values also use consistent sentence case.
- **Both Carrier Preflight action buttons now provide a visible hover response.**

## v2.42.25 — 2026-08-15

**Protocol wording and password terminology made explicit**

### Changed

- **User-facing credential terminology now consistently says password.** Encryption describes the hidden message/payload, while cryptographic key is reserved for the derived key itself or cipher-specific technical context.
- **Carrier Preflight actions are shorter and stay side by side.**

### Fixed

- **Protocol no longer claims that a recovered native payload used a supplied password when the message was actually plaintext.** Recovery wording is now neutral; Decode Status states separately whether the content was plaintext or decrypted.

## v2.42.24 — 2026-08-15

**Embedding indications no longer become a fake recovered message**

### Changed

- **When structural indications are strong but no reliable message or known protocol is recovered, Protocol now reports an LSB embedding indication instead of a generic recovered-text protocol.** The candidate may still be visible as a forensic indication, but it is explicitly marked as unvalidated.

### Fixed

- **Strong LSB statistics no longer promote an arbitrary readable-looking byte island to a recovered message.** RS/WS/chi-square can support the conclusion that embedding occurred, but they do not prove that a particular string is the payload. Headerless low-confidence candidates are now kept separate from recovered content.

## v2.42.23 — 2026-08-15

**Carrier Preflight warns before reusing a suspicious cover**

### Added

- **The Encoder now performs a lightweight Carrier Preflight when a lossless cover is loaded.** If it finds an obvious existing STEGO·STUDIO header or coherent readable text in common pixel-LSB layouts, Encode is blocked until you choose another image or explicitly continue with the current carrier.

### Changed

- **A negative preflight result is presented only as “no obvious prior hidden content detected”, never as proof that the carrier is clean.** Password-concealed or unsupported hidden data can still exist.

## v2.42.22 — 2026-08-15

**About This Project**

### Added

- **Added About This Project to the in-app menu.** It explains the project scope and makes clear that STEGO·STUDIO is experimental rather than a certified forensic or security product.

## v2.42.20 — 2026-08-15

**Alternate-message validation feedback refined**

### Fixed

- **The missing alternate-message warning now appears directly below the alternate password field that triggered it.** It disappears immediately when a non-blank alternate message begins.

## v2.42.19 — 2026-08-15

**Safer alternate-layer setup**

### Fixed

- **Enabling the alternate message can no longer silently produce a one-layer image.** Encode stays disabled until the alternate layer has a non-blank message and its own password, or the layer is turned off.

## v2.42.18 — 2026-08-15

**Enter shortcuts for Encode and Analyze**

### Added

- **Pressing Enter in the Encoder password fields starts Encode when the real button is available.** Message textareas keep normal multiline behaviour.
- **Pressing Enter in the Analyzer/Decoder password field starts Analyze when available.** The shortcut respects disabled/busy state, key repeat and IME composition.

## v2.42.17 — 2026-08-14

**Exported reports now have an explicit public schema**

### Changed

- **Export JSON now passes through an explicit allowlist before it leaves the Analyzer.** Internal working fields are no longer inherited automatically by the public report, making the exported schema more stable and preventing accidental internal state from appearing in future reports.

## v2.42.16 — 2026-08-14

**2.42 closure: evidence strength no longer drops when evidence grows**

### Fixed

- **Adding an active header match can no longer make Threat weaker than the same image with only its passive header.** The visible label still follows the most specific protocol state, while strong-evidence gating now follows the raw evidence strength independently.

## v2.42.15 — 2026-08-14

**Final 2.42 hardening: one evidence state, honest robust JPEG errors**

### Fixed

- **Threat, Protocol, the explanatory note and the offline-limit note now resolve the same native evidence state.** Mixed passive/active header cases can no longer describe the same finding with different labels.
- **Confirmed sturdier-mode JPEG evidence is no longer erased when the inner encrypted or compressed content cannot be opened.** The report keeps a confirmed locked/content-error state instead of falling through to “nothing found”.
- **Password feedback now resets deterministically and no longer depends on colour alone.** Repeated flashes share one timer, Clear removes the state, and the key icon plus the visible hint text change together with the orange outline.

## v2.42.14 — 2026-08-14

**Wrong-key highlight now frames the whole password field**

### Fixed

- **The wrong-key flash now highlights the password control as one complete field.** The effect used to be applied to the inner input, whose parent clips overflow; that left only two vertical orange lines visible. The flash now targets the outer key-field wrapper, producing the intended full rectangular outline without changing decoder logic.

## v2.42.13 — 2026-08-14

**One evidence order across the Analyzer**

### Fixed

- **Wrong-key feedback is now provisional everywhere a valid extraction may still happen later.** Three header-path failures still flashed the key field before the alternate layer and third-party engines had finished. With a supplied key they now wait for the same final gate as the generic decoder; missing-key prompts remain immediate.
- **Threat and Protocol now describe the strongest native evidence with the same precedence.** When a passive header and an authenticated extraction coexisted, Protocol said “extracted” while Threat mentioned only the header. The score was unchanged, but the wording diverged. Authenticated extraction now wins in both.
- **An authenticated extraction no longer hides the payload size when a public header also exposed it.** The route-neutral recovery text stays intact, with the already-public byte count appended when available.
- **One live English quick-guide sentence still referred to the removed Pro server.** It now matches the Portuguese text and the current offline product: adaptive methods are not reliably detected by this build.

## v2.42.12 — 2026-08-14

**Closing two remaining layer distinguishers**

### Fixed

- **A valid alternate password no longer makes the key field flash as if the password were wrong.** The generic decoder used to give that warning before the alternate layer had its turn. The warning is now provisional and only appears after every applicable extraction route has failed.
- **A message recovered by another tool can no longer inherit STEGO·STUDIO extraction status from a native header that matched earlier but failed to decode.** Header match and payload recovery are now kept as local operation facts until the final evidence state is resolved.

## v2.42.11 — 2026-08-14

**Two valid passwords no longer reveal which layer they opened**

### Fixed

- **The two-message mode could betray which password had opened which layer.** Both passwords still recovered their messages correctly, but only the main route was promoted to a confirmed STEGO·STUDIO extraction in the Analyzer. The alternate route is deliberately headerless and validates through AES-GCM, so its message appeared while Threat and Protocol stayed at the same level as a wrong password. A successful native recovery now becomes one public state regardless of the internal route, and the report does not publish a decoy/tail-layer marker.
- **A recovered alternate message no longer makes the protocol panel claim that a header was found.** That sentence was true for the main route and false for the alternate one. The panel now says only what both successful routes prove: a STEGO·STUDIO payload was recovered with the supplied password.

## v2.42.10 — 2026-08-13

**The interface locks during analysis on purpose now**

### Changed

- **While an analysis runs, everything that could change it is now deliberately locked.** It already behaved that way, but only by accident: the work occupies the browser so thoroughly that clicks and pasted images were simply never noticed. That is not a promise — it would quietly disappear the day the analysis becomes smoother or moves to a background thread, and interaction would return without anyone choosing it. Loading an image, editing the password, clearing, and switching language now wait for the analysis to finish, and say so rather than appearing to ignore you.

### Fixed

- **Pasting an image with Ctrl+V followed a separate path that did not invalidate a running analysis.** Dragging a file in and pasting one were two copies of the same loading routine, and only the first had been taught to discard results in flight. There is now a single entry point that both use. Two smaller repairs travel with it: finishing an analysis no longer re-enables the Analyse button without checking whether an image is actually loaded, and re-analysing the same image now supersedes the previous report instead of sharing its identity.

## v2.42.9 — 2026-08-13

**Loading a new image mid-analysis showed the old one’s results**

### Fixed

- **If you loaded a second image while the first was still being analysed, the preview changed but the results that appeared belonged to the previous image.** An analysis takes several seconds and reads the current image repeatedly along the way, so swapping the image underneath it left the two halves describing different files. Each analysis now works from a copy taken when it started, and checks before showing anything whether it is still the current one — if not, it finishes quietly and shows nothing. Changing the language mid-analysis could bring the old results back the same way, and no longer does.
- **A file that could not be read was being reported as a file with no camera metadata.** Those are different things, and the second one feeds the origin classifier — so a read failure was quietly becoming evidence about the image. The report now distinguishes not read from read and empty.

## v2.42.8 — 2026-08-13

**A frozen progress bar and a note that argued with itself**

### Fixed

- **Analysing a second time could leave the progress bar stuck forever with nothing in the console.** Reading the file was wrapped in a promise that waited only for success — if the read failed, no error was raised, nothing was logged, and the wait simply never ended. That is why the failure looked like a freeze rather than a fault. File reading now reports failure, cancellation and silence alike, gives up after a minute rather than waiting indefinitely, and a second analysis cannot start while one is still running.
- **The protocol panel showed the recovered message and, just below it, said no readable text had been recovered.** Three separate places describe the same finding — the threat tags, the panel heading, and its explanatory note — and each learned about confirmed extraction at a different time, so the last one was still describing the old state. All three now read the same state, so they no longer contradict each other.

## v2.42.7 — 2026-08-12

**Two panels disagreeing about the same message**

### Fixed

- **With the right password, one panel said a payload had been extracted while the panel below called the protocol undetermined.** Both were describing the same file at the same moment. The Protocol panel only ever consulted the passive scan, which runs without your password and cannot see a payload whose header is hidden — so once the password revealed one, that panel had no idea and fell back to guessing. It now reads the same evidence the threat score does, ordered by strength, and distinguishes a header confirmed with your password from one merely spotted without it.

## v2.42.6 — 2026-08-12

**Finding the header is not the same as reading the message**

### Fixed

- **The report could announce an extracted payload when nothing had been read.** The previous version started counting an extraction the moment the hidden header was located, but six different outcomes still end with no message: a corrupted body failing its authentication check, an encrypted payload with no password given, decompression failing. In all of them you would have been told a payload was extracted while the screen showed nothing. There are now two distinct findings — a header was found, and a message was recovered — with the second recorded only after a message actually survives. The sturdier JPEG mode always drew this line; the ordinary path now does too.

## v2.42.5 — 2026-08-12

**Two things the analysis was getting wrong**

### Fixed

- **Recovering a hidden message no longer leaves the threat score unchanged.** In lossless images the passive scan looks for a message without your password, so a payload whose header is masked stays invisible to it — and the score came out identical whether the password was right or wrong, even with the full message on screen. Actually reading a message is the strongest evidence there is, stronger than any statistic, and it now counts as such. The sturdier JPEG mode already did this; the ordinary path had been left out.
- **An image with no hidden message could reach the maximum threat score.** The tool knows that AI-generated files carry provenance data which produces statistical noise resembling steganography, and it has a rule to discount those signals. But the switch that turned the rule off was itself wired to two of those very signals, so on exactly the files the rule was written for, it never ran. A clean certified image scored 100 and announced a possible encrypted message. The switch now responds only to structural evidence — a header, an extracted payload, data past the end of the file — so a genuine hidden message still overrides the discount, while noise alone no longer does.
- **Two smaller repairs.** The exported report printed a placeholder instead of the image proportion it had already calculated. And the invisible element that catches a pasted image was marked as hidden from screen readers while still receiving keyboard focus, which leaves someone using one with no idea where they are.

## v2.42.4 — 2026-08-11

**Safer file-derived status text and corrected Steghide guidance**

### Fixed

- **The help no longer claims Steghide/BMP support that is not implemented.** The supported path is JPEG, and the guidance now distinguishes identification from the much narrower set of cipher/mode combinations this Decoder can actually decrypt.

### Security

- **Status messages are now rendered as plain text.** Error text can include information derived from the file being examined, so the status line no longer treats that content as markup.

## v2.42.3 — 2026-08-11

**Fewer doors, and an honest page about what this tool can read**

### Added

- **A page now states exactly what this tool can and cannot read from other steganography tools.** Saying "supports Steghide" would be misleading: Steghide can encrypt with eighteen algorithms across seven modes, and this decoder implements two of those combinations — which means even its default cipher fails in six of its seven modes. That is measured against the real program, not estimated. The page also records that OpenStego payloads written with its own encryption are identified but not decrypted, and that F5 is only ever guessed at, never extracted.

## v2.42.1 — 2026-08-11

**Finishing what the last version started**

### Changed

- **Two more places were still calling an unverified C2PA declaration "certified".** The last version corrected this wording in four texts and missed two, so the AI panel kept announcing certified synthetic origin while the panel beside it explained that no signature had been checked. Both now say the same thing.
- **The Pro mode was removed two versions ago, but the help text kept recommending it.** Several passages still told you to retry once the neural server was online, next to a promise that nothing is ever sent to a server. The help now describes the tool that exists. The claim that camera firmware cannot be forged is gone too — it was never true, and the code had already stopped relying on it.
- **The random choice in LSB Matching now comes from the cryptographic generator.** Each altered pixel moves up or down by one, and that direction was drawn from the browser’s ordinary random source — fast, but predictable, and the pattern of those directions is exactly what an analyst looks at.

### Fixed

- **Four more file-derived fields are now rendered strictly as text.** The certificate signer, C2PA generator name/version, software quoted in AI notes and manifest signal list can no longer be interpreted as page markup.
- **A deliberately absurd PNG could take the tab down before showing an error.** Width and height are read from the file and were trusted straight into memory allocation, so a header claiming enormous dimensions, or a small file that decompresses into gigabytes, would exhaust memory first and explain later. Both are now bounded and fail with a readable message.
- **The offline guarantee allowed more than it claimed.** The rule’s comment said only exact metadata addresses were permitted, but the pattern accepted any path on this site’s own domain. It now matches a closed list of exact addresses. The direction of the choice matters: the tool’s strongest promise should be checked by its strictest rule.

## v2.42.0 — 2026-08-11

**Treating the file as hostile input**

### Changed

- **C2PA detection no longer presents an unverified declaration as authenticated provenance.** The Analyzer now requires the declaration to appear in the expected container structure and states plainly that it found the declaration without cryptographically validating the signature.
- **Camera metadata no longer settles the question of whether an image was generated.** Camera fields remain useful evidence, but they are treated as editable metadata rather than an unforgeable source of truth.

### Security

- **File-derived metadata is escaped before it reaches page markup.** Crafted camera/software fields can no longer execute as HTML or script when the image is analyzed.

## v2.41.0 — 2026-08-11

**The source is public, and the footer finally proves it**

### Added

- **The tool is now free software under GPL-3.0, and the full source is published.** You can read every line that runs on your machine, change it, and share it. If you distribute a modified version, that version has to stay free under the same terms — which is the point: a tool whose whole premise is that you can verify what it does would be undone by a derivative nobody can inspect. The copyright notice now travels inside the file itself, since the file is the distribution.

### Changed

- **The footer used to claim this was open source without offering any way to check.** It said so as plain text — no link, no license named, nowhere to go. That is precisely the kind of unbacked claim this tool treats as a bug anywhere else in its own interface, so it was overdue. The footer now names the license and the address where the source lives.

## v2.40.0 — 2026-08-11

**Fully local core: optional Pro server removed**

### Changed

- **The Limitations section now states the resulting detection gap directly.** Content-adaptive methods such as HILL or UNIWARD may evade the built-in statistical analysis, and the single-file build does not ship the specialised trained models normally used for that task.

### Removed

- **The optional Pro neural-analysis mode was removed.** The core no longer uploads an image to a remote model server; all functionality in the distributed single-file build now runs locally in the browser.

### Fixed

- **The offline dependency rule now allows only the exact first-party metadata addresses it was meant to allow.** The previous pattern was broader than its own description.
- **The adversarial-content and script-like-message warnings remain available after Pro removal.** They were moved out of the retired neural layer because neither warning requires a server.

## v2.39.0 — 2026-08-11

**When it cannot read the message, it can still name the tool**

### Added

- **A new panel names the tool that hid the message, even when the message itself stays locked.** It appears only when every engine has failed — if the text came out, that is already the stronger proof and repeating it here would be noise. Two levels, kept deliberately far apart: **Confirmed** means Steghide’s internal signature was actually read, which is proof rather than a guess, because that signature sits at positions derived from the password itself. **Indication** means something merely resembles a known tool. The two are told apart by icon, by the word itself, and by border style — never by colour alone.

### Changed

- **The tool now says exactly which cipher defeated it.** Steghide can encrypt with any of eighteen algorithms across seven modes; this decoder implements two of those combinations. Instead of falling silent on the rest, it now reports the precise pair — `blowfish/CBC`, `rijndael-128/CTR` — so you know whether to reach for another tool or whether the file is simply damaged.

### Fixed

- **A failed decompression no longer leaves an error hanging in the background.** When the extracted bytes were not valid compressed data, the tool recovered correctly but left an untended rejected promise behind, which the browser reports as an unhandled error. Nothing visible broke; the noise is simply gone now.

## v2.38.1 — 2026-07-20

**Two field fixes: needless resizing, and copy-paste**

### Changed

- **Copying an image (Ctrl+C) destroys a sturdier-mode message; saving the file does not.** When you copy an image, the system re-encodes it on paste, and that extra recompression erases the payload — there is nothing the tool can do about it, because the damage happens before the image ever reaches it. The tool now says so: if it sees the statistical trace of a message it cannot read, it tells you to save the file and open that instead. The quick guide got the same warning.

### Fixed

- **Images already within the size limit are no longer resized.** The sturdier mode was cropping every image down to a multiple of 8 pixels — turning a 460×460 picture into 456×456 for no reason. The encoder already handles partial blocks at the edges, so the crop was needless. It now only applies when an image genuinely has to be shrunk to fit the 1080 px envelope.

## v2.38.0 — 2026-07-20

**The Analyzer can now spot the sturdier mode on its own**

### Added

- **The tool can now flag its own sturdier mode in someone else's image — without the password and without extracting anything.** Hiding data in JPEG coefficients forces them onto a fixed grid, and zero is almost never a point on it, so the share of zeros in the affected frequencies collapses. That share alone proves nothing (clean images range from 14% to 74%), so it is compared against the neighbouring frequencies **of the same image**, which cancels out what the picture happens to contain.
- **Calibrated against 46 clean images** — five covers at seven compression qualities each, plus ten real photos taken from WhatsApp, Facebook, Instagram and X. Not one was flagged. Every image filled to capacity was.

### Changed

- **It only sees payloads that fill most of the capacity, and the tool says so.** At half the capacity it stays silent; below that the trace falls inside the natural variation between images. So this is a **trace**, never a confirmation — and silence from it is not a clean bill of health. A short message hidden this way will not be caught.

### Fixed

- The quick guide was still describing a PNG-only tool. The worst of it told you to send images as a file and never as a photo — advice the sturdier image was built to make unnecessary. The whole guide was rewritten.

## v2.37.4 — 2026-07-20

**The alternative message warns you while you are writing it**

### Changed

- **The limit of the alternative message now appears in the form, not only after encoding.** It is written into the pixels, so it travels in the stealthier PNG and not in the sturdier JPG. Saying that only in the results panel meant saying it after the choice was already made — the note now sits right under the box where you type it, and says which of the two images to keep if plausible deniability is what you came for.

## v2.37.3 — 2026-07-20

**Every text in the tool now matches what it actually does**

### Added

- **The how-it-works guide gained a section on the two images**, explaining what each one trades, why the sturdier one shrinks the picture to 1080 px, why it spends room on error correction, and that all of it was measured on real posts rather than estimated. It also states plainly that the alternative message exists only in the PNG.

### Fixed

- **The tool was still describing itself as PNG-only.** The terminal announced that a JPEG would be converted and saved as a PNG; the ticker claimed the output is always a lossless PNG; the note under the password field said the message sits in plaintext in the LSBs; and the how-it-works guide never mentioned the sturdier image at all. All of it has been rewritten. Since these promises were being made where a new user reads first, they are the ones that mattered most.
- The title of each output block was sitting too far from its image. The gap came from a border colour that does not exist in the palette: the browser threw the declaration away and kept the empty space it reserved.

## v2.37.2 — 2026-07-20

**Readable secondary text, and one rhythm for the panels**

### Changed

- **All blocks in the two output columns now breathe the same amount.** The download button was touching its neighbours and the trade-off report was glued to the box above it, because one container in the middle of the column was not passing the spacing down. There is now a single spacing value shared by both columns.

### Fixed

- **The secondary text was not dim — it was invisible.** The colour used for every explanatory note in the tool measured 1.87:1 against the panel background. The accepted floor for readable text is 4.5:1, so it was off by more than a factor of two. It has been raised to 4.84:1, keeping the same bluish tone: still clearly secondary, now actually readable. This affects notes everywhere in the tool, not only the new panels.

## v2.37.1 — 2026-07-20

**The Analyzer now sees what the Decoder reads**

### Changed

- **The two images now sit side by side**, each one self-contained: its own picture, its own download, its own numbers and its own report. Reading happens down each column; comparing happens across. The image-choosing tips moved below both, where they serve either one.
- The note about resizing shrank and moved inside the output-size box, next to the number it explains, instead of sitting apart as a paragraph of its own.

### Fixed

- **A recovered message no longer scores zero.** The Decoder was reading the sturdier-mode payload out of a JPEG and the threat score still said 0, because the score only ever looked at the LSB header. Pulling a real message out of an image is the strongest evidence there is — stronger than any statistic — and it now counts as such. A payload that only survived in part counts too, but as a **trace**, at half the weight: the header made it through and the body did not, and that distinction matters.
- **The alternative message only ever existed in the PNG.** It is written into the pixels, and the sturdier image is built from the clean cover — so it never carried it. The tool was silent about that, which made it look like a failed extraction. Now the sturdier image says plainly that it carries the real message only.

## v2.37.0 — 2026-07-19

**Two images out: one stealthier, one sturdier**

### Added

- **The Encoder now gives you two images instead of one**, both carrying the same message. The **stealthier** one is the PNG you already knew — it hides better, but the message dies if you post it. The **sturdier** one is a JPG that survives being posted: it hides the message in the JPEG coefficients, where recompression cannot reach it.
- **Measured, not estimated.** Real images were posted to WhatsApp, X, Facebook and Instagram, downloaded back, and read. The message came back intact from all four. Everything the sturdier mode does is set by those measurements: it shrinks the image to 1080 px because above that the platforms resize it and nothing survives, and it uses enough redundancy to absorb the worst damage any of the four caused.
- **Neither version is the better one.** The sturdier image reports what it trades on two separate readings — how well it survives the channel, and how discreet it is — instead of a single score, precisely so the two are not compared on the same ruler. Someone hunting for steganography in JPEG coefficients will see the pattern in the sturdier image; they still cannot read it without the password.
- The Decoder reads the sturdier mode automatically. If the payload was damaged in transit, it says so — **"there is a message here, but it did not survive the trip"** — instead of the far less useful "nothing found".

### Changed

- When the message is too long for the sturdier version, it says so with the numbers — how much you need and how much fits — and points you to the PNG plus a channel that preserves files. It never generates a broken image.

### Fixed

- Error correction refuses to guess. If the damage is beyond what it can repair, it reports failure rather than handing back a message that looks fine and is wrong.

## v2.36.0 — 2026-07-19

**Progressive JPEG: the DCT reader finally opens it**

### Added

- **Progressive JPEG (SOF2) is now read.** Until now the DCT coefficient reader refused these files, and that blind spot mattered: **Facebook and X publish progressive**. On those images the JPEG Analyzer showed nothing and the Decoder did not even attempt Steghide or OutGuess — on X in particular, which is the one platform that preserves payloads byte for byte.
- The reader now accumulates the multiple scans a progressive file is built from, covering all four cases (DC first and refinement, AC first and refinement), plus EOB runs and successive approximation.

### Fixed

- Removed the texts that said progressive was unsupported — the friendly notice on the DCT panel and the honest-limits item in the help. They would now be lying.

## v2.35.2 — 2026-07-18

**The platform notice stops crediting the wrong method**

### Changed

- The notice was reorganised: first **what** was detected and **why it matters** (EXIF stripped, so the camera veto cannot apply and pixel signals inflate the synthetic score), then **how** it was detected.
- On JPEG, the **Decode Status** line no longer repeats the note right above it. Instead of "LSB unavailable", it now says what actually matters: which engines were tried and what came of it.

### Fixed

- The platform notice had **"(identified by filename)"** written into it, from back when the filename was the only method. Even when the detection came from the file's structure, it kept crediting the name — and contradicted the line added in the previous version. It now lists only the methods that actually fired.

## v2.35.1 — 2026-07-18

**Stops hiding the extraction result on JPEG**

### Fixed

- On a JPEG, the **Protocol** module showed only "STEGO·STUDIO protocol uses LSB — unavailable in JPEG" and nothing else. But the **Steghide** and **OutGuess** engines had been tried anyway, and their result was being thrown away. The **Decode Status** line now always appears, including when the tool's own protocol does not apply.
- This also makes the note in the DCT-coefficients panel true: it points to that line, which until now simply did not exist on JPEG — the exact format where the note is shown.

## v2.35.0 — 2026-07-18

**Recognises the platform by the file itself**

### Added

- The tool can now tell that an image passed through **WhatsApp**, **Facebook** or **Instagram** by reading the file's own structure — the quantisation tables and how it was encoded. Until now this was guessed from the file name alone, which vanishes the moment someone renames or re-downloads the image.

### Changed

- The origin panel now says **where the evidence came from**: structure (survives renaming) or file name (fragile). Knowing how strong a signal is matters as much as the signal.
- The profiles come from real measurements, not assumptions. **X/Twitter was deliberately left out**: it does not recompress — it repackages the image losslessly, keeping the original tables. So it has no signature of its own, and claiming one would produce a false match on any untouched file from the same editor.

### Fixed

- The note in the DCT-coefficients panel pointed to a "decoding panel" that does not exist by that name. It now names the actual places on screen, and covers both cases — where the message shows up when something is found, and where the outcome shows up when nothing is.

## v2.34.0 — 2026-07-18

**Saying plainly what it does — and what it does not**

### Added

- New help section: **The Decoder — what it reads, and what it doesn't**. It lists the tools that are actually read (STEGO·STUDIO's own protocol, OpenStego, Steghide, OutGuess), the ones that are not — **with the reason for each** — and the honest limits: no usable LSB in JPEG, progressive JPEG unsupported, and the DCT chi-square being a weak indicator rather than a detector.

### Fixed

- The help modal still said the tool had **two** functions, while the header right above it read ENCODER · ANALYZER · DECODER. The Decoder — the module that grew the most in recent versions — was missing from the tool's own description.
- A scrolling-bar message claimed the deep investigator *"recovers messages from any tool"*. It does not: it sweeps for readable text when no known header is present. The overclaim was replaced by an accurate description, and messages covering the real capabilities were added.
- The DCT-coefficients panel told the reader to "use the Decoder" — in a tool with a single button that had already run it, and mentioning only Steghide. It now says plainly that the extraction was already attempted, with both engines, and where to find the result.
- In the origin panel, the *synthetic* category could show a score with no signal explaining it, when the digital-graphic safeguard capped that score. It now states why the score exists and why it stopped there.

## v2.33.3 — 2026-07-18

**Faster still: one read per analysis**

### Changed

- The previous version stopped the two Decoder engines from repeating the same heavy work. This one finishes the job: the Analyzer was *also* decoding the same JPEG separately. The image is now decoded **once per analysis** and the result is shared by everything that needs it — up to **43% faster** on large photos, on top of the previous gain.

## v2.33.2 — 2026-07-18

**Decoder is faster on JPEG**

### Changed

- When reading a JPEG, the Decoder was doing the same heavy work twice: the Steghide engine decoded the image's DCT coefficients, found nothing, and the OutGuess engine decoded exactly the same thing all over again. It now decodes once and shares the result. Around **25% faster** on JPEG, and the gain is biggest on large photos — where the wait was most noticeable.

## v2.33.1 — 2026-07-18

**A digital image is not an AI image**

### Changed

- The previous safeguard only worked on PNG, because it required almost no noise — something JPEG compression destroys. The new one works on compressed images too.
- Hard evidence still wins: when a C2PA manifest or EXIF names an AI generator, the AI verdict stands.

### Fixed

- Rendered text, diagrams, flat art and exported screens saved as JPEG could be reported as **high probability of AI**. The signals behind that were real, but they only ever said "this is not a photograph" — none of them is specific to AI. The tool now recognises these as digital graphics, caps the AI score and classifies them under **digital art** instead.

## v2.33.0 — 2026-07-18

**Decoder now reads OutGuess**

### Added

- The Decoder can now recover messages hidden by **OutGuess** — the tool famously used by the **Cicada 3301** puzzle. It works with no password (OutGuess's default) or with the password when one was used.
- With OpenStego, Steghide and OutGuess, the Decoder now covers the three most common third-party tools — a single place that recognises the format, identifies the tool and recovers the message.

### Fixed

- OutGuess has an edge case where the last byte of a message is never actually embedded (it falls past the image capacity). When that happens the Decoder recovers the rest and says so plainly, instead of showing a corrupt character as if it were real.

## v2.32.1 — 2026-07-17

**JPEG detection & progressive handling fixes**

### Fixed

- Image format is now detected by **file signature (magic bytes)**, not just extension or MIME type. Files like **.jfif**, .jpe, or JPEGs with a wrong/missing MIME are now correctly recognized and get full DCT + Steghide analysis.
- **Progressive JPEGs** now show a clear, friendly message explaining that DCT analysis currently supports baseline JPEG (progressive is planned), instead of a confusing error. Strings, metadata and AI analysis still run.
- The terminal no longer warns that JPEG is "unavailable" — it now correctly reflects that DCT-coefficient analysis, Steghide extraction, AI and metadata all work for JPEG.

## v2.32.0 — 2026-07-17

**Analyzer now inspects JPEG DCT coefficients**

### Added

- For **JPEG** images, the Analyzer no longer just says "unavailable" — it now reads the actual quantized **DCT coefficients** and reports descriptive statistics (non-zero counts, distinct values, distribution across frequency bands) plus a first-order chi-square check.
- The chi-square result is labeled **honestly**: it catches naive high-rate LSB embedding (like Jsteg), but not tools that spread a small payload (Steghide, OutGuess, F5). The Analyzer states plainly that absence of a signal does not mean the image is clean — and points to the Decoder for a real Steghide extraction.

## v2.31.0 — 2026-07-17

**Decoder now reads Steghide (incl. JPEG/DCT)**

### Added

- The Decoder can now recover messages hidden by **Steghide** — the popular steganography tool. This includes Steghide in **JPEG** images, which hide data in DCT coefficients rather than pixels, a domain the Analyzer previously couldn't reach at all.
- Steghide encrypts by default with **AES-256**; the Decoder handles this transparently — provide the password and the message is recovered, filename and all. Without a password, Steghide files made without one are read automatically.
- Under the hood, this introduces a shared **JPEG/DCT engine** that reads quantized DCT coefficients directly in the browser — the foundation for upcoming JPEG steganalysis and robust-mode embedding.

## v2.30.0 — 2026-07-16

**Decoder now reads OpenStego images**

### Added

- The Decoder can now recover messages hidden by **OpenStego** (RandomLSB), not just STEGO·STUDIO's own format. Images with no password are read automatically; password-protected ones are recovered when you provide the password. This is the first of several third-party engines planned.
- When an OpenStego image uses its optional AES encryption, the Decoder identifies the source honestly and tells you to open it in OpenStego with the password, instead of pretending to extract it.

## v2.29.1 — 2026-07-16

**Plausible deniability — UI polish**

### Changed

- The "protection" field now reads "plaintext (no password)" when no key is set, making it clearer that a message without a password is trivially recoverable.

### Fixed

- When the second message is enabled and filled but has no password, the Hide button stays disabled with an inline alert (the alternate message is always encrypted, so it requires its own password). The terminal message, if reached, now reads "alternate password required".

## v2.29.0 — 2026-07-15

**Plausible deniability: a second, hidden message**

### Added

- The encoder can now embed a **second, independent message** in the same image, unlocked by a different password. If someone forces you to reveal a password, you hand over the alternate one — it reveals a harmless message, while your real message stays protected and **undetectable even to someone holding this tool's source code**. The two layers never overlap; each decodes only with its own password.
- The real message keeps full STC stealth; the alternate message is stored separately and validated by AES-GCM — no marker betrays that a second layer exists.

## v2.28.3 — 2026-07-04

**Tips moved into a second box in the right column**

### Changed

- The "Choosing an image" tips moved from a full-width band into a **second box in the right column**, below the stealth report — same style, filling the empty space so the two columns balance in height. Single-column list (no more 4-column spread).

## v2.28.2 — 2026-07-04

**Encoder layout rebalanced**

### Changed

- Reworked the encoder output so the two columns balance: the **map button and legend moved under the image** (where the map appears), the tips became a **full-width band below** with a separator, the caveat now sits right under the verdict, the image is larger, and the spacing around the download button was fixed.
- The map legend now reads "less detectable → more detectable" (clearer than "clean → leaks") in **both** the encoder and the analyzer. The encoder map button reads "Show stealth map".

## v2.28.1 — 2026-07-04

**Encoder output in two columns; map as an overlay**

### Changed

- The encoder output was reorganized into **two columns** (image + download + stats on the left, stealth report on the right) — no more stretched empty space, and the download button sits at the top, reachable without scrolling.
- The leak map is now an **overlay on the generated image** (like the Analyzer), shown by a button — instead of a cramped inline grid. That frees the right column for full bullet-point tips, and the map is only computed on demand (lighter encode). The verdict moved up to right below the two bars.
- In the Analyzer, the leak map now turns on automatically when you open the module (computed then, not before), with the button still there to toggle it off/on.

## v2.28.0 — 2026-07-04

**Leak panel: bigger image, legend, and split tips**

### Added

- Context-aware tips: the **Encoder** shows "Choosing an image" (avoid homogeneous images, prefer texture, smaller message in a bigger image, use the original) — advice for someone hiding a message. The **Analyzer** shows "How to read this map" — forensic interpretation for someone hunting one.

### Changed

- The Analyzer leak map moved from the tiny drop preview into its own results module, with a **larger image**, the overlay, and a **legend** (clean → more signal). On desktop it is two columns (image + reading); on mobile it stacks.
- Terminology changed from “detection floor” to “detection threshold”, because “floor” wrongly suggested a minimum that had to be exceeded. The Encoder map now shares the same cyan visual language as the Analyzer overlay, with a matching legend.

## v2.27.1 — 2026-07-04

**"Working…" indicator so the encoder never looks frozen**

### Fixed

- After encoding, the tool runs the stealth analysis on the main thread, which briefly froze the UI (and the terminal) — over a second of apparent lock reads as "broken". Now the **Encode button** shows a spinning "Working…" state the moment you click. The spinner animates on the compositor thread, so it **keeps moving even while the analysis blocks JavaScript** — clear "it is working" feedback, not frozen.
- The indicator lives on the button itself — ideal on mobile, where scrolling down to Encode pushes the terminal off-screen. Respects prefers-reduced-motion.

## v2.27.0 — 2026-07-04

**Leak map overlay in the Analyzer**

### Added

- The Analyzer can now overlay a **leak map** directly on any image you load: a "Show leak map" toggle highlights the regions where the RS signal is strongest, aligned to the image (letterboxing handled). Clean regions stay transparent so the picture shows through; leaky regions get a cyan glow (colorblind-safe brightness cue). Computed on demand — no cost unless you open it.

## v2.26.0 — 2026-07-03

**Leak map: see where the signal is strongest**

### Added

- The output stealth report now includes a grayscale **leak map** — a grid where brighter cells show where the RS signal is strongest across the image, so you can see which regions gave the payload away (smooth areas leak, textured areas hide). Luminance scale, colorblind-safe. Reuses the RS detector per grid cell.

## v2.25.0 — 2026-07-03

**The encoder now grades its own stealth**

### Added

- **Output stealth report:** after encoding, the tool runs its own statistical arsenal (RS/WS) on the image it just produced and tells you how detectable it came out — estimated RS/WS rate plus a plain-language verdict (below the detection threshold / weak signal / detectable). It uses the same thresholds as the Analyzer, so the encoder never claims "stealthy" where the Analyzer would say "detected".
- It runs automatically in the background (the image and stats appear instantly; the verdict fills in a moment later) and states honestly that it measures *our* output with *our* arsenal — not a guarantee of undetectability against every tool. This closes the encode→detect→improve loop right inside the app.

## v2.24.0 — 2026-07-03

**Modular source + build pipeline + true offline**

### Added

- Truly offline fonts: the three UI typefaces (IBM Plex Mono, IBM Plex Sans, Bebas Neue) are now embedded directly in the file instead of being fetched from Google Fonts. Open the HTML with no connection at all and it looks exactly the same — including the monospace terminal. The build now hard-fails if any network dependency slips back in.

### Changed

- The published app remains one standalone HTML file, and the build now verifies that it contains no runtime network dependency.
- All inline onclick handlers were migrated to addEventListener (wired once on load, with delegation for the dynamic forensic accordion). Behaviour is identical; the markup is now clean and ready for the modular source scopes.
- No change to runtime behaviour, UI, capacity or detection: you still download one HTML file and run it with no server. HILL and STC are now separate modules, making future work on adaptive costs and syndrome-trellis coding safer to edit in isolation.

## v2.23.1 — 2026-07-02

**Documentation fixes + i18n cleanup**

### Changed

- Rewrote the "Protection & Stealth" help section to match how the tool actually works: instead of three selectable modes (adaptive / STC / stealth-header), it now explains the two embedding paths the tool auto-selects (default STC-over-HILL stealth vs. RGB capacity) and the automatic password layers (AES-256-GCM, bit-order scrambling and hidden header).
- The Limitations section now clarifies the optional Pro mode (Aletheia server): trained neural models can target adaptive/neural methods like HILL and SteganoGAN, as a separate, optional, still-probabilistic layer — the in-browser core stays statistical and offline.
- Renamed the capacity toggle from "Prioritize capacity" to "High Capacity Mode" (label plus every UI reference: hints, auto-switch notice, quick guide and help).

### Fixed

- Corrected the outdated "only lossless formats work for encoding" claim in the How-it-works modal and the info ticker: since the universal-carrier change (v2.18.2), any browser-decodable image (JPEG included) is accepted as a carrier and always saved as a fresh lossless PNG — lossless matters for the output, not the input.
- The optional-key ticker message no longer implies any LSB extractor can read an un-keyed message; it now frames the key as encryption plus bit-order scrambling.
- Removed an orphan i18n key (termNotSupported) that was never referenced.

## v2.23.0 — 2026-06-30

**Argon2id key derivation**

### Changed

- **Older protected images remain decodable through the KDF version byte.** New images use Argon2id (`0x02`); images created with the earlier PBKDF2 envelope (`0x01`) continue to decode, and AES-GCM still supplies wrong-password/authentication failure detection.

### Security

- **Password-based AES-256 keys are now derived with Argon2id (RFC 9106, m=64 MiB, t=3, p=1) instead of PBKDF2 for new protected payloads.** This raises the memory and computation cost of password guessing while keeping the Argon2 WebAssembly inside the single-file build.

## v2.22.0 — 2026-06-29

**Canonical HILL cost map (better stealth placement)**

### Changed

- The adaptive/STC cost map now uses the canonical HILL formula (Li et al. 2014): the high-pass residual is smoothed by a 3×3 low-pass before the reciprocal, then spread by a 15×15 low-pass after it. This concentrates lower embedding cost in textured regions, matching HILL’s content-adaptive design, instead of the previous single 3×3 pass over `1/|R|`. The blur is implemented as an O(n) separable pass.

### Fixed

- Backward compatibility preserved via a format flag (FLAG_HILLV2): new adaptive images use the V2 map; adaptive images made before v2.22 (no flag) still decode with the original cost map. STC is unaffected (its decode is syndrome-based, cost-independent), so all STC images decode regardless.

## v2.21.0 — 2026-06-29

**HEIC detection + clear warning**

### Added

- HEIC/HEIF (Apple) files are now detected by their ftyp signature and produce a clear message ("convert to PNG or JPEG") in both the encoder and decoder, instead of failing silently — the browser cannot decode HEIC (except Safari). AVIF is intentionally left out, since modern browsers decode it fine. A generic message also covers any other image that fails to decode.

## v2.20.0 — 2026-06-28

**In-tool changelog restored**

### Added

- The version history modal is back in the tool (gear → "Version history"), in the original format, listing every semver release (v2.10+) with pre-semver versions marked "Legacy" below a divider.

## v2.19.2 — 2026-06-28

**C2PA false-positive calibration + UI tweaks**

### Changed

- **C2PA context suppression**: when the tool finds a structured C2PA declaration associated with synthetic provenance and there is no hard steganography evidence, signals that the C2PA content itself can create — manifest/SVG strings, SynthID-related LSB anomalies or neural firing — no longer inflate the Threat score. A real recovered message or other hard evidence still overrides the suppression.
- C2PA fields now read inline (LABEL: value); the encoder drop hint no longer lists formats.

## v2.19.0 — 2026-06-28

**Neural false-positive veto (flat/vector covers)**

### Changed

- The HILL neural detector fires ~0.99 on flat vector art even with no message (a cover-type artifact proven by clean baselines). Such signals are now marked inconclusive and stop inflating the threat; real detections on textured covers are preserved.

## v2.18.2 — 2026-06-28

**Encoder accepts any image (converts to PNG) + state-bug fix**

### Changed

- The encoder now accepts any decodable image as carrier; non-lossless input is converted to a NEW PNG on output (the message lives in the converted pixels, so lossy input is safe).

### Fixed

- Fixed a state bug where typing/clearing the password re-enabled the encode button on a previously blocked format.

## v2.17.0 — 2026-06-28

**C2PA manifest parsing — highlighted fields + readable summary**

### Added

- When a C2PA manifest is present, the key fields are parsed and highlighted (Signer, Generator, Version), with a readable .txt summary alongside the raw .c2pa.

### Fixed

- digitalSourceType now reads correctly (trainedAlgorithmicMedia) via the IPTC URL anchor.

## v2.16.0 — 2026-06-28

**C2PA asset extraction (watermark SVG + manifest)**

### Added

- Carves the C2PA watermark SVG and JUMBF manifest from the file bytes, with a sanitized SVG preview and downloads for both.

## v2.15.0 — 2026-06-27

**STC (Syndrome-Trellis Codes) — cost-aware embedding**

### Added

- The message body is now embedded via STC: a Viterbi search picks the minimum-HILL-cost change set satisfying H·y=m; decode is by syndrome (cost-independent, robust). STC is the new default stealth mode.

### Changed

- ~40% fewer pixels changed for the same message vs LSB-matching, concentrated in texture.

## v2.14.0 — 2026-06-27

**Pure-JS pixel I/O (anti-farbling)**

### Fixed

- Tool images failed online (HTTPS) but worked offline because canvas anti-fingerprinting could inject ±1 noise into `getImageData`, flipping LSBs and breaking decryption. PNG pixels are now read/written through a pure-JS codec instead of that 2D-canvas path, avoiding those canvas-side transformations for native PNG I/O.

## v2.13.1 – v2.13.9 — 2026-06-23 → 2026-06-26

**Encoder patch series: opaque-pixel embedding + detection calibration**

### Added

- Reversible capacity auto-switch (a too-large message turns capacity on by itself + amber warning, reverts if shortened) and a poor-cover stealth hint.

### Changed

- Detection calibrated against clean baselines: WS gated on flat covers (RS-primary), even/odd bias suppressed on quantized palettes, vector-art veto in the AI panel. Clean cover 35→0 (false positive removed); small message + password 35→0 (matches clean = stealth proven).

### Fixed

- **Critical alpha bug**: the canvas zeroes the RGB of transparent pixels (alpha premultiplication), destroying a header written on a transparent pixel. Embedding now uses **only opaque pixels** (alpha==255); the alpha channel is never touched, so transparency and appearance are fully preserved.

## v2.13.0 — 2026-06-23

**Encoder reorganized: stealth by default**

### Changed

- From 4 controls to 1 optional ("Prioritize capacity", off by default). The encoder auto-selects the stealthiest mode that fits (Adaptive → Standard → RGB); the stealth header is automatic whenever a password is set. Fully backward compatible.

## v2.12.1 — 2026-06-22

**Stegomalware detection**

### Added

- A module flags when the decoded hidden message looks like a script or executable (PowerShell/IEX, download-and-run, reverse shells, obfuscated JS, MZ/ELF headers). It runs only on successfully extracted content, with a dedicated alert banner and a contribution to the threat score.

## v2.12.0 — 2026-06-22

**Automatic payload compression**

### Added

- The message body is compressed with deflate-raw before encryption (only when the result is actually smaller), increasing useful capacity. Flagged by FLAG_COMPRESSED; fully backward compatible.

## v2.11.8 — 2026-06-22

**Password strength meter**

### Added

- A real-time strength indicator (Weak / Medium / Strong / Excellent) below the encoder password field, using a light in-house entropy heuristic (no zxcvbn, keeping the single file).

## v2.11.7 — 2026-06-21

**C2PA detection hardening**

### Fixed

- parseC2PA still scanned the whole file (including pixels) in spots; the certificate date and software name are now read only with real C2PA evidence, and SVG-watermark detection requires a viewBox near the &lt;svg&gt; to avoid chance matches in pixel noise.

## v2.11.6 — 2026-06-21

**Detectability (max-fill) warning**

### Added

- A warning when the message fills more than ~25% (caution) or >50% (high) of capacity, even if it fits — heavy embedding is the biggest tell for statistical/neural steganalysis.

## v2.11.5 — 2026-06-21

**C2PA false-positive fix**

### Fixed

- parseC2PA "confirmed" an AI generator just by matching its name in the raw bytes (including pixels) — short tokens like "grok" appeared by chance in binary noise. The generator is now identified only with real C2PA evidence.

## v2.11.4 — 2026-06-21

**Pro Mode authentication (frontend)**

### Added

- The frontend sends an X-API-Key header on every /analyze call; not a secret (client-side), but it blocks bots and scanners that do not send the key.

## v2.11.3 — 2026-06-20

**SEO on the new domain + encoder guide reorder**

### Changed

- Encoder guide step order: load → choose embedding mode → message → key → generate.

### Fixed

- URL tags (canonical, og:url, og:image, JSON-LD) pointed to the old domain; now stegostudio.com. Added robots.txt and sitemap.xml.

## v2.11.2 — 2026-06-20

**Updated quick guides**

### Added

- Encoder/Decoder guides now cover the embedding modes and stealth mode; leftover "XOR" text replaced with AES-256.

## v2.11.1 — 2026-06-20

**UX & layout polish**

### Changed

- Smooth auto-scroll to the generated image on encode; uniform spacing between result blocks.

## v2.11 — 2026-06-20

**Stealth mode (password-encrypted header)**

### Added

- Stealth mode masks the message header (MAGIC + mode + size) with a password-derived keystream, removing the fixed plaintext `STEGO` signature from that path. The correct password reconstructs the self-validating header. Requires a password.

### Changed

- Adaptive mode renamed from "(stealth)" to "(anti-detection)" to avoid ambiguity with the new stealth mode.

## v2.10 — 2026-06-19/20

**Adaptive embedding (HILL-cost anti-detection)**

### Added

- Adaptive mode places changes in texture/noise regions using a HILL cost map to reduce embedding cost and classic structural traces. The Decoder recomputes the same cost map (over the top 7 bits) to find the positions. It can be combined with encryption and password-based scrambling.

### Changed

- Changelog removed from the site (kept as a document) — restored in v2.20.0.

## v2.9.1 — Legacy — 2026-06-19

**UI polish: encoder key clear, table border, adversarial highlight**

### Added

- **Clear button on the Encoder key**: an "x" clears the encoding key (shown only when text is present), matching the Decoder. The encoder key is kept across attempts (not auto-cleared on image change).

### Changed

- Adversarial warning: the found string is now highlighted (its own boxed background, larger type), with the reason as a smaller label above.

### Fixed

- **Indicators table top border**: now that the table is visually separated from the scores, its top edge is closed again (full border + rounded corners).

## v2.9.0 — Legacy — 2026-06-19

**Header-independent message extraction (statistics authorize display)**

### Added

- **Messages without a tool header are now displayed**: when LSB statistics (RS/WS/chi-square) confirm embedding, any coherent text recovered by deep scan is shown as a real message — even short, even with low printable ratio, even without a STEGO/JOI header. The proof that it is a message comes from the statistics, not from the text being long or fully readable.
- **Resistant to fragmentation**: because statistical detection (not text length) authorizes display, splitting a message into tiny pieces does not evade detection — each embedded fragment lights up the LSB statistics. The recovered text may include some surrounding noise, which the user can easily tell apart from the real message.

## v2.8.2 — Legacy — 2026-06-19

**C2PA notice fix (offline-independent, below threat)**

### Fixed

- **C2PA false-positive notice now works offline**: it was tied to the neural section and only showed in Pro mode. It is now independent of the neural models and appears below the threat score whenever a C2PA declaration is found — since C2PA is detected in the offline analysis, the notice shows with or without the Pro backend.

## v2.8.1 — Legacy — 2026-06-19

**UX fixes batch**

### Added

- **C2PA false-positive notice**: when the tool finds a C2PA declaration associated with synthetic provenance and the neural models fire, a note explains that the scores may be false positives because those models were trained on real photos.
- **Decoder password: clear button**: an "x" clears the key (shown only when text is present), and the field is auto-cleared when a new image is loaded so a previous key cannot affect the next analysis.

### Fixed

- Clear/Clear Analysis dialog buttons (Confirm/Cancel) are now translated to English.
- Protocol accordion: "Recovered text" now matches the consolidated verdict instead of contradicting the decode status (shows "detected, not extractable" when the body was discarded as noise).

## v2.8.0 — Legacy — 2026-06-19

**Password-based position scrambling**

### Added

- **Password-protected LSBM payloads now use a password-derived Fisher-Yates order for their body positions.** Extracting the modified channel in physical order no longer reconstructs the payload body without reproducing the same password-derived ordering.

### Changed

- **Images without position scrambling remain backward compatible.** AES-GCM continues to protect the message content independently of the placement order.

## v2.7.0 — Legacy — 2026-06-18

**AES-256-GCM encryption replaces XOR for new protected messages**

### Changed

- **Images created with the old XOR format remain decodable for backward compatibility.**

### Security

- **The optional password now protects new messages with AES-256-GCM instead of the earlier XOR scheme.** The key is derived with PBKDF2 in this legacy format, and authenticated decryption rejects a wrong password or modified authenticated payload.

## v2.6.0 — Legacy — 2026-06-18

**Adversarial content detection**

### Added

- **Adversarial content warning**: a new layer flags text embedded in the file that appears designed to manipulate analysts or AI systems — prompt-injection-style instructions and counter-forensic claims (e.g. "no hidden content"). It is additive and structural, not a fixed phrase list, so it catches variations and never suppresses what the tool already surfaces (C2PA data, URLs, etc. stay visible and unflagged).
- Distinct security warning, separate from the steganography verdict — adversarial content manipulates the analyst; steganography hides data. The warning does not alter the threat score.

## v2.5.10 — Legacy — 2026-06-18

**Graded neural indication scale**

### Fixed

- **Per-method interpretation now graded in 5 levels**: None (0%), Minimal (1-19%), Weak (20-40%), Moderate (41-84%), Strong (85-100%). Fixes wording that called a 20% probability "no sign" — only 0% is now "none".

## v2.5.9 — Legacy — 2026-06-18

**UI polish — exclusive accordions + clearer neural interpretation**

### Changed

- **Exclusive accordions**: opening a forensic module or neural method now closes the others, so panels no longer pile up open.
- Neural section footer now keeps the tap hint (left) and processing time (right) on the same line; the 0% interpretation wording was clarified.

### Fixed

- **Accurate high-confidence interpretation**: the per-method explanation no longer claims structural attacks (RS/WS) can corroborate adaptive methods — for LSBM/HILL/etc. it now explains that structural attacks cannot detect them, so the neural model is the reliable detector.

## v2.5.8 — Legacy — 2026-06-18

**Clickable neural bars (per-method interpretation)**

### Added

- **Clickable method bars**: each neural probability bar (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide) now expands on tap to explain what the method is and how to read its probability — turning raw numbers into investigative context.

## v2.5.7 — Legacy — 2026-06-18

**UTF-8 island validation (fixes message detection)**

### Fixed

- **Well-formed UTF-8 validation**: the previous fix accepted any high byte, which made trailing binary garbage merge into the text island and caused some messages to stop being detected. The detector now validates proper UTF-8 sequences, so accented messages extract fully AND messages followed by binary noise are still detected.
- **Trailing noise character trimmed**: a residual character from binary garlanding the message (e.g. "...DO.m") is now removed when it appears right after final punctuation.

## v2.5.6 — Legacy — 2026-06-18

**Message extraction fixes (accents + length byte)**

### Changed

- Captured message buffer raised from 120 to 1000 characters to avoid truncating longer messages.

### Fixed

- **Accented messages no longer truncated**: the text-island detector broke on UTF-8 multibyte characters (á, é, ç, ã...), cutting messages mid-word. It now accepts UTF-8 continuation/lead bytes, so Portuguese/Spanish messages are extracted in full.
- **Stray length byte removed**: tool formats (JOI/STEGO) place a length byte right after the header that leaked as a phantom character at the start of the message (e.g. "QEsta..."). It is now stripped when a known tool header is present.

## v2.5.5 — Legacy — 2026-06-18

**Regression fixes — JOI headers + offline note**

### Fixed

- **Messages with third-party headers shown again**: LSB messages carrying a tool header (e.g. JOI_LSB1/2) were being suppressed as noise because only the native STEGO header was recognized. Any detected tool header now counts as a real message.
- **Offline limitation note no longer shows when Pro is online**: a scope bug made the note appear even with the neural server connected.

## v2.5.4 — Legacy — 2026-06-18

**Offline limitation note**

### Added

- **Offline limitation note**: when Pro mode is unavailable and there is partial suspicion, the tool now notes that offline analysis mainly catches LSB Replacement and structural anomalies, while LSB Matching and adaptive methods such as HILL may go unnoticed until the neural Pro mode is online. No scores are altered — this only communicates the offline detection limits.

## v2.5.3 — Legacy — 2026-06-18

**Verdict flow fixes + note placement**

### Changed

- The "steganography can look synthetic" note moved from the threat score to the **origin section**, and is also shown inside the Origin Probability module.

### Fixed

- **Threat score now reflects neural detection**: the exported/displayed score was being computed before the neural phase finished, leaving real stego (e.g. a real photo with an external tool's message) underscored. The score is now recomputed after neural results arrive.
- **Noise no longer shown as a message offline**: verdict consolidation now runs even without the Pro server, so deep-scan noise is suppressed instead of being displayed as a hidden message.

## v2.5.2 — Legacy — 2026-06-17

**Neural calibration — fewer false positives**

### Changed

- Neural detection now contributes to the threat score only with structural corroboration (RS/WS, header, or readable text), with contained weights to avoid score inflation.

### Fixed

- **Neural false positives reduced**: AI/synthetic images were triggering the spatial models (LSBR/LSBM/HILL) at ~100% even with no hidden message. The neural signal is now distrusted on AI images and requires corroboration to raise the threat score.
- **OutGuess artifact filtered**: the OutGuess model was firing at 100% on plain JPEGs (compression artifact). An isolated OutGuess signal without structural corroboration is now ignored.

## v2.5.1 — Legacy — 2026-06-17

**Honest verdict consolidation + threat recalibration**

### Added

- **Neural detection now feeds the threat score** intelligently: high-confidence neural detection reinforces the score; partial confidence contributes moderately.
- **Interpretive note** when neural and structural (RS/WS) signals disagree — indicating a likely adaptive or LSB-matching method that requires the original key to extract.

### Changed

- **Threat score recalibrated**: signals that indicate synthetic/AI origin (low sensor noise, rare color clusters) no longer inflate the steganography threat score on their own — they only count when corroborated by real stego evidence.

### Fixed

- **No more noise shown as a message**: when neural models detect steganography but sequential extraction only yields noise, the tool now says so honestly instead of displaying the noise as if it were the hidden message.

## v2.5 — Legacy — 2026-06-16

**Neural analysis via Pro backend**

### Added

- **Neural analysis (Pro)**: when the server is available, images are analyzed by 6 EfficientNet B0 models trained on ALASKA2 (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide).
- New **neural results section** below the Threat Score, with a probability bar per method and a consolidated verdict.
- **Live terminal status**: announces Pro mode when the server is online and shows the methods being processed during analysis.

### Changed

- The local analysis remains available when the optional neural server is unavailable; the neural layer is additive and degrades gracefully.

## v2.4 — Legacy — 2026-06-15

**High-capacity RGB encoder + neural detection**

### Added

- **High-capacity (RGB) mode** in the encoder: spreads the message across all 3 color channels, tripling capacity (~3 bits/pixel).
- **Neural embedding heuristic** in the analyzer: flags the GAN-like signature of methods such as SteganoGAN. Shown honestly as a suspicion, not proof.
- Help modal: notes on the RGB mode and on the neural heuristic.

### Changed

- Encoder header now records the mode, so decoding stays automatic and old images still decode.

## v2.3 — Legacy — 2026-06-15

**LSB Matching encoder + structural attacks**

### Added

- **RS and WS structural attacks** were added to estimate traces associated with LSB Replacement and related first-order embedding behaviour.

### Changed

- **The Encoder switched from LSB Replacement to LSB Matching (LSBM).** The change reduces the direct replacement bias targeted by classic first-order LSB tests; it is not presented as a guarantee against steganalysis.

### Fixed

- Translation of “Signing CA” and chrominance detail fragments now localizes correctly.

## v2.22 — Legacy — 2026-06-14

**SEO + public release**

### Added

- **robots.txt** and **sitemap.xml** with bilingual hreflang; Google Search Console verification.

### Changed

- Decoder quick-guide reordered for a clearer flow.

## v2.21 — Legacy — 2026-06-13

**Full bilingual interface (EN/PT)**

### Added

- Complete **EN/PT internationalization** of the whole interface, with live language switching that re-renders results.
- Settings **gear dropdown** holding help and the language switch; help now reachable on mobile.

### Changed

- AI-origin verdict and heuristic notes reorganized and translated.

### Fixed

- Fixed "Undefined" in Origin Probability scores; terminal and accordion glitches on language switch.

## v2.20 — Legacy — 2026-06-12

**Origin Probability classifier (4 categories)**

### Added

- **4-category origin classifier**: Photo, Screenshot, Digital Art, AI — each with its own score and most-likely verdict.
- **Social-media pipeline detector** (WhatsApp, Facebook, Instagram recompression) plus screenshot and digital-art detectors.

### Changed

- Calibrated thresholds against 21 real photos to cut false positives on photography.

## v2.18 — Legacy — 2026-06-11

**Deep LSB text investigator**

### Added

- **Sliding-window investigator** that scans all LSB extraction modes for the longest readable text, working with any encoder.

## v2.15 — Legacy — 2026-06-11

**C2PA module + expanded EXIF**

### Added

- **C2PA / Content Credentials parser**: reads the manifest and identifies 15+ known AI generators and signing authorities.
- **Expanded EXIF**: AI software detection, real-camera identification, GPS and certificate data.

## v2.12 — Legacy — 2026-06-10

**Chrominance, DCT and gradient analysis**

### Added

- **Chrominance (YCbCr)**, **DCT block uniformity** and **gradient** modules to spot synthetic-image traits.

## v2.09 — Legacy — 2026-06-10

**First synthetic-origin scoring**

### Added

- **AI score (0–100)** from generator-typical dimensions, missing camera EXIF, absent sensor noise and uniform regional entropy.

## v2.0 — Legacy — 2026-06-09

**Encoder added → renamed STEGO·STUDIO**

### Added

- **LSB encoder**: hides messages in the blue channel with an optional XOR cipher. The tool becomes read+write and is renamed **STEGO·STUDIO**.
- Two-tab interface: Encoder and Analyzer·Decoder.

## v1.0 — Legacy — 2026-06-08

**STEGO·SCAN — initial prototype**

### Added

- First forensic analyzer with 8 modules (metadata, hidden strings, LSB chi-square, OCR/QR, frequency, entropy, color anomalies) and an AI narrative report.
- Weighted Threat Score and the dark cyberpunk interface.
