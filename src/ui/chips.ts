// Aktive Filter als einzeln entfernbare Chips (Punkt 11).
import { criterion } from '../model/criteria.ts'
import type { SearchQuery } from '../model/query.ts'
import { sourceById } from '../data/sources.ts'
import { category, PURPOSES, TRANSACTIONS, COUNTRIES } from '../model/taxonomy.ts'
import { num } from './format.ts'

export interface Chip {
  key: string
  label: string
  tone?: 'must' | 'wish' | 'area'
  remove: (q: SearchQuery) => void
}

function rangeLabel(name: string, min: number | null, max: number | null, unit: string): string {
  if (min !== null && max !== null) return `${name} ${num(min)}–${num(max)} ${unit}`
  if (min !== null) return `${name} ab ${num(min)} ${unit}`
  return `${name} bis ${num(max)} ${unit}`
}

export function activeChips(q: SearchQuery): Chip[] {
  const out: Chip[] = []
  for (const a of q.areas) {
    const label =
      a.kind === 'country' ? COUNTRIES.find((c) => c.id === a.country)!.label
      : a.kind === 'region' ? `${a.region} (${a.country})`
      : a.kind === 'city' ? (a.wholeCity ? `${a.label} (ganze Stadt)` : `${a.label} + ${a.radiusKm} km`)
      : a.kind === 'radius' ? `${a.label} + ${a.radiusKm} km`
      : a.label
    out.push({ key: `area:${a.id}`, label, tone: 'area', remove: (x) => void (x.areas = x.areas.filter((y) => y.id !== a.id)) })
  }
  for (const p of q.purposes)
    out.push({ key: `p:${p}`, label: PURPOSES.find((x) => x.id === p)!.label, remove: (x) => void (x.purposes = x.purposes.filter((y) => y !== p)) })
  for (const t of q.transactions)
    out.push({ key: `t:${t}`, label: TRANSACTIONS.find((x) => x.id === t)!.label, remove: (x) => void (x.transactions = x.transactions.filter((y) => y !== t)) })
  for (const c of q.categories)
    out.push({ key: `c:${c}`, label: category(c)?.label ?? c, remove: (x) => void (x.categories = x.categories.filter((y) => y !== c)) })
  if (q.price.min !== null || q.price.max !== null)
    out.push({ key: 'price', label: rangeLabel(q.price.perSqm ? 'Preis/m²' : 'Preis', q.price.min, q.price.max, q.price.currency), remove: (x) => void ((x.price.min = null), (x.price.max = null)) })
  if (q.livingArea.min !== null || q.livingArea.max !== null)
    out.push({ key: 'living', label: rangeLabel('Wohnfläche', q.livingArea.min, q.livingArea.max, 'm²'), remove: (x) => void (x.livingArea = { min: null, max: null }) })
  if (q.plotArea.min !== null || q.plotArea.max !== null)
    out.push({ key: 'plot', label: rangeLabel('Grundstück', q.plotArea.min, q.plotArea.max, 'm²'), remove: (x) => void (x.plotArea = { min: null, max: null }) })
  if (q.rooms.min !== null || q.rooms.max !== null)
    out.push({ key: 'rooms', label: rangeLabel('Zimmer', q.rooms.min, q.rooms.max, ''), remove: (x) => void (x.rooms = { min: null, max: null }) })
  if (q.bedroomsMin !== null) out.push({ key: 'beds', label: `ab ${q.bedroomsMin} Schlafzimmer`, remove: (x) => void (x.bedroomsMin = null) })
  for (const c of q.criteria) {
    const def = criterion(c.id)
    if (!def) continue
    out.push({ key: `k:${c.id}`, label: `${c.mode === 'must' ? 'Muss' : 'Wunsch'}: ${def.label}`, tone: c.mode, remove: (x) => void (x.criteria = x.criteria.filter((y) => y.id !== c.id)) })
  }
  for (const t of q.targets)
    out.push({ key: `z:${t.id}`, label: `${t.mode === 'must' ? 'Muss' : 'Wunsch'}: ${t.label} ≤ ${t.maxKm} km`, tone: t.mode, remove: (x) => void (x.targets = x.targets.filter((y) => y.id !== t.id)) })
  for (const s of q.sources)
    out.push({ key: `s:${s}`, label: `Quelle: ${sourceById(s)?.name ?? s}`, remove: (x) => void (x.sources = x.sources.filter((y) => y !== s)) })
  if (q.allowUncertain) out.push({ key: 'unc', label: 'unsichere Angaben zugelassen', remove: (x) => void (x.allowUncertain = false) })
  return out
}
