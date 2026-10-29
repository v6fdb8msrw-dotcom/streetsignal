"""Ländergrenzen für die Bundesland-Bestimmung ohne Internetdienst.

Quelle: Verwaltungsgebiete 1:250 000 (VG250), Ebene Länder, BKG – WFS sgx.geodatenzentrum.de/wfs_vg250,
Lizenz dl-de/by-2-0 (geldleistungsfrei), Quellenvermerk „© BKG (Jahr) dl-de/by-2-0“.
Nur Landflächen (gf = 4), vereinfacht auf etwa 30 m. Ergebnis: public/data/laender.json
Aufruf: python3 tools/data/build-laender.py <lan.json vom WFS>
"""
import json
import sys


def simplify(pts, tol):
    """Douglas-Peucker ohne Bibliotheken"""
    if len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n2 = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if n2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / n2))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best:
                best, idx = d, i
        if best > tol * tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


data = json.load(open(sys.argv[1]))
out = {}
for f in data['features']:
    p = f['properties']
    if p.get('gf') != 4:
        continue
    polys = f['geometry']['coordinates'] if f['geometry']['type'] == 'MultiPolygon' else [f['geometry']['coordinates']]
    for poly in polys:
        rings = []
        for ring in poly:
            r = simplify([(round(x, 4), round(y, 4)) for x, y in ring], 0.0003)
            if len(r) >= 4:
                rings.append([[x, y] for x, y in r])
        if rings:
            out.setdefault(p['gen'], []).append(rings)
json.dump({
    'source': 'VG250 Länder, © BKG (2026) dl-de/by-2-0, vereinfacht auf etwa 30 m',
    'states': out,
}, open('public/data/laender.json', 'w'), separators=(',', ':'))
print(len(out), 'Länder:', ', '.join(sorted(out)))
