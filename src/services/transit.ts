// Verkehrsanbindung mit amtlichen Daten:
// - Deutschland: Abfahrten pro Werktag an Haltestellen, aufbereitet aus den GTFS-Fahrplänen von gtfs.de (DELFI, CC BY 4.0)
// - Schweiz: ÖV-Güteklasse des Bundesamts für Raumentwicklung (geo.admin.ch)
import { distanceM } from '../model/geo.ts'
import { fetchJson } from './http.ts'

export interface TransitStop {
  name: string
  lat: number
  lng: number
  /** Abfahrten am Stichtag (normaler Werktag) */
  departures: number
  /** Verkehrsmittel: B Bus, T Tram, U U-Bahn, S S-Bahn, R Regionalbahn, F Fernverkehr, X sonstige */
  modes: string
  distanceM: number
}

export interface TransitResult {
  covered: boolean
  source: 'gtfs' | 'oev_gueteklasse' | null
  /** Schweiz: Güteklasse A–D */
  ovClass: string | null
  stops: TransitStop[]
  /** true = nur Fern- und Regionalverkehr aufbereitet, Nahverkehr fehlt */
  partial?: boolean
  /** Summe der Abfahrten aller Haltestellen bis 500 m */
  departures500: number | null
  nearestLongDistance: TransitStop | null
  dataDate: string | null
  note: string
}

interface TileFile {
  date: string
  /** Enthaltene Feeds: fv Fernverkehr, rv Regionalverkehr, nv Nahverkehr */
  feeds?: string[]
  /** [lat, lng, name, departures, modes] */
  stops: [number, number, string, number, string][]
}

export const TILE_DEG = 0.25
const tileCache = new Map<string, Promise<TileFile | null>>()

export function tileKey(lat: number, lng: number): string {
  return `${Math.floor(lat / TILE_DEG) * TILE_DEG}_${Math.floor(lng / TILE_DEG) * TILE_DEG}`.replace(/\./g, 'p')
}

function loadTile(key: string): Promise<TileFile | null> {
  if (!tileCache.has(key))
    tileCache.set(
      key,
      fetch(`${import.meta.env.BASE_URL}data/oepnv/${key}.json`).then((r) => (r.ok ? (r.json() as Promise<TileFile>) : null)).catch(() => null),
    )
  return tileCache.get(key)!
}

async function gtfsStops(lat: number, lng: number, radiusM: number): Promise<{ stops: TransitStop[]; date: string | null; feeds: string[] }> {
  const keys = new Set<string>()
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  for (const a of [lat - dLat, lat + dLat]) for (const b of [lng - dLng, lng + dLng]) keys.add(tileKey(a, b))
  const tiles = (await Promise.all([...keys].map(loadTile))).filter((t): t is TileFile => !!t)
  const stops = tiles
    .flatMap((t) => t.stops)
    .map(([sLat, sLng, name, departures, modes]) => ({ name, lat: sLat, lng: sLng, departures, modes, distanceM: distanceM([lat, lng], [sLat, sLng]) }))
    .filter((s) => s.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
  return { stops, date: tiles[0]?.date ?? null, feeds: tiles[0]?.feeds ?? [] }
}

export async function fetchTransit(lat: number, lng: number, country: string | null): Promise<TransitResult> {
  if (country === 'CH') {
    const d = 0.01
    const res = await fetchJson<{ results: { attributes: { klasse_de?: string } }[] }>(
      'ch_oev',
      `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lng},${lat}&sr=4326&layers=all:ch.are.gueteklassen_oev&tolerance=0&mapExtent=${lng - d},${lat - d},${lng + d},${lat + d}&imageDisplay=600,600,96&returnGeometry=false&lang=de`,
    )
    const cls = res.results[0]?.attributes.klasse_de ?? null
    return {
      covered: true,
      source: 'oev_gueteklasse',
      ovClass: cls,
      partial: false,
      stops: [],
      departures500: null,
      nearestLongDistance: null,
      dataDate: null,
      note: cls ? 'ÖV-Güteklassen A (sehr gut) bis D (gering) bewerten Takt und Art der Haltestellen in der Umgebung.' : 'Keine ÖV-Güteklasse: Der Ort liegt außerhalb der erschlossenen Gebiete.',
    }
  }
  if (country && country !== 'DE')
    return { covered: false, source: null, ovClass: null, stops: [], departures500: null, nearestLongDistance: null, dataDate: null, note: 'Fahrplandaten sind bisher nur für Deutschland aufbereitet.' }
  const near = await gtfsStops(lat, lng, 1000)
  const far = await gtfsStops(lat, lng, 25000)
  const within500 = near.stops.filter((s) => s.distanceM <= 500)
  const partial = !(near.feeds.length ? near.feeds : far.feeds).includes('nv')
  return {
    partial,
    covered: near.date !== null || far.date !== null,
    source: 'gtfs',
    ovClass: null,
    stops: near.stops.slice(0, 8),
    departures500: within500.reduce((a, s) => a + s.departures, 0),
    nearestLongDistance: far.stops.find((s) => s.modes.includes('F')) ?? null,
    dataDate: near.date ?? far.date,
    note: partial
      ? 'Bisher nur Fern- und Regionalverkehr (inkl. S-Bahn) aufbereitet. Bus, Tram und U-Bahn fehlen noch, die Zahl ist daher zu niedrig. Sollfahrplan an einem normalen Werktag.'
      : 'Abfahrten aller Linien an einem normalen Werktag laut Sollfahrplan. Echtzeit, Ausfälle und Baustellen sind nicht berücksichtigt.',
  }
}
