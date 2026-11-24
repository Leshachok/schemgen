# Seat Scheme Format — Field Reference

A seat scheme is one JSON document describing the seat layout of one vehicle — a train
wagon or a bus (`"vehicle": "bus"`, see `shared-fixtures/bus.json`): which decks it has, how many rows each deck has, and what sits in each
column at each row — a seat, a table, a facility, or nothing at all.

This page is the field-by-field reference: every field, the values it takes, its default,
and what it changes on the rendered scheme. The design history — *why* the format looks
the way it does — is folded up at the bottom under **Design rationale & roadmap**.

## Quick start

```
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
```

A column is a vertical slot in the vehicle; the items inside it are placed by `row`. A row
nothing occupies is just empty space — that is how an aisle is drawn. There is no aisle
field anywhere in the format.

## Ground rules

- **The scheme is layout only.** Whether a seat is free, taken or selected comes from the
  availability payload at runtime, never from this file.
- **No pixel values.** Seat size, row pitch and gaps belong to each renderer; the same
  scheme renders on every platform. Colours, element art and minimum sizes come from the
  guidelines file "Wagon components" (spec D50).
- **Seat numbers are opaque strings.** Nothing — sorting, berth, validation — may be derived
  from one.
- **Unknown values never crash.** An unknown `kind` or `type` renders as an inert grey
  placeholder, so a new item type can ship before every app understands it.
- **Unknown fields are ignored.** Renderers skip fields they don't know.

## JSON structure

### Scheme (top level)

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `vehicle` | `"train"` \| `"bus"` | no | `"train"` | **Nothing visible.** Says what the file describes; the only rendered effect is the accessibility label ("Bus BUS-53" vs "Wagon BUS-53"). A bus is drawn by exactly the same rules as a wagon — its driver's place is the `driver` item, not this field. An unknown value warns and is treated as `train`. |
| `key` | string | yes | — | Nothing visible. Identifies the vehicle type, e.g. `"KUP-34"`. Renderers may use it in an accessibility label but must not depend on it. |
| `rev` | integer | yes | — | Nothing visible. Revision of this scheme; a published revision is never edited, a change publishes a new `rev`. |
| `decks` | array of Deck | yes | — | One drawing per deck, stacked in array order. An empty or missing array is an error. |

Removed, do not write: `class`, `hull`, `artwork` (spec D38).

### Deck

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `level` | `"lower"` \| `"upper"` | only when there are several decks | none | Names the deck for the passenger and in the accessibility label ("lower deck"). With one deck, omit it — or set it when the scheme shows one level of a double-deck vehicle (the Škoda wagons are two schemes, one per level). With several decks every deck needs one, and no two decks may share it. |
| `rows` | integer ≥ 1 | yes | `1` | Height of the grid. Every row has the same height; an unoccupied row draws as empty space (the aisle). Items may not extend past it. |
| `columns` | array of Column | yes | `[]` | Left-to-right order of the grid. Position in the array *is* the column index — inserting a column needs no renumbering. |

Removed, do not write: `id` — replaced by `level` (spec D39).

### Column

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `items` | array of Item | no | `[]` | What sits in this column. An empty column draws as a narrow gap — there is no separate gap marker. A column is as wide as its widest item: a seat column is narrower than one holding a facility block. |

A column has no other fields — no `type`, no flags.

### Item — common fields

Every item has a position. Beyond that, an item is **either a seat or a typed item**, told
apart by field presence, not by a discriminator:

- it has a `seat` field → it's a seat (see **Seat fields**);
- otherwise its `type` says what it is (see **Typed item fields**).

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `row` | integer ≥ 1 | yes | `1` | Top row the item occupies. |
| `span.rows` | integer ≥ 1 | no | `1` | How many rows the item covers, downward from `row`. A WC two rows tall is `"span": { "rows": 2 }`. Facility blocks are at least 2 rows (spec D51); see **Facilities**. |
| `span.cols` | integer ≥ 1 | no | `1` | Non-seat items only (spec D48). How many columns the item covers, rightward from its own. A baggage bay two seats long is `"span": { "rows": 2, "cols": 2 }` in one column, with the next column left empty. Ignored with a warning on seats and `separator`. |

Two items may not share a cell — a wide item's covered cells count — `row + span.rows − 1` may
not exceed the deck's `rows`, and a wide item may not run past the last column. A column
holding nothing but cells covered by a wide item is drawn seat-wide, not as a gap. Example:
`shared-fixtures/wide.json` (sample "Wide items").

#### Seat fields

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `seat` | string | yes | — | The label drawn on the seat and the id the availability payload and the selection use. **Opaque** — unique within a deck, nothing else. |
| `kind` | `"sit"` \| `"folding"` \| `"sleep"` \| `"luxury"` | yes | — | How the seat is drawn — see the table below. Any other value: grey placeholder with "?", not selectable. |
| `berth` | `"lower"` \| `"middle"` \| `"upper"` | for `sleep` only | — | Berth bar: above the seat for `upper`, below for `lower`, none for `middle`. Required on every `sleep` seat — even `middle`, which draws nothing — and an error on any other kind. |
| `facing` | `"left"` \| `"right"` \| `"top"` \| `"bottom"` | no, `sit` and `folding` only | none | Seat-back bracket: a half-open outline in the seat's colour at 50% opacity, on the side the back is against. Omitted → no bracket. |

| `kind` | Drawn as | Typical span |
|---|---|---|
| `sit` | Solid seat block, optional seat-back bracket | 1 row |
| `folding` | Folding seat: outlined block (white inside, border and number in the state colour), optional seat-back bracket | 1 row |
| `sleep` | Solid seat block plus berth bar | 1 row |
| `luxury` | Solid seat block, no indicator | 2 rows — write `"span": { "rows": 2 }`; there is no implicit span |

Removed, do not write: `class` (fare class — that belongs to availability), `byAisle`, `tags`,
`inclusive` (spec D52). A seat is never accessible as such: an accessible area is ordinary
seats next to a `handicapped` block or a `handicapped_wheelchair` marker. The outlined seat
that used to be `inclusive` is a folding seat, `kind: "folding"`.

#### Typed item fields

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `type` | string | yes | — | What the item is: `table`, `small_table`, `separator`, or a facility (see **Facilities**). Missing or unknown → grey placeholder block. |
| `facing` | `"top"` \| `"bottom"` | `small_table` only | `"top"` | Which half of its rows the small table occupies. |

| `type` | Drawn as | Sizing |
|---|---|---|
| `table` | Light block with a thin outline, no icon | Resizable in rows and columns; at least 1 row |
| `small_table` | The same block at half the height of its rows, in their top or bottom half | Resizable in rows and columns; at least 1 row |
| `separator` | Thin vertical line, slightly taller than the rows it covers; its column is narrow | `span.rows` = the rows it divides — it can stop short of the aisle. Never wide: it grows in length only |
| facility | Light block with the facility icon centred at its own size — icons never scale (spec D51) | At least the facility's minimum (see **Facilities**); `span.rows` and `span.cols` as needed |

Removed, do not write: facility `label`; the old `"table": true` / `"separator": true` /
`"facility": "wc"` shapes — every typed item uses `type`; `half_table` (now `small_table`) and
`chair` (spec D50) — both render as the unknown-type placeholder.

## Seat kinds & states

Every seat kind, and every visual state a renderer draws. **States are not scheme fields** —
they come from what the app passes the renderer at runtime:

| Input | Meaning |
|---|---|
| `mode: "view"` | Read-only: every known seat drawn available, nothing tappable. For previews and admin. |
| `mode: "select"` | Interactive: only seats in `available` are available and tappable. |
| `available` | Seat numbers that can be booked (`select` only). |
| `selected` | Seat numbers the app has selected (`select` only). |
| `onSeatClick(seat)` | Called on a tap; the app updates `selected` and re-renders — the renderer never changes it. |

In `select` mode:

| State | Source | Drawn as |
|---|---|---|
| available | in `available` | Solid blue (folding: blue outline), tappable |
| unavailable | not in `available` | Grey, not tappable |
| selected | in `available` and `selected` | Orange, tappable (the app decides what a second tap means) |
| unknown kind | scheme | Grey placeholder with "?", never tappable — in either mode |

A seat in the availability payload that the scheme doesn't contain is ignored.

The colours are the guidelines' Light and Dark palettes (spec D50). A consuming app passes
its own colours as the theme (spec D34); sizes are not themeable.

## Facilities

Every facility `type`, with the minimum size from the guidelines (spec D51). Any facility
can be made larger in rows and columns; the icon stays the same size, centred. An
unrecognized `type` still renders — as a plain block marked "?".

| `type` | Meaning | Minimum |
|---|---|---|
| `toilet` | Toilet | 2 rows |
| `invalid_toilet` | Accessible toilet — two icons side by side | 2 rows; its column is a little wider |
| `baggage` | Luggage space | 2 rows |
| `bike` | Bicycle space | 2 rows |
| `kid` | Children's area | 2 rows |
| `handicapped` | Accessible area block | 2 rows |
| `handicapped_wheelchair` | Standalone wheelchair marker, drawn without a block | 1 row |
| `shield` | Electrical cabinet warning | 2 rows |
| `steps_up` / `steps_down` | Stairs to the other deck, drawn without a block | 1 row |
| `wardrobe` | Wardrobe / coat hanger | 2 rows |
| `cafe` | Buffet, bar or café area | 2 rows |
| `coffee_machine` | Vending or coffee machine | 2 rows |
| `driver` | Bus driver's place | 1 row |

A facility block on the deck's first or last row reaches a little past it, into the deck's
edge. Its size depends only on its own rows, so blocks on the same rows always line up.

The list and the art follow the guidelines file "Wagon components" (spec D50); names follow
the Android sales app's drawables (spec D47). Renamed or removed, do not write: `wc`,
`wc_accessible`, `luggage`, `bicycle`, `inclusive` (as a `type`), `inclusive_marker`,
`electrical`, `stairs_up`, `stairs_down`, `chair` — they render as the unknown-type
placeholder.

## Validation

What the builder and both reference validators check. Errors make a scheme invalid;
warnings still render.

| Check | Level |
|---|---|
| No decks | error |
| Several decks and one has no `level`, or two share one | error |
| Unknown `level` value | warning |
| Unknown `vehicle` value | warning |
| `span.cols` on a seat or `separator` | warning (ignored) |
| Facility shorter than its minimum rows | warning |
| `small_table` with a `facing` other than `top` / `bottom` | warning |
| Item runs past the deck's `rows`, or past its last column | error |
| Two items in one cell | error |
| Duplicate seat number within a deck | error |
| `sleep` seat without a valid `berth`, or `berth` on any other kind | error |
| Unknown `kind`, unknown or missing `type`, unknown `facing` | warning |

Deliberately not checked: seat counts, numbering patterns, anything derived from a seat
number.

## Design rationale & roadmap

The sections above cover how to *use* the format. The full design history — why the format
looks the way it does, the guardrails that keep it from regressing, and the renderer
roadmap — lives in `docs/wagon-scheme-format.md`. Worth reading in full before changing the
format itself.
