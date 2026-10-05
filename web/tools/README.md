# web/tools

Scripts that regenerate the generated files under `web/js/`. None of these run
automatically — run them by hand after the thing they read from changes.

## extract_icons.py

Turns individual facility SVGs (exported one-per-icon from Figma) into the
`ICONS` data `web/js/icons.js` needs — inline SVG markup plus a computed content
bounding box, so the renderer can crop each icon to its actual glyph before
scaling. (Without this, icons on large mostly-empty artboards render at a
fraction of their usable size — this was a real bug, see
`docs/wagon-scheme-format.md`'s decision log.)

Also fixes a real Figma export gotcha: Figma puts `fill="none"` on the root
`<svg>`, and stroke-only child paths inherit it. Stripping the root to inline
the paths drops that inheritance, so every shape without its own explicit
`fill=` gets one added — otherwise it renders solid black.

```
python3 extract_icons.py toilet=WC.svg baggage=Baggage.svg invalid_toilet=Toilet.svg
```

Writes `icons.json` next to the script. You then need to fold that into
`web/js/icons.js`'s `ICONS.<name> = {...}` assignments by hand for now — there's
no automated injection step yet (worth adding if icons churn often).

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
