// Kartierte Lärmbelastung am Punkt aus der EU-Umgebungslärmkartierung (EEA ImageServer).
import { cached } from '../store/db.ts'
import { fetchJson } from './http.ts'

export type NoiseSource = 'road' | 'rail' | 'air' | 'ind'
export type NoisePeriod = 'lden' | 'lnight'

export const NOISE_SOURCE_LABEL: Record<NoiseSource, string> = {
  road: 'Straßenverkehr',
  rail: 'Schienenverkehr',
  air: 'Flugverkehr',
  ind: 'Industrie',
}

export const NOISE_PERIOD_LABEL: Record<NoisePeriod, string> = {
  lden: 'Ganztags (L_DEN)',
  lnight: 'Nachts (L_Night)',
}

const BASE = 'https://noise.discomap.eea.europa.eu/arcgis/rest/services/noiseStoryMap'

/** Klassen laut Legende des Dienstes */
const CLASSES: Record<NoisePeriod, Record<number, [number, number | null]>> = {
  lden: { 1: [55, 60], 2: [60, 65], 3: [65, 70], 4: [70, 75], 5: [75, null] },
  lnight: { 1: [50, 55], 2: [55, 60], 3: [60, 65], 4: [65, 70], 5: [70, null] },
}

export interface NoiseValue {
  source: NoiseSource
  period: NoisePeriod
  /** dB-Spanne der Klasse; null = keine kartierte Klasse an diesem Punkt */
  range: [number, number | null] | null
  rawClass: number | null
}

export interface NoiseResult {
  values: NoiseValue[]
  /** Höchster kartierter Wert auf einem Ring um den Punkt (Straße/Schiene, ganztags) */
  nearby: (NoiseValue & { radiusM: number })[]
  dataDate: string
  fetchedAt: string
  note: string
}

export function serviceUrl(source: NoiseSource, period: NoisePeriod): string {
  return `${BASE}/NoiseContours_${source}_${period}/ImageServer`
}

export function classToRange(period: NoisePeriod, raw: string | number | null | undefined): [number, number | null] | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return CLASSES[period][n] ?? null
}

export function formatRange(r: [number, number | null] | null, period: NoisePeriod): string {
  if (!r) return period === 'lden' ? 'unter 55 dB oder nicht kartiert' : 'unter 50 dB oder nicht kartiert'
  return r[1] === null ? `über ${r[0]} dB` : `${r[0]}–${r[1]} dB`
}

export const RING_M = 75

/** Acht Punkte auf einem Kreis um den Standort */
export function ringPoints(lat: number, lng: number, radiusM = RING_M): [number, number][] {
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * 2 * Math.PI
    return [lat + dLat * Math.sin(a), lng + dLng * Math.cos(a)]
  })
}

async function identify(source: NoiseSource, period: NoisePeriod, lat: number, lng: number): Promise<NoiseValue> {
  const geometry = encodeURIComponent(JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }))
  const url = `${serviceUrl(source, period)}/identify?geometry=${geometry}&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json`
  // Ein zweiter Versuch, falls der EEA-Server kurz nicht antwortet
  const res = await fetchJson<{ value?: string }>('eea_noise', url).catch(async () => {
    await new Promise((r) => setTimeout(r, 1500))
    return fetchJson<{ value?: string }>('eea_noise', url)
  })
  const rawClass = res.value && res.value !== 'NoData' ? Number(res.value) : null
  return { source, period, rawClass, range: classToRange(period, rawClass) }
}

export async function fetchNoise(lat: number, lng: number): Promise<NoiseResult> {
  const key = `noise2:${lat.toFixed(5)},${lng.toFixed(5)}`
  return cached(key, 30 * 24 * 3600 * 1000, async () => {
    const jobs: Promise<NoiseValue>[] = []
    for (const s of ['road', 'rail', 'air', 'ind'] as NoiseSource[]) for (const p of ['lden', 'lnight'] as NoisePeriod[]) jobs.push(identify(s, p, lat, lng))
    // Den Ring in kleinen Gruppen abfragen, um den öffentlichen Server nicht zu überlasten
    const inGroups = async (pts: [number, number][], src: NoiseSource) => {
      const out: NoiseValue[] = []
      for (let i = 0; i < pts.length; i += 4) out.push(...(await Promise.all(pts.slice(i, i + 4).map(([a, b]) => identify(src, 'lden', a, b)))))
      return out
    }
    const ringJobs = (['road', 'rail'] as NoiseSource[]).map(async (src) => {
      const ring = await inGroups(ringPoints(lat, lng), src)
      const max = ring.reduce<NoiseValue | null>((m, v) => (v.rawClass !== null && (!m || v.rawClass > (m.rawClass ?? 0)) ? v : m), null)
      return { source: src, period: 'lden' as NoisePeriod, rawClass: max?.rawClass ?? null, range: max?.range ?? null, radiusM: RING_M }
    })
    const [values, nearby] = await Promise.all([Promise.all(jobs), Promise.all(ringJobs)])
    return {
      values,
      nearby,
      dataDate: 'EU-Kartierungsrunde 4, Bezugsjahr 2022 (EEA-Update April 2026)',
      fetchedAt: new Date().toISOString(),
      note: 'Kartiert sind Ballungsräume, Hauptverkehrsstraßen, Haupteisenbahnstrecken und Großflughäfen. Unterhalb der Schwelle oder außerhalb dieser Gebiete gibt es keinen Wert, das heißt nicht automatisch Ruhe.',
    }
  })
}

/** Höchste kartierte Klasse über alle Quellen (für Vergleich), null = keine. Mit nearby: inkl. 75-m-Ring. */
export function loudest(r: NoiseResult, period: NoisePeriod = 'lden', withNearby = false): NoiseValue | null {
  const pool = [...r.values, ...(withNearby && period === 'lden' ? (r.nearby ?? []) : [])]
  return pool.filter((v) => v.period === period && v.range).sort((a, b) => (b.rawClass ?? 0) - (a.rawClass ?? 0))[0] ?? null
}
