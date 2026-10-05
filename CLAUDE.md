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
   §11 is the honest verification status of `compose-renderer/`.
3. `web/index.html` — open directly in a browser, no server needed. Four tabs:
   Catalogue (view/copy), Builder (edit), Preview (cross-framework), Docs (renders
   the spec above).

## Rules that aren't obvious from the code

- **Scope is format + renderers + builder, nothing else.** A renderer takes scheme
  JSON + availability + theme and emits a seat selection. No fetching, booking,
  partner integration or storage in it (D37).
- **Three renderers, one per UI tech, never mixed** (D31): Compose (Android,
  iOS and wasm targets — Android sales app, conductor app, wagon admin), SwiftUI
  (iOS sales app), Web (Vue/Nuxt — web sales, bus admin). Don't suggest the
  SwiftUI app embed the Compose renderer or vice versa.
- **Each renderer is a separately published library** (D32) consumed by other
  teams. Public API, versioning and packaging matter; `compose-renderer/` is
  currently a preview app, not yet that library.
- **Style lives in the renderer, identical across all three** (D33), from shared
  tokens with `mobile` and `web` presets. **Theme is colors only**, passed in by
  the consumer (D34). Never put colors or sizes in the scheme.
- **The builder stores nothing** (D35). It's a separate tool on its own domain
  that exports JSON (file or admin API); the admin panels are the source of truth.
  Don't add persistence or catalogue features to it — the Catalogue tab is dev
  sample data.
- **Buses use the same format** (D36). Keep the format vehicle-agnostic: bus-only
  elements are new `type` values, train-only fields (`class`, `hull`) must not
  become required. "Wagon" in names is historical.
- **`format.js` is canonical.** `compose-renderer`'s Kotlin layout/validate code is
  a port of it, not an independent implementation. If they diverge, `format.js` is
  right until a golden-fixture test says otherwise (roadmap phase 2, not built yet).
- **No aisle field.** Removed from the format entirely — a wagon with space just
  leaves a row unoccupied. Don't reintroduce `aisleAfterRow`.
- **Removed fields stay removed** (D38, D39): `class`, `hull`, `artwork`, seat
  `class`, facility `label`, `deck.id`. Decks are named by optional `level`
  (`lower`/`upper`), required and unique when a scheme has several decks. No doors
  on any vehicle (D40).
- **`docs/developer-guide.md` is the field reference.** Any format change updates
  it alongside the spec, `format.js`, the Kotlin model and the fixtures.
- **Every non-seat item uses one field, `type`** (`wc`, `table`, `half_table`,
  `separator`, ...) — not per-kind boolean flags. This was a real inconsistency
  that got fixed once; don't reintroduce `table: true` style shapes.
- **Seat numbers are opaque strings.** No numbering convention exists — never
  derive logic (sorting, berth inference, validation) from a seat number.
- **`compose-renderer/` builds and runs** (verified 2026-10-05, spec §11). The run
  task is `wasmJsBrowserDevelopmentRun` — `wasmJsBrowserRun` no longer exists. Tests:
  `composeApp:wasmJsBrowserTest`. For headless screenshots, Chrome needs
  `--use-angle=swiftshader --enable-unsafe-swiftshader`, and host pages must be served
  over http, not `file://`.

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
