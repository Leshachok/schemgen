#!/usr/bin/env python3
"""
figma_lattice.py - measure the lattice unit of wagon seat schemes drawn in Figma.

Pulls node geometry from the Figma REST API, then searches for the largest grid
unit onto which every element (seats, WCs, tables, dividers) can be snapped
without moving more than a given tolerance.

Usage:
    export FIGMA_TOKEN=figd_...
    python3 figma_lattice.py --file YQjujuPkQCN5uAVT451l1N --node 3:59221
    python3 figma_lattice.py --file ... --node ... --seat-pattern '^\\d+$' --dump out.json

    # offline, on a JSON file you already saved:
    python3 figma_lattice.py --from-json saved_nodes.json
"""

import argparse
import json
import os
import re
import statistics
import sys
import urllib.request
from collections import Counter

API = "https://api.figma.com/v1"

# Node types that carry real geometry. GROUP/FRAME are kept because dividers and
# WC blocks are often groups; filter them out later if they turn out to be noise.
GEOMETRY_TYPES = {
    "RECTANGLE", "ELLIPSE", "VECTOR", "INSTANCE",
    "COMPONENT", "FRAME", "GROUP", "BOOLEAN_OPERATION",
}


def fetch(file_key, node_ids, token):
    url = "%s/files/%s/nodes?ids=%s" % (API, file_key, ",".join(node_ids))
    req = urllib.request.Request(url, headers={"X-Figma-Token": token})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def collect(node, out, depth=0, parent=""):
    """Flatten the tree into a list of boxed elements."""
    box = node.get("absoluteBoundingBox")
    ntype = node.get("type", "")
    name = node.get("name", "")
    # depth 0 is the wagon frame itself - its hull is not necessarily on the lattice
    if depth > 0 and box and ntype in GEOMETRY_TYPES and box.get("width") and box.get("height"):
        out.append({
            "name": name,
            "type": ntype,
            "parent": parent,
            "depth": depth,
            "x": float(box["x"]),
            "y": float(box["y"]),
            "w": float(box["width"]),
            "h": float(box["height"]),
        })
    for child in node.get("children") or []:
        collect(child, out, depth + 1, name)
    return out


def snap_error(value, unit):
    """How far `value` sits from the nearest multiple of `unit`."""
    return abs(value - round(value / unit) * unit)


def evaluate(elements, unit, origin_x, origin_y):
    """Worst and 95th-percentile snapping error for a candidate unit."""
    errors = []
    for e in elements:
        errors.append(max(
            snap_error(e["x"] - origin_x, unit),
            snap_error(e["y"] - origin_y, unit),
            snap_error(e["w"], unit),
            snap_error(e["h"], unit),
        ))
    errors.sort()
    p95 = errors[min(len(errors) - 1, int(len(errors) * 0.95))]
    return max(errors), p95, errors


def worst_offenders(elements, unit, origin_x, origin_y, limit=10):
    scored = []
    for e in elements:
        err = max(
            snap_error(e["x"] - origin_x, unit),
            snap_error(e["y"] - origin_y, unit),
            snap_error(e["w"], unit),
            snap_error(e["h"], unit),
        )
        scored.append((err, e))
    scored.sort(key=lambda p: -p[0])
    return scored[:limit]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="Figma file key")
    ap.add_argument("--node", action="append", default=[],
                    help="node id, colon form e.g. 3:59221 (repeatable)")
    ap.add_argument("--from-json", help="read a saved API response instead of fetching")
    ap.add_argument("--seat-pattern", default=r"^\s*\d+\s*$",
                    help="regex matched against node name to identify seats")
    ap.add_argument("--tolerance", type=float, default=1.0,
                    help="max acceptable snapping error, in Figma px")
    ap.add_argument("--min-unit", type=float, default=2.0)
    ap.add_argument("--max-unit", type=float, default=60.0)
    ap.add_argument("--step", type=float, default=0.5)
    ap.add_argument("--dump", help="write normalised elements to this JSON file")
    args = ap.parse_args()

    if args.from_json:
        with open(args.from_json) as fh:
            payload = json.load(fh)
    else:
        token = os.environ.get("FIGMA_TOKEN")
        if not (args.file and args.node and token):
            ap.error("need --file, --node and FIGMA_TOKEN (or --from-json)")
        payload = fetch(args.file, args.node, token)

    elements = []
    for node_id, wrapper in (payload.get("nodes") or {}).items():
        doc = wrapper.get("document")
        if doc:
            collect(doc, elements)
    if not elements:
        sys.exit("no boxed elements found - check the node id")

    origin_x = min(e["x"] for e in elements)
    origin_y = min(e["y"] for e in elements)

    seat_re = re.compile(args.seat_pattern)
    seats = [e for e in elements if seat_re.match(e["name"])]
    others = [e for e in elements if not seat_re.match(e["name"])]

    print("elements: %d total, %d matched --seat-pattern as seats"
          % (len(elements), len(seats)))
    print()

    print("-- node names by frequency (top 25) --")
    for name, n in Counter(e["name"] for e in elements).most_common(25):
        print("  %-32s %4d" % (name[:32], n))
    print()

    if seats:
        sizes = Counter((round(e["w"], 1), round(e["h"], 1)) for e in seats)
        print("-- seat sizes --")
        for (w, h), n in sizes.most_common(10):
            print("  %6.1f x %-6.1f  %4d" % (w, h, n))
        modal_w, modal_h = sizes.most_common(1)[0][0]
        print("  modal seat: %.1f x %.1f" % (modal_w, modal_h))
        print("  half:       %.2f x %.2f" % (modal_w / 2, modal_h / 2))
        print("  third:      %.2f x %.2f" % (modal_w / 3, modal_h / 3))
        print()

    print("-- non-seat element sizes (top 15) --")
    osizes = Counter((round(e["w"], 1), round(e["h"], 1)) for e in others)
    for (w, h), n in osizes.most_common(15):
        print("  %6.1f x %-6.1f  %4d" % (w, h, n))
    print()

    print("-- lattice search (tolerance %.2f px) --" % args.tolerance)
    print("  %8s %10s %10s" % ("unit", "max err", "p95 err"))
    best = None
    unit = args.min_unit
    while unit <= args.max_unit:
        mx, p95, _ = evaluate(elements, unit, origin_x, origin_y)
        if p95 <= args.tolerance:
            print("  %8.2f %10.3f %10.3f  <-- fits" % (unit, mx, p95))
            if best is None or unit > best[0]:
                best = (unit, mx, p95)
        unit += args.step

    print()
    if best:
        u, mx, p95 = best
        print("LARGEST UNIT THAT FITS: %.2f px  (max err %.3f, p95 %.3f)" % (u, mx, p95))
        if seats:
            print("  = %.2f seat widths, %.2f seat heights"
                  % (u / modal_w, u / modal_h))
        print()
        print("-- worst offenders at that unit --")
        for err, e in worst_offenders(elements, u, origin_x, origin_y):
            print("  %7.3f  %-24s %-10s  x=%.1f y=%.1f w=%.1f h=%.1f"
                  % (err, e["name"][:24], e["type"],
                     e["x"] - origin_x, e["y"] - origin_y, e["w"], e["h"]))
    else:
        print("NO UNIT FITS within tolerance - raise --tolerance or lower --min-unit")
        print("worst offenders at the smallest unit tried:")
        for err, e in worst_offenders(elements, args.min_unit, origin_x, origin_y):
            print("  %7.3f  %-24s x=%.1f y=%.1f w=%.1f h=%.1f"
                  % (err, e["name"][:24], e["x"] - origin_x, e["y"] - origin_y,
                     e["w"], e["h"]))

    if args.dump:
        u = best[0] if best else 1.0
        norm = [{
            "name": e["name"], "type": e["type"],
            "x": round((e["x"] - origin_x) / u),
            "y": round((e["y"] - origin_y) / u),
            "w": max(1, round(e["w"] / u)),
            "h": max(1, round(e["h"] / u)),
        } for e in elements]
        with open(args.dump, "w") as fh:
            json.dump({"unit_px": u, "elements": norm}, fh,
                      indent=2, ensure_ascii=False)
        print("\nwrote %d normalised elements to %s" % (len(norm), args.dump))


if __name__ == "__main__":
    main()
