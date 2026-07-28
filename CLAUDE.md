# schemgen

A platform-driven format for train wagon seat layouts (Ukrainian Railways), plus
a browser prototype and the first native renderer. Read `docs/wagon-scheme-format.md`
before making format changes — it's the actual spec with rationale, not just notes.

## Orientation, fastest path

1. `README.md` — repo map, quick start.
2. `docs/wagon-scheme-format.md` — the spec. §2 Decisions and §6 Guardrails matter
   most if you're touching the format itself. §8-9 are repo layout + roadmap.
   §11 is the honest verification status of `compose-renderer/`.
3. `web/index.html` — open directly in a browser, no server needed. Four tabs:
   Catalogue (view/copy), Builder (edit), Preview (cross-framework), Docs (renders
   the spec above).

## Rules that aren't obvious from the code

- **`format.js` is canonical.** `compose-renderer`'s Kotlin layout/validate code is
  a port of it, not an independent implementation. If they diverge, `format.js` is
  right until a golden-fixture test says otherwise (roadmap phase 2, not built yet).
- **No aisle field.** Removed from the format entirely — a wagon with space just
  leaves a row unoccupied. Don't reintroduce `aisleAfterRow`.
- **Every non-seat item uses one field, `type`** (`wc`, `table`, `half_table`,
  `separator`, ...) — not per-kind boolean flags. This was a real inconsistency
  that got fixed once; don't reintroduce `table: true` style shapes.
- **Seat numbers are opaque strings.** No numbering convention exists — never
  derive logic (sorting, berth inference, validation) from a seat number.
- **`compose-renderer/` has never been compiled.** Written without network access
  to the Kotlin/Gradle toolchain. Treat it as a strong draft, not working code,
  until someone runs `./gradlew wasmJsBrowserRun` and reports back.

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
