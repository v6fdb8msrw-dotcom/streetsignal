"""Überflutungsflächen Österreich (HQ30, HQ100, HQ300) als kleine Rasterkacheln für die App.

Quelle: Überflutungsflächen HWRL 2026 (BMLUK, Umweltbundesamt), data.gv.at, Lizenz CC BY 4.0.
Die GeoPackages liegen in EPSG:3857. Jede Kachel umfasst 0,25° × 0,25° (wie die Fahrplandaten). Darin ein Raster
von 25 Mercator-Metern (am Boden etwa 17 m): Bit 1 = HQ30, Bit 2 = HQ100, Bit 4 = HQ300.

Schritt 1 je Szenario (Flächen ins Raster übertragen, Zwischenstand im Arbeitsordner):
  python3 tools/data/build-flood-at.py add UEFF_HQ030_2026.gpkg 1 ARBEITSORDNER
Schritt 2 (Kacheln schreiben):
  python3 tools/data/build-flood-at.py write ARBEITSORDNER public/data/hochwasser-at
"""
import json
import math
import os
import sqlite3
import struct
import sys
import time
import zlib

import numpy as np

CELL = 25.0  # Mercator-Meter
TILE = 0.25  # Grad
R = 6378137.0


def merc_x(lng):
    return math.radians(lng) * R


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R


def lat_of(y):
    return math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)


def lng_of(x):
    return math.degrees(x / R)


def tile_key(lat0, lng0):
    f = lambda v: f'{v:g}'.replace('.', 'p').replace('-', 'm')
    return f'{f(lat0)}_{f(lng0)}'


def tile_geom(lat0, lng0):
    """Mercator-Ursprung (West, Nord) und Rastergröße einer Kachel"""
    x0, x1 = merc_x(lng0), merc_x(lng0 + TILE)
    y0, y1 = merc_y(lat0), merc_y(lat0 + TILE)
    w = int(math.ceil((x1 - x0) / CELL))
    h = int(math.ceil((y1 - y0) / CELL))
    return x0, y1, w, h


def parse_gpkg_geom(blob):
    """GeoPackage-Binärformat → Liste von Polygonen, jedes eine Liste von Ringen (N×2-Arrays)"""
    flags = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    wkb = memoryview(blob)[8 + env:]
    polys = []

    def read_geom(off):
        bo = '<' if wkb[off] == 1 else '>'
        (typ,) = struct.unpack_from(bo + 'I', wkb, off + 1)
        off += 5
        base = typ % 1000
        dims = 2 + {0: 0, 1: 1, 2: 1, 3: 2}[typ // 1000]
        if base == 3:
            (nr,) = struct.unpack_from(bo + 'I', wkb, off)
            off += 4
            rings = []
            for _ in range(nr):
                (n,) = struct.unpack_from(bo + 'I', wkb, off)
                off += 4
                a = np.frombuffer(wkb, dtype=np.dtype('f8').newbyteorder(bo), count=n * dims, offset=off).reshape(n, dims)[:, :2]
                off += n * dims * 8
                rings.append(np.ascontiguousarray(a, dtype=np.float64))
            polys.append(rings)
        elif base == 6:
            (np_,) = struct.unpack_from(bo + 'I', wkb, off)
            off += 4
            for _ in range(np_):
                off = read_geom(off)
        else:
            raise ValueError(f'Geometrietyp {typ} nicht unterstützt')
        return off

    read_geom(0)
    return polys


def fill_polygon(rings, grids, bit):
    xs = np.concatenate([r[:, 0] for r in rings])
    ys = np.concatenate([r[:, 1] for r in rings])
    # Kanten aller Ringe (gerade/ungerade-Regel füllt Löcher richtig aus)
    ax = np.concatenate([r[:-1, 0] for r in rings])
    ay = np.concatenate([r[:-1, 1] for r in rings])
    bx = np.concatenate([r[1:, 0] for r in rings])
    by = np.concatenate([r[1:, 1] for r in rings])
    keep = ay != by
    ax, ay, bx, by = ax[keep], ay[keep], bx[keep], by[keep]
    if not len(ax):
        return
    ey0, ey1 = np.minimum(ay, by), np.maximum(ay, by)
    lat_min, lat_max = lat_of(ys.min()), lat_of(ys.max())
    lng_min, lng_max = lng_of(xs.min()), lng_of(xs.max())
    for lat0 in np.arange(math.floor(lat_min / TILE) * TILE, lat_max, TILE):
        for lng0 in np.arange(math.floor(lng_min / TILE) * TILE, lng_max, TILE):
            lat0, lng0 = round(float(lat0), 2), round(float(lng0), 2)
            key = tile_key(lat0, lng0)
            x0, ytop, w, h = tile_geom(lat0, lng0)
            r0 = max(0, int((ytop - ys.max()) / CELL))
            r1 = min(h - 1, int((ytop - ys.min()) / CELL))
            if r1 < r0:
                continue
            grid = grids.get(key)
            if grid is None:
                grid = grids[key] = np.zeros((h, w), dtype=np.uint8)
            for c0 in range(r0, r1 + 1, 32):
                rows = np.arange(c0, min(r1 + 1, c0 + 32))
                yc = ytop - (rows + 0.5) * CELL
                # nur Kanten, die diesen Zeilenblock überhaupt schneiden
                sel = np.nonzero((ey1 > yc.min()) & (ey0 <= yc.max()))[0]
                if not len(sel):
                    continue
                sax, say, sbx, sby = ax[sel], ay[sel], bx[sel], by[sel]
                Y = yc[:, None]
                cross = ((say[None, :] <= Y) & (sby[None, :] > Y)) | ((sby[None, :] <= Y) & (say[None, :] > Y))
                ri, ei = np.nonzero(cross)
                if not len(ri):
                    continue
                t = (yc[ri] - say[ei]) / (sby[ei] - say[ei])
                xi = sax[ei] + t * (sbx[ei] - sax[ei])
                order = np.lexsort((xi, ri))
                ri, xi = ri[order], xi[order]
                # Schnittpunkte paarweise je Zeile
                starts = np.searchsorted(ri, np.arange(len(rows)))
                ends = np.searchsorted(ri, np.arange(len(rows)), side='right')
                for k in range(len(rows)):
                    seg = xi[starts[k]:ends[k]]
                    if len(seg) < 2:
                        continue
                    row = grid[rows[k]]
                    for a, b in zip(seg[0::2], seg[1::2]):
                        ca = max(0, int(math.ceil((a - x0) / CELL - 0.5)))
                        cb = min(w - 1, int(math.floor((b - x0) / CELL - 0.5)))
                        if cb >= ca:
                            row[ca:cb + 1] |= bit


def add(gpkg, bit, work):
    os.makedirs(work, exist_ok=True)
    grids = {}
    for f in os.listdir(work):
        if f.endswith('.npy'):
            grids[f[:-4]] = np.load(os.path.join(work, f))
    con = sqlite3.connect(gpkg)
    table, col = con.execute('select table_name, column_name from gpkg_geometry_columns').fetchone()
    srs = con.execute('select srs_id from gpkg_geometry_columns').fetchone()[0]
    if srs != 3857:
        sys.exit(f'Erwartet EPSG:3857, gefunden {srs}')
    total = con.execute(f'select count(*) from "{table}"').fetchone()[0]
    t0 = time.time()
    for i, (blob,) in enumerate(con.execute(f'select "{col}" from "{table}"')):
        if blob:
            for rings in parse_gpkg_geom(bytes(blob)):
                fill_polygon(rings, grids, bit)
        if i % 500 == 0:
            print(f'{i}/{total} Flächen, {time.time() - t0:.0f} s, {len(grids)} Kacheln', flush=True)
    for key, g in grids.items():
        np.save(os.path.join(work, key + '.npy'), g)
    print(f'fertig: {total} Flächen in {time.time() - t0:.0f} s, {len(grids)} Kacheln')


def write(work, out):
    os.makedirs(out, exist_ok=True)
    index = {}
    size = 0
    for f in sorted(os.listdir(work)):
        if not f.endswith('.npy'):
            continue
        g = np.load(os.path.join(work, f))
        if not g.any():
            continue
        key = f[:-4]
        data = zlib.compress(g.tobytes(), 9)
        with open(os.path.join(out, key + '.bin'), 'wb') as fh:
            fh.write(data)
        size += len(data)
        index[key] = [int(g.shape[1]), int(g.shape[0])]
    meta = {
        'cell': CELL,
        'tile': TILE,
        'bits': {'hq30': 1, 'hq100': 2, 'hq300': 4},
        'source': 'Überflutungsflächen HWRL 2026, BMLUK / Umweltbundesamt (data.gv.at)',
        'license': 'CC BY 4.0, aufbereitet als Raster von 25 Mercator-Metern',
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'tiles': index,
    }
    with open(os.path.join(out, 'index.json'), 'w') as fh:
        json.dump(meta, fh)
    print(f'{len(index)} Kacheln, {size / 1e6:.1f} MB → {out}')


if __name__ == '__main__':
    if sys.argv[1] == 'add':
        add(sys.argv[2], int(sys.argv[3]), sys.argv[4])
    elif sys.argv[1] == 'write':
        write(sys.argv[2], sys.argv[3])
