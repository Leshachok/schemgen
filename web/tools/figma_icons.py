#!/usr/bin/env python3
"""
figma_icons.py - rewrite the generated ICONS block of web/js/icons.js from one SVG
per element, exported from the guidelines file "Wagon components" (D50).

    /usr/bin/python3 web/tools/figma_icons.py <dir-of-svgs>

Each file is <type>.svg (toilet.svg, steps_up.svg, ...), exported from the Light
variant: the icon layer of a facility block, or the whole component for the
elements drawn without a block (steps, the wheelchair marker). Icons are drawn at
their exported size and never scaled (D51), so the SVG's own width/height is kept.

The guideline greys are replaced with currentColor so the renderer's theme picks the
icon colour. #BBBCB7 is a near-duplicate grey on one path of the driver icon.
"""
import os
import re
import sys

GREYS = ("#B7BABC", "#D4D5D6", "#BBBCB7")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "js", "icons.js")
START, END = "/* <generated:icons> */", "/* </generated:icons> */"


def convert(path):
    src = open(path, encoding="utf-8").read()
    head = re.search(r"<svg\b[^>]*>", src).group(0)
    w = float(re.search(r'\bwidth="([\d.]+)"', head).group(1))
    h = float(re.search(r'\bheight="([\d.]+)"', head).group(1))
    body = src[src.index(head) + len(head):src.rindex("</svg>")]
    # Figma wraps some icons in a clip-path to their own 24x24 frame - a no-op here
    body = re.sub(r"<defs>.*?</defs>", "", body, flags=re.S)
    body = re.sub(r'\s*clip-path="[^"]*"', "", body)
    body = re.sub(r"<g>\s*(.*?)\s*</g>", r"\1", body, flags=re.S) if body.count("<g") == 1 and "<g>" in body else body
    for g in GREYS:
        body = body.replace('"%s"' % g, '"currentColor"')
    left = set(re.findall(r'#[0-9A-Fa-f]{6}', body))
    if left:
        sys.exit("%s: unexpected colours %s - add them to GREYS or fix the export" % (path, sorted(left)))
    body = " ".join(line.strip() for line in body.splitlines() if line.strip())
    # Figma puts fill="none" on the root <svg> and outline-only paths inherit it; with the
    # root stripped they'd fall back to SVG's default black fill, so keep it on a wrapper
    root_fill = re.search(r'\bfill="([^"]*)"', head)
    if root_fill:
        body = '<g fill="%s">%s</g>' % (root_fill.group(1), body)
    num = lambda v: ("%g" % v)
    return "ICONS.%s = { w:%s, h:%s, svg:'%s' };" % (
        os.path.splitext(os.path.basename(path))[0], num(w), num(h), body.replace("'", "\\'"))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    d = sys.argv[1]
    lines = [convert(os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.endswith(".svg")]
    js = open(TARGET, encoding="utf-8").read()
    a, b = js.index(START) + len(START), js.index(END)
    js = js[:a] + "\n" + "\n".join(lines) + "\n" + js[b:]
    open(TARGET, "w", encoding="utf-8").write(js)
    print("wrote %d icons into %s" % (len(lines), os.path.relpath(TARGET, os.getcwd())))


if __name__ == "__main__":
    main()
