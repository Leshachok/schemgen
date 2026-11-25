# web/tools

Scripts that regenerate the generated files under `web/js/`. None of these run
automatically — run them by hand after the thing they read from changes.

## figma_icons.py

Rewrites the generated icon blocks of `web/js/icons.js`, of the Compose renderer's
`render/Icons.kt` and of the Vue renderer's `render/Icons.ts` (between the
`<generated:icons>` markers) from one SVG per element, exported from the guidelines
file **"Wagon components"**, the source of truth for elements, colours and sizes
(D50 in `docs/wagon-scheme-format.md`).

```
/usr/bin/python3 web/tools/figma_icons.py path/to/exported-svgs/
```

Export the **Light** variant of each element as SVG and name the file after its
format `type` (`toilet.svg`, `baggage.svg`, `steps_up.svg`, …):

- **facility blocks** (toilet, baggage, bike, …, driver): export only the icon layer
  inside the block, not the background rectangle. The renderer draws the block itself
  and centres the icon at its exported size; icons are never scaled (D51).
- **steps and the wheelchair marker**: export the whole component. They are drawn
  without a block.
- **inclusive toilet** (`invalid_toilet`): two icons and a divider with no frame
  around them. Export the three layers as one 53×24 SVG.

The script swaps the guideline greys for `currentColor` so each theme can colour
icons (D34), strips Figma's no-op clip paths, and stops if an unexpected colour is
left. It also keeps a Figma export trap from coming back: Figma puts `fill="none"` on
the root `<svg>`, and outline-only paths inherit it. Inlining the paths drops that root,
so they fall back to SVG's default black fill and every icon turns into a dark shape.
The script wraps the icon in a `<g>` carrying the root's fill. Without edit rights on the guidelines file, the Figma MCP server can't read it
— duplicate it to your drafts and export from the copy.

## extract_schemes.py

Converts real wagon cards from a full Figma catalogue SVG export into candidate
scheme JSON, by clustering seat/facility rects into rows and columns. This is
the geometry-only path: it auto-numbers seats sequentially and reads every seat
as `kind: sit, facing: left`, because the flattened SVG export has no layer
names to recover real numbers or kinds from. 133 of ~135 real wagon cards
converted cleanly against the original catalogue export this was built against.

```
python3 extract_schemes.py uz_web__master_.svg auto_schemes.json
```

Getting real seat numbers and kinds needs the Figma REST API instead (keeps
layer names) — see the importer note in `docs/wagon-scheme-format.md`'s roadmap,
phase 7.

## figma_lattice.py

Not part of the regular regeneration flow — a one-off measurement tool used
during the format's design to answer "do seats actually align to a grid, or is
row/column layout the wrong model?" (Answer: yes, they align — see the decision
log.) Kept here in case a future wagon type needs the same question re-asked.
Pulls geometry from the Figma REST API (needs a `FIGMA_TOKEN`) rather than an
SVG export. Run with `--help` for usage.

## embed_docs.py

Embeds `docs/wagon-scheme-format.md` into `web/js/docs.js` as a string constant,
so the Docs tab can render it without a `fetch()` call (which Chrome blocks for
local files opened via `file://`, the whole point of not needing a server here).

```
python3 web/tools/embed_docs.py
```

Run this after editing `docs/wagon-scheme-format.md` — the Docs tab won't
reflect changes until you do.
