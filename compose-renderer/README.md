# compose-renderer

Compose Multiplatform module for schemgen. Web (`wasmJs`) target only for now —
Android and iOS targets are commented scaffolding in `composeApp/build.gradle.kts`,
meant to be enabled in roadmap phase 5 (see `docs/wagon-scheme-format.md` §9).

## Verification status

Builds, tests pass, and renders schemes sent by postMessage — verified 2026-10-05,
details in `docs/wagon-scheme-format.md` §11.

```
./gradlew wasmJsBrowserDevelopmentRun          # dev server, http://localhost:8080
./gradlew composeApp:wasmJsBrowserTest         # commonTest in headless Chrome
```

(`wasmJsBrowserRun`, the name used in older notes, no longer exists in current
Kotlin.)

Seat-back bracket, berth bars and real facility icons are implemented. Not yet
verified: pixel parity with `web/js/render.js`, which needs the golden fixture
suite (roadmap phase 2).

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
