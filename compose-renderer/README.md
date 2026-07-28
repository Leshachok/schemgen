# compose-renderer

Compose Multiplatform module for schemgen. Web (`wasmJs`) target only for now —
Android and iOS targets are commented scaffolding in `composeApp/build.gradle.kts`,
meant to be uncommented in roadmap phase 3 (see `docs/wagon-scheme-format.md` §9).

## ⚠️ Verification status

**This module has never been compiled.** It was written in a sandboxed environment
with no network access, so nothing here has been built, run, or tested beyond
static review against current (July 2026) Compose Multiplatform documentation.
Before trusting any of it:

```
./gradlew wasmJsBrowserRun
```

...and fix whatever the compiler finds. Likely trouble spots, roughly in order of
how much I'd bet on them:

1. **`@JsFun` postMessage interop** in `composeApp/src/wasmJsMain/kotlin/schemgen/main.kt`.
   The pattern (`@JsFun("(cb) => {...}")` importing a JS closure as a Kotlin
   callback) is current as of research done while writing this, but the exact
   signature Kotlin/Wasm expects has shifted across versions before and I have no
   way to confirm it compiles as written.
2. **Gradle/plugin versions** in `gradle/libs.versions.toml` — Kotlin 2.4.10,
   Compose Multiplatform 1.11.1 were current when checked, but by the time you
   read this they may not be the latest, and Compose Multiplatform pins to a
   specific Kotlin baseline that's worth double-checking.
3. **Compose Multiplatform Material3 + Canvas API surface** used in
   `SchemeCanvas.kt` — `drawRoundRect`, `CornerRadius`, `Stroke` etc. are stable
   APIs I'm confident about, but I can't rule out a signature drift.

## What's deliberately out of scope for v1

The renderer (`composeApp/src/commonMain/kotlin/schemgen/render/SchemeCanvas.kt`)
draws seat/facility/table/half-table/separator blocks with the right color roles,
but does **not** yet port:

- the seat-back bracket (facing indicator)
- the berth bar (upper/lower indicator)
- real facility icons (currently every facility renders as a plain block)

These are real visual features in `web/js/render.js` — porting them now, before
the layout math itself is fixture-verified against the JS reference, would mean
debugging two things at once. Phase 4 in the roadmap picks this back up.

## Module map

```
composeApp/src/
  commonMain/kotlin/schemgen/
    model/Scheme.kt        data classes mirroring the JSON format 1:1
    model/SchemeParser.kt  hand-written parser (the format isn't a clean tagged
                            union, so this mirrors web/js/format.js's own
                            duck-typed dispatch rather than fighting
                            kotlinx.serialization's polymorphism)
    layout/Layout.kt       layout math, ported line-for-line from format.js
    layout/Validate.kt     structural validation, same rules as format.js
    render/SchemeCanvas.kt the Composable renderer
  wasmJsMain/kotlin/schemgen/main.kt   web entry point + postMessage listener
  wasmJsMain/resources/index.html      HTML shell for the wasmJs build
  commonTest/kotlin/schemgen/          fixture-based parser/validator tests
                                        (also never run - see above)
```

## Keeping this in sync with the JS reference

`layout/Layout.kt` and `layout/Validate.kt` are ports, not independent
implementations — if `web/js/format.js` changes, these should change with it.
There's no automated check for that yet (roadmap phase 2, golden fixture
parity); until then it's a manual discipline.
