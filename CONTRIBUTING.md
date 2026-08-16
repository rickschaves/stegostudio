# Contributing

Thanks for your interest in STEGO·STUDIO.

The project is intentionally small and dependency-light: the published application is a
single offline HTML file assembled from the sources in this repository.

## Public language

English is the target language for public repository documentation. The application
itself remains bilingual (English and Portuguese).

## Build and test

```sh
node unpack_assets.js   # restores binary assets and verifies their SHA-256 hashes
node build.js           # builds dist/stego_studio_v<VERSION>.html
node test.js            # runs the project regression checks
```

No package install or bundler is required. A green test run means the change is
consistent with the properties these checks cover; it is not a general proof of
correctness or security.

## Before proposing a change

- Keep the application fully client-side and offline at runtime.
- Do not add network calls, remote fonts, analytics, telemetry or external runtime assets.
- Treat image-derived data as hostile input and keep it out of HTML markup unless it is
  explicitly escaped for that context.
- Preserve documented compatibility and avoid turning heuristic evidence into certainty.
- Run the build and test commands above and include a concise description of what changed
  and why.
- If a change affects a public report field, update the public schema and its regression
  coverage.


## Source comments

Comments in public source are documentation for readers and contributors. Keep them when
they explain non-obvious logic, security/privacy invariants, compatibility constraints,
file-format details or maintenance traps that the code alone does not make clear.

Do not use source comments as a development diary. Personal information, health details,
private review/release history and attribution of who discovered a bug do not belong in
public code. `node test.js` includes a hygiene gate for these classes, but human review is
still expected for whether a comment is actually useful.

## Security-sensitive changes

Changes to cryptography, payload formats, password derivation, parser boundaries or
plausible-deniability behaviour deserve especially focused review. Please describe the
intended invariant, not only the code change.

For current security limits and the threat model, see [SECURITY.md](SECURITY.md).
For decoder coverage, see [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).
