// Vorsichtige Duplikaterkennung (Meta-Suche Abschnitt 7): nur Vorschläge, nie automatisches Zusammenführen.
import { distanceM } from '../model/geo.ts'
import { mainPrice, type Property } from '../model/property.ts'

export interface DuplicateHint {
  property: Property
  reasons: string[]
  /** gleiche URL = sicher; sonst nur Hinweis */
  certain: boolean
}

const close = (a: number | null, b: number | null, tol: number) => a !== null && b !== null && Math.abs(a - b) <= Math.max(a, b) * tol

export function findDuplicates(candidate: Property, existing: Property[]): DuplicateHint[] {
  const out: DuplicateHint[] = []
  const urls = new Set(candidate.offers.map((o) => o.url).filter(Boolean))
  for (const p of existing) {
    if (p.id === candidate.id) continue
    const reasons: string[] = []
    if (p.offers.some((o) => o.url && urls.has(o.url))) {
      out.push({ property: p, reasons: ['gleicher Link'], certain: true })
      continue
    }
    const ext = candidate.offers.find((o) => o.externalId)
    if (ext && p.offers.some((o) => o.externalId === ext.externalId && o.portalId === ext.portalId)) reasons.push('gleiche Objekt-ID')
    if (candidate.location && p.location && candidate.location.precision === 'exact' && p.location.precision === 'exact' && distanceM([candidate.location.lat, candidate.location.lng], [p.location.lat, p.location.lng]) < 30) reasons.push('gleiche Adresse')
    if (candidate.transaction.value && candidate.transaction.value === p.transaction.value && close(mainPrice(candidate).value, mainPrice(p).value, 0.03)) reasons.push('ähnlicher Preis')
    if (close(candidate.livingArea.value, p.livingArea.value, 0.03)) reasons.push('ähnliche Fläche')
    if (candidate.category.value && candidate.category.value === p.category.value) reasons.push('gleiche Immobilienart')
    // Mindestens Adresse plus zwei weitere Merkmale, sonst kein Hinweis
    if (reasons.includes('gleiche Adresse') && reasons.length >= 3) out.push({ property: p, reasons, certain: false })
    else if (reasons.includes('gleiche Objekt-ID')) out.push({ property: p, reasons, certain: false })
  }
  return out
}
