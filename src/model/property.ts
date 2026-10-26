// Immobilienprofil (Master-Prompt Abschnitt 6, Meta-Suche Abschnitt 5).
// Jede Angabe trägt ihre Herkunft; fehlende Werte bleiben null und werden als „unbekannt“ gezeigt.
import type { Fact } from './provenance.ts'
import type { LocationPrecision } from './listing.ts'
import type { Country, Currency, Transaction } from './taxonomy.ts'

/** Wie das Inserat in StreetSignal gelangt ist (Adaptertypen aus Abschnitt 4.3) */
export type ImportMethod =
  | 'manual-link' // nur Link gespeichert
  | 'user-form' // Werte selbst eingetragen
  | 'user-provided-text' // eingefügter Inseratstext
  | 'user-provided-document' // PDF oder Screenshot
  | 'permitted-public-page' // automatischer Abruf einer freigegebenen Seite
  | 'authorized-api'
  | 'authorized-broker-feed'

export const IMPORT_METHOD_LABEL: Record<ImportMethod, string> = {
  'manual-link': 'nur Link gespeichert',
  'user-form': 'selbst eingetragen',
  'user-provided-text': 'aus eingefügtem Text erkannt',
  'user-provided-document': 'aus Dokument erkannt',
  'permitted-public-page': 'automatisch von freigegebener Seite',
  'authorized-api': 'offizielle Schnittstelle',
  'authorized-broker-feed': 'Maklerfeed',
}

export type PersonalStatus = 'neu' | 'interessant' | 'favorit' | 'ausgeschlossen'

export const STATUS_LABEL: Record<PersonalStatus, string> = {
  neu: 'Neu',
  interessant: 'Interessant',
  favorit: 'Favorit',
  ausgeschlossen: 'Ausgeschlossen',
}

export interface GeoPoint {
  lat: number
  lng: number
}

export interface PropertyLocation extends GeoPoint {
  precision: LocationPrecision
  /** Woraus die Position stammt, z. B. „Photon-Geocoding der Adresse“ */
  basis: string
}

/** Ein Originalangebot. Mehrere Angebote desselben Objekts bleiben einzeln sichtbar (Duplikaterkennung). */
export interface Offer {
  portalId: string
  url: string | null
  externalId?: string
  price: Fact<number>
  priceKind: 'kauf' | 'kalt' | 'warm' | 'pacht'
  importMethod: ImportMethod
  importedAt: string
  /** Letzte zulässige Überprüfung; bei reinen Links nie automatisch */
  lastChecked: string | null
  active: boolean
}

export interface Property {
  id: string
  createdAt: string
  updatedAt: string
  country: Country
  title: Fact<string>
  description: Fact<string>
  category: Fact<string>
  transaction: Fact<Transaction>
  currency: Currency
  purchasePrice: Fact<number>
  coldRent: Fact<number>
  warmRent: Fact<number>
  livingArea: Fact<number>
  plotArea: Fact<number>
  rooms: Fact<number>
  bedrooms: Fact<number>
  address: Fact<string>
  location: PropertyLocation | null
  publishedAt: Fact<string>
  offers: Offer[]
  notes: string
  status: PersonalStatus
  /** Demonstrationsdaten werden überall als solche gekennzeichnet */
  demo?: boolean
}

export type PropertyField =
  | 'title'
  | 'description'
  | 'category'
  | 'transaction'
  | 'purchasePrice'
  | 'coldRent'
  | 'warmRent'
  | 'livingArea'
  | 'plotArea'
  | 'rooms'
  | 'bedrooms'
  | 'address'
  | 'publishedAt'

/** Wie vollständig das Profil ist: Anteil bekannter Kernfelder */
export function completeness(p: Property): { known: number; total: number } {
  const core: Fact<unknown>[] = [p.category, p.transaction, p.livingArea, p.rooms, p.address]
  core.push(p.transaction.value === 'kauf' ? p.purchasePrice : p.coldRent)
  const known = core.filter((f) => f.value !== null).length + (p.location ? 1 : 0)
  return { known, total: core.length + 1 }
}

/** Preis, wie er im Vergleich gezeigt wird */
export function mainPrice(p: Property): { label: string; value: number | null } {
  if (p.transaction.value === 'kauf') return { label: 'Kaufpreis', value: p.purchasePrice.value }
  if (p.coldRent.value !== null) return { label: p.transaction.value === 'pacht' ? 'Pacht/Monat' : 'Kaltmiete', value: p.coldRent.value }
  if (p.warmRent.value !== null) return { label: 'Warmmiete', value: p.warmRent.value }
  return { label: p.transaction.value === 'pacht' ? 'Pacht' : 'Preis', value: null }
}

export function pricePerSqm(p: Property): number | null {
  const price = mainPrice(p).value
  const area = p.category.value && ['baugrund_wohnen', 'grund_gewerbe', 'grund_gemischt', 'grund_ferienhaus', 'landwirtschaft', 'wald', 'grund_sonstig'].includes(p.category.value)
    ? p.plotArea.value
    : p.livingArea.value
  return price !== null && area ? price / area : null
}
