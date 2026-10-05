# schemgen

A platform-driven format for describing seat layouts of train wagons and buses,
plus a browser prototype (builder, sample catalogue, cross-framework preview) and
the first native renderer (Compose Multiplatform, web target).

The problem this solves: hundreds of wagon types, each currently hand-drawn as
per-platform assets (Android alone had 400-500 files). A new wagon type means a
new app build and a store review on every platform. The fix is a small JSON
format any platform can render natively, authored through a no-code builder
instead of by hand. Buses use the same format, for the combined bus + train
ticket. Read `docs/wagon-scheme-format.md` for the full design history,
decisions, and rationale — this README is just a map of the repo.

## Renderers and consumers

Three renderers, each published as its own library for other teams' apps:

| Renderer | Consumers |
|---|---|
| Compose Multiplatform (Android, iOS, wasm) | Android sales app, conductor app, wagon admin |
| SwiftUI | iOS sales app |
| Web (TS core + Vue component) | web sales, bus admin |

Only the Compose one exists so far. The builder is a separate, stateless tool:
it exports scheme JSON to the admin panels, which store and publish schemes.
See spec §1.3 and §9.

## Layout

```
web/                the reference implementation - open web/index.html directly,
                     no server or build step needed
compose-renderer/    Compose Multiplatform module, wasmJs target - NOT YET
                     COMPILED, see compose-renderer/README.md
docs/                the format spec + decision log + roadmap
shared-fixtures/     real scheme JSON, used to check every renderer agrees
```

## Quick start

```
open web/index.html      # catalogue, builder, framework preview, docs - all in the browser
```

For the Compose Multiplatform preview specifically:

```
cd compose-renderer
./gradlew wasmJsBrowserRun    # starts a dev server, usually http://localhost:8080
```

Then in the web app's **Preview** tab, select "Compose Multiplatform (Web)", Load
that URL, and hit "Send current scheme" from whatever wagon you're looking at in
Catalogue or Builder.

## Status

The web prototype is functional and has been exercised in a real browser
(headless Chromium) after every change — see `docs/wagon-scheme-format.md` §10
for what's been verified and how.

The Compose module is real, complete Kotlin source but **has never been
compiled** — it was written without network access to the Kotlin/Gradle/Compose
toolchain. Treat it as a strong first draft. See
`compose-renderer/README.md` and `docs/wagon-scheme-format.md` §11 before
relying on it.

## Regenerating generated files

Three files under `web/js/` are generated, not hand-edited:

| File | Regenerate with | From |
|---|---|---|
| `icons.js` | `web/tools/extract_icons.py` | facility SVG exports from Figma |
| `schemes.js`'s `AUTO` array | `web/tools/extract_schemes.py` | a full Figma catalogue SVG export |
| `docs.js` | `web/tools/embed_docs.py` | `docs/wagon-scheme-format.md` |

See `web/tools/README.md` for exact usage of each.
