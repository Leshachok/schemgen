#!/usr/bin/env python3
"""
extract_icons.py - turn individual Figma-exported facility SVGs into the ICONS
data web/js/icons.js expects: inline SVG markup plus a computed content bounding
box, so the renderer can crop each icon to its actual glyph before scaling
(otherwise icons on large mostly-empty artboards render tiny inside their block
- this was a real bug, see docs/wagon-scheme-format.md's history).

Also fixes a real Figma export gotcha: Figma puts fill="none" on the root
<svg>, and stroke-only child paths inherit it. Stripping the root to inline
the paths drops that inheritance, so every path/circle/rect/ellipse without
its own explicit fill= gets one added here - otherwise they render solid
black.

Usage:
    python3 extract_icons.py wc=WC.svg luggage=Baggage.svg wc_accessible=Toilet.svg
    -> writes icons.json next to this script

Then regenerate web/js/icons.js's ICONS block from icons.json (see
tools/README.md for the exact substitution, or adapt inject step below).
"""
import re
import sys
import json

NUM = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')
CMD = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)')
ARGC = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7, 'Z': 0}


def path_points(d):
    pts, cx, cy, sx, sy = [], 0.0, 0.0, 0.0, 0.0
    for cmd, rest in CMD.findall(d):
        up, rel = cmd.upper(), cmd.islower()
        nums = [float(n) for n in NUM.findall(rest)]
        n = ARGC[up]
        if n == 0:
            cx, cy = sx, sy
            pts.append((cx, cy))
            continue
        for i in range(0, len(nums) - n + 1, n):
            a = nums[i:i + n]
            if up == 'H':
                cx = cx + a[0] if rel else a[0]
            elif up == 'V':
                cy = cy + a[0] if rel else a[0]
            elif up == 'A':
                cx = cx + a[5] if rel else a[5]
                cy = cy + a[6] if rel else a[6]
            else:
                for j in range(0, n, 2):
                    pts.append((cx + a[j] if rel else a[j], cy + a[j + 1] if rel else a[j + 1]))
                cx = cx + a[n - 2] if rel else a[n - 2]
                cy = cy + a[n - 1] if rel else a[n - 1]
            pts.append((cx, cy))
            if up == 'M':
                sx, sy = cx, cy
    return pts


def extract_one(path):
    s = open(path, encoding='utf-8').read()
    vb = re.search(r'<svg[^>]*viewBox="([^"]+)"', s).group(1)
    w, h = (float(x) for x in vb.split()[2:4])

    inner = re.sub(r'^.*?<svg[^>]*>', '', s, flags=re.S)
    inner = re.sub(r'</svg>\s*$', '', inner, flags=re.S)
    inner = re.sub(r'<defs>.*?</defs>', '', inner, flags=re.S)
    inner = re.sub(r'\s*clip-path="url\(#[^)]*\)"', '', inner)
    # drop the plain full-size background rect Figma sometimes exports
    inner = re.sub(r'<rect width="%g" height="%g"[^>]*/>' % (w, h), '', inner, count=1)

    def fix_fill(m):
        tag, attrs, close = m.group(1), m.group(2), m.group(3)
        if 'fill=' in attrs:
            return m.group(0)
        return '<%s%s fill="none"%s>' % (tag, attrs.rstrip(), close)
    inner = re.sub(r'<(path|circle|rect|ellipse)\b(.*?)(\s*/)>', fix_fill, inner, flags=re.S)
    inner = re.sub(r'\s+', ' ', inner).strip()

    pts = []
    for d in re.findall(r'\sd="([^"]+)"', inner):
        pts += path_points(d)
    for m in re.finditer(r'<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"', inner):
        x, y, r = (float(g) for g in m.groups())
        pts += [(x - r, y - r), (x + r, y + r)]

    if pts:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        pad = 3
        bx = max(0, min(xs) - pad)
        by = max(0, min(ys) - pad)
        box = [round(bx, 1), round(by, 1),
               round(min(w, max(xs) + pad) - bx, 1), round(min(h, max(ys) + pad) - by, 1)]
    else:
        box = [0, 0, w, h]

    return {'w': w, 'h': h, 'box': box, 'svg': inner}


def main():
    if not sys.argv[1:]:
        print(__doc__)
        sys.exit(1)
    out = {}
    for pair in sys.argv[1:]:
        name, path = pair.split('=', 1)
        out[name] = extract_one(path)
        print('%-20s box=%s' % (name, out[name]['box']))
    json.dump(out, open('icons.json', 'w'), ensure_ascii=False, indent=2)
    print('\nwrote icons.json with', len(out), 'icons')


if __name__ == '__main__':
    main()
