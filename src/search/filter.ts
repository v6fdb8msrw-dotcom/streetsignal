// Filtert gespeicherte Immobilien. Muss-Kriterien filtern, Wünsche zählen nur – sichtbar, ohne verdeckten Score.
// Unbekannt ist nie erfüllt (Punkt 10 der Erweiterung).
import { distanceM } from '../model/geo.ts'
import { mainPrice, type Property } from '../model/property.ts'
import type { PropertyFilter } from '../model/query.ts'
import { category } from '../model/taxonomy.ts'
import { nearestOf, type EnvReport } from '../services/environment.ts'
import type { PoiCategory } from '../services/overpass.ts'

export type Status = 'yes' | 'no' | 'unknown'

export interface EnvCriterion {
  id: string
  label: string
  hint: string
  group: 'Natur' | 'Wasser' | 'Erreichbarkeit' | 'Ruhe' | 'Veränderung'
  evaluate: (r: EnvReport) => { status: Status; evidence: string }
}

const near = (id: string, label: string, group: EnvCriterion['group'], poi: PoiCategory, maxM: number, what: string): EnvCriterion => ({
  id,
  label,
  group,
  hint: `${what} höchstens ${maxM >= 1000 ? `${maxM / 1000} km` : `${maxM} m`} Luftlinie (OpenStreetMap)`,
  evaluate: (r) => {
    if (r.pois.status !== 'ok') return { status: 'unknown', evidence: 'OpenStreetMap-Daten fehlen' }
    const d = nearestOf(r, poi)
    if (d === null) return { status: 'no', evidence: `kein Eintrag im Suchbereich` }
    return { status: d <= maxM ? 'yes' : 'no', evidence: `${what} in ${Math.round(d)} m` }
  },
})

export const ENV_CRITERIA: EnvCriterion[] = [
  near('park', 'Nähe zu Parks', 'Natur', 'gruen', 500, 'Grünfläche'),
  near('wald', 'Nähe zu Wäldern', 'Natur', 'wald', 1000, 'Wald'),
  near('aussicht', 'Aussichtspunkt in der Nähe', 'Natur', 'aussicht', 1500, 'Aussichtspunkt'),
  near('wasser', 'Nähe zu Wasser', 'Wasser', 'wasser', 1000, 'Gewässer'),
  near('oepnv', 'Nahverkehr vor der Tür', 'Erreichbarkeit', 'oepnv', 400, 'Haltestelle'),
  near('bahn', 'Bahnhof in der Nähe', 'Erreichbarkeit', 'bahn', 1000, 'Bahnhof'),
  near('einkauf', 'Einkauf in der Nähe', 'Erreichbarkeit', 'einkauf', 600, 'Supermarkt'),
  near('schule', 'Schule in der Nähe', 'Erreichbarkeit', 'schule', 1000, 'Schule'),
  near('kita', 'Kita in der Nähe', 'Erreichbarkeit', 'kita', 800, 'Kita'),
  near('medizin', 'Ärztliche Versorgung nah', 'Erreichbarkeit', 'medizin', 1000, 'Arzt/Apotheke/Klinik'),
  {
    id: 'ruhe',
    label: 'Geringe kartierte Lärmbelastung',
    group: 'Ruhe',
    hint: 'Keine kartierte Lärmklasse ab 60 dB (ganztags) am Punkt und im Umkreis von 75 m (EU-Lärmkartierung 2022). Keine Garantie für Ruhe.',
    evaluate: (r) => {
      if (!r.noise.data) return { status: 'unknown', evidence: 'Lärmdaten fehlen' }
      const loud = [...r.noise.data.values, ...(r.noise.data.nearby ?? [])].filter((v) => v.period === 'lden' && v.range && v.range[0] >= 60)
      return loud.length ? { status: 'no', evidence: `kartiert ab ${loud[0].range![0]} dB` } : { status: 'yes', evidence: 'keine Klasse ab 60 dB kartiert' }
    },
  },
  {
    id: 'kein_hochwasser',
    label: 'Außerhalb von Hochwasserflächen (HQ100)',
    group: 'Ruhe',
    hint: 'Nicht in einer Hochwassergefahrenfläche bei mittlerem Hochwasser (HQ100) laut BfG. Nur Deutschland; Starkregen nicht enthalten.',
    evaluate: (r) => {
      const f = r.flood?.data
      if (!f?.covered) return { status: 'unknown', evidence: 'Hochwasserdaten fehlen oder nicht abgedeckt' }
      return f.inArea.hq100 || f.inArea.haeufig ? { status: 'no', evidence: 'in Hochwassergefahrenfläche HQ100' } : { status: 'yes', evidence: f.inArea.extrem ? 'nur bei Extremhochwasser betroffen' : 'nicht betroffen' }
    },
  },
  {
    id: 'guter_takt',
    label: 'Dichter Nahverkehrstakt',
    group: 'Erreichbarkeit',
    hint: 'Deutschland: mindestens 200 Abfahrten pro Werktag an Haltestellen bis 500 m (Sollfahrplan gtfs.de). Schweiz: ÖV-Güteklasse A oder B.',
    evaluate: (r) => {
      const t = r.transit?.data
      if (!t?.covered) return { status: 'unknown', evidence: 'Fahrplandaten fehlen' }
      if (t.ovClass !== null) return /^[AB]/.test(t.ovClass) ? { status: 'yes', evidence: `ÖV-Güteklasse ${t.ovClass}` } : { status: 'no', evidence: `ÖV-Güteklasse ${t.ovClass}` }
      if (t.departures500 === null || t.partial) return { status: 'unknown', evidence: 'Nahverkehr noch nicht aufbereitet' }
      return { status: t.departures500 >= 200 ? 'yes' : 'no', evidence: `${t.departures500} Abfahrten/Werktag bis 500 m` }
    },
  },
  {
    id: 'keine_baustelle',
    label: 'Keine Baustelle in direkter Nähe',
    group: 'Veränderung',
    hint: 'Keine in OpenStreetMap eingetragene Baustelle im Umkreis von 300 m (Eintragungen sind unvollständig).',
    evaluate: (r) => {
      if (r.pois.status !== 'ok') return { status: 'unknown', evidence: 'OpenStreetMap-Daten fehlen' }
      const d = nearestOf(r, 'baustelle')
      return d !== null && d <= 300 ? { status: 'no', evidence: `Baustelle in ${Math.round(d)} m` } : { status: 'yes', evidence: 'keine eingetragene Baustelle ≤ 300 m' }
    },
  },
  {
    id: 'kein_bplan_verfahren',
    label: 'Kein laufendes Bebauungsplanverfahren am Ort',
    group: 'Veränderung',
    hint: 'Nur dort messbar, wo Bebauungspläne angebunden sind (derzeit Berlin, Hamburg).',
    evaluate: (r) => {
      if (!r.planning.data?.covered) return { status: 'unknown', evidence: 'für diese Region nicht angebunden' }
      const n = r.planning.data.plans.filter((p) => p.status === 'im Verfahren').length
      return n ? { status: 'no', evidence: `${n} Verfahren am Punkt` } : { status: 'yes', evidence: 'kein Verfahren am Punkt' }
    },
  },
]

export interface CriterionOutcome {
  id: string
  label: string
  mode: 'must' | 'wish'
  status: Status
  evidence: string
}

export interface FilterResult {
  property: Property
  report: EnvReport | null
  outcomes: CriterionOutcome[]
  unknown: string[]
  wishes: { yes: number; total: number }
}

type Check = 'ok' | 'out' | 'unknown'
function inRange(v: number | null, min: number | null, max: number | null): Check {
  if (min === null && max === null) return 'ok'
  if (v === null) return 'unknown'
  if (min !== null && v < min) return 'out'
  if (max !== null && v > max) return 'out'
  return 'ok'
}

export function applyFilter(props: Property[], reports: Map<string, EnvReport>, f: PropertyFilter): FilterResult[] {
  const out: FilterResult[] = []
  for (const p of props) {
    const unknown: string[] = []
    const keep = (c: Check, label: string) => {
      if (c === 'out') return false
      if (c === 'unknown') {
        if (!f.includeUnknown) return false
        unknown.push(label)
      }
      return true
    }
    if (f.statuses.length && !f.statuses.includes(p.status)) continue
    if (f.countries.length && !f.countries.includes(p.country)) continue
    if (f.area) {
      if (!p.location) {
        if (!keep('unknown', 'Lage')) continue
      } else if (distanceM([f.area.lat, f.area.lng], [p.location.lat, p.location.lng]) > f.area.radiusKm * 1000) continue
    }
    if (f.transactions.length && !keep(p.transaction.value === null ? 'unknown' : f.transactions.includes(p.transaction.value) ? 'ok' : 'out', 'Miete/Kauf')) continue
    if (f.categories.length && !keep(p.category.value === null ? 'unknown' : f.categories.includes(p.category.value) ? 'ok' : 'out', 'Immobilienart')) continue
    if (f.purposes.length) {
      const def = p.category.value ? category(p.category.value) : undefined
      if (!keep(!def ? 'unknown' : def.purposes.some((x) => f.purposes.includes(x)) ? 'ok' : 'out', 'Zweck')) continue
    }
    // Preise nie zwischen Währungen vergleichen
    const price = mainPrice(p).value
    const priceCheck = f.price.min === null && f.price.max === null ? 'ok' : p.currency !== f.price.currency ? 'unknown' : inRange(price, f.price.min, f.price.max)
    if (!keep(priceCheck, p.currency !== f.price.currency ? `Preis in ${p.currency}` : 'Preis')) continue
    if (!keep(inRange(p.livingArea.value, f.livingArea.min, f.livingArea.max), 'Wohnfläche')) continue
    if (!keep(inRange(p.plotArea.value, f.plotArea.min, f.plotArea.max), 'Grundstücksfläche')) continue
    if (!keep(inRange(p.rooms.value, f.roomsMin, null), 'Zimmer')) continue

    const report = reports.get(p.id) ?? null
    const outcomes: CriterionOutcome[] = []
    let failed = false
    for (const sel of f.criteria) {
      const def = ENV_CRITERIA.find((c) => c.id === sel.id)
      if (!def) continue
      const ev = report ? def.evaluate(report) : { status: 'unknown' as Status, evidence: 'Umgebung noch nicht analysiert' }
      outcomes.push({ id: def.id, label: def.label, mode: sel.mode, ...ev })
      if (sel.mode === 'must' && ev.status !== 'yes') {
        if (ev.status === 'unknown' && f.includeUnknown) unknown.push(def.label)
        else failed = true
      }
    }
    if (failed) continue
    const wishes = outcomes.filter((o) => o.mode === 'wish')
    out.push({ property: p, report, outcomes, unknown, wishes: { yes: wishes.filter((w) => w.status === 'yes').length, total: wishes.length } })
  }
  const pv = (r: FilterResult) => mainPrice(r.property).value
  out.sort((a, b) => {
    switch (f.sort) {
      case 'price_asc':
        return (pv(a) ?? Infinity) - (pv(b) ?? Infinity)
      case 'price_desc':
        return (pv(b) ?? -Infinity) - (pv(a) ?? -Infinity)
      case 'area_desc':
        return (b.property.livingArea.value ?? -1) - (a.property.livingArea.value ?? -1)
      case 'newest':
        return b.property.createdAt.localeCompare(a.property.createdAt)
      default:
        return b.wishes.yes - a.wishes.yes || a.unknown.length - b.unknown.length || b.property.createdAt.localeCompare(a.property.createdAt)
    }
  })
  return out
}
