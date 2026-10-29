"""Entpackt eine ZIP-Datei direkt aus stdin, ohne das Archiv zu speichern (spart Speicherplatz bei großen Downloads).
Geschrieben werden nur Einträge mit der gewünschten Endung.

Aufruf: curl -sL URL | python3 tools/data/unzip-stream.py ZIELORDNER .gpkg
"""
import os
import struct
import sys
import zlib

out_dir, ext = sys.argv[1], sys.argv[2].lower()
src = sys.stdin.buffer
buf = b''


def read(n):
    global buf
    while len(buf) < n:
        chunk = src.read(1 << 20)
        if not chunk:
            break
        buf += chunk
    r, buf = buf[:n], buf[n:]
    return r


while read(4) == b'PK\x03\x04':
    _, flag, method, _, _, _, csize, _, nlen, xlen = struct.unpack('<HHHHHIIIHH', read(26))
    name = read(nlen).decode('utf-8', 'replace')
    read(xlen)
    keep = name.lower().endswith(ext)
    out = open(os.path.join(out_dir, os.path.basename(name)), 'wb') if keep else None
    print('Eintrag', name, 'behalten' if keep else 'übersprungen', file=sys.stderr, flush=True)
    if method == 8:
        d = zlib.decompressobj(-15)
        total = 0
        while not d.eof:
            chunk = buf or src.read(1 << 20)
            buf = b''
            if not chunk:
                break
            data = d.decompress(chunk)
            total += len(data)
            if out:
                out.write(data)
            if d.unused_data:
                buf = d.unused_data
        print(f'  {total >> 20} MB', file=sys.stderr, flush=True)
    elif method == 0 and not flag & 8:
        left = csize
        while left:
            c = read(min(left, 1 << 20))
            if not c:
                break
            left -= len(c)
            if out:
                out.write(c)
    else:
        sys.exit(f'Nicht unterstützt: Methode {method}, Flag {flag}')
    if out:
        out.close()
    if flag & 8:
        # Datendeskriptor (mit oder ohne Signatur, evtl. Zip64): bis zum nächsten Eintrag vorspulen
        while True:
            read(0)
            if len(buf) < 4:
                more = src.read(1 << 20)
                if not more:
                    break
                buf += more
            i = buf.find(b'PK\x03\x04')
            j = buf.find(b'PK\x01\x02')
            k = min(x for x in (i, j) if x >= 0) if max(i, j) >= 0 else -1
            if k >= 0:
                buf = buf[k:]
                break
            buf = buf[-3:]
