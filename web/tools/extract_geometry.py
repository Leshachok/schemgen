"""Extract wagon-card geometry (seats + facility blocks) from a Figma SVG export.
Usage: python3 extract_geometry.py <path-to-export.svg>
"""
import re, json, collections, sys

SVG_PATH = sys.argv[1] if len(sys.argv) > 1 else "Wagons.svg"
src = open(SVG_PATH, encoding="utf-8").read()

tok = re.compile(r'<(/?)(g|rect|svg)\b([^>]*)>', re.S)
attr = re.compile(r'([a-zA-Z:_-]+)="([^"]*)"')

rects, stack, gcount = [], [], 0
for m in tok.finditer(src):
    closing, tag, body = m.group(1), m.group(2), m.group(3)
    if tag == 'g':
        if closing: stack.pop() if stack else None
        else:
            stack.append(gcount); gcount += 1
    elif tag == 'rect' and not closing:
        a = dict(attr.findall(body))
        try:
            r = dict(g=stack[-1] if stack else -1,
                     x=float(a.get('x',0)), y=float(a.get('y',0)),
                     w=float(a['width']), h=float(a['height']),
                     rx=a.get('rx'), fill=a.get('fill',''),
                     tr=a.get('transform'))
        except (KeyError, ValueError):
            continue
        rects.append(r)

print('rects parsed:', len(rects), ' groups:', gcount)
print('with transform:', sum(1 for r in rects if r['tr']))
print()
print('transform samples:', collections.Counter(
    re.sub(r'[-0-9.]+','N', r['tr']) for r in rects if r['tr']).most_common(5))
print()
seats = [r for r in rects if (r['w'], r['h']) == (32.0, 32.0)]
print('32x32 seats:', len(seats), 'across', len(set(r['g'] for r in seats)), 'groups')
print('seat fills:', collections.Counter(r['fill'] for r in seats).most_common(6))
print('seat rx:', collections.Counter(r['rx'] for r in seats).most_common(6))
json.dump(rects, open('rects.json','w'))
