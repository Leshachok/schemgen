# Wagon Scheme Format — Developer Guide

A wagon scheme is a single JSON document describing the seat layout of one
train wagon: which decks it has, how many rows each deck has, and what sits
in each column at each row — a seat, a table, a wall-mounted facility, or
nothing at all.

This page is the practical "how it works, how to use it" reference. The
full design history — why the format looks the way it does — is folded up
at the bottom under **Design rationale & roadmap**.

## Quick start

```
{
  "key": "KUP-34",
  "rev": 1,
  "class": "kupe",
  "hull": "plain",
  "decks": [
    {
      "id": "main",
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

A column is a vertical slot in the wagon; the items inside it are placed by
`row`. A row nothing occupies is just empty space — there's no `aisle`
field anywhere in the format.

## JSON structure

### Scheme (top level)

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | Unique scheme identifier, e.g. `"KUP-34"`. |
| `rev` | integer | yes | Revision number — bump on every content change. |
| `class` | string | yes | Wagon class label (`"kupe"`, `"platskart"`, ...). Free text, not validated against a fixed list. |
| `hull` | string | no | `"plain"` for square-ish corners; anything else gives a more rounded hull silhouette. |
| `decks` | array of Deck | yes | One entry per physical deck/level of the wagon. |

### Deck

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Deck identifier, unique within the scheme. |
| `rows` | integer | yes | Number of rows in this deck's grid. |
| `columns` | array of Column | yes | Left-to-right order matters — it's the render order. |

### Column

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | array of Item | no | Omit or leave empty for a blank column (a gap). |

### Item

Every item has a `row` (1-based) and an optional `span` (`{ "rows": n, "cols": n }`,
both default to `1`). Beyond that, an item is **either a seat or something
structural** — the two shapes are told apart by field presence, not a
discriminator field:

- If the item has a `seat` key, it's a seat (see **Seat kinds & states** below).
- Otherwise its `type` field says what it is (see **Facilities** below).

#### Seat fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `seat` | string | yes | The seat's identifier — an **opaque label**, not a number to compute from. Never derive sorting, berth inference, or validation from its contents. |
| `kind` | string | yes | `"sit"`, `"sleep"`, or `"luxury"`. Anything else renders as an inert placeholder rather than crashing. |
| `berth` | string | only for `kind:"sleep"` | `"lower"`, `"middle"`, or `"upper"`. |
| `facing` | string | only for `kind:"sit"` | `"left"`, `"right"`, `"top"`, or `"bottom"` — which way the seat-back bracket points. |
| `inclusive` | boolean | no | Marks an accessibility-designated seat; renders with an outline instead of a solid fill. |

#### Structural fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string or null | no | `"table"`, `"half_table"`, `"separator"`, or a facility type (see **Facilities** below). `null`/unknown renders as an inert placeholder — never a crash. |
| `facing` | string | only for `half_table` | `"top"` or `"bottom"` — which half of the row it occupies. |

## Seat kinds & states

Every seat kind and visual state the renderer knows about. `luxury` seats
default to a 2-row span; `sit`/`sleep` default to 1 row.

## Facilities

Every non-seat facility `type` with a known icon. An unrecognized `type`
still renders — as a plain block with its raw type name as a fallback label
— it just won't have artwork yet.

## Design rationale & roadmap

The sections above cover how to *use* the format. The full design history —
why the format looks the way it does, the guardrails that keep it from
regressing, and the native-renderer roadmap — lives in
`docs/wagon-scheme-format.md`. Worth reading in full before changing the
format itself.
