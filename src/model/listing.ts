import type { Fact } from './provenance.ts'
import type { Country, Currency, Purpose, Transaction } from './taxonomy.ts'

export type LatLng = [number, number]

/** Wie genau der Standort bekannt ist. Die Karte zeigt nie mehr Genauigkeit als vorhanden. */
export type LocationPrecision = 'exact' | 'street' | 'postcode' | 'city'

export const PRECISION_RADIUS_M: Record<LocationPrecision, number> = {
  exact: 0,
  street: 250,
  postcode: 1500,
  city: 5000,
}

export const PRECISION_LABEL: Record<LocationPrecision, string> = {
  exact: 'genaue Adresse',
  street: 'Straße bekannt',
  postcode: 'nur Postleitzahl',
  city: 'nur Ort',
}

export type SettlementType = 'grossstadt' | 'kleinstadt' | 'vorort' | 'dorf' | 'laendlich' | 'abgelegen'
export type UrbanZone = 'innenstadt' | 'urbanes_viertel' | 'ruhiges_viertel' | 'stadtrand' | 'ausserhalb'

/** Arten von Geo-Objekten, zu denen Entfernungen gemessen werden. */
export type GeoFeature =
  | 'park'
  | 'wald'
  | 'see'
  | 'fluss'
  | 'meer'
  | 'berge'
  | 'wandergebiet'
  | 'schutzgebiet'
  | 'skigebiet'
  | 'hafen'
  | 'oepnv'
  | 'einkauf'
  | 'schule'
  | 'kita'
  | 'medizin'
  | 'gewerbegebiet'

/**
 * Umgebung eines Standorts. In der Demo vorberechnet; später füllt ein GeoContextProvider
 * die Werte z. B. aus einem lokalen OpenStreetMap-Auszug.
 */
export interface GeoContext {
  settlement: Fact<SettlementType>
  zone: Fact<UrbanZone>
  /** Luftlinie in Metern zum nächsten Objekt der Art */
  distances: Partial<Record<GeoFeature, Fact<number>>>
  /** Grundstück grenzt direkt an Wasser (Ufer, Seegrundstück) */
  waterfront: Fact<boolean>
  /** Kartierter Lärm, Tag-Abend-Nacht-Index L_DEN in dB(A) */
  noiseDb: Fact<number>
  elevationM: Fact<number>
  alpineRegion: Fact<boolean>
  /** Anteil Grünfläche im Umkreis von 500 m (0–1) */
  greenShare: Fact<number>
}

export interface Address {
  country: Country
  region: string
  city: string
  postcode?: string
  street?: string
}

export interface Prices {
  currency: Currency
  /** Kaltmiete pro Monat */
  coldRent: Fact<number>
  warmRent: Fact<number>
  purchase: Fact<number>
  /** Pacht pro Monat */
  lease: Fact<number>
  serviceCharges: Fact<number>
}

export interface Sizes {
  livingArea: Fact<number>
  /** Nutzfläche bei Gewerbe */
  usableArea: Fact<number>
  plotArea: Fact<number>
  rooms: Fact<number>
  bedrooms: Fact<number>
}

export type FeatureKey =
  | 'balkon'
  | 'terrasse'
  | 'garten'
  | 'stellplatz'
  | 'aufzug'
  | 'barrierefrei'
  | 'moebliert'
  | 'haustiere'
  | 'neubau'
  | 'energie'
  | 'sofort_frei'
  | 'seeblick'
  | 'skylineblick'
  | 'hochhaus'
  | 'bebaubar'

export type StyleKey =
  | 'modern'
  | 'minimalistisch'
  | 'klassisch'
  | 'rustikal'
  | 'traditionell'
  | 'historisch'
  | 'luxurioes'

export interface Listing {
  id: string
  /** Gleiches Objekt bei mehreren Quellen → gleiche objectId (Gruppierung) */
  objectId: string
  sourceId: string
  /** Link zur Originalanzeige; null bei Beispieldaten */
  url: string | null
  title: string
  /** Kategorie-IDs aus der Registry, jede mit eigener Herkunft (inseriert oder nur vermutet) */
  categories: Fact<string>[]
  purposes: Purpose[]
  /** Nur was die Quelle ausweist (Punkt 4) */
  transaction: Transaction
  address: Address
  position: LatLng
  precision: LocationPrecision
  prices: Prices
  sizes: Sizes
  features: Partial<Record<FeatureKey, Fact<boolean>>>
  styles: Partial<Record<StyleKey, Fact<boolean>>>
  availableFrom: Fact<string>
  geo: GeoContext
  /** Kurzbeschreibung, wie sie in der Quelle steht */
  description?: string
  addedAt: string
}

export interface SourceDef {
  id: string
  name: string
  kind: 'demo' | 'manual' | 'import' | 'feed'
  /** Ist die Quelle tatsächlich angebunden? Sonst nur Hinweis, keine Angebote. */
  integrated: boolean
  note: string
}
