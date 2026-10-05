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
        { "items": [ { "type": "wc", "row": 1, "span": { "rows": 2 } } ] },
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
  scheme renders on every platform.
- **Seat numbers are opaque strings.** Nothing — sorting, berth, validation — may be derived
  from one.
- **Unknown values never crash.** An unknown `kind` or `type` renders as an inert grey
  placeholder, so a new item type can ship before every app understands it.
- **Unknown fields are ignored.** Renderers skip fields they don't know.

## JSON structure

### Scheme (top level)

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `vehicle` | `"train"` \| `"bus"` | no | `"train"` | Names the vehicle in the accessibility label ("Bus BUS-53"). Nothing else is drawn differently — a bus is the same grid of seats and items. An unknown value warns and is treated as `train`. |
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
| `items` | array of Item | no | `[]` | What sits in this column. An empty column draws as a narrow gap — there is no separate gap marker. A column is as wide as its widest item. |

A column has no other fields — no `type`, no flags.

### Item — common fields

Every item has a position. Beyond that, an item is **either a seat or a typed item**, told
apart by field presence, not by a discriminator:

- it has a `seat` field → it's a seat (see **Seat fields**);
- otherwise its `type` says what it is (see **Typed item fields**).

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `row` | integer ≥ 1 | yes | `1` | Top row the item occupies. |
| `span.rows` | integer ≥ 1 | no | `1` | How many rows the item covers, downward from `row`. A WC two rows tall is `"span": { "rows": 2 }`. |

Every item is exactly one column wide; there is no `span.cols` (spec D41). Two items may not
share a cell, and `row + span.rows − 1` may not exceed the deck's `rows`.

#### Seat fields

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `seat` | string | yes | — | The label drawn on the seat and the id the availability payload and the selection use. **Opaque** — unique within a deck, nothing else. |
| `kind` | `"sit"` \| `"sleep"` \| `"luxury"` | yes | — | How the seat is drawn — see the table below. Any other value: grey placeholder with "?", not selectable. |
| `berth` | `"lower"` \| `"middle"` \| `"upper"` | for `sleep` only | — | Berth bar: above the seat for `upper`, below for `lower`, none for `middle`. Required on every `sleep` seat — even `middle`, which draws nothing — and an error on any other kind. |
| `facing` | `"left"` \| `"right"` \| `"top"` \| `"bottom"` | no, `sit` only | none | Seat-back bracket: a half-open outline on the side the back is against, at 50% opacity. Omitted → no bracket. |
| `inclusive` | boolean | no | `false` | Accessibility seat: drawn as an outline (white fill, navy border) instead of solid. Usually placed next to an `inclusive` facility. |

| `kind` | Drawn as | Typical span |
|---|---|---|
| `sit` | Solid seat block, optional seat-back bracket | 1 row |
| `sleep` | Solid seat block plus berth bar | 1 row |
| `luxury` | Solid seat block, no indicator | 2 rows — write `"span": { "rows": 2 }`; there is no implicit span |

Removed, do not write: `class` (fare class — that belongs to availability), `byAisle`, `tags`.

#### Typed item fields

| Field | Type | Required | Default | What it changes |
|---|---|---|---|---|
| `type` | string | yes | — | What the item is: `table`, `half_table`, `separator`, `driver`, or a facility (see **Facilities**). Missing or unknown → grey placeholder block. |
| `facing` | `"top"` \| `"bottom"` | `half_table` only | `"top"` | Which half of the row the half-table occupies. |

| `type` | Drawn as | Sizing |
|---|---|---|
| `table` | Plain light block, no icon | Resizable: `span.rows` 1–3 |
| `half_table` | Light block of half a row's height, in the top or bottom half | Fixed: one row, no `span` |
| `driver` | Light block with a steering-wheel icon (stand-in until the real asset exists) | Fixed: exactly one cell; a `span` is ignored with a warning. No `facing` |
| `separator` | Thin vertical line, slightly taller than the rows it covers; its column is narrow | `span.rows` = the rows it divides — it can stop short of the aisle |
| facility | Light block with the facility icon centred and scaled to fit | `span.rows` as needed |

Removed, do not write: facility `label`; the old `"table": true` / `"separator": true` /
`"facility": "wc"` shapes — every typed item uses `type`.

## Seat kinds & states

Every seat kind, and every visual state a renderer draws. **States are not scheme fields** —
they come from the availability payload and the user's selection:

| State | Source | Drawn as |
|---|---|---|
| available | availability payload | Solid navy, selectable |
| unavailable | availability payload, or seat missing from it | Grey, not selectable |
| selected | user's tap | Selection colour |
| unknown kind | scheme | Grey placeholder with "?", never selectable |

A seat in the availability payload that the scheme doesn't contain is ignored.

## Facilities

Every facility `type` with a known icon. An unrecognized `type` still renders — as a plain
block marked "?" — it just won't have artwork yet.

| `type` | Meaning | Usual size |
|---|---|---|
| `wc` | Toilet | 2 rows |
| `wc_accessible` | Accessible toilet | 2 rows |
| `luggage` | Luggage space | variable |
| `bicycle` | Bicycle space | variable |
| `kid` | Children's area | variable — icon is a stand-in |
| `inclusive` | Wheelchair marker inside a compartment with inclusive seats | matches the compartment |
| `inclusive_marker` | Standalone wheelchair marker | variable |
| `electrical` | Electrical cabinet warning | variable |
| `stairs_up` / `stairs_down` | Stairs to the other deck | variable — icons are stand-ins |
| `driver` | Bus driver's place | one cell, always — icon is a stand-in |

## Validation

What the builder and both reference validators check. Errors make a scheme invalid;
warnings still render.

| Check | Level |
|---|---|
| No decks | error |
| Several decks and one has no `level`, or two share one | error |
| Unknown `level` value | warning |
| Unknown `vehicle` value | warning |
| `span` on a `driver` | warning (ignored) |
| Item runs past the deck's `rows` | error |
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
