// Umgebungsanalyse eines Standorts (Master-Prompt Abschnitt 8). Alle Quellen laufen parallel;
// fällt eine aus, bleibt ihr Abschnitt sichtbar leer mit Grund, statt still zu verschwinden.
import { dist as fmtM } from '../components/format.ts'
import { reverseGeocode, type GeoResult } from './geocode.ts'
import { SourceError } from './http.ts'
import { fetchLandValue, type LandValueResult } from './landvalue.ts'
import { fetchNoise, formatRange, loudest, NOISE_SOURCE_LABEL, type NoiseResult } from './noise.ts'
import { fetchCouncil, type CouncilResult } from './oparl.ts'
import { fetchPois, POI_CATEGORIES, type Poi, type PoiCategory, type PoiResult } from './overpass.ts'
import { fetchPlanning, type PlanningResult } from './planning.ts'

export const RADII = [250, 500, 1000, 3000] as const
export type Radius = (typeof RADII)[number]

export interface Section<T> {
  status: 'ok' | 'error' | 'loading'
  data: T | null
  error: string | null
  sourceIds: string[]
}

export interface EnvReport {
  id: string
  /** Immobilie oder gespeicherter Ort, zu dem der Bericht gehört (für die Änderungshistorie) */
  targetId: string
  createdAt: string
  lat: number
  lng: number
  radius: Radius
  place: GeoResult | null
  pois: Section<PoiResult>
  noise: Section<NoiseResult>
  planning: Section<PlanningResult>
  landValue: Section<LandValueResult>
  council: Section<CouncilResult>
}

async function section<T>(sourceIds: string[], job: () => Promise<T>): Promise<Section<T>> {
  try {
    return { status: 'ok', data: await job(), error: null, sourceIds }
  } catch (e) {
    const msg = e instanceof SourceError ? e.message : (e as Error).message || 'unbekannter Fehler'
    return { status: 'error', data: null, error: msg, sourceIds }
  }
}

const pending = <T,>(sourceIds: string[]): Section<T> => ({ status: 'loading', data: null, error: null, sourceIds })

/**
 * Fragt alle Quellen parallel ab. onPartial meldet jeden fertigen Abschnitt sofort,
 * damit die Oberfläche nicht auf die langsamste Quelle warten muss.
 */
export async function analyze(targetId: string, lat: number, lng: number, radius: Radius, onPartial?: (r: EnvReport) => void): Promise<EnvReport> {
  const report: EnvReport = {
    id: crypto.randomUUID(),
    targetId,
    createdAt: new Date().toISOString(),
    lat,
    lng,
    radius,
    place: null,
    pois: pending(['overpass']),
    noise: pending(['eea_noise']),
    planning: pending(['hh_bplan', 'be_bplan']),
    landValue: pending(['nrw_boris', 'boris_d']),
    council: pending(['oparl']),
  }
  const emit = () => onPartial?.({ ...report })
  emit()
  const geo = await reverseGeocode(lat, lng).catch(() => null)
  // Stadtstaaten: Photon liefert dort oft kein Bundesland
  const place = geo && !geo.state && geo.city && ['Berlin', 'Hamburg', 'Bremen'].includes(geo.city) ? { ...geo, state: geo.city } : geo
  report.place = place
  emit()
  const run = async <K extends 'pois' | 'noise' | 'planning' | 'landValue' | 'council'>(key: K, job: () => Promise<NonNullable<EnvReport[K]['data']>>) => {
    ;(report[key] as Section<unknown>) = await section(report[key].sourceIds, job)
    emit()
  }
  await Promise.all([
    run('pois', () => fetchPois(lat, lng, radius)),
    run('noise', () => fetchNoise(lat, lng)),
    run('planning', () => fetchPlanning(lat, lng, place?.state ?? null)),
    run('landValue', () => fetchLandValue(lat, lng, place?.country ?? null, place?.state ?? null)),
    run('council', () => fetchCouncil(place?.city ?? null, place?.street ?? null)),
  ])
  return { ...report }
}

export interface CategorySummary {
  id: PoiCategory
  label: string
  /** Anzahl im gewählten Radius */
  count: number
  nearest: Poi | null
}

export function summarizePois(r: EnvReport): CategorySummary[] {
  const pois = r.pois.data?.pois ?? []
  return POI_CATEGORIES.map((c) => {
    const ofCat = pois.filter((p) => p.category === c.id)
    return { id: c.id, label: c.label, count: ofCat.filter((p) => p.distanceM <= r.radius).length, nearest: ofCat[0] ?? null }
  })
}

export function nearestOf(r: EnvReport, id: PoiCategory): number | null {
  return summarizePois(r).find((c) => c.id === id)?.nearest?.distanceM ?? null
}

/**
 * Regelbasierte Zusammenfassung ohne KI: nur belegte Fakten, jede Aussage mit Quelle.
 * Trennung: „facts“ sind Messwerte, „hints“ Einordnungen, „gaps“ fehlende Daten.
 */
export function ruleSummary(r: EnvReport): { facts: string[]; hints: string[]; gaps: string[] } {
  const facts: string[] = []
  const hints: string[] = []
  const gaps: string[] = []
  const cats = summarizePois(r)
  const near = (id: PoiCategory) => cats.find((c) => c.id === id)!

  const park = near('gruen').nearest
  if (park) facts.push(`Nächste Grünfläche: ${park.name ?? 'ohne Namen'} in ${fmtM(park.distanceM)} Luftlinie (OpenStreetMap).`)
  const stop = near('oepnv').nearest ?? near('bahn').nearest
  if (stop) facts.push(`Nächste Haltestelle: ${stop.name ?? 'ohne Namen'} in ${fmtM(stop.distanceM)} (OpenStreetMap).`)
  if (r.pois.status === 'ok')
    facts.push(`Im Umkreis von ${fmtM(r.radius)}: ${near('schule').count} Schulen, ${near('kita').count} Kitas, ${near('einkauf').count} Supermärkte, ${near('medizin').count} medizinische Einrichtungen (OpenStreetMap).`)

  if (r.noise.data) {
    const l = loudest(r.noise.data, 'lden')
    const n = loudest(r.noise.data, 'lnight')
    const ring = loudest(r.noise.data, 'lden', true)
    if (l) facts.push(`Kartierte Lärmklasse am Punkt: ${NOISE_SOURCE_LABEL[l.source]} ${formatRange(l.range, 'lden')} ganztags${n ? `, nachts ${formatRange(n.range, 'lnight')}` : ''} (EU-Lärmkartierung 2022).`)
    else hints.push('Genau an diesem Punkt gibt es keine kartierte Lärmklasse (unter 55 dB oder nicht kartiert, nicht automatisch ruhig).')
    if (ring && (!l || (ring.rawClass ?? 0) > (l.rawClass ?? 0))) facts.push(`Im Umkreis von 75 m kartiert: ${NOISE_SOURCE_LABEL[ring.source]} ${formatRange(ring.range, 'lden')} ganztags, etwa an der nächsten Straße oder Bahnstrecke (EU-Lärmkartierung 2022).`)
  } else if (r.noise.status === 'error') gaps.push('Lärmdaten konnten nicht abgerufen werden.')

  const construction = near('baustelle')
  if (construction.count > 0) facts.push(`${construction.count} in OpenStreetMap eingetragene Baustellen im Umkreis, die nächste in ${fmtM(construction.nearest!.distanceM)}.`)

  if (r.planning.data?.covered) {
    const inProc = r.planning.data.plans.filter((p) => p.status === 'im Verfahren').length
    const valid = r.planning.data.plans.filter((p) => p.status === 'festgesetzt').length
    facts.push(`Bebauungspläne am Punkt: ${valid} festgesetzt, ${inProc} im Verfahren (${r.planning.data.region}).`)
    if (inProc) hints.push('Ein Plan im Verfahren ist noch keine genehmigte Baumaßnahme.')
  } else if (r.planning.data) gaps.push(`Bebauungspläne für ${r.planning.data.region ?? 'diese Region'} sind noch nicht angebunden; siehe ${r.planning.data.portal?.label}.`)

  if (r.landValue.data?.values.length) {
    const v = r.landValue.data.values[0]
    facts.push(`Bodenrichtwert: ${v.valueEurPerSqm.toLocaleString('de-DE')} €/m² (${v.usage ?? 'Nutzung k. A.'}, Stichtag ${v.referenceDate ?? 'k. A.'}, BORIS.NRW).`)
    hints.push('Der Bodenrichtwert ist ein Zonen-Durchschnitt, kein Verkehrswert.')
  } else if (r.landValue.data) gaps.push(r.landValue.data.note)

  if (r.council.data?.available) {
    const hits = r.council.data.papers.filter((p) => p.match)
    if (hits.length) facts.push(`${hits.length} aktuelle Ratsvorlagen mit Bezug zu Straße oder Planung (${r.council.data.system}).`)
  } else if (r.council.data) gaps.push(r.council.data.note)

  for (const s of [r.pois, r.noise, r.planning, r.landValue, r.council]) if (s.status === 'error') gaps.push(`Quelle nicht erreichbar: ${s.error}`)
  if ([r.pois, r.noise, r.planning, r.landValue, r.council].some((s) => s.status === 'loading')) hints.push('Einige Quellen antworten noch …')
  return { facts, hints, gaps }
}

/** Vergleich zweier Berichte desselben Orts: was hat sich geändert? (Abschnitt 11) */
export function diffReports(newer: EnvReport, older: EnvReport): string[] {
  const out: string[] = []
  const a = summarizePois(newer)
  const b = summarizePois(older)
  for (const c of a) {
    const prev = b.find((x) => x.id === c.id)
    if (prev && prev.count !== c.count) out.push(`${c.label}: ${prev.count} → ${c.count}`)
  }
  const pn = (r: EnvReport) => r.planning.data?.plans.map((p) => `${p.name} (${p.status})`) ?? []
  for (const p of pn(newer)) if (!pn(older).includes(p)) out.push(`Neu bei Bebauungsplänen: ${p}`)
  const cp = (r: EnvReport) => r.council.data?.papers.map((p) => p.id) ?? []
  const newCp = cp(newer).filter((id) => !cp(older).includes(id)).length
  if (newCp) out.push(`${newCp} neue Ratsvorlagen`)
  return out
}
