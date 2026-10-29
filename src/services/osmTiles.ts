// Umgebung aus OpenStreetMap über die Vektorkacheln von OpenFreeMap (dieselben Kacheln wie die Grundkarte).
// Läuft über ein CDN und ist damit unabhängig von den oft überlasteten Overpass-Servern.
// Daten: © OpenStreetMap-Mitwirkende (ODbL), Kacheln: OpenFreeMap (OpenMapTiles-Schema).
import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { distanceM } from '../model/geo.ts'
import { fetchJson, fetchWithLimits } from './http.ts'
import type { Poi, PoiCategory, PoiResult } from './overpass.ts'

const Z = 14
const TILEJSON = 'https://tiles.openfreemap.org/planet'

type Props = Record<string, string | number | boolean>

/** Zuordnung der OpenMapTiles-Klassen zu den Kategorien von StreetSignal */
export function categorizeTile(layer: string, p: Props): PoiCategory | null {
  const cls = String(p.class ?? '')
  const sub = String(p.subclass ?? '')
  if (layer === 'poi') {
    if (sub === 'kindergarten' || sub === 'childcare') return 'kita'
    if (sub === 'school' || (cls === 'school' && !sub)) return 'schule'
    if (['supermarket', 'convenience'].includes(sub)) return 'einkauf'
    if (['doctors', 'hospital', 'pharmacy', 'clinic'].includes(sub)) return 'medizin'
    if (sub === 'bus_stop' || sub === 'tram_stop') return 'oepnv'
    if (cls === 'railway' && ['station', 'halt', 'subway'].includes(sub)) return 'bahn'
    if (sub === 'viewpoint') return 'aussicht'
    if (sub === 'park') return 'gruen'
    return null
  }
  if (layer === 'landcover') {
    if (cls === 'wood') return 'wald'
    // Gärten sind oft privat und zählen deshalb nicht (wie bei der Overpass-Abfrage)
    if (['park', 'village_green', 'recreation_ground'].includes(sub)) return 'gruen'
    return null
  }
  if (layer === 'park') return cls === 'nature_reserve' || cls === 'national_park' ? 'wald' : 'gruen'
  if (layer === 'water') return ['lake', 'river', 'ocean', 'pond'].includes(cls) ? 'wasser' : null
  if (layer === 'waterway') return cls === 'river' ? 'wasser' : null
  if (layer === 'landuse') {
    // Schul-, Kita- und Klinikgelände sind oft nur als Fläche ohne eigenen Punkt eingetragen
    if (cls === 'construction') return 'baustelle'
    if (cls === 'school') return 'schule'
    if (cls === 'kindergarten') return 'kita'
    if (cls === 'hospital') return 'medizin'
    return null
  }
  if (layer === 'transportation') return cls.endsWith('_construction') ? 'baustelle' : null
  return null
}

const LAYERS = ['poi', 'landcover', 'park', 'water', 'waterway', 'landuse', 'transportation']

function tileXY(lat: number, lng: number): [number, number] {
  const n = 2 ** Z
  const x = Math.floor(((lng + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return [x, y]
}

function toLngLat(x: number, y: number, tx: number, ty: number, extent: number): [number, number] {
  const n = 2 ** Z
  const lng = ((tx + x / extent) / n) * 360 - 180
  const m = Math.PI - (2 * Math.PI * (ty + y / extent)) / n
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(m))
  return [lat, lng]
}

/** Punkt in Polygon (gerade/ungerade über alle Ringe) */
function inside(lat: number, lng: number, rings: [number, number][][]): boolean {
  let c = false
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ai, bi] = ring[i]
      const [aj, bj] = ring[j]
      if (ai > lat !== aj > lat && lng < ((bj - bi) * (lat - ai)) / (aj - ai) + bi) c = !c
    }
  return c
}

/** Abstand vom Standort zum Objekt: Punkt direkt, Linien und Flächen über den nächsten Stützpunkt (0, wenn innerhalb) */
function nearest(f: VectorTileFeature, lat: number, lng: number, tx: number, ty: number): { lat: number; lng: number; d: number } {
  const rings = f.loadGeometry().map((ring) => ring.map((pt) => toLngLat(pt.x, pt.y, tx, ty, f.extent)))
  if (f.type === 3 && inside(lat, lng, rings)) return { lat, lng, d: 0 }
  let best = { lat: rings[0][0][0], lng: rings[0][0][1], d: Infinity }
  for (const ring of rings)
    for (const [a, b] of ring) {
      const d = distanceM([lat, lng], [a, b])
      if (d < best.d) best = { lat: a, lng: b, d }
    }
  return best
}

let tileUrl: Promise<string> | null = null

export async function fetchPoisFromTiles(lat: number, lng: number, radiusM: number): Promise<PoiResult> {
  tileUrl ??= fetchJson<{ tiles: string[] }>('openfreemap', TILEJSON).then((t) => t.tiles[0])
  const template = await tileUrl
  const reach = Math.max(radiusM, 1500)
  const dLat = reach / 111320
  const dLng = reach / (111320 * Math.cos((lat * Math.PI) / 180))
  const [x0, y0] = tileXY(lat + dLat, lng - dLng)
  const [x1, y1] = tileXY(lat - dLat, lng + dLng)
  const coords: [number, number][] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) coords.push([x, y])

  const byKey = new Map<string, Poi>()
  await Promise.all(
    coords.map(async ([tx, ty]) => {
      const url = template.replace('{z}', String(Z)).replace('{x}', String(tx)).replace('{y}', String(ty))
      const buf = await (await fetchWithLimits('openfreemap', url)).arrayBuffer()
      const tile = new VectorTile(new Pbf(new Uint8Array(buf)))
      for (const layerName of LAYERS) {
        const layer = tile.layers[layerName]
        if (!layer) continue
        for (let i = 0; i < layer.length; i++) {
          const f = layer.feature(i)
          const props = f.properties as Props
          const category = categorizeTile(layerName, props)
          if (!category) continue
          const near = nearest(f, lat, lng, tx, ty)
          const limit = ['gruen', 'wald', 'wasser', 'bahn', 'aussicht'].includes(category) ? reach : radiusM
          if (near.d > limit) continue
          const name = (props.name_de ?? props.name ?? null) as string | null
          // Dasselbe Objekt liegt oft in mehreren Kacheln: nach Kategorie, Name und grober Lage zusammenfassen
          const key = `${category}|${name ?? ''}|${f.id ?? ''}|${name ? '' : `${near.lat.toFixed(4)},${near.lng.toFixed(4)}`}`
          const prev = byKey.get(key)
          if (prev && prev.distanceM <= near.d) continue
          byKey.set(key, {
            id: `t${f.id ?? i}-${tx}-${ty}`,
            category,
            name,
            lat: near.lat,
            lng: near.lng,
            distanceM: Math.round(near.d),
            tags: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, String(v)])),
            osmUrl: `https://www.openstreetmap.org/#map=19/${near.lat.toFixed(5)}/${near.lng.toFixed(5)}`,
          })
        }
      }
    }),
  )
  const version = template.match(/\/(\d{4})(\d{2})(\d{2})_/)
  return {
    pois: [...byKey.values()].sort((a, b) => a.distanceM - b.distanceM),
    dataTimestamp: version ? `${version[1]}-${version[2]}-${version[3]}` : null,
    fetchedAt: new Date().toISOString(),
    source: 'openfreemap',
  }
}
