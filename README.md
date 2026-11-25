# schemgen

A platform-driven format for describing seat layouts of train wagons and buses,
plus a browser prototype (builder, sample catalogue, cross-framework preview) and
two native renderers: Compose Multiplatform, and Vue 3, which ports it file for file.

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
| Compose Multiplatform (Android, iOS, wasm) | Android sales app (legacy Views, via `ComposeView`), wagon admin; conductor app later |
| iOS (SwiftUI with a UIKit wrapper, or UIKit — open) | iOS sales app (UIKit) |
| Web (Vue 3, plus a framework-free `/core`) | bus admin; web sales later (it draws schemes itself for now) |

The Compose and Vue ones exist; the iOS one doesn't yet. The Vue renderer is a file-for-file
port of the Compose one (D53), so a change to either has an obvious place in the other. The builder is a separate static page that
stores nothing: it produces scheme JSON, which is pasted into the admin panels
that store and publish schemes. Elements, colours, states and minimum sizes come
from the design team's guidelines file "Wagon components". See spec §1.3, D49-D52
and §9.

## Layout

```
web/                the reference implementation - open web/index.html directly,
                     no server or build step needed
compose-renderer/    Compose Multiplatform renderer: the published library
                     (ua.gov.uz:schemgen-renderer-compose - Android, iOS, wasm) plus a
                     wasm preview harness, see compose-renderer/README.md
vue-renderer/        Vue 3 renderer: the published library (@uz/schemgen-renderer-vue,
                     Vue 3.4+ and Nuxt 4) plus a Vite preview harness, see
                     vue-renderer/README.md
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
./gradlew :composeApp:wasmJsBrowserDevelopmentRun    # dev server on http://localhost:8080
```

For the Vue one:

```
cd vue-renderer
npm install && npm run dev    # dev server on http://localhost:5173
```

Then in the Builder's **Live preview**, pick "Compose Multiplatform (Web)" or "Vue 3 (Web)".
The current scheme is sent to that preview on every edit.

## Status

The web prototype is functional and has been exercised in a real browser
(headless Chromium) after every change — see `docs/wagon-scheme-format.md` §10
for what's been verified and how.

The Compose module builds, its tests pass, and it renders schemes sent from a
host page (verified 2026-10-05, see `docs/wagon-scheme-format.md` §11). Not yet
checked: pixel parity with the web reference, and the Android/iOS targets, which
aren't configured yet.

The Vue module builds and its tests pass, among them one that runs `format.js` itself and
compares every item box, validation message and seat state on all shared fixtures. In the
browser it matches the web reference on five fixtures, side by side (verified 2026-11-25,
see `docs/wagon-scheme-format.md` §12). 0.1.0 is published to the `UZmiv-internal` npm feed.

## Building and CI

`build.md` covers what CI builds (static web app + Compose wasm preview + Vue preview), the
commands, and how the three are assembled into one deployable site.

## Regenerating generated files

Three files under `web/js/` are generated, not hand-edited:

| File | Regenerate with | From |
|---|---|---|
| `icons.js`'s `ICONS` block (and `Icons.kt`'s, `Icons.ts`'s) | `web/tools/figma_icons.py` | SVG exports from the guidelines file "Wagon components" |
| `schemes.js`'s `AUTO` array | `web/tools/extract_schemes.py` | a full Figma catalogue SVG export |
| `docs.js` | `web/tools/embed_docs.py` | `docs/wagon-scheme-format.md` |

See `web/tools/README.md` for exact usage of each.
