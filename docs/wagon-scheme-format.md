# Wagon scheme format — design notes

**Status:** draft, in discussion
**Owner:** Oleksii, Mobile (UZ)
**Last updated:** 2026-07-27

---

## 1. Purpose

Replace hand-maintained per-platform seat-map assets (≈400–500 files on Android alone, plus
separate iOS and web sets) with a single data format describing a wagon, rendered natively
on each platform.

Targets:

- New wagon type ships without an app release or store review
- One source of truth, so iOS / Android / Web cannot drift
- Schemes authored in a no-code builder by designers, not coded by engineers
- Large reduction in app bundle size

Out of scope: replacing the engineer's floor plan. The facility keeps producing the real
drawing; the builder converts it into the clickable picker.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Format is data, not a drawing | The picker is a semantic seat map. Fidelity to the engineering drawing is explicitly a non-goal. |
| D2 | JSON, not a bespoke text DSL | A custom DSL means three hand-written parsers — three sources of divergence, which is the problem being solved. |
| D3 | Row + column grid | Confirmed by measurement, §3. |
| D4 | Layout and runtime state are separate payloads | Layout is static per wagon type; availability changes per train, per second. |
| D5 | Published revisions are immutable | A sold ticket references a seat in a specific revision. |
| D6 | Unknown item types render as inert placeholders | This is what actually removes the app-release dependency. |
| D7 | Three thin native renderers, guarded by shared golden fixtures | Cheaper than shipping CMP/Skia to iOS and Wasm to web. |
| D8 | **No `side` seat kind** | Platskart side seats are drawn identically to all others; only position differs. `byAisle` becomes a seat property. |
| D9 | **Doors are not modelled** | Not drawn on schemes. |
| D10 | **Seat numbers are opaque strings** | No conventions exist. Numbering can start anywhere. **No logic may depend on a seat number.** |
| D11 | **No compartment grouping in the format** | A compartment has a number the user never sees. Nothing in the picker needs it. |
| D12 | **No seat-count validation** | Wagons of the same class differ by a couple of elements; a count rule would produce false failures. |
| D13 | **Gender / children wagons are out of scope** | They filter *wagon selection*. The scheme is unaffected. |
| D14 | **Deck is a list of columns** (Option A) | Position is the array index. Inserting a bay needs no renumbering, and two items cannot occupy one cell. |
| D15 | ~~Separator is a column type~~ **superseded by D23** | |
| D16 | **Aisle is a deck field, not an item** | It spans the whole wagon on the row axis. As an item it would be repeated in every column. |
| D17 | **Wheelchair marker is a facility** | Same element class as WC or table. Keep it simple. |
| D18 | **Every scheme has an aisle, including a trailing one** | Купе runs the corridor along the bottom; плацкарт puts it between the bay of 4 and the pair. `aisleAfterRow` may name the last row. |
| D19 | **Separators are drawn per row band, never across the aisle** | A separator is one line segment per contiguous group of rows. |
| D20 | **Škoda is two schemes, not one scheme with two decks** | Confirmed from the real layout. |
| D21 | ~~A separator is `sepAfter: true` on a column~~ **superseded by D23** | |
| D22 | **Columns have no `type` at all** | A column is `{ items }`. An empty column *is* the gap. |
| D23 | **Separator is a positioned item, exactly like a table** | Not a column-level flag. Carries its own `row` + `span`, so it can be placed on any subset of rows in any column — a bay-only divider that stops before the aisle, not an entity forced to span whatever the column happens to contain. |
| D24 | **Aisle is not a format concept at all — `aisleAfterRow` is removed** | Space is simply a row nothing is placed on. No field, no spacing constant, no special case in layout. A wagon that wants a corridor just leaves a row's items empty across every column. |
| D27 | **Builder items are draggable within the canvas, not just from the palette** | Dropping onto an occupied cell is a no-op — this is deliberately a *move*, not a swap, to avoid silent data loss from an imprecise drop. |
| D28 | **Non-seat items (facility, table, separator) get a drag handle to resize their row span** | Seats don't get one — `luxury`'s span is fixed by definition and other seat kinds don't span rows, so a resize handle on a seat would have nothing meaningful to do. |
| D29 | **Half-table is its own item, not a small `table`** | Fixed size (never resizable — no resize handle, no row-span field), and it takes a `facing: top \| bottom` instead of a span, since its whole identity is which half of the row it occupies. |
| D30 | **Every non-seat item uses one field, `type`, instead of a mix of named fields and boolean flags** | `facility: "wc"`, `table: true`, `separator: true`, `halfTable: true` was inconsistent — an accidental artifact of adding item kinds one at a time, not a deliberate distinction. `wc`, `table`, `half_table`, `separator` are now all just values of `type`. This also gives table/separator/half-table the same unknown-value fallback facilities already had — a typo in `type` renders as an inert placeholder instead of silently doing nothing. |
| D25 | **`byAisle` removed** | Redundant with row position relative to `aisleAfterRow` — a seat's row already says whether it's in the aisle pair. |
| D26 | **`tags` / `seatTags` removed entirely** | No behaviour depended on it; dropped rather than carried as unused surface area. |

### Rejected

- **Compose Multiplatform for rendering.** ~10–20 MB of Skia + Kotlin runtime added to the
  iOS binary for a seat grid, plus a UIKit bridging seam for touch, scroll and
  accessibility. On web, canvas-based Wasm output does not fit an HTML frontend and is
  invisible to screen readers.
- **Absolute pixel coordinates in the format.** The design files contain up to 6px of
  hand-placement drift that carries no information.

---

## 3. Evidence from the current catalogue

Measured against two Figma SVG exports (`Wagons.svg`, 35 MB; `uz_web__master_.svg`, 81 MB).

### Alignment — grid model confirmed

Grouping seats into bands within each wagon card (tolerance 6px):

| Axis | Bands | Perfectly aligned (spread 0.00px) | Worst spread |
|---|---|---|---|
| Row (y) | 567 | 564 — **99.47%** | 4px |
| Column (x) | 2325 | 2182 — **93.85%** | 6px |

Worst misalignment in the whole catalogue is a quarter of a seat width.

### Seat geometry

Two scales are present (`25×25` and `32×32`) — a design-system difference, not a layout
difference. The renderer owns pixel size; the format does not encode it.

| Observed block | Count | Reading |
|---|---|---|
| `25×25` navy filled | 7982 | standard seat |
| `27×25` navy + `23×2` bar | 952 pairs | berth level: bar above = upper, below = lower, absent = middle |
| `32×32` navy filled | 713 | same seat, other design scale |
| `27×66` navy | 170 | seat spanning **exactly 2 rows** (66 = 2×25 + 16) → люкс berth |
| `24×24` / `30×30` white fill, navy stroke | 73 | **inclusive seat** — outlined instead of filled |
| `25×25` grey `#D4D5D6` | 10 | unavailable — runtime state, not layout |

### How attributes are drawn

| Attribute | Rendering |
|---|---|
| `berth` | Bar **above** = upper, bar **below** = lower, **nothing drawn** = middle. |
| `facing` (sit) | A half-open rounded bracket drawn around the seat at 50% opacity, on the side the back is against. Reference asset: 37×41 artboard, 32×32 seat inset at (4.5, 4.5); rotate 0/90/180/270 for left/top/right/bottom. |
| `inclusive` | Seat drawn as outline (white fill, navy border) instead of solid. Accompanied by a wheelchair marker item nearby. |
| `luxury` | No indicator — the seat is simply 2 rows tall. |
| `byAisle` | No indicator — position below the aisle is the only cue. |
| `facing` | Seat-back bracket around the seat. **Deferred**, see §4.2. |

### Facilities — two visual families

| Family | Fill / border | Widths | Heights | Reading |
|---|---|---|---|---|
| Partition | `#F7F6F8` + `#D4D5D6` border, rx 3.5 | 23, 38 | 11, 28, 31, 65, 88, 102 | tables, partitions between bays |
| Block | `#F7F6F8`, no border, rx 4 | 40, 56, 61 | 66, 101, 103, 104 | WC, luggage, stairs, vestibule |

Plus 2284 hairline rules (1–2px) used as visual separators. These are **not** items — they
are how the renderer draws a boundary between column groups.

### Interior heights

Vertical hairlines cluster at heights that map to row counts: `66` = 2 rows (2×25 + 16),
`78` = 2 rows with a wider aisle, `103` = 3 rows (3×25 + 2×14), plus `112`–`169` for taller
stock. Row count per deck comes from a small set.

---

## 4. Item taxonomy

Two axes that must not be conflated:

- **Type / attribute** — intrinsic to the wagon. Lives in the layout file. Changes only when
  the wagon is rebuilt.
- **Runtime state** — per train, per date, per user. Comes from the availability API. Never
  in the layout file.

`sitting` / `sleeping` / `luxury` are *types*. `occupied` / `selected` are *states*. Keeping
them apart is what lets the layout file be cached forever.

### 4.1 Wagon classes (domain reference)

| Class | Compartment | Berth levels | Typical capacity |
|---|---|---|---|
| **Купе** | 4 places | 2 lower + 2 upper | 32–36 |
| **Плацкарт** | 4 places + 2 across the aisle | bay: 2 lower + 2 upper; aisle pair: 1 lower + 1 upper | 54 |
| **Люкс (СВ)** | 2 places | — | 18 |
| **RIC купе** | 3 places | lower + **middle** + upper | — |
| **1 / 2 клас (сидячий)** | — | — | varies |

Reference only — **none of this is enforced** (D12). Capacities vary and wagons of the same
class routinely differ by a few elements. RIC is the reason `middle` exists in the enum.

Any wagon class may contain inclusive seats: an inclusive compartment in sleeping stock
(commonly numbered 33–34), or its seated analogue.

### 4.2 Seat

| Field | Values | Notes |
|---|---|---|
| `number` | **opaque string** | No conventions. May start at any value. **Nothing may be derived from it** (D10). |
| `kind` | `sit` \| `sleep` \| `luxury` | Closed enum, three values. |
| `berth` | `lower` \| `middle` \| `upper` | Required when `kind = sleep`. **Always write explicitly** — see below. |
| `inclusive` | bool, default `false` | Renders as an outlined seat. |
| `facing` | `left` \| `right` \| `top` \| `bottom` | Only when `kind = sit`. **Deferred** — backend cannot supply it yet. |
| `span` | `{rows, cols}`, default `{1,1}` | `luxury` observed at `{2,1}`. |
| `class` | fare class id | Only when it varies *within* one wagon (Škoda double-decker does). |


**Never let absence encode a value.** The picker draws nothing for a middle berth, but the
JSON must still say `"berth": "middle"`. If middle is an absent field, then a middle berth,
an unfinished scheme, and a writer predating berth support all look identical, and no
validator can separate them. Render absence; store presence.

**Keep `facing` in the schema despite the deferral.** Adding an optional field to a live
format is free; retrofitting one into 400 immutable published revisions is not. Populate it
when the backend can.

**`byAisle` was removed (D25).** It duplicated information already carried by the seat's
`row` relative to `aisleAfterRow` — a side place is identifiable purely by position, so a
separate flag added a second, potentially-inconsistent source of truth for the same fact.

### 4.3 Facility (non-selectable)

Confirmed list, with assets supplied. Not final — more may appear.

| Type | Size behaviour |
|---|---|
| `wc` | 2 rows × 1 column |
| `wc_accessible` | inclusive toilet |
| `table` | 1, 2 or 3 rows |
| `luggage` | variable height |
| `bicycle` | same sizing as luggage |
| `kid` | variable height |
| `inclusive` | placed in a compartment containing inclusive seats |
| `inclusive_marker` | standalone wheelchair marker |
| `electrical` | electricity warning |
| `stairs_up` / `stairs_down` | Škoda only |

| Field | Values |
|---|---|
| `type` | one of the above, or unknown → inert placeholder |
| `span` | `{rows, cols}` — required, these vary a lot (§3) |
| `label` | optional short text override |

### 4.4 Structural

A deck is an ordered list of **columns**. Every column is exactly one of:

A column is `{ items: [...] }` and nothing else. An empty `items` array is a gap — there is
no separate gap marker. There is no `aisleAfterRow` field, no aisle spacing constant in the
renderer, no special case anywhere in layout.

| Concept | How it is expressed |
|---|---|
| content column | `items`, each with its own `row` and optional `span` |
| gap (horizontal space) | a column with `items: []` |
| corridor / aisle (vertical space) | **not a field.** A row that no column places an item on. Every row uses the same pitch; an "aisle" row is just a row that happens to be empty. |
| separator | `{ type: "separator", row, span }` — placed exactly like a table, in whichever column and row range it needs. Rendered as a thin line, positioned with full control: it can cover only a bay, stop short of open space, or run the full deck. |
| table | `{ type: "table", row, span }` — resizable, full row height by default. |
| half-table | `{ type: "half_table", row, facing: "top" \| "bottom" }` — fixed at half the row's height, occupying only the top or bottom half. Not resizable; carries no `span`. |

Every non-seat item — facility or structural — shares this one shape: `type` names what it
is, everything else is that type's own fields. A seat is the only item with a second
identity field (`seat`, the number), because a seat is the only item that is both typed
*and* individually identified.

This removes the last deck-level field that wasn't a plain count. `rows` is now the only
thing a deck says about itself besides its columns.

The **aisle is not a column and not an item** — it is `aisleAfterRow` on the deck, because
it runs on the row axis and spans the full length of the wagon. Separators run on the column
axis and span the full height. Different axes, different mechanisms.

`table` and `partition` are content items inside a column, not column types.

### 4.5 Deck / wagon level

| Field | Values | Notes |
|---|---|---|
| `key` | e.g. `П19` | Existing wagon-type key. |
| `rev` | int | Immutable once published. |
| `class` | `kupe` \| `platskart` \| `lux` \| `ric` \| `seated` | **Informational only.** Drives no behaviour (D12). Useful for browsing in the builder. |
| `rows` | int | Per deck. |
| `aisleAfterRow` | int[] | Where row groups break. |
| `decks` | array | Double-deckers have 2. |
| `hull` | `plain` \| `nose_left` \| `nose_right` | Covers the observed head-car taper. |
| `artwork` | optional URL | Decorative SVG behind the grid. Escape hatch only, see §6. |

Not present, deliberately: compartment numbers (D11), gender/children flags (D13), seat
counts (D12), doors (D9).

### 4.6 Runtime state — availability payload, NOT layout

`available`, `occupied`, `held`, `selected`, `unavailable`, plus price and fare class per
seat. The grey `#D4D5D6` seats in the design files belong here.

Today the API returns the list of bookable seats; those render blue and clickable, everything
else renders grey and disabled. Layout never changes — only state.

**Reconciliation rule.** Schemes currently ship inside the app, so scheme and availability
are always in lockstep. Once schemes are fetched and cached independently they can drift:

- seat in the scheme, missing from the availability response → render **disabled**
- seat in the availability response, missing from the scheme → **ignore**, log

Never crash, never render a seat with no known state. A wagon reconfigured on the backend
before its new scheme revision is published then degrades to "some seats unbookable" rather
than a broken screen.

---

## 5. Draft JSON

```json
{
  "key": "П19",
  "rev": 3,
  "class": "platskart",
  "hull": "plain",
  "decks": [
    {
      "id": "main",
      "rows": 5,
      "aisleAfterRow": [2],
      "columns": [
        { "items": [ {"seat": "5",  "kind": "sleep", "berth": "upper", "row": 1},
                     {"seat": "6",  "kind": "sleep", "berth": "lower", "row": 2},
                     {"seat": "37", "kind": "sleep", "berth": "upper", "row": 5} ] },
        { "items": [ {"seat": "7",  "kind": "sleep", "berth": "upper", "row": 1},
                     {"seat": "8",  "kind": "sleep", "berth": "lower", "row": 2},
                     {"separator": true, "row": 3, "span": {"rows": 3}} ] },
        { "items": [ {"facility": "wc", "row": 1, "span": {"rows": 5}} ] }
      ]
    }
  ]
}
```

Open structural question: columns-with-items (above) versus a flat item list with explicit
`{row, col}`. Columns are compact and encode ordering naturally; a flat list is simpler to
generate from a Figma import. Prototype both against three real wagons before choosing (Q3).

---

## 6. Guardrails

- **Never store pixel values.** Row pitch, gap widths and seat size are platform constants.
  The 6px of drift in the design files is noise, not data.
- **Never derive anything from a seat number.** No ordering, no berth level, no side
  detection, no validation (D10).
- **`artwork` is an escape hatch, not a path.** The moment decorative SVG becomes the normal
  way to draw a wagon, we are back to maintaining assets per wagon type.
- **Unknown enum value = inert grey placeholder, never a crash.** Write this into the
  conformance suite as a test, not just into the spec.
- **Runtime state never enters the layout file.** If a field changes between two trains of
  the same wagon type, it does not belong here.
- **Crop facility icons to their content box before scaling.** The supplied assets sit on
  large mostly-empty artboards (a 23×25 glyph on a 56×104 board). Scaling the artboard to
  fit a block leaves the icon roughly a third of the size it should be.

### Validation the builder should still do

Seat-count rules are out (D12), but these are structural, touch no seat number, and catch
real authoring mistakes:

- duplicate seat number within a deck
- two items occupying the same grid cell
- an item whose `span` runs off the edge of the deck
- a seat in `seatTags` that does not exist in any deck
- `berth` missing on a `kind: sleep` seat, or present on any other kind

---

## 7. Open questions

1. **Two supplied icons are unlabelled** in the export (`Group_31`, `Group_34`). Read as
   `bicycle` and `inclusive` in the prototype — needs confirming, they may be swapped.
2. **No assets yet** for `kid`, `stairs_up`, `stairs_down` — drawn as stand-ins.
3. **Is the facility list final?** Marked "close to complete but not final".

### Settled

| Question | Answer |
|---|---|
| Is direction drawn? | Yes — seat-back bracket. Deferred anyway (backend). |
| What is the `23×2` bar? | Berth level. |
| Does `luxury` have variants? | No — just large, 2 rows. |
| Does `side` need a berth? | Yes, and `side` is not a kind at all → `byAisle` flag (D8). |
| Seat numbers — strings? | Yes, opaque. No conventions exist (D10). |
| Compartment as a grouping? | No (D11). |
| Gender-restricted wagons? | Wagon-selection filter only (D13). |
| Which wagons skip the picker? | None — all in-app wagons have a clickable scheme. |
| Doors? | Not drawn, not modelled (D9). |
| Which bar position = which berth? | **Above = upper**, below = lower, nothing = middle. |
| Seat-count validation? | Not wanted (D12). |
| Which bar position = which berth? | Above = upper (already listed). |
| Columns vs flat item list? | Columns (D14). |
| Does availability change layout? | No — seat state only. Reconciliation rule in §4.6. |
| Wheelchair marker? | A facility, like WC (D17). |
| Separators between bays? | A column type (D15). |
| Aisle? | A deck field, not an item (D16). Every scheme has one (D18). |
| Do separators cross the aisle? | No — one segment per row band (D19). |
| Škoda: one scheme or two? | Two (D20). |

---

## 8. Repository layout

The project lives at `/dev/schemgen` (this doc's copy: `docs/wagon-scheme-format.md`).

```
schemgen/
  docs/                     this file — the format spec, decisions, and roadmap
  web/                      reference implementation: browser renderer + catalogue + builder
    index.html              entry point — Catalogue / Builder / Preview / Docs tabs
    css/app.css
    js/
      format.js             canonical vocabulary + layout math + validator — every other
                             renderer must agree with this file
      icons.js               generated icon assets + seat-back geometry
      schemes.js              hand-written reference schemes + auto-converted catalogue
      docs.js                 generated — embedded copy of this doc for the Docs tab
      render.js                SVG rendering
      app.js                    UI wiring: catalogue, builder, export, framework preview
    tools/                  regeneration scripts (see web/tools/README.md)
  compose-renderer/         Compose Multiplatform module — Kotlin Multiplatform + Compose,
                             wasmJs target first (see compose-renderer/README.md)
  shared-fixtures/          scheme JSON used to check every renderer agrees with format.js
  android/                  placeholder — future Compose Multiplatform Android target
  ios/                      placeholder — future SwiftUI or Compose Multiplatform iOS target
```

Each renderer subfolder is a sibling of `web/`, not nested inside it — `web/` is the
reference implementation and UI shell, not the parent project.

## 9. Expansion roadmap

Ordered by dependency, not by calendar. Each phase should end with something a
non-engineer can look at — a running preview, a report, a comparison — not just code.

1. **Compose Multiplatform Web (current)** — shared Kotlin model, parser, layout math,
   and validator, ported line-for-line from `format.js`. Renderer is intentionally
   reduced scope for v1 (no seat-back bracket, no berth bars, no real icons — see
   `compose-renderer/composeApp/src/commonMain/kotlin/schemgen/render/SchemeCanvas.kt`).
   Exit criteria: `./gradlew wasmJsBrowserRun` actually compiles and renders a scheme sent
   from the web app's Preview tab. This has not been verified yet — see §11.

2. **Golden fixture parity** — extend `/shared-fixtures` with expected output per seat
   (`{seat: row, col, span, hit-box}`), and write a test in each renderer that checks its
   own layout against that expectation, not just against the JSON parsing cleanly. This
   is what turns "looks about right" into "provably agrees." Do this before adding more
   platforms, not after — a divergence is cheap to fix with two renderers and expensive
   with four.

3. **Compose Multiplatform Android** — reuse the same `commonMain` model/layout/renderer;
   add real touch/tap handling, accessibility semantics (seat number, state, tags spoken
   by TalkBack), and the availability reconciliation rule from §4.6.

4. **Seat-back bracket, berth bars, real icons in Compose** — port the remaining visual
   fidelity from `render.js` once the layout is fixture-verified. Deferred out of phase 1
   deliberately, so early feedback is about structure, not pixel-matching.

5. **iOS** — decide Compose Multiplatform iOS vs. native SwiftUI once phase 3 has real
   numbers on binary size and touch/accessibility feel (the CMP-for-iOS overhead concern
   from the first discussion — Skia + Kotlin runtime on a device — either turns out to be
   fine in practice or it doesn't; phase 3 on Android is the cheapest way to learn the
   Compose Multiplatform ergonomics before betting iOS on it too).

6. **Production web renderer** — replace `web/js/render.js`'s prototype rendering with
   whatever the real frontend stack is (React/TS or otherwise), sharing `format.js`'s
   logic (or a straight port of it) and the same fixtures.

7. **Figma importer, productionized** — `web/tools/extract_schemes.py` proves the
   geometry-clustering approach works on the real catalogue; turn it into a proper
   importer against the Figma REST API (keeps layer names, so seat numbers and kinds
   come through correctly instead of being auto-numbered placeholders) and wire its
   output into the builder as "review this auto-generated scheme" rather than a
   separate offline step.

8. **CI fixture gate** — once phase 2 exists, run it in CI on every PR to every
   renderer. A renderer disagreeing with the fixtures should fail the build, not get
   caught by someone eyeballing a screenshot.

## 10. Prototype status

A working single-file prototype exists (`wagon-prototype.html`): renderer, catalogue of
sample schemes, live JSON editing, structural validator, and a drag-and-drop visual builder.

**Twelve of the sample schemes were auto-converted from the real Figma catalogue export**
by a script that clusters seat/block rects into rows and columns and emits scheme JSON.
That is the migration path from step 5 below, proven on real data: 133 of the ~135 wagon
cards in `uz_web__master_.svg` converted without manual work, covering seat counts from 12
to 70+. Seat *numbers* are sequential rather than real, because the SVG export outlines all
text — recovering the real numbers needs the Figma REST API, which keeps layer names.

Known gap: two supplied icons (`Group_31`, `Group_34`) arrived unlabelled and are read as
`bicycle` and `inclusive`; `kid`, `stairs_up` and `stairs_down` are stand-ins pending assets.

## 11. Compose renderer verification status

`compose-renderer/` is real, complete-as-written Kotlin source — but it has never been
compiled. The environment that wrote it had no network access to fetch Kotlin/Gradle/
Compose dependencies, so nothing in that module has been built, run, or tested beyond
static review. Specifically unverified:

- Whether the Gradle configuration (Kotlin 2.4.10, Compose Multiplatform 1.11.1,
  `wasmJs { browser { ... } }`) is complete and correct as written.
- The `@JsFun` postMessage interop in `main.kt` — the general pattern is current as of
  research done while writing it, but has not been exercised against a real build.
- Whether `commonTest` actually runs and passes on any target.

Before relying on this module for anything: run `./gradlew wasmJsBrowserRun` inside
`compose-renderer/` and fix whatever the compiler finds. Treat everything in that
directory as a strong first draft, not working code.

## 12. Next steps

1. Pull one wagon per class through the Figma REST API (`GET /v1/files/{key}/nodes`) to
   recover layer names — the SVG export outlines all text, so component names are
   unrecoverable from it. Answers Q2.
2. Hand-write JSON for four representative wagons: купе, плацкарт (with aisle seats), люкс,
   and a seated Intercity car with an inclusive block. If the format survives all four, it
   will survive most.
3. Build the **web renderer first** — the builder reuses it for live preview.
4. Extract the golden fixture suite from those four: scheme JSON → expected
   `{seat → row, col, span}` plus tap-resolution cases. Language-neutral, run in all three
   platform test suites.
5. Write the bulk importer: Figma API → candidate scheme JSON for the whole catalogue. Turns
   "draw 400 schemes" into "review 400 auto-generated schemes".
6. Compose and SwiftUI renderers against the fixtures.
7. Rollout behind a flag: render new format alongside old assets, diff screenshots, migrate
   by wagon family.
