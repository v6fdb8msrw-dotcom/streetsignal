// Vergleich mit persönlichen Gewichtungen (Master-Prompt Abschnitt 7). Offengelegte Rechnung:
// Pro Faktor bekommt das beste Objekt 1, das schlechteste 0, dazwischen linear. Unbekannt = 0 Punkte, sichtbar markiert.
import { pricePerSqm, type Property } from '../model/property.ts'
import { nearestOf, summarizePois, type EnvReport } from '../services/environment.ts'

export type FactorId = 'ruhe' | 'gruen' | 'oepnv' | 'takt' | 'hochwasser' | 'versorgung' | 'baustellen' | 'preis_qm'

export interface Factor {
  id: FactorId
  label: string
  better: 'lower' | 'higher'
  describe: string
  value: (p: Property, r: EnvReport | null) => number | null
  format: (v: number, p: Property) => string
}

export const FACTORS: Factor[] = [
  {
    id: 'ruhe',
    label: 'Ruhe',
    better: 'lower',
    describe: 'höchste kartierte Lärmklasse ganztags am Punkt und im Umkreis von 75 m (0 = keine Klasse ab 55 dB)',
    value: (_p, r) => (r?.noise.data ? Math.max(0, ...[...r.noise.data.values, ...(r.noise.data.nearby ?? [])].filter((v) => v.period === 'lden').map((v) => v.rawClass ?? 0)) : null),
    format: (v) => (v === 0 ? 'keine Klasse ≥ 55 dB' : ['', '55–60 dB', '60–65 dB', '65–70 dB', '70–75 dB', '> 75 dB'][v]),
  },
  {
    id: 'gruen',
    label: 'Grün in der Nähe',
    better: 'lower',
    describe: 'Abstand zur nächsten Grünfläche',
    value: (_p, r) => (r?.pois.data ? nearestOf(r, 'gruen') : null),
    format: (v) => `${Math.round(v)} m`,
  },
  {
    id: 'oepnv',
    label: 'Verkehrsanbindung',
    better: 'lower',
    describe: 'Abstand zur nächsten Haltestelle oder zum nächsten Bahnhof',
    value: (_p, r) => {
      if (!r?.pois.data) return null
      const d = [nearestOf(r, 'oepnv'), nearestOf(r, 'bahn')].filter((x): x is number => x !== null)
      return d.length ? Math.min(...d) : null
    },
    format: (v) => `${Math.round(v)} m`,
  },
  {
    id: 'takt',
    label: 'Nahverkehrstakt',
    better: 'higher',
    describe: 'Abfahrten pro Werktag an Haltestellen bis 500 m (Sollfahrplan, nur Deutschland)',
    value: (_p, r) => (r?.transit?.data?.partial ? null : (r?.transit?.data?.departures500 ?? null)),
    format: (v) => `${v.toLocaleString('de-DE')} Abfahrten`,
  },
  {
    id: 'hochwasser',
    label: 'Hochwassersicherheit',
    better: 'lower',
    describe: 'BfG-Hochwasserflächen: 0 = nie betroffen, 1 = nur extrem, 2 = HQ100, 3 = häufig (nur Deutschland)',
    value: (_p, r) => {
      const f = r?.flood?.data
      if (!f?.covered) return null
      return f.inArea.haeufig ? 3 : f.inArea.hq100 ? 2 : f.inArea.extrem ? 1 : 0
    },
    format: (v) => ['nicht betroffen', 'nur bei Extremhochwasser', 'bei HQ100', 'schon bei häufigem Hochwasser'][v],
  },
  {
    id: 'versorgung',
    label: 'Versorgung',
    better: 'higher',
    describe: 'Anzahl Supermärkte, Ärzte, Schulen und Kitas im Analyse-Umkreis',
    value: (_p, r) => (r?.pois.data ? summarizePois(r).filter((c) => ['einkauf', 'medizin', 'schule', 'kita'].includes(c.id)).reduce((a, c) => a + c.count, 0) : null),
    format: (v) => `${v} Einrichtungen`,
  },
  {
    id: 'baustellen',
    label: 'Wenige Bauvorhaben',
    better: 'lower',
    describe: 'Baustellen (OpenStreetMap) plus Bebauungsplanverfahren am Ort (wo angebunden)',
    value: (_p, r) => {
      if (!r?.pois.data) return null
      const sites = summarizePois(r).find((c) => c.id === 'baustelle')?.count ?? 0
      const plans = r.planning.data?.plans.filter((x) => x.status === 'im Verfahren').length ?? 0
      return sites + plans
    },
    format: (v) => `${v} bekannt`,
  },
  {
    id: 'preis_qm',
    label: 'Preis pro m²',
    better: 'lower',
    describe: 'Preis geteilt durch Wohnfläche (bei Grundstücken: Grundstücksfläche); nur gleiche Währung und Angebotsart vergleichbar',
    value: (p) => pricePerSqm(p),
    format: (v, p) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency, maximumFractionDigits: v < 100 ? 2 : 0 }).format(v),
  },
]

export interface ScoreCell {
  factor: FactorId
  raw: number | null
  points: number
  note: string | null
}

export interface ScoreRow {
  property: Property
  cells: ScoreCell[]
  total: number
  max: number
}

export function score(items: { property: Property; report: EnvReport | null }[], weights: Record<FactorId, number>): ScoreRow[] {
  // Preis/m² nur vergleichen, wenn alle dieselbe Währung und Angebotsart haben
  const priceComparable = new Set(items.map((i) => `${i.property.currency}/${i.property.transaction.value}`)).size === 1
  const rows: ScoreRow[] = items.map((i) => ({ property: i.property, cells: [], total: 0, max: 0 }))
  for (const f of FACTORS) {
    const w = weights[f.id]
    const raws = items.map((i) => (f.id === 'preis_qm' && !priceComparable ? null : f.value(i.property, i.report)))
    const known = raws.filter((v): v is number => v !== null)
    const lo = Math.min(...known)
    const hi = Math.max(...known)
    items.forEach((_, k) => {
      const raw = raws[k]
      let points = 0
      let note: string | null = null
      if (raw === null) note = f.id === 'preis_qm' && !priceComparable ? 'nicht vergleichbar (Währung/Angebotsart)' : 'unbekannt, 0 Punkte'
      // Mit nur einem bekannten Wert gibt es nichts zu vergleichen: keine Punkte für niemanden
      else if (known.length < 2) note = 'nur hier bekannt, nicht verglichen'
      else points = hi === lo ? 1 : f.better === 'lower' ? (hi - raw) / (hi - lo) : (raw - lo) / (hi - lo)
      rows[k].cells.push({ factor: f.id, raw, points: points * w, note })
      rows[k].total += points * w
      rows[k].max += w
    })
  }
  return rows
}
