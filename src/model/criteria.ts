// Einheitliche Kriterien für Wohnstil, Umgebung und Ausstattung (Punkte 6, 7, 9).
// Jedes Kriterium sagt selbst, wie es gemessen wird; die Schwelle steht sichtbar im Hinweis.
import type { Fact, Provenance } from './provenance.ts'
import type { FeatureKey, GeoFeature, Listing, SettlementType, StyleKey, UrbanZone } from './listing.ts'

export type CriterionKind = 'style' | 'environment' | 'feature'

export type CriterionGroup =
  | 'stil'
  | 'urban'
  | 'natur'
  | 'wasser'
  | 'berge'
  | 'erreichbarkeit'
  | 'ausstattung'

export const CRITERION_GROUPS: { id: CriterionGroup; label: string; kind: CriterionKind }[] = [
  { id: 'stil', label: 'Wohnstil und Architektur', kind: 'style' },
  { id: 'urban', label: 'Stadt und Urbanität', kind: 'environment' },
  { id: 'natur', label: 'Natur und Grün', kind: 'environment' },
  { id: 'wasser', label: 'Meer und Wasser', kind: 'environment' },
  { id: 'berge', label: 'Berge und alpine Umgebung', kind: 'environment' },
  { id: 'erreichbarkeit', label: 'Ruhe und Erreichbarkeit', kind: 'environment' },
  { id: 'ausstattung', label: 'Weitere Anforderungen', kind: 'feature' },
]

/** yes = erfüllt (belastbar), uncertain = erfüllt laut unsicherer Angabe, no, unknown */
export type MatchStatus = 'yes' | 'uncertain' | 'no' | 'unknown'

export interface Evaluation {
  status: MatchStatus
  /** Begründung in Klartext, z. B. „Park 320 m (OpenStreetMap)“ */
  evidence: string
  provenance: Provenance
}

/** Wie ein Kriterium ausgewertet wird. Als Daten beschrieben, damit neue Kriterien ohne Code dazukommen. */
export type Measure =
  | { type: 'distance'; feature: GeoFeature; maxM: number }
  | { type: 'settlement'; values: SettlementType[] }
  | { type: 'zone'; values: UrbanZone[] }
  | { type: 'waterfront'; feature?: GeoFeature; maxM?: number }
  | { type: 'noise'; maxDb: number }
  | { type: 'elevation'; minM: number }
  | { type: 'alpine' }
  | { type: 'green'; minShare: number }
  | { type: 'feature'; key: FeatureKey }
  | { type: 'style'; key: StyleKey }
  | { type: 'category'; ids: string[] }
  | { type: 'all'; of: Measure[] }
  | { type: 'any'; of: Measure[] }

export interface CriterionDef {
  id: string
  label: string
  group: CriterionGroup
  measure: Measure
  /** Sichtbar in der Oberfläche: woran gemessen wird */
  hint: string
}

const FEATURE_NAME: Record<GeoFeature, string> = {
  park: 'Park',
  wald: 'Wald',
  see: 'See',
  fluss: 'Fluss',
  meer: 'Meer',
  berge: 'Berge',
  wandergebiet: 'Wandergebiet',
  schutzgebiet: 'Schutz-/Erholungsgebiet',
  skigebiet: 'Skigebiet',
  hafen: 'Hafen',
  oepnv: 'ÖPNV-Haltestelle',
  einkauf: 'Einkauf',
  schule: 'Schule',
  kita: 'Kita',
  medizin: 'Arzt/Klinik',
  gewerbegebiet: 'Gewerbegebiet',
}

const SETTLEMENT_NAME: Record<SettlementType, string> = {
  grossstadt: 'Großstadt',
  kleinstadt: 'Kleinstadt',
  vorort: 'Vorort',
  dorf: 'Dorf',
  laendlich: 'ländlich',
  abgelegen: 'abgelegen',
}

const ZONE_NAME: Record<UrbanZone, string> = {
  innenstadt: 'Innenstadt',
  urbanes_viertel: 'urbanes Viertel',
  ruhiges_viertel: 'ruhiges Stadtviertel',
  stadtrand: 'Stadtrand',
  ausserhalb: 'außerhalb der Stadt',
}

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  balkon: 'Balkon',
  terrasse: 'Terrasse',
  garten: 'Garten',
  stellplatz: 'Stellplatz/Garage',
  aufzug: 'Aufzug',
  barrierefrei: 'Barrierefreier Zugang',
  moebliert: 'Möbliert',
  haustiere: 'Haustiere erlaubt',
  neubau: 'Neubau',
  energie: 'Energie-/Nachhaltigkeitsmerkmal',
  sofort_frei: 'Sofort verfügbar',
  seeblick: 'See-/Meerblick',
  skylineblick: 'Skylineblick',
  hochhaus: 'Hochhaus',
  bebaubar: 'Bebaubar (laut Quelle)',
}

export const STYLE_LABEL: Record<StyleKey, string> = {
  modern: 'modern',
  minimalistisch: 'minimalistisch',
  klassisch: 'klassisch',
  rustikal: 'rustikal',
  traditionell: 'traditionelle Architektur',
  historisch: 'historisch',
  luxurioes: 'luxuriöse Ausstattung',
}

const d = (id: string, label: string, group: CriterionGroup, feature: GeoFeature, maxM: number): CriterionDef => ({
  id,
  label,
  group,
  measure: { type: 'distance', feature, maxM },
  hint: `${FEATURE_NAME[feature]} höchstens ${fmtM(maxM)} Luftlinie`,
})

export function fmtM(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`
}

export const CRITERIA: CriterionDef[] = [
  // Wohnstil (getrennt von der Immobilienart, Punkt 6)
  { id: 'stil_modern', label: 'Modern', group: 'stil', measure: { type: 'style', key: 'modern' }, hint: 'Stilmerkmal im Inserat oder unsichere Bildanalyse' },
  { id: 'stil_minimal', label: 'Minimalistisch modern', group: 'stil', measure: { type: 'style', key: 'minimalistisch' }, hint: 'Stilmerkmal im Inserat oder unsichere Bildanalyse' },
  { id: 'stil_klassisch', label: 'Klassisch', group: 'stil', measure: { type: 'style', key: 'klassisch' }, hint: 'Stilmerkmal im Inserat oder unsichere Bildanalyse' },
  { id: 'stil_rustikal', label: 'Rustikal', group: 'stil', measure: { type: 'style', key: 'rustikal' }, hint: 'Stilmerkmal im Inserat oder unsichere Bildanalyse' },
  { id: 'stil_traditionell', label: 'Traditionelle Architektur', group: 'stil', measure: { type: 'style', key: 'traditionell' }, hint: 'Stilmerkmal im Inserat oder unsichere Bildanalyse' },
  { id: 'stil_historisch', label: 'Historisches Gebäude', group: 'stil', measure: { type: 'style', key: 'historisch' }, hint: 'nur belastbar, wenn die Quelle es bestätigt' },
  { id: 'stil_hochhaus', label: 'Wohnung im Hochhaus', group: 'stil', measure: { type: 'feature', key: 'hochhaus' }, hint: 'Angabe im Inserat' },
  { id: 'stil_skyline', label: 'Skylineblick', group: 'stil', measure: { type: 'feature', key: 'skylineblick' }, hint: 'nur aus dem Inserat; Aussicht wird nicht berechnet' },
  { id: 'art_penthouse', label: 'Penthouse-Charakter', group: 'stil', measure: { type: 'category', ids: ['penthouse'] }, hint: 'als Penthouse eingeordnet' },
  { id: 'art_villa', label: 'Villa', group: 'stil', measure: { type: 'category', ids: ['villa'] }, hint: 'als Villa eingeordnet (Optik allein reicht nicht)' },
  { id: 'art_landhaus', label: 'Landhaus', group: 'stil', measure: { type: 'category', ids: ['landhaus', 'bauernhaus'] }, hint: 'als Landhaus oder Bauernhaus eingeordnet' },
  { id: 'art_stadthaus', label: 'Stadthaus', group: 'stil', measure: { type: 'category', ids: ['stadthaus'] }, hint: 'als Stadthaus eingeordnet' },
  { id: 'art_chalet', label: 'Chalet', group: 'stil', measure: { type: 'category', ids: ['chalet'] }, hint: 'als Chalet eingeordnet' },
  { id: 'art_ferienhaus', label: 'Ferienhaus', group: 'stil', measure: { type: 'category', ids: ['ferienhaus', 'ferienimmobilie'] }, hint: 'als Ferienhaus/-immobilie eingeordnet' },

  // A. Stadt und Urbanität
  { id: 'u_grossstadt', label: 'Großstadt', group: 'urban', measure: { type: 'settlement', values: ['grossstadt'] }, hint: 'Siedlungstyp laut Gemeindedaten' },
  { id: 'u_innenstadt', label: 'Innenstadt / Stadtzentrum', group: 'urban', measure: { type: 'zone', values: ['innenstadt'] }, hint: 'Lage im Stadtgebiet' },
  { id: 'u_urban', label: 'Urbanes Viertel', group: 'urban', measure: { type: 'zone', values: ['urbanes_viertel', 'innenstadt'] }, hint: 'Lage im Stadtgebiet' },
  { id: 'u_ruhig', label: 'Ruhigeres Stadtviertel', group: 'urban', measure: { type: 'zone', values: ['ruhiges_viertel'] }, hint: 'Lage im Stadtgebiet' },
  { id: 'u_stadtrand', label: 'Stadtrand', group: 'urban', measure: { type: 'zone', values: ['stadtrand'] }, hint: 'Lage im Stadtgebiet' },
  { id: 'u_kleinstadt', label: 'Kleinstadt', group: 'urban', measure: { type: 'settlement', values: ['kleinstadt'] }, hint: 'Siedlungstyp laut Gemeindedaten' },
  { id: 'u_vorort', label: 'Vorort', group: 'urban', measure: { type: 'settlement', values: ['vorort'] }, hint: 'Siedlungstyp laut Gemeindedaten' },
  { id: 'u_dorf', label: 'Dorf', group: 'urban', measure: { type: 'settlement', values: ['dorf'] }, hint: 'Siedlungstyp laut Gemeindedaten' },
  { id: 'u_laendlich', label: 'Ländliche Umgebung', group: 'urban', measure: { type: 'settlement', values: ['laendlich', 'dorf', 'abgelegen'] }, hint: 'Siedlungstyp laut Gemeindedaten' },
  { id: 'u_abgelegen', label: 'Abgelegene Lage', group: 'urban', measure: { type: 'settlement', values: ['abgelegen'] }, hint: 'Siedlungstyp laut Gemeindedaten' },

  // B. Natur und Grün
  { id: 'n_gruen', label: 'Möglichst viel Grün', group: 'natur', measure: { type: 'green', minShare: 0.35 }, hint: 'mind. 35 % Grünfläche im Umkreis von 500 m' },
  d('n_park', 'Nähe zu Parks', 'natur', 'park', 500),
  d('n_wald', 'Nähe zu Wäldern', 'natur', 'wald', 1000),
  { id: 'n_naturnah', label: 'Naturnahe Wohnlage', group: 'natur', measure: { type: 'any', of: [{ type: 'green', minShare: 0.5 }, { type: 'distance', feature: 'wald', maxM: 300 }] }, hint: 'mind. 50 % Grün im Umkreis von 500 m oder Wald höchstens 300 m' },
  d('n_see', 'Nähe zu Seen', 'natur', 'see', 2000),
  d('n_fluss', 'Nähe zu Flüssen', 'natur', 'fluss', 1000),
  d('n_berge', 'Nähe zu Bergen', 'natur', 'berge', 15000),
  d('n_wandern', 'Nähe zu Wandergebieten', 'natur', 'wandergebiet', 5000),
  d('n_schutz', 'Nähe zu Schutz-/Erholungsgebieten', 'natur', 'schutzgebiet', 3000),

  // C. Meer und Wasser (nah ≠ direkt)
  d('w_meer_nah', 'Meeresnähe', 'wasser', 'meer', 5000),
  d('w_meer_direkt', 'Möglichst direkt am Meer', 'wasser', 'meer', 300),
  d('w_see_nah', 'Unmittelbare Nähe zu einem See', 'wasser', 'see', 300),
  { id: 'w_seegrundstueck', label: 'Seegrundstück', group: 'wasser', measure: { type: 'waterfront', feature: 'see', maxM: 50 }, hint: 'Grundstück grenzt laut Quelle an einen See' },
  d('w_fluss_nah', 'Nähe zu einem Fluss', 'wasser', 'fluss', 500),
  { id: 'w_direkt', label: 'Direkte Wasserlage / Uferlage', group: 'wasser', measure: { type: 'waterfront' }, hint: 'Grundstück grenzt laut Quelle direkt ans Wasser' },
  d('w_hafen', 'Hafennähe', 'wasser', 'hafen', 2000),

  // D. Berge
  { id: 'b_alpen', label: 'Alpenregion', group: 'berge', measure: { type: 'alpine' }, hint: 'liegt in der Alpenkonvention-Gebietskulisse' },
  { id: 'b_berg', label: 'Bergregion', group: 'berge', measure: { type: 'any', of: [{ type: 'elevation', minM: 600 }, { type: 'distance', feature: 'berge', maxM: 5000 }] }, hint: 'mind. 600 m ü. M. oder Berge höchstens 5 km' },
  { id: 'b_chalet', label: 'Chalet-Umgebung', group: 'berge', measure: { type: 'all', of: [{ type: 'alpine' }, { type: 'settlement', values: ['dorf', 'laendlich', 'abgelegen'] }] }, hint: 'Alpenregion und dörfliche oder ländliche Lage' },
  d('b_ski', 'Nähe zu Skigebieten', 'berge', 'skigebiet', 15000),
  { id: 'b_hoehe', label: 'Naturnahe Höhenlage', group: 'berge', measure: { type: 'all', of: [{ type: 'elevation', minM: 800 }, { type: 'green', minShare: 0.3 }] }, hint: 'mind. 800 m ü. M. und mind. 30 % Grün' },

  // E. Ruhe und Erreichbarkeit
  { id: 'e_ruhe', label: 'Geringe kartierte Lärmbelastung', group: 'erreichbarkeit', measure: { type: 'noise', maxDb: 50 }, hint: 'Lärmkartierung L_DEN höchstens 50 dB(A); keine Garantie für Ruhe' },
  d('e_oepnv', 'Nähe zu ÖPNV', 'erreichbarkeit', 'oepnv', 400),
  d('e_einkauf', 'Nähe zu Einkauf', 'erreichbarkeit', 'einkauf', 600),
  d('e_schule', 'Nähe zu Schulen', 'erreichbarkeit', 'schule', 1000),
  d('e_kita', 'Nähe zu Kitas', 'erreichbarkeit', 'kita', 800),
  d('e_medizin', 'Nähe zu medizinischer Versorgung', 'erreichbarkeit', 'medizin', 1000),
  d('e_gewerbe', 'Nähe zu Gewerbestandorten', 'erreichbarkeit', 'gewerbegebiet', 3000),

  // Weitere Anforderungen (Punkt 9)
  ...(['balkon', 'terrasse', 'garten', 'stellplatz', 'aufzug', 'barrierefrei', 'moebliert', 'haustiere', 'neubau', 'energie', 'sofort_frei', 'seeblick', 'bebaubar'] as FeatureKey[]).map(
    (key): CriterionDef => ({
      id: `f_${key}`,
      label: FEATURE_LABEL[key],
      group: 'ausstattung',
      measure: { type: 'feature', key },
      hint: key === 'seeblick' ? 'nur aus dem Inserat; Sichtachsen werden nicht berechnet' : key === 'bebaubar' ? 'nur wenn eine verlässliche Quelle die Bebaubarkeit angibt' : 'Angabe im Inserat',
    }),
  ),
]

const CRITERION_INDEX = new Map(CRITERIA.map((c) => [c.id, c]))
export const criterion = (id: string) => CRITERION_INDEX.get(id)

function status(p: Provenance, ok: boolean): MatchStatus {
  if (p === 'unavailable') return 'unknown'
  if (!ok) return 'no'
  return p === 'source' || p === 'user' ? 'yes' : 'uncertain'
}

function basisText(f: Fact<unknown>): string {
  return f.basis ? ` (${f.basis})` : ''
}

const UNKNOWN: Evaluation = { status: 'unknown', evidence: 'keine Angabe', provenance: 'unavailable' }

export function evaluateMeasure(m: Measure, l: Listing): Evaluation {
  switch (m.type) {
    case 'distance': {
      const f = l.geo.distances[m.feature]
      if (!f || f.value === null) return { ...UNKNOWN, evidence: `${FEATURE_NAME[m.feature]}: keine Geodaten` }
      return {
        status: status(f.provenance, f.value <= m.maxM),
        evidence: `${FEATURE_NAME[m.feature]} ${fmtM(f.value)}${basisText(f)}`,
        provenance: f.provenance,
      }
    }
    case 'settlement': {
      const f = l.geo.settlement
      if (f.value === null) return UNKNOWN
      return { status: status(f.provenance, m.values.includes(f.value)), evidence: `${SETTLEMENT_NAME[f.value]}${basisText(f)}`, provenance: f.provenance }
    }
    case 'zone': {
      const f = l.geo.zone
      if (f.value === null) return UNKNOWN
      return { status: status(f.provenance, m.values.includes(f.value)), evidence: `${ZONE_NAME[f.value]}${basisText(f)}`, provenance: f.provenance }
    }
    case 'waterfront': {
      const f = l.geo.waterfront
      if (f.value === null) return { ...UNKNOWN, evidence: 'Uferlage nicht angegeben' }
      let ok = f.value
      let evidence = f.value ? 'grenzt direkt ans Wasser' : 'keine Uferlage'
      if (ok && m.feature) {
        const dist = l.geo.distances[m.feature]
        ok = !!dist && dist.value !== null && dist.value <= (m.maxM ?? 50)
        evidence = ok ? `grenzt an ${FEATURE_NAME[m.feature]}` : `Ufer, aber nicht an einem ${FEATURE_NAME[m.feature]}`
      }
      return { status: status(f.provenance, ok), evidence: evidence + basisText(f), provenance: f.provenance }
    }
    case 'noise': {
      const f = l.geo.noiseDb
      if (f.value === null) return { ...UNKNOWN, evidence: 'keine Lärmkartierung' }
      return { status: status(f.provenance, f.value <= m.maxDb), evidence: `${f.value} dB(A) kartiert${basisText(f)}`, provenance: f.provenance }
    }
    case 'elevation': {
      const f = l.geo.elevationM
      if (f.value === null) return UNKNOWN
      return { status: status(f.provenance, f.value >= m.minM), evidence: `${f.value} m ü. M.${basisText(f)}`, provenance: f.provenance }
    }
    case 'alpine': {
      const f = l.geo.alpineRegion
      if (f.value === null) return UNKNOWN
      return { status: status(f.provenance, f.value), evidence: f.value ? 'Alpenregion' : 'nicht in den Alpen', provenance: f.provenance }
    }
    case 'green': {
      const f = l.geo.greenShare
      if (f.value === null) return UNKNOWN
      return { status: status(f.provenance, f.value >= m.minShare), evidence: `${Math.round(f.value * 100)} % Grün im Umkreis${basisText(f)}`, provenance: f.provenance }
    }
    case 'feature': {
      const f = l.features[m.key]
      if (!f || f.value === null) return { ...UNKNOWN, evidence: `${FEATURE_LABEL[m.key]}: keine Angabe` }
      return { status: status(f.provenance, f.value), evidence: `${FEATURE_LABEL[m.key]}: ${f.value ? 'ja' : 'nein'}${basisText(f)}`, provenance: f.provenance }
    }
    case 'style': {
      const f = l.styles[m.key]
      if (!f || f.value === null) return { ...UNKNOWN, evidence: `Stil „${STYLE_LABEL[m.key]}“: keine Angabe` }
      return { status: status(f.provenance, f.value), evidence: `${STYLE_LABEL[m.key]}: ${f.value ? 'ja' : 'nein'}${basisText(f)}`, provenance: f.provenance }
    }
    case 'category': {
      const hits = l.categories.filter((c) => c.value !== null && m.ids.includes(c.value))
      if (l.categories.length === 0) return UNKNOWN
      if (hits.length === 0) return { status: 'no', evidence: 'andere Immobilienart', provenance: 'source' }
      const best = hits.find((h) => h.provenance === 'source' || h.provenance === 'user') ?? hits[0]
      return { status: status(best.provenance, true), evidence: `eingeordnet als ${best.value}${basisText(best)}`, provenance: best.provenance }
    }
    case 'all':
    case 'any': {
      const parts = m.of.map((x) => evaluateMeasure(x, l))
      return combine(parts, m.type)
    }
  }
}

const RANK: Record<MatchStatus, number> = { no: 0, unknown: 1, uncertain: 2, yes: 3 }

function combine(parts: Evaluation[], mode: 'all' | 'any'): Evaluation {
  const pick = mode === 'all'
    ? parts.reduce((a, b) => (RANK[b.status] < RANK[a.status] ? b : a))
    : parts.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a))
  return { status: pick.status, evidence: parts.map((p) => p.evidence).join(' · '), provenance: pick.provenance }
}

export function evaluateCriterion(c: CriterionDef, l: Listing): Evaluation {
  return evaluateMeasure(c.measure, l)
}
