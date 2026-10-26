import type { LatLng } from './listing.ts'
import type { Country, Currency, Purpose, Transaction } from './taxonomy.ts'

/** Ein Suchgebiet. Mehrere Gebiete werden mit ODER verknüpft (Punkt 2). */
export type SearchArea =
  | { id: string; kind: 'country'; country: Country }
  | { id: string; kind: 'region'; country: Country; region: string }
  | { id: string; kind: 'city'; placeId: string; label: string; center: LatLng; country: Country; city: string; radiusKm: number; wholeCity: boolean }
  | { id: string; kind: 'radius'; label: string; center: LatLng; radiusKm: number }
  | { id: string; kind: 'landscape'; landscapeId: string; label: string }

export type CriterionMode = 'must' | 'wish'

export interface CriterionSelection {
  id: string
  mode: CriterionMode
}

/** Persönliches Ziel (Arbeitsplatz, Schule der Kinder …), Punkt 7E */
export interface PersonalTarget {
  id: string
  label: string
  position: LatLng
  maxKm: number
  mode: CriterionMode
}

export type PriceBasis = 'auto' | 'kalt' | 'warm' | 'kauf' | 'pacht'

export interface Range {
  min: number | null
  max: number | null
}

export interface SearchQuery {
  areas: SearchArea[]
  purposes: Purpose[]
  transactions: Transaction[]
  categories: string[]
  price: Range & { basis: PriceBasis; perSqm: boolean; currency: Currency }
  livingArea: Range
  plotArea: Range
  rooms: Range
  bedroomsMin: number | null
  /** Unbekannte Werte trotzdem einschließen (Punkt 8) */
  includeUnknown: { price: boolean; livingArea: boolean; plotArea: boolean; rooms: boolean; mustCriteria: boolean }
  /** Extrahierte und KI-vermutete Angaben für Muss-Kriterien zulassen */
  allowUncertain: boolean
  criteria: CriterionSelection[]
  targets: PersonalTarget[]
  /** leere Liste = alle integrierten Quellen */
  sources: string[]
  sort: SortKey
  groupDuplicates: boolean
}

export type SortKey = 'wishes' | 'price_asc' | 'price_desc' | 'area_desc' | 'newest'

export const SORT_LABEL: Record<SortKey, string> = {
  wishes: 'Erfüllte Wünsche',
  price_asc: 'Preis aufsteigend',
  price_desc: 'Preis absteigend',
  area_desc: 'Fläche absteigend',
  newest: 'Neueste zuerst',
}

export function emptyQuery(): SearchQuery {
  return {
    areas: [],
    purposes: [],
    transactions: [],
    categories: [],
    price: { min: null, max: null, basis: 'auto', perSqm: false, currency: 'EUR' },
    livingArea: { min: null, max: null },
    plotArea: { min: null, max: null },
    rooms: { min: null, max: null },
    bedroomsMin: null,
    includeUnknown: { price: false, livingArea: false, plotArea: false, rooms: false, mustCriteria: false },
    allowUncertain: false,
    criteria: [],
    targets: [],
    sources: [],
    sort: 'wishes',
    groupDuplicates: true,
  }
}

export interface SavedProfile {
  id: string
  name: string
  query: SearchQuery
  createdAt: string
  updatedAt: string
  /** Vorbereitet: Benachrichtigung nur für Quellen mit zulässigem Feed */
  notify: boolean
}
