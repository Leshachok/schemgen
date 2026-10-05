/* Generated from docs/wagon-scheme-format.md and docs/developer-guide.md -
   regenerate with `python3 web/tools/embed_docs.py` after editing either file. */
"use strict";

var DOCS_MARKDOWN = `# Seat scheme format — design notes

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
| Ticket-selling app, Android | native Android, Compose hosted via \`ComposeView\` (or the fragment rewritten in Compose) | **Compose** (Android target) | trains, buses |
| Conductor app | Compose Multiplatform, Android + iOS | **Compose** (Android + iOS targets) | trains |
| Wagon admin panel | Compose Multiplatform, wasm | **Compose** (wasmJs target) | trains — scheme + preview per wagon type |
| Bus admin panel | Vue / Nuxt | **Web** | buses — scheme + preview per bus |
| Ticket-selling website | Vue / Nuxt | **Web** | trains, buses |

The admin panels are the **source of truth** for schemes: each already lists its vehicle
types, and each type gets its scheme and a live preview there. The builder is a separate,
stateless authoring tool that hands a scheme to an admin (D35).

\`\`\`
Builder (own domain, stores nothing) ──JSON file / admin API──▶ Wagon admin (Compose wasm)
                                                               Bus admin   (Vue/Nuxt)
                                                                   │ publish immutable revisions (D5)
                                                                   ▼
                       Sales iOS (SwiftUI) · Sales Android (Compose) · Conductor (Compose) · Web sales (Web)
\`\`\`

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
| D8 | **No \`side\` seat kind** | Platskart side seats are drawn identically to all others; only position differs. \`byAisle\` becomes a seat property. |
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
| D21 | ~~A separator is \`sepAfter: true\` on a column~~ **superseded by D23** | |
| D22 | **Columns have no \`type\` at all** | A column is \`{ items }\`. An empty column *is* the gap. |
| D23 | **Separator is a positioned item, exactly like a table** | Not a column-level flag. Carries its own \`row\` + \`span\`, so it can be placed on any subset of rows in any column — a bay-only divider that stops before the aisle, not an entity forced to span whatever the column happens to contain. |
| D24 | **Aisle is not a format concept at all — \`aisleAfterRow\` is removed** | Space is simply a row nothing is placed on. No field, no spacing constant, no special case in layout. A wagon that wants a corridor just leaves a row's items empty across every column. |
| D27 | **Builder items are draggable within the canvas, not just from the palette** | Dropping onto an occupied cell is a no-op — this is deliberately a *move*, not a swap, to avoid silent data loss from an imprecise drop. |
| D28 | **Non-seat items (facility, table, separator) get a drag handle to resize their row span** | Seats don't get one — \`luxury\`'s span is fixed by definition and other seat kinds don't span rows, so a resize handle on a seat would have nothing meaningful to do. |
| D29 | **Half-table is its own item, not a small \`table\`** | Fixed size (never resizable — no resize handle, no row-span field), and it takes a \`facing: top \\| bottom\` instead of a span, since its whole identity is which half of the row it occupies. |
| D30 | **Every non-seat item uses one field, \`type\`, instead of a mix of named fields and boolean flags** | \`facility: "wc"\`, \`table: true\`, \`separator: true\`, \`halfTable: true\` was inconsistent — an accidental artifact of adding item kinds one at a time, not a deliberate distinction. \`wc\`, \`table\`, \`half_table\`, \`separator\` are now all just values of \`type\`. This also gives table/separator/half-table the same unknown-value fallback facilities already had — a typo in \`type\` renders as an inert placeholder instead of silently doing nothing. |
| D25 | **\`byAisle\` removed** | Redundant with row position — a seat's row already says whether it's in the aisle pair. (Written when the aisle was \`aisleAfterRow\`; D24 makes it an empty row, the reasoning is unchanged.) |
| D26 | **\`tags\` / \`seatTags\` removed entirely** | No behaviour depended on it; dropped rather than carried as unused surface area. |
| D31 | **Three renderers, one per UI technology, never mixed: Compose, SwiftUI, Web** | Each consumer (§1.3) uses the renderer native to its own stack. Compose Multiplatform is used *because its consumers are already Compose apps* — the conductor app and wagon admin are CMP, and every Android app uses Compose — not as a cross-platform shortcut. The iOS sales app is SwiftUI and gets a SwiftUI renderer; the Vue sites get a web renderer. This settles the old "CMP vs SwiftUI for iOS" roadmap question: both exist, for different consumers. |
| D32 | **Every renderer is a separately published library** | The renderers are consumed by other teams in their own apps, on their own release schedules. So each needs a stable public API, its own semver and changelog, and platform-native packaging (Maven for Compose, SPM for SwiftUI, npm for web). A renderer that only works inside this repo has not shipped. |
| D33 | **The renderer owns the look; the look is identical across renderers** | Colors, sizes, strokes and icon treatment are never in the scheme (consistent with §6, no pixel values). But three teams hand-copying a style guide will drift exactly the way per-platform assets drifted, so the style is defined once, as shared design tokens, and generated into each renderer. Web differs from mobile — at least in sizes — so tokens come as a \`mobile\` and a \`web\` preset. |
| D34 | **Theme = colors only, passed in by the consumer** | Each consumer app has its own theming (light/dark, brand), so the renderer takes a theme argument (e.g. a parameter on the composable) with the shared tokens as the default. Only colors are themeable for now; sizes come from the preset, not the theme. Widening this later is additive; narrowing it after consumers depend on it is not. |
| D35 | **The builder is a separate, stateless authoring tool** | Hosted on its own domain. It configures a scheme and exports it — as a JSON file or through an API into an admin panel. It stores no schemes and is not a catalogue: the admin panels are the source of truth (§1.3). Editing an existing scheme means loading its JSON in, not looking it up. |
| D36 | **Buses use the same format** | A bus is rows and columns of seats with an empty row for the aisle, optional facilities, sometimes two decks — everything the format already expresses. Bus availability has the same shape as train availability (§1.2). A second format would mean a second set of three renderers. Train-specific fields must therefore become optional, and bus-only elements are new \`type\` values, not a new structure — see §4.7. |
| D37 | **This project is the format, the renderers and the builder — nothing else** | Availability, booking, partner integration and scheme storage all live elsewhere (§1.1). Keeping the renderer's input/output this narrow is what lets five consumer apps embed it without inheriting anyone's backend. |
| D38 | **Removed: \`class\`, \`hull\`, \`artwork\`, seat \`class\`, facility \`label\`** | Format review, 2026-10-05: none of them changed what a passenger sees. \`class\` was display-only (D12) and the admin already knows a wagon type's class. \`hull\` was \`"plain"\` in every scheme ever written — \`nose_left\` / \`nose_right\` never occurred and no renderer drew a nose, so its only effect was a corner radius. \`artwork\`, per-seat fare \`class\` and facility \`label\` were specified but never implemented anywhere; fare class already belongs to the availability payload (§4.6). Both \`class\` and \`hull\` were also train-only, which D36 rules out for required fields. Unused fields in a published format are not free — every renderer team has to wonder whether to support them. |
| D39 | **\`deck.id\` replaced by optional \`deck.level\`: \`lower\` \\| \`upper\`** | \`id\` was \`"main"\` everywhere and nothing read it, yet a double-deck vehicle needs to tell the passenger which deck they are looking at, and \`"main"\` cannot. \`level\` is optional for a one-deck scheme and required — and unique — when a scheme has several decks. Škoda stays two schemes (D20); each now carries the level it shows (\`SKD-D1\` lower, \`SKD-D2\` upper, which its stairs confirm). |
| D40 | **No doors on any vehicle** | D9 extends to buses. Wagon schemes show only the aisle, and buses follow the same convention. The driver's place is the one bus-only item (§4.7). |
| D41 | **\`span.cols\` removed — every item is one column wide** | Implemented in layout but never set by any scheme, sample, import or builder action. Horizontal size is already expressed by columns; a second way to make an item wide would be a second source of truth for the same thing. If a wide item is ever needed, adding an optional field back is additive. **Superseded by D48.** |
| D42 | **Top-level \`vehicle\`: \`train\` \\| \`bus\`, absent means \`train\`** | Chosen over a separate bus key space: one explicit field says what a scheme describes, so an exported file is self-describing and a key can never be read in the wrong namespace. **It changes nothing visual** — a bus is drawn by exactly the rules a wagon is, and the driver's place is its own item (D43). Its only rendered effect is the accessibility label ("Bus BUS-53" vs "Wagon …"). It also leaves a switch in place should a vehicle ever need different rendering. Kept deliberately (2026-10-05) although the admins already know the vehicle type: dropping it later would cost more than carrying it. Defaulting to \`train\` keeps every scheme written before buses valid without touching a published revision (D5). An unknown value warns and renders as a train. |
| D43 | **\`driver\` is a typed item, always exactly one cell, no \`facing\`** | The one bus-only element (no doors, D40). A fixed size means no span to author and no resize handle in the builder, like \`half_table\` (D29); a \`span\` on it is ignored with a warning rather than an error, so a stray field cannot break a published scheme. No \`facing\`: the wheel reads the same whichever way the vehicle is drawn. No icon exists yet — the steering-wheel glyph is a stand-in, like \`kid\` and the stairs. |
| D44 | **Builder edits vehicle and decks: at most two decks, levels kept valid by construction** | Two decks is the most \`level\` can name. Adding a second deck fills in \`lower\` / \`upper\` on both, and picking the other deck's level swaps the two, so the builder never produces a duplicate or missing level (D39) — the validator still catches hand-edited JSON. Removing a deck that has items takes a second click, the same no-silent-data-loss rule as D27. The builder writes \`vehicle\` explicitly, including \`"train"\`, so an exported file always says what it is. |
| D45 | **Two interaction modes, a renderer input: \`view\` and \`select\`** | Different consumers need different behaviour — an admin preview shows a scheme, a sales app sells seats from it. \`view\`: every known seat looks available, nothing is tappable, no availability needed. \`select\`: the app passes the available seat numbers; those are blue and tappable, every other seat grey and inert (the §4.6 rule). A mode is runtime input like availability (D4), never a scheme field. A highlight in \`view\` mode and separate \`occupied\` / \`held\` looks are deliberately left out until a consumer needs them — both are additive. |
| D46 | **The app owns the selection; the renderer only reports taps** | The renderer calls back with the tapped seat number and never changes \`selected\` itself; the app updates its set and passes it back in. Selection rules — a maximum, one seat per passenger, deselect-on-tap — differ per product and belong to the app. It also keeps every renderer stateless and identical: same inputs, same picture. |
| D47 | **Facility names and art come from the Android sales app** | The sales apps already ship every facility a real wagon has, drawn from one design system (iOS uses the same glyphs as PNGs). Their names are the Android drawable names with the \`ic_\` prefix, the class prefix (\`ps_\`, \`ks_\`) and the size suffix dropped: \`wc\`→\`toilet\`, \`wc_accessible\`→\`invalid_toilet\`, \`luggage\`→\`baggage\`, \`bicycle\`→\`bike\`, \`inclusive\`→\`handicapped\`, \`electrical\`→\`shield\` (\`ic_is_shield\`). Two are adjusted where the literal name would mislead: the standalone marker is \`handicapped_wheelchair\`, not \`invalid\` (reads as "not valid" next to validator messages), and stairs are \`steps_up\` / \`steps_down\` (Android's down drawable is plain \`ic_ps_steps\`). New from the apps: \`wardrobe\`, \`cafe\`, \`coffee_machine\`, and \`chair\` — a bar stool, one cell, with an optional \`facing\` that turns its back arc like a seat back (default \`right\`), drawn without a facility block. \`baggage\`, \`steps_up\` and \`steps_down\` replace mislabelled or stand-in art. \`kid\` and \`driver\` have no counterpart in either app and keep their names. A clean rename, no aliases: nothing is published yet, and old names now render as the unknown-type placeholder. |
| D48 | **\`span.cols\` is back, for non-seat items only — reverses D41** | A baggage bay, a shared table or a toilet block can be longer than one seat, and the catalogue already draws them so: the importer emits such a block as two neighbouring one-column items with nothing tying them together, so a builder edit can move or delete half of it. A wide item covers the next \`cols − 1\` columns the way \`span.rows\` covers rows downward; it does not widen its own column, which is how the D41-era field worked and why reverting that commit was not the fix. A column covered by a wide item is drawn seat-wide even when empty, or it would collapse to a gap and squash the item. Seats stay one column: a wide seat raises questions about the back bracket, berth bars and what a passenger reads it as, and no real layout needs one. \`separator\`, \`half_table\`, \`driver\` and \`chair\` stay one column too. \`cols\` on any of those is ignored with a warning, not an error, like D43's span on the driver. In the builder, inserting a column inside a wide item widens it and deleting one narrows it, so the item keeps its neighbours. |

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

Measured against two Figma SVG exports (\`Wagons.svg\`, 35 MB; \`uz_web__master_.svg\`, 81 MB).

### Alignment — grid model confirmed

Grouping seats into bands within each wagon card (tolerance 6px):

| Axis | Bands | Perfectly aligned (spread 0.00px) | Worst spread |
|---|---|---|---|
| Row (y) | 567 | 564 — **99.47%** | 4px |
| Column (x) | 2325 | 2182 — **93.85%** | 6px |

Worst misalignment in the whole catalogue is a quarter of a seat width.

### Seat geometry

Two scales are present (\`25×25\` and \`32×32\`) — a design-system difference, not a layout
difference. The renderer owns pixel size; the format does not encode it.

| Observed block | Count | Reading |
|---|---|---|
| \`25×25\` navy filled | 7982 | standard seat |
| \`27×25\` navy + \`23×2\` bar | 952 pairs | berth level: bar above = upper, below = lower, absent = middle |
| \`32×32\` navy filled | 713 | same seat, other design scale |
| \`27×66\` navy | 170 | seat spanning **exactly 2 rows** (66 = 2×25 + 16) → люкс berth |
| \`24×24\` / \`30×30\` white fill, navy stroke | 73 | **inclusive seat** — outlined instead of filled |
| \`25×25\` grey \`#D4D5D6\` | 10 | unavailable — runtime state, not layout |

### How attributes are drawn

| Attribute | Rendering |
|---|---|
| \`berth\` | Bar **above** = upper, bar **below** = lower, **nothing drawn** = middle. |
| \`facing\` (sit) | A half-open rounded bracket drawn around the seat at 50% opacity, on the side the back is against. Reference asset: 37×41 artboard, 32×32 seat inset at (4.5, 4.5); rotate 0/90/180/270 for left/top/right/bottom. |
| \`inclusive\` | Seat drawn as outline (white fill, navy border) instead of solid. Accompanied by a wheelchair marker item nearby. |
| \`luxury\` | No indicator — the seat is simply 2 rows tall. |
| aisle-side seat | No indicator — position relative to the empty aisle row is the only cue (D25). |

### Facilities — two visual families

| Family | Fill / border | Widths | Heights | Reading |
|---|---|---|---|---|
| Partition | \`#F7F6F8\` + \`#D4D5D6\` border, rx 3.5 | 23, 38 | 11, 28, 31, 65, 88, 102 | tables, partitions between bays |
| Block | \`#F7F6F8\`, no border, rx 4 | 40, 56, 61 | 66, 101, 103, 104 | WC, luggage, stairs, vestibule |

Plus 2284 hairline rules (1–2px) used as visual separators. These are **not** items — they
are how the renderer draws a boundary between column groups.

### Interior heights

Vertical hairlines cluster at heights that map to row counts: \`66\` = 2 rows (2×25 + 16),
\`78\` = 2 rows with a wider aisle, \`103\` = 3 rows (3×25 + 2×14), plus \`112\`–\`169\` for taller
stock. Row count per deck comes from a small set.

---

## 4. Item taxonomy

Two axes that must not be conflated:

- **Type / attribute** — intrinsic to the wagon. Lives in the layout file. Changes only when
  the wagon is rebuilt.
- **Runtime state** — per train, per date, per user. Comes from the availability API. Never
  in the layout file.

\`sitting\` / \`sleeping\` / \`luxury\` are *types*. \`occupied\` / \`selected\` are *states*. Keeping
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
class routinely differ by a few elements. RIC is the reason \`middle\` exists in the enum.

Any wagon class may contain inclusive seats: an inclusive compartment in sleeping stock
(commonly numbered 33–34), or its seated analogue.

### 4.2 Seat

| Field | Values | Notes |
|---|---|---|
| \`number\` | **opaque string** | No conventions. May start at any value. **Nothing may be derived from it** (D10). |
| \`kind\` | \`sit\` \\| \`sleep\` \\| \`luxury\` | Closed enum, three values. |
| \`berth\` | \`lower\` \\| \`middle\` \\| \`upper\` | Required when \`kind = sleep\`. **Always write explicitly** — see below. |
| \`inclusive\` | bool, default \`false\` | Renders as an outlined seat. |
| \`facing\` | \`left\` \\| \`right\` \\| \`top\` \\| \`bottom\` | Optional, only when \`kind = sit\`. Draws the seat-back bracket. |
| \`span\` | \`{rows}\`, default \`{1}\` | \`luxury\` observed at \`{rows: 2}\`. Seats have no \`cols\` — always one column (D48). |


**Never let absence encode a value.** The picker draws nothing for a middle berth, but the
JSON must still say \`"berth": "middle"\`. If middle is an absent field, then a middle berth,
an unfinished scheme, and a writer predating berth support all look identical, and no
validator can separate them. Render absence; store presence.

**\`facing\` is optional.** It was once marked deferred because the backend could not supply
it; in practice the builder writes it on every \`sit\` seat and both renderers draw it. A seat
without it simply has no bracket.

**\`byAisle\` was removed (D25).** It duplicated information already carried by the seat's
\`row\` relative to the empty aisle row — a side place is identifiable purely by position, so a
separate flag added a second, potentially-inconsistent source of truth for the same fact.

### 4.3 Facility (non-selectable)

Names and art from the Android sales app's drawables (D47), which is every facility the
production sales apps draw today.

| Type | Size behaviour |
|---|---|
| \`toilet\` | 2 rows × 1 column |
| \`invalid_toilet\` | accessible toilet |
| \`table\` | 1, 2 or 3 rows |
| \`baggage\` | variable height |
| \`bike\` | same sizing as baggage |
| \`kid\` | variable height; stand-in icon, no app has one |
| \`handicapped\` | placed in a compartment containing inclusive seats |
| \`handicapped_wheelchair\` | standalone wheelchair marker |
| \`shield\` | electrical cabinet warning |
| \`steps_up\` / \`steps_down\` | Škoda only |
| \`wardrobe\` | coat hanger / wardrobe |
| \`cafe\` | buffet, bar or café area |
| \`coffee_machine\` | vending / coffee machine |
| \`chair\` | bar stool, always one cell, optional \`facing\`, no block (D47) |
| \`driver\` | Bus driver's place. Always one cell (D43); stand-in icon |

| Field | Values |
|---|---|
| \`type\` | one of the above, or unknown → inert placeholder |
| \`span\` | \`{rows, cols}\` — \`rows\` required, these vary a lot (§3); \`cols\` optional, default 1 (D48) |

### 4.4 Structural

A deck is an ordered list of **columns**. Every column is exactly one of:

A column is \`{ items: [...] }\` and nothing else. An empty \`items\` array is a gap — there is
no separate gap marker. There is no \`aisleAfterRow\` field, no aisle spacing constant in the
renderer, no special case anywhere in layout.

| Concept | How it is expressed |
|---|---|
| content column | \`items\`, each with its own \`row\` and optional \`span\` |
| gap (horizontal space) | a column with \`items: []\` |
| corridor / aisle (vertical space) | **not a field.** A row that no column places an item on. Every row uses the same pitch; an "aisle" row is just a row that happens to be empty. |
| separator | \`{ type: "separator", row, span }\` — placed exactly like a table, in whichever column and row range it needs. Rendered as a thin line, positioned with full control: it can cover only a bay, stop short of open space, or run the full deck. |
| table | \`{ type: "table", row, span }\` — resizable in both directions, full row height by default. |
| wide item | \`span.cols\` > 1 on a facility or table: it covers that many columns from its own rightward, which must be free in those rows. Usually the covered columns are empty (\`items: []\`); they are drawn seat-wide, not as gaps (D48). |
| half-table | \`{ type: "half_table", row, facing: "top" \\| "bottom" }\` — fixed at half the row's height, occupying only the top or bottom half. Not resizable; carries no \`span\`. |

Every non-seat item — facility or structural — shares this one shape: \`type\` names what it
is, everything else is that type's own fields. A seat is the only item with a second
identity field (\`seat\`, the number), because a seat is the only item that is both typed
*and* individually identified.

This removes the last deck-level field that wasn't a plain count. \`rows\` is now the only
thing a deck says about itself besides its columns.

The **aisle is not a column, not an item and not a field** (D24) — it is a row nothing is
placed on. \`table\`, \`half_table\` and \`separator\` are content items inside a column, not
column types.

### 4.5 Scheme and deck level

| Field | On | Values | Notes |
|---|---|---|---|
| \`vehicle\` | scheme | \`train\` \\| \`bus\` | Optional, absent means \`train\` (D42). |
| \`key\` | scheme | e.g. \`П19\`, \`BUS-53\` | Vehicle-type key. Renderers must not depend on it. |
| \`rev\` | scheme | int | Immutable once published. Renderers must not depend on it. |
| \`decks\` | scheme | array | Double-deckers have 2. |
| \`level\` | deck | \`lower\` \\| \`upper\` | Optional with one deck; required and unique with several (D39). |
| \`rows\` | deck | int | Grid height. |
| \`columns\` | deck | array | Left to right. |

Not present, deliberately: compartment numbers (D11), gender/children flags (D13), seat
counts (D12), doors (D9, D40), aisle position (D24), wagon class and hull shape (D38).

Field-by-field reference, with defaults and what each value changes on screen:
\`docs/developer-guide.md\`.

### 4.6 Runtime state — availability payload, NOT layout

\`available\`, \`occupied\`, \`held\`, \`selected\`, \`unavailable\`, plus price and fare class per
seat. The grey \`#D4D5D6\` seats in the design files belong here.

Today the API returns the list of bookable seats; those render blue and clickable, everything
else renders grey and disabled. Layout never changes — only state.

**Renderer contract (D45, D46).** Every renderer takes the same runtime input:

| Input | Values | Notes |
|---|---|---|
| \`mode\` | \`view\` \\| \`select\` | \`view\`: every known seat looks available, nothing is tappable. |
| \`available\` | set of seat numbers | \`select\` only. Seats not in it are unavailable. |
| \`selected\` | set of seat numbers | \`select\` only. Owned by the app; drawn selected only if also available. |
| \`onSeatClick\` | callback(seat number) | \`select\` only. Fired for available and selected seats; the renderer never changes \`selected\` itself. |

Seat state, in order of precedence: unknown kind → **unknown** (grey "?", never tappable);
\`view\` → **available**; not in \`available\` → **unavailable**; in \`selected\` → **selected**;
otherwise **available**. Reference implementation: \`seatState()\` in \`web/js/format.js\`,
mirrored by \`layout/SeatState.kt\`.

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

What carries over unchanged: the grid, empty-row aisles, \`decks\` (double-deck coaches),
\`steps_up\` / \`steps_down\`, \`sit\` and \`sleep\` seats (sleeper coaches), \`toilet\`, \`table\`,
\`baggage\`, availability and reconciliation. A typical 2+2 coach is two seat columns, an empty
row, two more seat columns.

The two train-only top-level fields, \`class\` and \`hull\`, were removed (D38). What a bus adds:

- **\`"vehicle": "bus"\`** at the top level (D42).
- **\`driver\`** — the one bus-only item: a typed item, always one cell, no \`facing\` (D43).
  Older renderers draw it as an inert placeholder (D6).
- **No doors** (D40).

Reference: \`shared-fixtures/bus.json\` (sample "Автобус 2+2"), a 53-seat 2+2 coach drawn
front-left — the driver at row 5, the bus's left side when facing left; row 3 the aisle,
closed by the rear bench. Still worth checking against two or three real bus layouts, the
same way the grid model was validated against the wagon catalogue (§3).

---

## 5. Draft JSON

\`\`\`json
{
  "key": "П19",
  "rev": 3,
  "decks": [
    {
      "rows": 5,
      "columns": [
        { "items": [ {"seat": "5",  "kind": "sleep", "berth": "upper", "row": 1},
                     {"seat": "6",  "kind": "sleep", "berth": "lower", "row": 2},
                     {"seat": "37", "kind": "sleep", "berth": "upper", "row": 5} ] },
        { "items": [ {"seat": "7",  "kind": "sleep", "berth": "upper", "row": 1},
                     {"seat": "8",  "kind": "sleep", "berth": "lower", "row": 2},
                     {"type": "separator", "row": 4, "span": {"rows": 2}} ] },
        { "items": [ {"type": "toilet", "row": 1, "span": {"rows": 5}} ] }
      ]
    }
  ]
}
\`\`\`

Row 3 is the aisle: nothing is placed on it (D24). Columns-with-items versus a flat item
list was settled in favour of columns (D14).

---

## 6. Guardrails

- **Never store pixel values.** Row pitch, gap widths and seat size are platform constants.
  The 6px of drift in the design files is noise, not data.
- **Never derive anything from a seat number.** No ordering, no berth level, no side
  detection, no validation (D10).
- **No decorative artwork in the format.** \`artwork\` was specified once as an escape hatch
  and removed unused (D38). The moment decorative SVG becomes the normal way to draw a
  vehicle, we are back to maintaining assets per vehicle type.
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
- an item whose \`span\` runs off the edge of the deck
- \`berth\` missing on a \`kind: sleep\` seat, or present on any other kind

---

## 7. Open questions

1. ~~Two supplied icons are unlabelled~~ — settled: checked against the sales apps' own
   art, \`Group_31\` is the bike and \`Group_34\` the wheelchair (\`handicapped\`) (D47).
2. **No assets yet** for \`kid\` and \`driver\` — neither sales app has them; still stand-ins.
   The stairs now use the apps' art (D47).
3. **Is the facility list final?** It now covers everything both sales apps draw (D47).
   The Android app's empty "shelf" blocks are tables (\`table\` / \`half_table\`); iOS's
   connection and spacer cells are empty space. iOS's train-head cell ("Голова потягу")
   has no equivalent yet.
4. **Web vs mobile layout behaviour.** Sizes differ (D33). Whether layout behaviour also
   differs — scroll direction, rotating the vehicle on narrow screens — is undecided.
5. ~~Bus top level~~ — settled: \`vehicle\` field (D42).
6. ~~Driver's place~~ — settled: one cell, no \`facing\` (D43). Real icon still pending.
7. **Two admins, one builder.** The builder pushes to the wagon admin (Compose) and the bus
   admin (Vue/Nuxt). One shared import API, or one per admin? Owned by the admin teams.
8. **Naming.** "Wagon scheme" is baked into the spec title, file names and code. Rename to
   something vehicle-neutral, and when — the generated files and the Pages deploy depend
   on current paths.

### Settled

| Question | Answer |
|---|---|
| Is direction drawn? | Yes — seat-back bracket, from the optional \`facing\`. |
| What is the \`23×2\` bar? | Berth level. |
| Does \`luxury\` have variants? | No — just large, 2 rows. |
| Does \`side\` need a berth? | Yes, and \`side\` is not a kind at all (D8). \`byAisle\` was later removed too — position says it (D25). |
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
| Doors on buses? | No — no doors on any vehicle (D40). |
| Wagon class, hull shape? | Removed from the format (D38). |
| How is a double-deck vehicle's deck named? | \`deck.level\`, \`lower\` / \`upper\` (D39). |
| Wide items (\`span.cols\`)? | Back for non-seat items only (D48, reverses D41). |
| Bus vs train? | Top-level \`vehicle\`, default \`train\` (D42). |
| Driver's place? | \`driver\` item, one cell, no \`facing\` (D43). |
| \`inclusive\` vs \`inclusive_marker\`? | Both kept — now \`handicapped\` and \`handicapped_wheelchair\` (D47). |
| Facility names? | The Android sales app's drawable names (D47). |

---

## 8. Repository layout

The project lives at \`/dev/schemgen\` (this doc's copy: \`docs/wagon-scheme-format.md\`).

\`\`\`
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
\`\`\`

Not yet created: the SwiftUI renderer, the production web renderer, and the shared style
tokens (§9). Each renderer subfolder is a sibling of \`web/\`, not nested inside it — \`web/\`
is the reference implementation and UI shell, not the parent project.

\`compose-renderer/\` today is a wasm **preview app** driven by \`postMessage\` from the web
Preview tab, not a library anyone can depend on. Under D32 it becomes the published Compose
library, with the preview app kept as a thin harness on top of it.

\`web/\` is a prototype of the builder (D35) plus dev tooling. Its Catalogue tab and the
bundled \`AUTO\` schemes are sample data for exercising renderers, not a product feature —
the product catalogue is the admin panels.

## 9. Expansion roadmap

Ordered by dependency, not by calendar. Each phase should end with something a
non-engineer can look at — a running preview, a report, a comparison — not just code.
Rewritten 2026-10-05 for D31–D37; the previous version assumed one Compose renderer
growing platform by platform, an undecided iOS stack, and train-only schemes.

1. **Compose Multiplatform Web compiles — done 2026-10-05.** Shared Kotlin model, parser,
   layout math and validator, ported line-for-line from \`format.js\`. Builds, tests pass,
   and a scheme sent by postMessage renders — see §11.

2. **Golden fixture parity** — extend \`/shared-fixtures\` with expected output per seat
   (\`{seat: row, col, span, hit-box}\`), and a test in each renderer checking its own
   layout against that, not just that the JSON parses. With three renderers owned by
   different teams' consumers, the fixtures *are* the contract a release is judged by
   (D32). Do this before the second renderer exists, not after.

3. **Vehicle-agnostic format + bus items** — resolve §7 questions 5–6 against two or three
   real bus layouts; make train-only fields optional; add bus \`type\` values; add bus
   fixtures. Before the SwiftUI and web renderers start, so they are born bus-aware.

4. **Shared style tokens** — one token source (colors, sizes, strokes, icon sizes) with a
   \`mobile\` and a \`web\` preset, generated into Kotlin, Swift and TS (D33). Define the theme
   shape: colors only, defaulting to the tokens (D34). Fixtures check layout; tokens are
   what keeps appearance identical.

5. **Compose renderer as a published library** — split \`compose-renderer/\` into a library
   module plus the preview harness; add \`androidTarget()\` and iOS targets next to
   \`wasmJs\`; public API along the lines of
   \`SeatScheme(scheme, availability, theme, onSeatClick)\`; touch handling, accessibility
   semantics (seat number and state spoken by TalkBack / VoiceOver) and the reconciliation
   rule from §4.6; publish to Maven. Consumers: Android sales app (via \`ComposeView\`),
   conductor app (Android + iOS), wagon admin (wasm).

6. **Visual fidelity in Compose** — seat-back bracket, berth bars and real icons are
   already ported from \`render.js\` (§11); what's left is checking them against the web
   reference once layout is fixture-verified, and fixing whatever differs.

7. **SwiftUI renderer** — for the iOS sales app. Port of \`format.js\` logic, same fixtures,
   same tokens, same theme shape; published as a Swift package.

8. **Web renderer** — for web sales and the bus admin, both Vue/Nuxt. A framework-free TS
   core (port of \`format.js\`: parse, validate, layout) plus a Vue 3 component on top,
   rendering SVG so it is Nuxt-SSR-safe and screen-reader visible; published to npm. The
   builder's own preview should move onto the same core.

9. **Builder as a standalone product** (D35) — own domain; JSON file export and import;
   push to the admin APIs once their contract exists (§7 Q7); Preview tab showing all
   three renderers so a designer can check a scheme everywhere before exporting.

10. **Figma importer, productionized** — \`web/tools/extract_schemes.py\` proves the
    geometry-clustering approach on the real catalogue; turn it into an importer against
    the Figma REST API (keeps layer names, so seat numbers and kinds come through) feeding
    the builder as "review this auto-generated scheme".

11. **CI fixture gate** — run phase 2's suite in CI on every PR to every renderer. A
    renderer disagreeing with the fixtures fails the build, rather than being caught by
    someone eyeballing a screenshot.

## 10. Prototype status

A working prototype exists (\`web/index.html\`, no build step): renderer, catalogue of sample
schemes, live JSON editing, structural validator, and a drag-and-drop visual builder.

**Twelve of the sample schemes were auto-converted from the real Figma catalogue export**
by a script that clusters seat/block rects into rows and columns and emits scheme JSON.
That is the importer path (§9 phase 10), proven on real data: 133 of the ~135 wagon
cards in \`uz_web__master_.svg\` converted without manual work, covering seat counts from 12
to 70+. Seat *numbers* are sequential rather than real, because the SVG export outlines all
text — recovering the real numbers needs the Figma REST API, which keeps layer names.

Known gaps:

- Facility art now comes from the Android sales app (D47). The old Figma \`luggage\` export,
  which drew a face and a monitor, is replaced by the app's briefcase; \`kid\` and \`driver\`
  are still stand-ins.
- The Figma importer predates wide items (D48): a block two seats long still comes out as
  two neighbouring one-column items (several \`CAT-*\` samples have such baggage pairs).
  Merging them into one wide item is importer work, not done yet.
- The live preview stacks a double-deck scheme's decks but doesn't caption them with their
  level yet — only the deck tabs above the canvas and the accessibility label say which is
  which.

## 11. Compose renderer verification status

**Verified 2026-10-05** (Kotlin 2.4.10, Compose Multiplatform 1.11.1, Gradle 9.6.1,
JDK 26, macOS):

- \`./gradlew wasmJsBrowserDevelopmentExecutableDistribution\` builds cleanly.
- \`./gradlew composeApp:wasmJsBrowserTest\` runs the \`commonTest\` suite in headless Chrome:
  3/3 pass (kupe and platskart parse with no structural errors; the broken fixture still
  reports its errors).
- \`./gradlew wasmJsBrowserDevelopmentRun\` serves the preview on \`localhost:8080\`. Standalone
  it draws the inlined kupe sample; a \`schemgen:scheme\` postMessage from a parent page
  replaces it — checked by sending \`shared-fixtures/platskart.json\` from a host page, which
  rendered all 54 seats, berth bars, separators and facility icons.

Gotchas found on the way:

- **The documented \`wasmJsBrowserRun\` no longer exists.** Current Kotlin splits it into
  \`wasmJsBrowserDevelopmentRun\` and \`wasmJsBrowserProductionRun\`; the bare name fails as
  ambiguous.
- **Headless Chrome needs software WebGL** (\`--use-angle=swiftshader
  --enable-unsafe-swiftshader\`) or the Skia canvas draws nothing. And a host page opened
  from \`file://\` gets a blank cross-origin iframe in headless mode — serve it over http.
  Both are test-harness issues, not renderer bugs.
- \`gradle.properties\` sets \`kotlin.native.cacheKind\`, which Kotlin now reports as removed.
  Harmless today; drop it when iOS targets are added.

**Density bug, fixed 2026-10-05.** The canvas was sized in dp but drawn in raw px, so on any
screen with density above 1 (every phone, Retina browsers) the scheme filled only part of its
box and taps would have missed. Drawing is now scaled by density, text measured unscaled, and
tap positions divided by density before hit-testing. Checked at 2× in headless Chrome.

Taps: hit-testing (\`seatAt\`) and the mode rule are unit-tested. Synthetic pointer events on
the wasm canvas selected exactly the available seats tapped and ignored an unavailable one —
but only in two of four headless runs; the failing runs registered no taps at all, which
points at the test harness's timing rather than the renderer. Confirm on a real device.

Still unverified: pixel parity with \`web/js/render.js\` (no fixture comparison exists —
phase 2), and anything on Android or iOS targets, which aren't configured yet.

The seat-back bracket, berth bars and real facility icons, previously listed as deferred
(§9 phase 6), are already implemented in \`SchemeCanvas.kt\` / \`Icons.kt\`. What remains of
phase 6 is confirming they match the web reference.

## 12. Next steps

Immediate actions, in order. The longer view is §9.

1. ~~Run the Compose build and record the outcome in §11~~ — done 2026-10-05.
2. Pull one wagon per class through the Figma REST API (\`GET /v1/files/{key}/nodes\`) to
   recover layer names, and collect two or three real bus layouts. Together they feed the
   fixture suite and the bus format questions (§7 Q5–6).
3. Build the golden fixture suite: scheme JSON → expected \`{seat → row, col, span}\` plus
   tap-resolution cases, covering купе, плацкарт, люкс, a seated car with an inclusive
   block, and at least one bus.
4. Draft the style token file and theme shape, and agree them with the consuming teams
   before any renderer depends on them.
5. Sketch each renderer's public API and get sign-off from its consumer teams — once
   published (D32), changing it costs every consumer a migration.
`;
var DOCS_GUIDE_MARKDOWN = `# Seat Scheme Format — Field Reference

A seat scheme is one JSON document describing the seat layout of one vehicle — a train
wagon or a bus (\`"vehicle": "bus"\`, see \`shared-fixtures/bus.json\`): which decks it has, how many rows each deck has, and what sits in each
column at each row — a seat, a table, a facility, or nothing at all.

This page is the field-by-field reference: every field, the values it takes, its default,
and what it changes on the rendered scheme. The design history — *why* the format looks
the way it does — is folded up at the bottom under **Design rationale & roadmap**.

## Quick start

\`\`\`
{
  "key": "KUP-34",
  "rev": 1,
  "decks": [
    {
      "rows": 2,
      "columns": [
        { "items": [ { "type": "toilet", "row": 1, "span": { "rows": 2 } } ] },
        { "items": [
            { "seat": "1", "kind": "sleep", "berth": "lower", "row": 1 },
            { "seat": "2", "kind": "sleep", "berth": "upper", "row": 2 }
        ] }
      ]
    }
  ]
}
\`\`\`

A column is a vertical slot in the vehicle; the items inside it are placed by \`row\`. A row
nothing occupies is just empty space — that is how an aisle is drawn. There is no aisle
field anywhere in the format.

## Ground rules

- **The scheme is layout only.** Whether a seat is free, taken or selected comes from the
  availability payload at runtime, never from this file.
- **No pixel values.** Seat size, row pitch and gaps belong to each renderer; the same
  scheme renders on every platform.
- **Seat numbers are opaque strings.** Nothing — sorting, berth, validation — may be derived
  from one.
- **Unknown values never crash.** An unknown \`kind\` or \`type\` renders as an inert grey
  placeholder, so a new item type can ship before every app understands it.
- **Unknown fields are ignored.** Renderers skip fields they don't know.

## JSON structure

### Scheme (top level)

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| \`vehicle\` | \`"train"\` \\| \`"bus"\` | no | \`"train"\` | **Nothing visible.** Says what the file describes; the only rendered effect is the accessibility label ("Bus BUS-53" vs "Wagon BUS-53"). A bus is drawn by exactly the same rules as a wagon — its driver's place is the \`driver\` item, not this field. An unknown value warns and is treated as \`train\`. |
| \`key\` | string | yes | — | Nothing visible. Identifies the vehicle type, e.g. \`"KUP-34"\`. Renderers may use it in an accessibility label but must not depend on it. |
| \`rev\` | integer | yes | — | Nothing visible. Revision of this scheme; a published revision is never edited, a change publishes a new \`rev\`. |
| \`decks\` | array of Deck | yes | — | One drawing per deck, stacked in array order. An empty or missing array is an error. |

Removed, do not write: \`class\`, \`hull\`, \`artwork\` (spec D38).

### Deck

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| \`level\` | \`"lower"\` \\| \`"upper"\` | only when there are several decks | none | Names the deck for the passenger and in the accessibility label ("lower deck"). With one deck, omit it — or set it when the scheme shows one level of a double-deck vehicle (the Škoda wagons are two schemes, one per level). With several decks every deck needs one, and no two decks may share it. |
| \`rows\` | integer ≥ 1 | yes | \`1\` | Height of the grid. Every row has the same height; an unoccupied row draws as empty space (the aisle). Items may not extend past it. |
| \`columns\` | array of Column | yes | \`[]\` | Left-to-right order of the grid. Position in the array *is* the column index — inserting a column needs no renumbering. |

Removed, do not write: \`id\` — replaced by \`level\` (spec D39).

### Column

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| \`items\` | array of Item | no | \`[]\` | What sits in this column. An empty column draws as a narrow gap — there is no separate gap marker. A column is as wide as its widest item. |

A column has no other fields — no \`type\`, no flags.

### Item — common fields

Every item has a position. Beyond that, an item is **either a seat or a typed item**, told
apart by field presence, not by a discriminator:

- it has a \`seat\` field → it's a seat (see **Seat fields**);
- otherwise its \`type\` says what it is (see **Typed item fields**).

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| \`row\` | integer ≥ 1 | yes | \`1\` | Top row the item occupies. |
| \`span.rows\` | integer ≥ 1 | no | \`1\` | How many rows the item covers, downward from \`row\`. A WC two rows tall is \`"span": { "rows": 2 }\`. |
| \`span.cols\` | integer ≥ 1 | no | \`1\` | Non-seat items only (spec D48). How many columns the item covers, rightward from its own. A baggage bay two seats long is \`"span": { "rows": 2, "cols": 2 }\` in one column, with the next column left empty. Ignored with a warning on seats, \`separator\`, \`half_table\`, \`driver\` and \`chair\`. |

Two items may not share a cell — a wide item's covered cells count — \`row + span.rows − 1\` may
not exceed the deck's \`rows\`, and a wide item may not run past the last column. A column
holding nothing but cells covered by a wide item is drawn seat-wide, not as a gap. Example:
\`shared-fixtures/wide.json\` (sample "Wide items").

#### Seat fields

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| \`seat\` | string | yes | — | The label drawn on the seat and the id the availability payload and the selection use. **Opaque** — unique within a deck, nothing else. |
| \`kind\` | \`"sit"\` \\| \`"sleep"\` \\| \`"luxury"\` | yes | — | How the seat is drawn — see the table below. Any other value: grey placeholder with "?", not selectable. |
| \`berth\` | \`"lower"\` \\| \`"middle"\` \\| \`"upper"\` | for \`sleep\` only | — | Berth bar: above the seat for \`upper\`, below for \`lower\`, none for \`middle\`. Required on every \`sleep\` seat — even \`middle\`, which draws nothing — and an error on any other kind. |
| \`facing\` | \`"left"\` \\| \`"right"\` \\| \`"top"\` \\| \`"bottom"\` | no, \`sit\` only | none | Seat-back bracket: a half-open outline on the side the back is against, at 50% opacity. Omitted → no bracket. |
| \`inclusive\` | boolean | no | \`false\` | Accessibility seat: drawn as an outline (white fill, navy border) instead of solid. Usually placed next to a \`handicapped\` facility. |

| \`kind\` | Drawn as | Typical span |
|---|---|---|
| \`sit\` | Solid seat block, optional seat-back bracket | 1 row |
| \`sleep\` | Solid seat block plus berth bar | 1 row |
| \`luxury\` | Solid seat block, no indicator | 2 rows — write \`"span": { "rows": 2 }\`; there is no implicit span |

Removed, do not write: \`class\` (fare class — that belongs to availability), \`byAisle\`, \`tags\`.

#### Typed item fields

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| \`type\` | string | yes | — | What the item is: \`table\`, \`half_table\`, \`separator\`, \`driver\`, or a facility (see **Facilities**). Missing or unknown → grey placeholder block. |
| \`facing\` | \`"top"\` \\| \`"bottom"\` | \`half_table\` only | \`"top"\` | Which half of the row the half-table occupies. |
| \`facing\` | \`"left"\` \\| \`"right"\` \\| \`"top"\` \\| \`"bottom"\` | \`chair\` only | \`"right"\` | Which way the stool faces — its back arc is on the opposite side, as with a seat. |

| \`type\` | Drawn as | Sizing |
|---|---|---|
| \`table\` | Plain light block, no icon | Resizable: \`span.rows\` 1–3, \`span.cols\` as needed |
| \`half_table\` | Light block of half a row's height, in the top or bottom half | Fixed: one row, no \`span\` |
| \`driver\` | Light block with a steering-wheel icon (stand-in until the real asset exists) | Fixed: exactly one cell; a \`span\` is ignored with a warning. No \`facing\` |
| \`chair\` | Free-standing bar stool — a round seat with a back arc, no block behind it | Fixed: exactly one cell, like \`driver\`; turned by \`facing\` |
| \`separator\` | Thin vertical line, slightly taller than the rows it covers; its column is narrow | \`span.rows\` = the rows it divides — it can stop short of the aisle |
| facility | Light block with the facility icon centred and scaled to fit | \`span.rows\` and \`span.cols\` as needed |

Removed, do not write: facility \`label\`; the old \`"table": true\` / \`"separator": true\` /
\`"facility": "wc"\` shapes — every typed item uses \`type\`.

## Seat kinds & states

Every seat kind, and every visual state a renderer draws. **States are not scheme fields** —
they come from what the app passes the renderer at runtime:

| Input | Meaning |
|---|---|
| \`mode: "view"\` | Read-only: every known seat drawn available, nothing tappable. For previews and admin. |
| \`mode: "select"\` | Interactive: only seats in \`available\` are available and tappable. |
| \`available\` | Seat numbers that can be booked (\`select\` only). |
| \`selected\` | Seat numbers the app has selected (\`select\` only). |
| \`onSeatClick(seat)\` | Called on a tap; the app updates \`selected\` and re-renders — the renderer never changes it. |

In \`select\` mode:

| State | Source | Drawn as |
|---|---|---|
| available | in \`available\` | Solid navy (inclusive: outline), tappable |
| unavailable | not in \`available\` | Grey, not tappable |
| selected | in \`available\` and \`selected\` | Selection colour, tappable (the app decides what a second tap means) |
| unknown kind | scheme | Grey placeholder with "?", never tappable — in either mode |

A seat in the availability payload that the scheme doesn't contain is ignored.

## Facilities

Every facility \`type\` with a known icon. An unrecognized \`type\` still renders — as a plain
block marked "?" — it just won't have artwork yet.

| \`type\` | Meaning | Usual size |
|---|---|---|
| \`toilet\` | Toilet | 2 rows |
| \`invalid_toilet\` | Accessible toilet | 2 rows |
| \`baggage\` | Luggage space | variable |
| \`bike\` | Bicycle space | variable |
| \`kid\` | Children's area | variable — icon is a stand-in |
| \`handicapped\` | Wheelchair marker inside a compartment with inclusive seats | matches the compartment |
| \`handicapped_wheelchair\` | Standalone wheelchair marker | variable |
| \`shield\` | Electrical cabinet warning | variable |
| \`steps_up\` / \`steps_down\` | Stairs to the other deck | variable |
| \`wardrobe\` | Wardrobe / coat hanger | variable |
| \`cafe\` | Buffet, bar or café area | variable |
| \`coffee_machine\` | Vending or coffee machine | variable |
| \`chair\` | Bar stool, see **Typed item fields** | one cell, always |
| \`driver\` | Bus driver's place | one cell, always — icon is a stand-in |

Names follow the Android sales app's drawables (spec D47). Renamed, do not write: \`wc\`,
\`wc_accessible\`, \`luggage\`, \`bicycle\`, \`inclusive\` (as a \`type\`), \`inclusive_marker\`,
\`electrical\`, \`stairs_up\`, \`stairs_down\` — they now render as the unknown-type placeholder.

## Validation

What the builder and both reference validators check. Errors make a scheme invalid;
warnings still render.

| Check | Level |
|---|---|
| No decks | error |
| Several decks and one has no \`level\`, or two share one | error |
| Unknown \`level\` value | warning |
| Unknown \`vehicle\` value | warning |
| \`span\` on a \`driver\` | warning (ignored) |
| \`span.cols\` on a seat, \`separator\` or \`half_table\` | warning (ignored) |
| Item runs past the deck's \`rows\`, or past its last column | error |
| Two items in one cell | error |
| Duplicate seat number within a deck | error |
| \`sleep\` seat without a valid \`berth\`, or \`berth\` on any other kind | error |
| Unknown \`kind\`, unknown or missing \`type\`, unknown \`facing\` | warning |

Deliberately not checked: seat counts, numbering patterns, anything derived from a seat
number.

## Design rationale & roadmap

The sections above cover how to *use* the format. The full design history — why the format
looks the way it does, the guardrails that keep it from regressing, and the renderer
roadmap — lives in \`docs/wagon-scheme-format.md\`. Worth reading in full before changing the
format itself.
`;
