// Suchlogik (Punkte 2, 8, 10): Muss-Kriterien filtern, Wunsch-Kriterien werden nur gezählt und offen gezeigt.
// Kein verdeckter Score: Sortierung nach Wünschen = Anzahl belastbar erfüllter Wünsche, dann unsicher erfüllter.
import { criterion, evaluateCriterion, type Evaluation, type MatchStatus } from '../model/criteria.ts'
import { distanceM, inPolygon, LANDSCAPES } from '../model/geo.ts'
import type { Listing } from '../model/listing.ts'
import { isReliable } from '../model/provenance.ts'
import type { Fact } from '../model/provenance.ts'
import type { CriterionMode, PriceBasis, Range, SearchArea, SearchQuery } from '../model/query.ts'
import { category } from '../model/taxonomy.ts'

export interface CriterionResult {
  id: string
  label: string
  mode: CriterionMode
  evaluation: Evaluation
}

export interface PriceView {
  label: string
  value: number | null
  currency: string
  perSqm: number | null
}

export interface ListingResult {
  listing: Listing
  /** true = alle Muss-Kriterien belastbar erfüllt */
  mustOk: boolean
  /** Muss-Kriterien, die nur wegen „Unbekannte einschließen“ durchgelassen wurden */
  unknownMusts: string[]
  criteria: CriterionResult[]
  wishes: { yes: number; uncertain: number; unknown: number; no: number; total: number }
  /** Welche Größen unbekannt waren und eingeschlossen wurden */
  includedUnknown: string[]
  price: PriceView
  /** Suchgebiete, in die das Objekt fällt */
  areaIds: string[]
}

export interface ResultGroup {
  objectId: string
  primary: ListingResult
  offers: ListingResult[]
}

export interface SearchOutput {
  groups: ResultGroup[]
  total: number
  fromSources: number
  manual: number
  excluded: { area: number; type: number; price: number; size: number; criteria: number; source: number }
}

export function areaContains(area: SearchArea, l: Listing): boolean {
  switch (area.kind) {
    case 'country':
      return l.address.country === area.country
    case 'region':
      return l.address.country === area.country && l.address.region === area.region
    case 'city':
      if (area.wholeCity) return l.address.city === area.city || distanceM(area.center, l.position) <= area.radiusKm * 1000
      return distanceM(area.center, l.position) <= area.radiusKm * 1000
    case 'radius':
      return distanceM(area.center, l.position) <= area.radiusKm * 1000
    case 'landscape': {
      const ls = LANDSCAPES.find((x) => x.id === area.landscapeId)
      return !!ls && inPolygon(l.position, ls.polygon)
    }
  }
}

function effectiveBasis(basis: PriceBasis, l: Listing): Exclude<PriceBasis, 'auto'> {
  if (basis !== 'auto') return basis
  if (l.transaction === 'kauf') return 'kauf'
  if (l.transaction === 'pacht') return 'pacht'
  return 'kalt'
}

const BASIS_LABEL = { kalt: 'Kaltmiete', warm: 'Warmmiete', kauf: 'Kaufpreis', pacht: 'Pacht/Monat' } as const

function priceFact(basis: Exclude<PriceBasis, 'auto'>, l: Listing): Fact<number> {
  const p = l.prices
  switch (basis) {
    case 'kalt':
      return p.coldRent.value !== null ? p.coldRent : p.warmRent.value !== null && l.transaction === 'miete' ? { ...p.warmRent, basis: 'nur Warmmiete angegeben' } : p.coldRent
    case 'warm':
      return p.warmRent
    case 'kauf':
      return p.purchase
    case 'pacht':
      return p.lease
  }
}

/** Bezugsfläche für den Quadratmeterpreis: Wohnfläche, sonst Nutzfläche, bei Grundstücken die Grundstücksfläche. */
export function referenceArea(l: Listing): Fact<number> {
  const s = l.sizes
  const isPlot = l.categories.some((c) => c.value !== null && category(c.value)?.group === 'grundstueck')
  if (isPlot) return s.plotArea
  if (s.livingArea.value !== null) return s.livingArea
  return s.usableArea
}

export function priceView(l: Listing, basis: PriceBasis): PriceView {
  const b = effectiveBasis(basis, l)
  const f = priceFact(b, l)
  const area = referenceArea(l)
  const perSqm = f.value !== null && area.value ? f.value / area.value : null
  // Bei Miete ohne Kaltmiete zeigt die Liste ehrlich „Warmmiete“
  const label = b === 'kalt' && l.prices.coldRent.value === null && l.prices.warmRent.value !== null ? 'Warmmiete' : BASIS_LABEL[b]
  return { label, value: f.value, currency: l.prices.currency, perSqm }
}

type RangeCheck = 'ok' | 'out' | 'unknown'

function checkRange(value: number | null, r: Range): RangeCheck {
  if (r.min === null && r.max === null) return 'ok'
  if (value === null) return 'unknown'
  if (r.min !== null && value < r.min) return 'out'
  if (r.max !== null && value > r.max) return 'out'
  return 'ok'
}

function sizeValue(f: Fact<number>, allowUncertain: boolean): number | null {
  return f.value !== null && isReliable(f.provenance, allowUncertain) ? f.value : null
}

export function search(listings: Listing[], q: SearchQuery, integratedSources: Set<string>): SearchOutput {
  const excluded = { area: 0, type: 0, price: 0, size: 0, criteria: 0, source: 0 }
  const results: ListingResult[] = []

  for (const l of listings) {
    // Quelle
    if (!integratedSources.has(l.sourceId) || (q.sources.length > 0 && !q.sources.includes(l.sourceId))) {
      excluded.source++
      continue
    }

    // Gebiet: ODER über alle Gebiete
    const areaIds = q.areas.filter((a) => areaContains(a, l)).map((a) => a.id)
    if (q.areas.length > 0 && areaIds.length === 0) {
      excluded.area++
      continue
    }

    // Zweck, Transaktion, Immobilienart
    // Nur belastbare Einordnungen zählen; vermutete nur mit „unsichere Angaben zulassen“
    const cats = l.categories.filter((c) => c.value !== null && isReliable(c.provenance, q.allowUncertain)).map((c) => c.value!)
    if (q.purposes.length > 0 && !l.purposes.some((p) => q.purposes.includes(p))) {
      excluded.type++
      continue
    }
    if (q.transactions.length > 0 && !q.transactions.includes(l.transaction)) {
      excluded.type++
      continue
    }
    if (q.categories.length > 0) {
      if (!cats.some((c) => q.categories.includes(c))) {
        excluded.type++
        continue
      }
    }

    const includedUnknown: string[] = []

    // Preis
    const price = priceView(l, q.price.basis)
    const priceValue = q.price.perSqm ? price.perSqm : price.value
    let pc = checkRange(priceValue, q.price)
    const priceActive = q.price.min !== null || q.price.max !== null
    if (priceActive && price.currency !== q.price.currency) pc = 'unknown' // keine Umrechnung zwischen Währungen
    if (pc === 'out' || (pc === 'unknown' && !q.includeUnknown.price)) {
      excluded.price++
      continue
    }
    if (pc === 'unknown') includedUnknown.push(price.currency !== q.price.currency ? `Preis in ${price.currency}` : 'Preis')

    // Größen (Wohnfläche ≠ Grundstücksfläche)
    const sizeChecks: [string, RangeCheck, boolean][] = [
      ['Wohnfläche', checkRange(sizeValue(l.sizes.livingArea, q.allowUncertain) ?? (cats.some((c) => category(c)?.group === 'gewerbe') ? sizeValue(l.sizes.usableArea, q.allowUncertain) : null), q.livingArea), q.includeUnknown.livingArea],
      ['Grundstücksfläche', checkRange(sizeValue(l.sizes.plotArea, q.allowUncertain), q.plotArea), q.includeUnknown.plotArea],
      ['Zimmer', checkRange(sizeValue(l.sizes.rooms, q.allowUncertain), q.rooms), q.includeUnknown.rooms],
      ['Schlafzimmer', checkRange(sizeValue(l.sizes.bedrooms, q.allowUncertain), { min: q.bedroomsMin, max: null }), q.includeUnknown.rooms],
    ]
    let sizeFail = false
    for (const [name, check, inc] of sizeChecks) {
      if (check === 'out' || (check === 'unknown' && !inc)) sizeFail = true
      else if (check === 'unknown') includedUnknown.push(name)
    }
    if (sizeFail) {
      excluded.size++
      continue
    }

    // Kriterien
    const crit: CriterionResult[] = []
    for (const sel of q.criteria) {
      const def = criterion(sel.id)
      if (!def) continue
      crit.push({ id: def.id, label: def.label, mode: sel.mode, evaluation: evaluateCriterion(def, l) })
    }
    for (const t of q.targets) {
      const dist = distanceM(t.position, l.position)
      const ok = dist <= t.maxKm * 1000
      // Ungenauer Standort: nur sicher, wenn auch mit Unschärfe im Radius
      const evaluation: Evaluation = {
        status: ok ? (l.precision === 'exact' || l.precision === 'street' ? 'yes' : 'uncertain') : 'no',
        evidence: `${(dist / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km Luftlinie bis ${t.label}`,
        provenance: l.precision === 'exact' || l.precision === 'street' ? 'source' : 'extracted',
      }
      crit.push({ id: `target:${t.id}`, label: `${t.label} ≤ ${t.maxKm} km`, mode: t.mode, evaluation })
    }

    const unknownMusts: string[] = []
    let mustFail = false
    for (const c of crit) {
      if (c.mode !== 'must') continue
      const s: MatchStatus = c.evaluation.status
      if (s === 'yes') continue
      if (s === 'uncertain' && q.allowUncertain) continue
      if ((s === 'unknown' || s === 'uncertain') && q.includeUnknown.mustCriteria) {
        unknownMusts.push(c.label)
        continue
      }
      mustFail = true
      break
    }
    if (mustFail) {
      excluded.criteria++
      continue
    }

    const wishes = { yes: 0, uncertain: 0, unknown: 0, no: 0, total: 0 }
    for (const c of crit) {
      if (c.mode !== 'wish') continue
      wishes.total++
      wishes[c.evaluation.status]++
    }

    results.push({
      listing: l,
      mustOk: unknownMusts.length === 0 && includedUnknown.length === 0,
      unknownMusts,
      criteria: crit,
      wishes,
      includedUnknown,
      price,
      areaIds,
    })
  }

  sortResults(results, q)

  const groups: ResultGroup[] = []
  if (q.groupDuplicates) {
    const byObj = new Map<string, ResultGroup>()
    for (const r of results) {
      const g = byObj.get(r.listing.objectId)
      if (g) g.offers.push(r)
      else {
        const ng = { objectId: r.listing.objectId, primary: r, offers: [r] }
        byObj.set(r.listing.objectId, ng)
        groups.push(ng)
      }
    }
  } else {
    for (const r of results) groups.push({ objectId: r.listing.id, primary: r, offers: [r] })
  }

  const manual = results.filter((r) => r.listing.sourceId === 'manual').length
  return { groups, total: results.length, fromSources: results.length - manual, manual, excluded }
}

function sortResults(rs: ListingResult[], q: SearchQuery) {
  const pv = (r: ListingResult) => (q.price.perSqm ? r.price.perSqm : r.price.value)
  const area = (r: ListingResult) => r.listing.sizes.livingArea.value ?? r.listing.sizes.usableArea.value ?? r.listing.sizes.plotArea.value ?? -1
  rs.sort((a, b) => {
    switch (q.sort) {
      case 'wishes':
        return b.wishes.yes - a.wishes.yes || b.wishes.uncertain - a.wishes.uncertain || Number(b.mustOk) - Number(a.mustOk) || a.listing.title.localeCompare(b.listing.title)
      case 'price_asc':
        return (pv(a) ?? Infinity) - (pv(b) ?? Infinity)
      case 'price_desc':
        return (pv(b) ?? -Infinity) - (pv(a) ?? -Infinity)
      case 'area_desc':
        return area(b) - area(a)
      case 'newest':
        return b.listing.addedAt.localeCompare(a.listing.addedAt)
    }
  })
}
