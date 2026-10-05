"""Convert real wagon cards from a Figma SVG export into candidate scheme JSON.
Auto-numbers seats sequentially and reads them as `kind: sit, facing: left` -
this is geometry-only; real seat numbers/kinds need the Figma REST API (which
keeps layer names) rather than the flattened SVG export. See tools/README.md.

Usage: python3 extract_schemes.py <path-to-export.svg> [output.json]
"""
import re, json, collections, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "uz_web__master_.svg"
OUT = sys.argv[2] if len(sys.argv) > 2 else "auto_schemes.json"
src=open(SRC,encoding='utf-8').read()
attr=re.compile(r'([a-zA-Z:_-]+)="([^"]*)"')
rects=[]
for m in re.finditer(r'<rect\b([^>]*)>', src):
    a=dict(attr.findall(m.group(1)))
    try:
        rects.append(dict(x=float(a.get('x',0)), y=float(a.get('y',0)),
                          w=float(a['width']), h=float(a['height']),
                          rx=a.get('rx'), fill=a.get('fill',''), stroke=a.get('stroke')))
    except (KeyError, ValueError):
        pass

NAVY='#213786'; GREYFILL='#F7F6F8'; BORDER='#D4D5D6'
SEATSZ={(25.0,25.0),(27.0,25.0),(32.0,32.0),(27.0,27.0)}

seats=[r for r in rects if (r['w'],r['h']) in SEATSZ and r['fill'] in (NAVY,'white')]
blocks=[r for r in rects if r['fill']==GREYFILL and 8<r['w']<200 and 8<r['h']<200]
cards=[r for r in rects if r['rx'] and r['fill']=='white' and r['w']>300 and r['h']>80]
cards.sort(key=lambda c:(c['y'],c['x']))
kept=[]
for c in cards:
    if not any(c['x']>=k['x']-1 and c['y']>=k['y']-1 and c['x']+c['w']<=k['x']+k['w']+1
               and c['y']+c['h']<=k['y']+k['h']+1 for k in kept):
        kept.append(c)
cards=kept

def inside(r,c,pad=6):
    return (r['x']>=c['x']-pad and r['y']>=c['y']-pad
            and r['x']+r['w']<=c['x']+c['w']+pad and r['y']+r['h']<=c['y']+c['h']+pad)

def band(vals,tol):
    vals=sorted(set(vals)); groups=[[vals[0]]]
    for v in vals[1:]:
        if v-groups[-1][-1]<=tol: groups[-1].append(v)
        else: groups.append([v])
    return groups

def classify_block(b):
    """map a grey block's shape onto a facility type - approximate, for sample data"""
    ar = b['h']/max(b['w'],1)
    if b['w']<=6 or b['h']<=6: return None            # hairline -> separator
    if ar>2.2: return 'toilet'
    if ar>1.4: return 'baggage'
    return 'table'

out=[]
for ci,c in enumerate(cards):
    cs=[s for s in seats if inside(s,c)]
    if len(cs)<8: continue
    bs=[b for b in blocks if inside(b,c) and b['w']<c['w']*0.6]
    xs=band([s['x'] for s in cs]+[b['x'] for b in bs], 8)
    ys=band([s['y'] for s in cs]+[b['y'] for b in bs], 8)
    if len(xs)>60 or len(ys)>10: continue
    colof={}; rowof={}
    for i,g in enumerate(xs):
        for v in g: colof[round(v,2)]=i
    for i,g in enumerate(ys):
        for v in g: rowof[round(v,2)]=i

    ncols=len(xs); nrows=len(ys)
    columns=[{'items':[]} for _ in range(ncols)]
    occupied=set()

    ordered=sorted(cs,key=lambda s:(colof[round(s['x'],2)], rowof[round(s['y'],2)]))
    num=1
    for s in ordered:
        cc=colof[round(s['x'],2)]; rr=rowof[round(s['y'],2)]+1
        if (cc,rr) in occupied: continue
        occupied.add((cc,rr))
        inclusive = s['fill']=='white'
        item={'seat':str(num), 'kind':'sit', 'facing':'left', 'row':rr}
        if inclusive: item['inclusive']=True
        columns[cc]['items'].append(item)
        num+=1
    for b in bs:
        cc=colof.get(round(b['x'],2)); rr0=rowof.get(round(b['y'],2))
        if cc is None or rr0 is None: continue
        rr=rr0+1
        span=max(1,min(nrows-rr+1, round(b['h']/38.0)))
        if any((cc,r) in occupied for r in range(rr,rr+span)): continue
        t=classify_block(b)
        if not t: continue
        for r in range(rr,rr+span): occupied.add((cc,r))
        item={'type':t,'row':rr}
        if span>1: item['span']={'rows':span}
        columns[cc]['items'].append(item)

    seatcount=sum(1 for col in columns for it in col['items'] if 'seat' in it)
    if seatcount<8: continue
    out.append({'seats':seatcount,'rows':nrows,'cols':ncols,
                'scheme':{'key':'AUTO-%d'%seatcount,'rev':1,
                          'decks':[{'rows':nrows,'columns':columns}]}})

out.sort(key=lambda o:o['seats'])
print('usable wagons converted:', len(out))
sizes=collections.Counter(o['seats'] for o in out)
print('seat counts:', sorted(sizes.items())[:30])
json.dump(out, open(OUT,'w'))
