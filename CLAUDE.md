# schemgen

A platform-driven format for seat layouts of train wagons and buses (Ukrainian
Railways), plus a browser prototype of the builder and the first native renderer.
Read `docs/wagon-scheme-format.md` before making format changes — it's the actual
spec with rationale, not just notes.

## Orientation, fastest path

1. `README.md` — repo map, quick start.
2. `docs/wagon-scheme-format.md` — the spec. §1.1-1.3 are scope, vehicles and who
   consumes which renderer. §2 Decisions and §6 Guardrails matter most if you're
   touching the format itself. §8-9 are repo layout + roadmap.
   §11 is the honest verification status of `compose-renderer/`, §12 of `vue-renderer/`.
3. `web/index.html` — open directly in a browser, no server needed. Four tabs:
   Catalogue (view/copy), Builder (edit), Preview (cross-framework), Docs (renders
   the spec above).

## Rules that aren't obvious from the code

- **Scope is format + renderers + builder, nothing else.** A renderer takes scheme
  JSON + availability + theme and emits a seat selection. No fetching, booking,
  partner integration or storage in it (D37).
- **The Vue renderer is a file-for-file port of the Compose renderer** (D53):
  `vue-renderer/schemgen-renderer-vue/src/` has the same files, function names, constants,
  comments and public/internal split as `schemgen-renderer-compose`. A change to one
  renderer's model, layout, validation or drawing goes into the other in the same file and
  function, in the same change. Keep the port mechanical (translation table in
  `vue-renderer/README.md`); don't restructure one side on its own.
- **Three renderers, one per UI tech, never mixed** (D31, corrected by D49):
  Compose (Android, iOS and wasm targets — Android sales app, which is legacy
  Views and hosts it in a `ComposeView`; wagon admin; conductor app later), an
  iOS renderer for the UIKit sales app (SwiftUI-with-wrapper vs UIKit is open,
  spec §7 Q9), Web (Vue 3 — bus admin; web sales draws schemes itself for now).
  Don't suggest the iOS app embed the Compose renderer or vice versa.
- **The guidelines file "Wagon components" (Figma) is the source of truth** for
  elements, colours, states and minimum sizes (D50). Sizes there are minimums,
  not presets: every non-seat item resizes, except `separator`, which only grows
  in length. Icons never scale (D51). Readable copy for the Figma MCP (it needs
  edit rights): `YT7hdm4ldCXMNveFQI4Ftu`; the original is `FdfInROVpKQHhPHFFi9MIV`.
- **Each renderer is a separately published library** (D32) consumed by other
  teams. Public API, versioning and packaging matter. The Compose one is
  `compose-renderer/schemgen-renderer-compose` (`ua.gov.uz:schemgen-renderer-compose` on the
  `UZmiv-internal` and `UZmiv-public` Azure feeds, set up like `../uz-compose-ui-kit`; the old
  `UZmiv` feed is readable by the whole organization and being retired, so publish nothing
  new there). `composeApp` next to it is only
  the wasm preview harness. Consumers and the miv-multiplatform hand-off:
  `compose-renderer/INTEGRATION.md`. The Vue one is `@uz/schemgen-renderer-vue` (npm, same
  two feeds), for Vue 3.4+ and Nuxt 4 with SSR; `previewApp` is its harness, `sampleApp` a
  sample consumer app, and `vue-renderer/README.md` covers consumers and publishing.
- **Style lives in the renderer, identical across all three** (D33), from shared
  tokens with `mobile` and `web` presets. **Theme is colors only**, passed in by
  the consumer (D34). Never put colors or sizes in the scheme.
- **The builder stores nothing** (D35, D49). It's a static page that only produces
  JSON, which gets pasted into the admin panels — no admin import API; the admin
  panels are the source of truth.
  Don't add persistence or catalogue features to it — the Catalogue tab is dev
  sample data.
- **Buses use the same format** (D36). Keep the format vehicle-agnostic: bus-only
  elements are new `type` values, train-only fields (`class`, `hull`) must not
  become required. "Wagon" in names is historical.
- **`format.js` is canonical.** `compose-renderer`'s Kotlin layout/validate code is
  a port of it, not an independent implementation, and `vue-renderer` ports the Kotlin. If
  they diverge, `format.js` is right until a golden-fixture test says otherwise (roadmap
  phase 3, not built yet). `vue-renderer/schemgen-renderer-vue/test/formatJs.test.ts` already
  runs `format.js` on every shared fixture and compares the TS port with it.
  Icon art for all three is generated from one set of exports (`web/tools/figma_icons.py`).
- **No aisle field.** Removed from the format entirely — a wagon with space just
  leaves a row unoccupied. Don't reintroduce `aisleAfterRow`.
- **Removed fields stay removed** (D38, D39, D50, D52): `class`, `hull`, `artwork`, seat
  `class`, seat `inclusive`, facility `label`, `deck.id`, `chair`; `half_table` is now
  `small_table`. There are no inclusive seats: the outlined seat is `kind: "folding"`,
  and accessibility is only the `handicapped` / `handicapped_wheelchair` items.
  `span.cols` came back for non-seat items (D48, reversing D41) — seats and `separator`
  stay one column wide. Decks are named by optional `level`
  (`lower`/`upper`), required and unique when a scheme has several decks. No doors
  on any vehicle (D40). Buses: top-level `vehicle: "bus"` (absent = train, D42) and
  the `driver` item (D43; one cell is its minimum since D51).
- **Renderers take `mode` (`view` | `select`), `available`, `selected` and an
  `onSeatClick` callback** (D45). The app owns the selection — a renderer only reports
  taps and never mutates `selected` (D46). `seatState()` in `format.js` is the rule;
  Kotlin and TS mirror it in `layout/SeatState.kt` / `layout/SeatState.ts`.
- **`docs/developer-guide.md` is the field reference.** Any format change updates
  it alongside the spec, `format.js`, the Kotlin and TS models and the fixtures.
- **Every non-seat item uses one field, `type`** (`toilet`, `table`, `small_table`,
  `separator`, ...) — not per-kind boolean flags. This was a real inconsistency
  that got fixed once; don't reintroduce `table: true` style shapes.
- **Facility names come from the Android sales app** (D47): its drawable names
  minus `ic_`/class prefix/size suffix (`toilet`, `baggage`, `bike`, `shield`, …); the list
  and the art come from the guidelines file (D50). The old names (`wc`, `luggage`,
  `bicycle`, `electrical`, `inclusive_marker`, …) are gone — no aliases.
- **Seat numbers are opaque strings.** No numbering convention exists — never
  derive logic (sorting, berth inference, validation) from a seat number.
- **`compose-renderer/` builds and runs** (verified 2026-10-05, spec §11). The run
  task is `wasmJsBrowserDevelopmentRun` — `wasmJsBrowserRun` no longer exists. Tests:
  `:schemgen-renderer-compose:wasmJsBrowserTest` (and `iosSimulatorArm64Test`). Configuring
  needs an Android SDK (`local.properties`, untracked). For headless screenshots, Chrome needs
  `--use-angle=swiftshader --enable-unsafe-swiftshader`, and host pages must be served
  over http, not `file://`.
- **`vue-renderer/` builds and runs** (verified 2026-11-25, spec §12). From `vue-renderer/`:
  `npm install`, `npm test` (typecheck + Vitest), `npm run dev` (harness on
  `localhost:5173`, which the Preview tab's "Vue 3 (Web)" loads), `npm run build`. Imports in
  `src/` carry `.js` extensions (NodeNext), so the built ESM loads in Node and Nuxt's server.

## Before changing web/js/*.js

`icons.js`, `schemes.js`'s `AUTO` array, and `docs.js` are generated — see
`web/tools/README.md`. Don't hand-edit the generated sections; edit the source
(Figma exports / `docs/wagon-scheme-format.md`) and regenerate.

After any change to `web/`, prefer verifying in a real browser (Playwright is
available) over trusting a code read — this repo has already shipped a bug
(a duplicated inline `<script>` running the whole app twice) that looked fine
on inspection and only showed up under an actual click-through test.

## Style

Terse, direct commit messages. No AI attribution in commits or comments beyond
what's already there. Match the existing prose style in `docs/` if you're adding
to it — reasoning documented, not just conclusions.
