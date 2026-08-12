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
node test.js            # 12 invariants — must be green before any commit
```

## Version bumps touch exactly five places

1. `build.js` — `const VERSION`
2. `src/main.js` — the `_tool` string
3. `template.html` — the version in the header logo (**not** injected by the build)
4. `src/ui.js` — a new entry at the top of the `CHANGELOG` array
5. `docs/STEGO_STUDIO_CHANGELOG.md`

`test.js` verifies the first four from the built HTML. The fifth is manual.

## What the invariants do and do not prove

The 12 invariants check that a build is internally consistent: syntax, i18n key
parity, literal injection of every source block, the offline guarantee, and that
data taken from an analysed file cannot become markup.

They do **not** exercise behaviour. There is no encode/decode round-trip, no
malformed-input corpus, no comparison against reference tools. A green run means
*this build is consistent*, not *this software is correct*. Treat it that way.
