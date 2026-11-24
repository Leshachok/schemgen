#!/usr/bin/env python3
"""
figma_icons.py - rewrite the generated icon blocks of web/js/icons.js and of the Compose
renderer's Icons.kt from one SVG per element, exported from the guidelines file
"Wagon components" (D50). Both renderers get the same art from the same files.

    /usr/bin/python3 web/tools/figma_icons.py <dir-of-svgs>

Each file is <type>.svg (toilet.svg, steps_up.svg, ...), exported from the Light
variant: the icon layer of a facility block, or the whole component for the
elements drawn without a block (steps, the wheelchair marker). Icons are drawn at
their exported size and never scaled (D51), so the SVG's own width/height is kept.

The guideline greys are replaced with currentColor (web) or a paint flag (Kotlin) so
the renderer's theme picks the icon colour. #BBBCB7 is a near-duplicate grey on one
path of the driver icon.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

GREYS = ("#B7BABC", "#D4D5D6", "#BBBCB7")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "js", "icons.js")
START, END = "/* <generated:icons> */", "/* </generated:icons> */"
KT_TARGET = os.path.join(os.path.dirname(ROOT), "compose-renderer", "schemgen-renderer-compose", "src",
                         "commonMain", "kotlin", "ua", "gov", "uz", "schemgen", "render", "Icons.kt")
KT_START, KT_END = "// <generated:icons>", "// </generated:icons>"
SVG_NS = "{http://www.w3.org/2000/svg}"


def num(v):
    return "%g" % v


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
    return "ICONS.%s = { w:%s, h:%s, svg:'%s' };" % (
        os.path.splitext(os.path.basename(path))[0], num(w), num(h), body.replace("'", "\\'"))


def rect_path(x, y, w, h, rx):
    if rx <= 0:
        return "M%s %sH%sV%sH%sZ" % (num(x), num(y), num(x + w), num(y + h), num(x))
    rx = min(rx, w / 2, h / 2)
    a = "A%s %s 0 0 1 " % (num(rx), num(rx))
    return ("M%s %sH%s" % (num(x + rx), num(y), num(x + w - rx)) + a + "%s %s" % (num(x + w), num(y + rx))
            + "V%s" % num(y + h - rx) + a + "%s %s" % (num(x + w - rx), num(y + h))
            + "H%s" % num(x + rx) + a + "%s %s" % (num(x), num(y + h - rx))
            + "V%s" % num(y + rx) + a + "%s %sZ" % (num(x + rx), num(y)))


def kotlin_icon(path):
    """One `"type" to Icon(...)` entry. Compose has no SVG parser in commonMain, and SVG
    resources can't be drawn on Android (KB ADR-0020), so every shape becomes path data
    plus its paint flags; the colour comes from the theme at draw time."""
    root = ET.parse(path).getroot()
    out = []

    def walk(el, fill, tx, ty):
        tag = el.tag.replace(SVG_NS, "")
        if tag == "defs":
            return
        m = re.match(r"translate\(([-\d.]+)[ ,]*([-\d.]*)\)", el.get("transform", ""))
        if m:
            tx, ty = tx + float(m.group(1)), ty + float(m.group(2) or 0)
        fill = el.get("fill", fill)
        if tag in ("path", "rect", "circle"):
            if tag == "path":
                d = el.get("d")
            elif tag == "rect":
                d = rect_path(float(el.get("x", 0)), float(el.get("y", 0)), float(el.get("width")),
                              float(el.get("height")), float(el.get("rx", 0)))
            else:
                cx, cy, r = (float(el.get(k)) for k in ("cx", "cy", "r"))
                d = "M%s %sa%s %s 0 1 0 %s 0a%s %s 0 1 0 %s 0Z" % (
                    num(cx - r), num(cy), num(r), num(r), num(2 * r), num(r), num(r), num(-2 * r))
            args = ['"%s"' % d]
            if fill not in (None, "none"):
                args.append("fill = true")
            if el.get("stroke") not in (None, "none"):
                args.append("stroke = %sf" % num(float(el.get("stroke-width", 1))))
                if el.get("stroke-linecap") == "round":
                    args.append("roundCap = true")
                if el.get("stroke-linejoin") == "round":
                    args.append("roundJoin = true")
            if el.get("fill-rule") == "evenodd":
                args.append("evenOdd = true")
            if tx or ty:
                args.append("tx = %sf, ty = %sf" % (num(tx), num(ty)))
            out.append("        IconPath(%s)" % ", ".join(args))
        for child in el:
            walk(child, fill, tx, ty)

    walk(root, None, 0.0, 0.0)
    name = os.path.splitext(os.path.basename(path))[0]
    return '    "%s" to Icon(%sf, %sf, listOf(\n%s\n    ))' % (
        name, num(float(root.get("width"))), num(float(root.get("height"))), ",\n".join(out))


def replace_block(target, start, end, body):
    text = open(target, encoding="utf-8").read()
    a, b = text.index(start) + len(start), text.index(end)
    open(target, "w", encoding="utf-8").write(text[:a] + body + text[b:])
    print("wrote %s" % os.path.relpath(target, os.getcwd()))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    d = sys.argv[1]
    files = [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(".svg")]
    replace_block(TARGET, START, END, "\n" + "\n".join(convert(f) for f in files) + "\n")
    replace_block(KT_TARGET, KT_START, KT_END,
                  "\ninternal val ICONS: Map<String, Icon> = mapOf(\n" + ",\n".join(kotlin_icon(f) for f in files) + "\n)\n")
    print("%d icons" % len(files))


if __name__ == "__main__":
    main()
