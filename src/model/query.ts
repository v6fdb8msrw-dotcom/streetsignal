// Filter und Suchprofile für die gespeicherten Immobilien (Erweiterung „Intelligente Suche“, Punkte 2–13).
import type { PersonalStatus } from './property.ts'
import type { Country, Currency, Purpose, Transaction } from './taxonomy.ts'

export type CriterionMode = 'must' | 'wish'

export interface CriterionSelection {
  id: string
  mode: CriterionMode
}

export interface Range {
  min: number | null
  max: number | null
}

export interface PropertyFilter {
  countries: Country[]
  /** Umkreis um einen Punkt (z. B. Frankfurt + 25 km) */
  area: { label: string; lat: number; lng: number; radiusKm: number } | null
  purposes: Purpose[]
  transactions: Transaction[]
  categories: string[]
  price: Range & { currency: Currency }
  livingArea: Range
  plotArea: Range
  roomsMin: number | null
  statuses: PersonalStatus[]
  criteria: CriterionSelection[]
  /** Objekte mit unbekannten Werten trotzdem zeigen (markiert) */
  includeUnknown: boolean
  sort: 'wishes' | 'price_asc' | 'price_desc' | 'area_desc' | 'newest'
}

export function emptyFilter(): PropertyFilter {
  return {
    countries: [],
    area: null,
    purposes: [],
    transactions: [],
    categories: [],
    price: { min: null, max: null, currency: 'EUR' },
    livingArea: { min: null, max: null },
    plotArea: { min: null, max: null },
    roomsMin: null,
    statuses: ['neu', 'interessant', 'favorit'],
    criteria: [],
    includeUnknown: false,
    sort: 'wishes',
  }
}

export interface SavedProfile {
  id: string
  name: string
  filter: PropertyFilter
  createdAt: string
  updatedAt: string
}
