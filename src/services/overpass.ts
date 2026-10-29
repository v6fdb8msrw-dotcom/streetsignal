// Umgebung aus OpenStreetMap. Standard: Vektorkacheln von OpenFreeMap (osmTiles.ts), Ausweich: Overpass API.
// Ergebnis wird zwischengespeichert.
import { distanceM } from '../model/geo.ts'
import { cached } from '../store/db.ts'
import { fetchJson, SourceError } from './http.ts'
import { fetchPoisFromTiles } from './osmTiles.ts'

export type PoiCategory =
  | 'gruen'
  | 'wald'
  | 'wasser'
  | 'schule'
  | 'kita'
  | 'einkauf'
  | 'medizin'
  | 'oepnv'
  | 'bahn'
  | 'aussicht'
  | 'baustelle'

export interface PoiCategoryDef {
  id: PoiCategory
  label: string
  /** Overpass-Filter, jeweils für nwr (Knoten, Wege, Relationen) */
  filters: string[]
  color: string
}

export const POI_CATEGORIES: PoiCategoryDef[] = [
  { id: 'gruen', label: 'Parks und Grünflächen', filters: ['["leisure"="park"]', '["leisure"="garden"]["access"!="private"]', '["landuse"="recreation_ground"]'], color: '#4f7a4a' },
  { id: 'wald', label: 'Wälder und Naturräume', filters: ['["landuse"="forest"]', '["natural"="wood"]', '["leisure"="nature_reserve"]'], color: '#2f5d3a' },
  { id: 'wasser', label: 'Gewässer', filters: ['["natural"="water"]', '["waterway"="river"]', '["natural"="coastline"]'], color: '#4a8fb0' },
  { id: 'schule', label: 'Schulen', filters: ['["amenity"="school"]'], color: '#b07a2a' },
  { id: 'kita', label: 'Kitas', filters: ['["amenity"="kindergarten"]', '["amenity"="childcare"]'], color: '#c9963f' },
  { id: 'einkauf', label: 'Supermärkte', filters: ['["shop"="supermarket"]', '["shop"="convenience"]'], color: '#8a5a8c' },
  { id: 'medizin', label: 'Medizinische Einrichtungen', filters: ['["amenity"="doctors"]', '["amenity"="hospital"]', '["amenity"="pharmacy"]', '["amenity"="clinic"]'], color: '#b4473f' },
  { id: 'oepnv', label: 'Haltestellen (Bus, Tram)', filters: ['["highway"="bus_stop"]', '["railway"="tram_stop"]'], color: '#183F32' },
  { id: 'bahn', label: 'Bahnhöfe (S-, U-, Fernbahn)', filters: ['["railway"="station"]', '["railway"="halt"]', '["station"="subway"]'], color: '#102D26' },
  { id: 'aussicht', label: 'Aussichtspunkte', filters: ['["tourism"="viewpoint"]'], color: '#7a8f5a' },
  { id: 'baustelle', label: 'Baustellen laut OpenStreetMap', filters: ['["landuse"="construction"]', '["building"="construction"]', '["highway"="construction"]'], color: '#c0612b' },
]

export interface Poi {
  id: string
  category: PoiCategory
  name: string | null
  lat: number
  lng: number
  distanceM: number
  tags: Record<string, string>
  osmUrl: string
}

export interface PoiResult {
  pois: Poi[]
  /** Zeitstempel der OSM-Daten laut Server */
  dataTimestamp: string | null
  fetchedAt: string
  /** Woher die Daten kamen: OpenFreeMap-Kacheln (Standard) oder Overpass (Ausweich) */
  source?: 'openfreemap' | 'overpass'
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export function buildQuery(lat: number, lng: number, radiusM: number): string {
  const parts: string[] = []
  for (const c of POI_CATEGORIES) {
    // Grün, Wald und Wasser auch etwas außerhalb des Radius finden, damit „nächster Park“ sinnvoll ist
    const r = ['gruen', 'wald', 'wasser', 'bahn', 'aussicht'].includes(c.id) ? Math.max(radiusM, 1500) : radiusM
    for (const f of c.filters) parts.push(`nwr${f}(around:${r},${lat},${lng});`)
  }
  return `[out:json][timeout:25];(${parts.join('')});out tags center qt 600;`
}

export function categorize(tags: Record<string, string>): PoiCategory | null {
  for (const c of POI_CATEGORIES) {
    for (const f of c.filters) {
      const conds = [...f.matchAll(/\["([^"]+)"(!?=)"([^"]+)"\]/g)]
      if (conds.every(([, k, op, v]) => (op === '=' ? tags[k] === v : tags[k] !== v))) return c.id
    }
  }
  return null
}

/** Öffentliche, kostenlose Overpass-Server: Hauptserver, dann ein Ausweichserver (private.coffee, laut Betreiber frei nutzbar) */
export const OVERPASS_SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

/** Overpass-Abfrage mit einem zweiten Versuch und Ausweichserver bei Überlastung */
export async function overpass<T>(query: string): Promise<T> {
  // Laut Server bei Überlastung mit wachsender Wartezeit erneut versuchen; insgesamt höchstens etwa eine Minute
  const attempts: [string, number, number][] = [
    [OVERPASS_SERVERS[0], 0, 25000],
    [OVERPASS_SERVERS[0], 3000, 20000],
    [OVERPASS_SERVERS[1], 0, 25000],
  ]
  for (const [url, wait, timeout] of attempts) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    try {
      return await fetchJson<T>('overpass', url, { method: 'POST', body: new URLSearchParams({ data: query }) }, timeout)
    } catch {
      // nächster Versuch
    }
  }
  throw new SourceError('overpass', 'Die öffentlichen OpenStreetMap-Server sind gerade ausgelastet. Bitte später „Neu prüfen“')
}

export async function fetchPois(lat: number, lng: number, radiusM: number): Promise<PoiResult> {
  return cached(`pois2:${lat.toFixed(4)},${lng.toFixed(4)},${radiusM}`, 6 * 3600 * 1000, async () => {
    try {
      return await fetchPoisFromTiles(lat, lng, radiusM)
    } catch {
      // Kacheln nicht erreichbar: Overpass versuchen
      return fetchPoisOverpass(lat, lng, radiusM)
    }
  })
}

export async function fetchPoisOverpass(lat: number, lng: number, radiusM: number): Promise<PoiResult> {
  const query = buildQuery(lat, lng, radiusM)
  const key = `overpass:${lat.toFixed(4)},${lng.toFixed(4)},${radiusM}`
  return cached(key, 6 * 3600 * 1000, async () => {
    const data = await overpass<{ elements: OverpassElement[]; osm3s?: { timestamp_osm_base?: string } }>(query)
    const pois: Poi[] = []
    for (const e of data.elements) {
      const pLat = e.lat ?? e.center?.lat
      const pLng = e.lon ?? e.center?.lon
      if (pLat === undefined || pLng === undefined || !e.tags) continue
      const category = categorize(e.tags)
      if (!category) continue
      pois.push({
        id: `${e.type}/${e.id}`,
        category,
        name: e.tags.name ?? null,
        lat: pLat,
        lng: pLng,
        distanceM: distanceM([lat, lng], [pLat, pLng]),
        tags: e.tags,
        osmUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      })
    }
    pois.sort((a, b) => a.distanceM - b.distanceM)
    return { pois, dataTimestamp: data.osm3s?.timestamp_osm_base ?? null, fetchedAt: new Date().toISOString(), source: 'overpass' as const }
  })
}
