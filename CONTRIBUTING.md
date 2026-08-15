# Contributing

## Language

The project is transitioning to English for anything a reader outside the
project will encounter.

**English:** `README.md`, this file, `SECURITY.md`, commit messages, and the
in-app interface (both English and Portuguese are shipped; English is the
reference).

**Still Portuguese:** `docs/STEGO_STUDIO_CHANGELOG.md`, `LEIA-ME.md`,
`docs/MEDICAO_REDES_SOCIAIS.md`, and source comments. The changelog alone runs
past two thousand lines of detailed engineering notes; translating it in bulk
would risk losing the reasoning that makes it worth keeping. It is being
converted gradually, newest entries first.

Source comments will stay in Portuguese for now. They explain *why* a decision
was made — often citing a specific bug that motivated it — and that reasoning is
worth more intact in the author's language than flattened into a second one.

## Building

```sh
node unpack_assets.js   # recreates src/fonts/ from ASSETS_BASE64.md
node build.js           # assembles dist/stego_studio_v<VERSION>.html
node test.js            # 18 invariants — must be green before any commit
```

## Version bumps touch exactly five places

1. `build.js` — `const VERSION`
2. `src/main.js` — the `_tool` string
3. `template.html` — the version in the header logo (**not** injected by the build)
4. `src/ui.js` — a new entry at the top of the `CHANGELOG` array
5. `docs/STEGO_STUDIO_CHANGELOG.md`

`test.js` verifies the first four from the built HTML. The fifth is manual.

## What the invariants do and do not prove

The 18 invariants check that a build is internally consistent: syntax, i18n key
parity, literal injection of every source block, the offline guarantee, and that
data taken from an analysed file cannot become markup.

Four of them exercise behaviour directly: the legacy golden-fixture check, the
real threat logic, the Threat/Protocol agreement check, and the F1 layered check.
The F1 check now does two different jobs on purpose: compact bytes taken from a
real v2.29.0 image prove historical format compatibility, while a deterministic
64×64 image is encoded with both layers, serialized to PNG, reopened and decoded
to cover the carrier path (`opaquePixels`, tail anchoring and PNG I/O). It also
executes the same pure evidence resolver used by production code and a hostile
robust-JPEG vector where the confirmed outer envelope and the inner AES password
deliberately diverge.

This is still **partial behavioural coverage**, not a complete security suite. It
does not cover the full matrix of encoder modes, a malformed-input corpus, or
browser-only behaviour. Several recent defects were found by manual smoke testing
rather than by a red build. A green run means *this build is consistent with the
properties these checks cover*, not *this software is correct*. Treat it that way.


## Regression discipline

Recent 2.42.x regressions repeatedly came from a correct local refactor changing a
value that had **other readers elsewhere**. Before replacing, centralising or
reinterpreting a shared field/state, enumerate every consumer first: renderer,
Threat scoring, exported JSON, accessibility/help text, reset/cleanup paths and
third-party fallbacks. A source of truth is only truly single when all dependent
surfaces have been accounted for.

Regression checks should protect the **property**, not the exact mutation that was
last observed. Prefer table-driven behavioural checks and file/handler-wide ratchets
over narrow text windows. If a mutation demonstrates a green false negative, improve
the model of the property rather than adding only a regex for that spelling.

