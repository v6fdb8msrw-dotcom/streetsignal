// Bundesland am Punkt ohne Internetdienst: amtliche Ländergrenzen (VG250, © BKG dl-de/by-2-0), vereinfacht
// in public/data/laender.json. Hält die Analyse funktionsfähig, wenn die Adresssuche ausfällt.

interface LaenderFile {
  states: Record<string, number[][][][]>
}

let file: Promise<{ name: string; polys: number[][][][]; bbox: [number, number, number, number] }[]> | null = null

function load() {
  file ??= fetch(`${import.meta.env.BASE_URL}data/laender.json`)
    .then((r) => (r.ok ? (r.json() as Promise<LaenderFile>) : Promise.reject(new Error('Ländergrenzen fehlen'))))
    .then((d) =>
      Object.entries(d.states).map(([name, polys]) => {
        let w = 180, s = 90, e = -180, n = -90
        for (const poly of polys) for (const [x, y] of poly[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
        return { name, polys, bbox: [w, s, e, n] as [number, number, number, number] }
      }),
    )
  return file
}

/** Punkt in Polygon mit Löchern (gerade/ungerade über alle Ringe) */
export function inPolygon(lng: number, lat: number, rings: number[][][]): boolean {
  let c = false
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c
    }
  return c
}

/** Deutsches Bundesland am Punkt oder null (außerhalb Deutschlands oder Datei nicht ladbar) */
export async function germanStateAt(lat: number, lng: number): Promise<string | null> {
  const states = await load().catch(() => null)
  if (!states) return null
  for (const st of states) {
    const [w, s, e, n] = st.bbox
    if (lng < w || lng > e || lat < s || lat > n) continue
    if (st.polys.some((p) => inPolygon(lng, lat, p))) return st.name
  }
  return null
}
