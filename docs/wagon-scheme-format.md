# Seat scheme format — design notes

**Status:** draft, in discussion
**Owner:** Oleksii, Mobile (UZ)
**Last updated:** 2026-10-05
**Covers:** train wagons and buses (D36). Most of this document was written when the
format was train-only, so it says "wagon" throughout; read it as "vehicle" unless a section
is explicitly train-specific.

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

### 1.1 Scope of this project

This project is the **format**, the **renderers** that draw it on each platform, and the
**builder** that produces it. Nothing else (D37). Availability, booking and partner
integration live in external systems with their own APIs; scheme storage and publishing live
in the admin panels. A renderer takes a scheme plus an availability payload plus a theme, and
emits a seat selection — it never fetches, books or stores anything.

### 1.2 Vehicles

Trains and, since the combined bus + train ticket, **buses** (D36). UZ runs its own bus
fleet and also sells seats on partner/carrier buses, but every bus scheme is authored on
UZ's side, exactly like a wagon scheme. Partners only supply the free-seat list and receive
the selected seats on purchase — which is the same shape as the train availability flow
(§4.6). For this project a bus is just another scheme.

### 1.3 Consumers and renderers

Schemes are shown in several products, built by different teams in different stacks. There
is **one renderer per UI technology**, and technologies are never mixed — the SwiftUI app
does not embed the Compose renderer (D31).

| Consumer | Stack | Renderer | Shows |
|---|---|---|---|
| Ticket-selling app, iOS | native SwiftUI | **SwiftUI** | trains, buses |
| Ticket-selling app, Android | native Android, Compose hosted via `ComposeView` (or the fragment rewritten in Compose) | **Compose** (Android target) | trains, buses |
| Conductor app | Compose Multiplatform, Android + iOS | **Compose** (Android + iOS targets) | trains |
| Wagon admin panel | Compose Multiplatform, wasm | **Compose** (wasmJs target) | trains — scheme + preview per wagon type |
| Bus admin panel | Vue / Nuxt | **Web** | buses — scheme + preview per bus |
| Ticket-selling website | Vue / Nuxt | **Web** | trains, buses |

The admin panels are the **source of truth** for schemes: each already lists its vehicle
types, and each type gets its scheme and a live preview there. The builder is a separate,
stateless authoring tool that hands a scheme to an admin (D35).

```
Builder (own domain, stores nothing) ──JSON file / admin API──▶ Wagon admin (Compose wasm)
                                                               Bus admin   (Vue/Nuxt)
                                                                   │ publish immutable revisions (D5)
                                                                   ▼
                       Sales iOS (SwiftUI) · Sales Android (Compose) · Conductor (Compose) · Web sales (Web)
```

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
| D7 | Three thin native renderers, guarded by shared golden fixtures | Cheaper than shipping CMP/Skia to iOS and Wasm to web. Made concrete by D31. |
| D8 | **No `side` seat kind** | Platskart side seats are drawn identically to all others; only position differs. `byAisle` becomes a seat property. |
| D9 | **Doors are not modelled** | Not drawn on schemes. |
| D10 | **Seat numbers are opaque strings** | No conventions exist. Numbering can start anywhere. **No logic may depend on a seat number.** |
| D11 | **No compartment grouping in the format** | A compartment has a number the user never sees. Nothing in the picker needs it. |
| D12 | **No seat-count validation** | Wagons of the same class differ by a couple of elements; a count rule would produce false failures. |
| D13 | **Gender / children wagons are out of scope** | They filter *wagon selection*. The scheme is unaffected. |
| D14 | **Deck is a list of columns** (Option A) | Position is the array index. Inserting a bay needs no renumbering, and two items cannot occupy one cell. |
| D15 | ~~Separator is a column type~~ **superseded by D23** | |
| D16 | ~~Aisle is a deck field, not an item~~ **superseded by D24** | |
| D17 | **Wheelchair marker is a facility** | Same element class as WC or table. Keep it simple. |
| D18 | ~~Every scheme has an aisle, including a trailing one~~ **superseded by D24** | The observation still holds — купе runs the corridor along the bottom, плацкарт between the bay of 4 and the pair — it is just expressed as an empty row now. |
| D19 | ~~Separators are drawn per row band, never across the aisle~~ **superseded by D23** | A positioned separator covers exactly the rows it is given. |
| D20 | **Škoda is two schemes, not one scheme with two decks** | Confirmed from the real layout. |
| D21 | ~~A separator is `sepAfter: true` on a column~~ **superseded by D23** | |
| D22 | **Columns have no `type` at all** | A column is `{ items }`. An empty column *is* the gap. |
| D23 | **Separator is a positioned item, exactly like a table** | Not a column-level flag. Carries its own `row` + `span`, so it can be placed on any subset of rows in any column — a bay-only divider that stops before the aisle, not an entity forced to span whatever the column happens to contain. |
| D24 | **Aisle is not a format concept at all — `aisleAfterRow` is removed** | Space is simply a row nothing is placed on. No field, no spacing constant, no special case in layout. A wagon that wants a corridor just leaves a row's items empty across every column. |
| D27 | **Builder items are draggable within the canvas, not just from the palette** | Dropping onto an occupied cell is a no-op — this is deliberately a *move*, not a swap, to avoid silent data loss from an imprecise drop. |
| D28 | **Non-seat items (facility, table, separator) get a drag handle to resize their row span** | Seats don't get one — `luxury`'s span is fixed by definition and other seat kinds don't span rows, so a resize handle on a seat would have nothing meaningful to do. |
| D29 | **Half-table is its own item, not a small `table`** | Fixed size (never resizable — no resize handle, no row-span field), and it takes a `facing: top \| bottom` instead of a span, since its whole identity is which half of the row it occupies. |
| D30 | **Every non-seat item uses one field, `type`, instead of a mix of named fields and boolean flags** | `facility: "wc"`, `table: true`, `separator: true`, `halfTable: true` was inconsistent — an accidental artifact of adding item kinds one at a time, not a deliberate distinction. `wc`, `table`, `half_table`, `separator` are now all just values of `type`. This also gives table/separator/half-table the same unknown-value fallback facilities already had — a typo in `type` renders as an inert placeholder instead of silently doing nothing. |
| D25 | **`byAisle` removed** | Redundant with row position — a seat's row already says whether it's in the aisle pair. (Written when the aisle was `aisleAfterRow`; D24 makes it an empty row, the reasoning is unchanged.) |
| D26 | **`tags` / `seatTags` removed entirely** | No behaviour depended on it; dropped rather than carried as unused surface area. |
| D31 | **Three renderers, one per UI technology, never mixed: Compose, SwiftUI, Web** | Each consumer (§1.3) uses the renderer native to its own stack. Compose Multiplatform is used *because its consumers are already Compose apps* — the conductor app and wagon admin are CMP, and every Android app uses Compose — not as a cross-platform shortcut. The iOS sales app is SwiftUI and gets a SwiftUI renderer; the Vue sites get a web renderer. This settles the old "CMP vs SwiftUI for iOS" roadmap question: both exist, for different consumers. |
| D32 | **Every renderer is a separately published library** | The renderers are consumed by other teams in their own apps, on their own release schedules. So each needs a stable public API, its own semver and changelog, and platform-native packaging (Maven for Compose, SPM for SwiftUI, npm for web). A renderer that only works inside this repo has not shipped. |
| D33 | **The renderer owns the look; the look is identical across renderers** | Colors, sizes, strokes and icon treatment are never in the scheme (consistent with §6, no pixel values). But three teams hand-copying a style guide will drift exactly the way per-platform assets drifted, so the style is defined once, as shared design tokens, and generated into each renderer. Web differs from mobile — at least in sizes — so tokens come as a `mobile` and a `web` preset. |
| D34 | **Theme = colors only, passed in by the consumer** | Each consumer app has its own theming (light/dark, brand), so the renderer takes a theme argument (e.g. a parameter on the composable) with the shared tokens as the default. Only colors are themeable for now; sizes come from the preset, not the theme. Widening this later is additive; narrowing it after consumers depend on it is not. |
| D35 | **The builder is a separate, stateless authoring tool** | Hosted on its own domain. It configures a scheme and exports it — as a JSON file or through an API into an admin panel. It stores no schemes and is not a catalogue: the admin panels are the source of truth (§1.3). Editing an existing scheme means loading its JSON in, not looking it up. |
| D36 | **Buses use the same format** | A bus is rows and columns of seats with an empty row for the aisle, optional facilities, sometimes two decks — everything the format already expresses. Bus availability has the same shape as train availability (§1.2). A second format would mean a second set of three renderers. Train-specific fields must therefore become optional, and bus-only elements are new `type` values, not a new structure — see §4.7. |
| D37 | **This project is the format, the renderers and the builder — nothing else** | Availability, booking, partner integration and scheme storage all live elsewhere (§1.1). Keeping the renderer's input/output this narrow is what lets five consumer apps embed it without inheriting anyone's backend. |

### Rejected

- **Compose Multiplatform as the one renderer for every product.** ~10–20 MB of Skia +
  Kotlin runtime added to the iOS sales binary for a seat grid, plus a UIKit bridging seam
  for touch, scroll and accessibility. On web, canvas-based Wasm output does not fit an HTML
  frontend and is invisible to screen readers. Still rejected for the SwiftUI and Vue
  consumers. Compose *is* used where the consumer is already a Compose app (D31) — there
  none of these costs apply.
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
| aisle-side seat | No indicator — position relative to the empty aisle row is the only cue (D25). |
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
`row` relative to the empty aisle row — a side place is identifiable purely by position, so a
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

The **aisle is not a column, not an item and not a field** (D24) — it is a row nothing is
placed on. `table`, `half_table` and `separator` are content items inside a column, not
column types.

### 4.5 Deck / wagon level

| Field | Values | Notes |
|---|---|---|
| `key` | e.g. `П19` | Existing wagon-type key. Bus key space is open, §7. |
| `rev` | int | Immutable once published. |
| `class` | `kupe` \| `platskart` \| `lux` \| `ric` \| `seated` | **Informational only.** Drives no behaviour (D12). Train-specific — optional for buses, §4.7. |
| `rows` | int | Per deck. |
| `decks` | array | Double-deckers have 2. |
| `hull` | `plain` \| `nose_left` \| `nose_right` | Covers the observed head-car taper. Train-specific, §4.7. |
| `artwork` | optional URL | Decorative SVG behind the grid. Escape hatch only, see §6. |

Not present, deliberately: compartment numbers (D11), gender/children flags (D13), seat
counts (D12), doors (D9), aisle position (D24).

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

The same payload shape and the same rule apply to buses, whether the free-seat list comes
from UZ's own fleet or from a partner's system — mapping partner data into this shape is
the consuming app's job, not the renderer's (D37).

### 4.7 Buses

What carries over unchanged: the grid, empty-row aisles, `decks` (double-deck coaches),
`stairs_up` / `stairs_down`, `sit` and `sleep` seats (sleeper coaches), `wc`, `table`,
`luggage`, availability and reconciliation. A typical 2+2 coach is two seat columns, an empty
row, two more seat columns.

What is train-specific and must not be required for a bus:

- `class` — the enum is wagon classes. Either omitted for buses or widened; it is
  informational either way.
- `hull` — `nose_left` / `nose_right` describe a locomotive-end taper. A bus has a distinct
  front and rear; whether that needs a hull value or is purely the renderer's business is
  open.
- `key` — wagon-type keys. Buses need their own key space, or a top-level discriminator
  (e.g. `vehicle: "train" | "bus"`) so a key cannot be read in the wrong namespace.

Likely bus-only items, as new `type` values (D30): `driver`, and probably `door` /
`entrance` — for buses these orient the passenger in a way they do not in a wagon, so D9
may not carry over. Thanks to D6, adding them later is safe: older renderers draw an inert
placeholder.

None of this is decided yet — see §7. Validate against two or three real bus layouts before
choosing, the same way the grid model was validated against the wagon catalogue (§3).

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
      "columns": [
        { "items": [ {"seat": "5",  "kind": "sleep", "berth": "upper", "row": 1},
                     {"seat": "6",  "kind": "sleep", "berth": "lower", "row": 2},
                     {"seat": "37", "kind": "sleep", "berth": "upper", "row": 5} ] },
        { "items": [ {"seat": "7",  "kind": "sleep", "berth": "upper", "row": 1},
                     {"seat": "8",  "kind": "sleep", "berth": "lower", "row": 2},
                     {"type": "separator", "row": 4, "span": {"rows": 2}} ] },
        { "items": [ {"type": "wc", "row": 1, "span": {"rows": 5}} ] }
      ]
    }
  ]
}
```

Row 3 is the aisle: nothing is placed on it (D24). Columns-with-items versus a flat item
list was settled in favour of columns (D14).

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
- `berth` missing on a `kind: sleep` seat, or present on any other kind

---

## 7. Open questions

1. **Two supplied icons are unlabelled** in the export (`Group_31`, `Group_34`). Read as
   `bicycle` and `inclusive` in the prototype — needs confirming, they may be swapped.
2. **No assets yet** for `kid`, `stairs_up`, `stairs_down` — drawn as stand-ins.
3. **Is the facility list final?** Marked "close to complete but not final".
4. **Web vs mobile layout behaviour.** Sizes differ (D33). Whether layout behaviour also
   differs — scroll direction, rotating the vehicle on narrow screens — is undecided.
5. **Bus top level.** Separate key space vs a `vehicle` discriminator; what `class` and
   `hull` mean for a bus (§4.7).
6. **Bus-only items.** Are the driver and doors drawn on bus schemes? Needs real bus
   layouts.
7. **Two admins, one builder.** The builder pushes to the wagon admin (Compose) and the bus
   admin (Vue/Nuxt). One shared import API, or one per admin? Owned by the admin teams.
8. **Naming.** "Wagon scheme" is baked into the spec title, file names and code. Rename to
   something vehicle-neutral, and when — the generated files and the Pages deploy depend
   on current paths.

### Settled

| Question | Answer |
|---|---|
| Is direction drawn? | Yes — seat-back bracket. Deferred anyway (backend). |
| What is the `23×2` bar? | Berth level. |
| Does `luxury` have variants? | No — just large, 2 rows. |
| Does `side` need a berth? | Yes, and `side` is not a kind at all (D8). `byAisle` was later removed too — position says it (D25). |
| Seat numbers — strings? | Yes, opaque. No conventions exist (D10). |
| Compartment as a grouping? | No (D11). |
| Gender-restricted wagons? | Wagon-selection filter only (D13). |
| Which wagons skip the picker? | None — all in-app wagons have a clickable scheme. |
| Doors? | Not drawn, not modelled (D9). |
| Which bar position = which berth? | **Above = upper**, below = lower, nothing = middle. |
| Seat-count validation? | Not wanted (D12). |
| Columns vs flat item list? | Columns (D14). |
| Does availability change layout? | No — seat state only. Reconciliation rule in §4.6. |
| Wheelchair marker? | A facility, like WC (D17). |
| Separators between bays? | A positioned item, like a table (D23). |
| Aisle? | Not a format concept — an empty row (D24). |
| Škoda: one scheme or two? | Two (D20). |
| iOS: Compose Multiplatform or SwiftUI? | Both, for different consumers — SwiftUI for the iOS sales app, Compose for the CMP conductor app (D31). |
| How do renderers ship? | As separately published libraries (D32). |
| What can a theme change? | Colors only, for now (D34). |
| Does the builder store schemes? | No — admins are the source of truth (D35). |
| Buses: own format? | No, same format (D36). Bus schemes are authored on UZ's side even for partner buses. |
| Which apps show buses? | Sales iOS, sales Android, web sales; authored into the bus admin. |

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
```

Not yet created: the SwiftUI renderer, the production web renderer, and the shared style
tokens (§9). Each renderer subfolder is a sibling of `web/`, not nested inside it — `web/`
is the reference implementation and UI shell, not the parent project.

`compose-renderer/` today is a wasm **preview app** driven by `postMessage` from the web
Preview tab, not a library anyone can depend on. Under D32 it becomes the published Compose
library, with the preview app kept as a thin harness on top of it.

`web/` is a prototype of the builder (D35) plus dev tooling. Its Catalogue tab and the
bundled `AUTO` schemes are sample data for exercising renderers, not a product feature —
the product catalogue is the admin panels.

## 9. Expansion roadmap

Ordered by dependency, not by calendar. Each phase should end with something a
non-engineer can look at — a running preview, a report, a comparison — not just code.
Rewritten 2026-10-05 for D31–D37; the previous version assumed one Compose renderer
growing platform by platform, an undecided iOS stack, and train-only schemes.

1. **Compose Multiplatform Web compiles — done 2026-10-05.** Shared Kotlin model, parser,
   layout math and validator, ported line-for-line from `format.js`. Builds, tests pass,
   and a scheme sent by postMessage renders — see §11.

2. **Golden fixture parity** — extend `/shared-fixtures` with expected output per seat
   (`{seat: row, col, span, hit-box}`), and a test in each renderer checking its own
   layout against that, not just that the JSON parses. With three renderers owned by
   different teams' consumers, the fixtures *are* the contract a release is judged by
   (D32). Do this before the second renderer exists, not after.

3. **Vehicle-agnostic format + bus items** — resolve §7 questions 5–6 against two or three
   real bus layouts; make train-only fields optional; add bus `type` values; add bus
   fixtures. Before the SwiftUI and web renderers start, so they are born bus-aware.

4. **Shared style tokens** — one token source (colors, sizes, strokes, icon sizes) with a
   `mobile` and a `web` preset, generated into Kotlin, Swift and TS (D33). Define the theme
   shape: colors only, defaulting to the tokens (D34). Fixtures check layout; tokens are
   what keeps appearance identical.

5. **Compose renderer as a published library** — split `compose-renderer/` into a library
   module plus the preview harness; add `androidTarget()` and iOS targets next to
   `wasmJs`; public API along the lines of
   `SeatScheme(scheme, availability, theme, onSeatClick)`; touch handling, accessibility
   semantics (seat number and state spoken by TalkBack / VoiceOver) and the reconciliation
   rule from §4.6; publish to Maven. Consumers: Android sales app (via `ComposeView`),
   conductor app (Android + iOS), wagon admin (wasm).

6. **Visual fidelity in Compose** — seat-back bracket, berth bars and real icons are
   already ported from `render.js` (§11); what's left is checking them against the web
   reference once layout is fixture-verified, and fixing whatever differs.

7. **SwiftUI renderer** — for the iOS sales app. Port of `format.js` logic, same fixtures,
   same tokens, same theme shape; published as a Swift package.

8. **Web renderer** — for web sales and the bus admin, both Vue/Nuxt. A framework-free TS
   core (port of `format.js`: parse, validate, layout) plus a Vue 3 component on top,
   rendering SVG so it is Nuxt-SSR-safe and screen-reader visible; published to npm. The
   builder's own preview should move onto the same core.

9. **Builder as a standalone product** (D35) — own domain; JSON file export and import;
   push to the admin APIs once their contract exists (§7 Q7); Preview tab showing all
   three renderers so a designer can check a scheme everywhere before exporting.

10. **Figma importer, productionized** — `web/tools/extract_schemes.py` proves the
    geometry-clustering approach on the real catalogue; turn it into an importer against
    the Figma REST API (keeps layer names, so seat numbers and kinds come through) feeding
    the builder as "review this auto-generated scheme".

11. **CI fixture gate** — run phase 2's suite in CI on every PR to every renderer. A
    renderer disagreeing with the fixtures fails the build, rather than being caught by
    someone eyeballing a screenshot.

## 10. Prototype status

A working prototype exists (`web/index.html`, no build step): renderer, catalogue of sample
schemes, live JSON editing, structural validator, and a drag-and-drop visual builder.

**Twelve of the sample schemes were auto-converted from the real Figma catalogue export**
by a script that clusters seat/block rects into rows and columns and emits scheme JSON.
That is the importer path (§9 phase 10), proven on real data: 133 of the ~135 wagon
cards in `uz_web__master_.svg` converted without manual work, covering seat counts from 12
to 70+. Seat *numbers* are sequential rather than real, because the SVG export outlines all
text — recovering the real numbers needs the Figma REST API, which keeps layer names.

Known gap: two supplied icons (`Group_31`, `Group_34`) arrived unlabelled and are read as
`bicycle` and `inclusive`; `kid`, `stairs_up` and `stairs_down` are stand-ins pending assets.

## 11. Compose renderer verification status

**Verified 2026-10-05** (Kotlin 2.4.10, Compose Multiplatform 1.11.1, Gradle 9.6.1,
JDK 26, macOS):

- `./gradlew wasmJsBrowserDevelopmentExecutableDistribution` builds cleanly.
- `./gradlew composeApp:wasmJsBrowserTest` runs the `commonTest` suite in headless Chrome:
  3/3 pass (kupe and platskart parse with no structural errors; the broken fixture still
  reports its errors).
- `./gradlew wasmJsBrowserDevelopmentRun` serves the preview on `localhost:8080`. Standalone
  it draws the inlined kupe sample; a `schemgen:scheme` postMessage from a parent page
  replaces it — checked by sending `shared-fixtures/platskart.json` from a host page, which
  rendered all 54 seats, berth bars, separators and facility icons.

Gotchas found on the way:

- **The documented `wasmJsBrowserRun` no longer exists.** Current Kotlin splits it into
  `wasmJsBrowserDevelopmentRun` and `wasmJsBrowserProductionRun`; the bare name fails as
  ambiguous.
- **Headless Chrome needs software WebGL** (`--use-angle=swiftshader
  --enable-unsafe-swiftshader`) or the Skia canvas draws nothing. And a host page opened
  from `file://` gets a blank cross-origin iframe in headless mode — serve it over http.
  Both are test-harness issues, not renderer bugs.
- `gradle.properties` sets `kotlin.native.cacheKind`, which Kotlin now reports as removed.
  Harmless today; drop it when iOS targets are added.

Still unverified: pixel parity with `web/js/render.js` (no fixture comparison exists —
phase 2), and anything on Android or iOS targets, which aren't configured yet.

The seat-back bracket, berth bars and real facility icons, previously listed as deferred
(§9 phase 6), are already implemented in `SchemeCanvas.kt` / `Icons.kt`. What remains of
phase 6 is confirming they match the web reference.

## 12. Next steps

Immediate actions, in order. The longer view is §9.

1. ~~Run the Compose build and record the outcome in §11~~ — done 2026-10-05.
2. Pull one wagon per class through the Figma REST API (`GET /v1/files/{key}/nodes`) to
   recover layer names, and collect two or three real bus layouts. Together they feed the
   fixture suite and the bus format questions (§7 Q5–6).
3. Build the golden fixture suite: scheme JSON → expected `{seat → row, col, span}` plus
   tap-resolution cases, covering купе, плацкарт, люкс, a seated car with an inclusive
   block, and at least one bus.
4. Draft the style token file and theme shape, and agree them with the consuming teams
   before any renderer depends on them.
5. Sketch each renderer's public API and get sign-off from its consumer teams — once
   published (D32), changing it costs every consumer a migration.
