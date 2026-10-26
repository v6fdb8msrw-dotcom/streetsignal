// Kompakte Schreibweise für Inserate (Beispieldaten und Import-Hilfe).
import type { Fact } from '../model/provenance.ts'
import { fromSource, unknown } from '../model/provenance.ts'
import type {
  FeatureKey,
  GeoContext,
  GeoFeature,
  LatLng,
  Listing,
  LocationPrecision,
  SettlementType,
  StyleKey,
  UrbanZone,
} from '../model/listing.ts'
import type { Country, Purpose, Transaction } from '../model/taxonomy.ts'
import { COUNTRIES } from '../model/taxonomy.ts'

export interface GeoSpec {
  s: SettlementType
  z: UrbanZone
  d: Partial<Record<GeoFeature, number>>
  wf?: boolean
  noise?: number
  elev: number
  alp?: boolean
  green: number
}

export interface Spec {
  id: string
  obj?: string
  src?: string
  title: string
  /** „villa“ = laut Inserat, „~villa“ = nur aus Fotos vermutet */
  cats: string[]
  purposes: Purpose[]
  tx: Transaction
  country: Country
  region: string
  city: string
  pc?: string
  street?: string
  pos: LatLng
  prec: LocationPrecision
  cold?: number
  warm?: number
  buy?: number
  lease?: number
  nk?: number
  living?: number
  usable?: number
  plot?: number
  rooms?: number
  beds?: number
  /** Leerzeichen-getrennt: „balkon“ = ja (Quelle), „-garten“ = nein, „?aufzug“ = extrahiert, „~seeblick“ = KI-Vermutung */
  feat?: string
  style?: string
  from?: string
  desc?: string
  /** Fehlt bei eigenen und importierten Objekten: Umgebung bleibt dann „nicht verfügbar“ */
  geo?: GeoSpec
  url?: string
  /** Herkunft der Sachangaben: Quelle (Standard) oder eigene Eingabe */
  prov?: 'source' | 'user'
  added?: string
}

const GEO_BASIS = 'Demo-Geodaten'

function parseFlags<K extends string>(s: string | undefined): Partial<Record<K, Fact<boolean>>> {
  const out: Partial<Record<K, Fact<boolean>>> = {}
  for (const raw of (s ?? '').split(/\s+/).filter(Boolean)) {
    const prefix = raw[0]
    if (prefix === '-') out[raw.slice(1) as K] = fromSource(false)
    else if (prefix === '?') out[raw.slice(1) as K] = { value: true, provenance: 'extracted', basis: 'Exposé-Text' }
    else if (prefix === '~') out[raw.slice(1) as K] = { value: true, provenance: 'ai_guess', basis: 'Bildanalyse' }
    else out[raw as K] = fromSource(true)
  }
  return out
}

const num = (v: number | undefined): Fact<number> => (v === undefined ? unknown<number>() : fromSource(v))

function geo(g: GeoSpec | undefined): GeoContext {
  if (!g)
    return {
      settlement: unknown(),
      zone: unknown(),
      distances: {},
      waterfront: unknown(),
      noiseDb: unknown(),
      elevationM: unknown(),
      alpineRegion: unknown(),
      greenShare: unknown(),
    }
  const distances: GeoContext['distances'] = {}
  for (const [k, v] of Object.entries(g.d)) distances[k as GeoFeature] = fromSource(v as number, GEO_BASIS)
  return {
    settlement: fromSource(g.s, GEO_BASIS),
    zone: fromSource(g.z, GEO_BASIS),
    distances,
    waterfront: g.wf === undefined ? unknown<boolean>() : fromSource(g.wf, 'Inserat'),
    noiseDb: g.noise === undefined ? unknown<number>() : fromSource(g.noise, 'Lärmkartierung (Demo)'),
    elevationM: fromSource(g.elev, GEO_BASIS),
    alpineRegion: fromSource(g.alp ?? false, GEO_BASIS),
    greenShare: fromSource(g.green, GEO_BASIS),
  }
}

export function build(s: Spec): Listing {
  const currency = COUNTRIES.find((c) => c.id === s.country)!.currency
  const l: Listing = {
    id: s.id,
    objectId: s.obj ?? s.id,
    sourceId: s.src ?? 'demo_a',
    url: s.url ?? null,
    title: s.title,
    categories: s.cats.map((c) => (c.startsWith('~') ? { value: c.slice(1), provenance: 'ai_guess', basis: 'Bildanalyse' } : fromSource(c, 'Inserat'))),
    purposes: s.purposes,
    transaction: s.tx,
    address: { country: s.country, region: s.region, city: s.city, postcode: s.pc, street: s.street },
    position: s.pos,
    precision: s.prec,
    prices: {
      currency,
      coldRent: num(s.cold),
      warmRent: num(s.warm),
      purchase: num(s.buy),
      lease: num(s.lease),
      serviceCharges: num(s.nk),
    },
    sizes: {
      livingArea: num(s.living),
      usableArea: num(s.usable),
      plotArea: num(s.plot),
      rooms: num(s.rooms),
      bedrooms: num(s.beds),
    },
    features: parseFlags<FeatureKey>(s.feat),
    styles: parseFlags<StyleKey>(s.style),
    availableFrom: s.from ? fromSource(s.from) : unknown<string>(),
    geo: geo(s.geo),
    description: s.desc,
    addedAt: s.added ?? '2026-10-01',
  }
  return s.prov === 'user' ? asUser(l) : l
}

/** Alle Sachangaben als „vom Nutzer eingegeben“ markieren */
function asUser(l: Listing): Listing {
  const mark = <T,>(f: Fact<T>): Fact<T> => (f.value === null ? f : { ...f, provenance: 'user', basis: 'eigene Eingabe' })
  const markAll = <R extends Record<string, Fact<unknown>>>(r: R): R => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, mark(v)])) as R
  return {
    ...l,
    categories: l.categories.map(mark),
    prices: { ...markAll({ coldRent: l.prices.coldRent, warmRent: l.prices.warmRent, purchase: l.prices.purchase, lease: l.prices.lease, serviceCharges: l.prices.serviceCharges }), currency: l.prices.currency },
    sizes: markAll({ ...l.sizes }),
    features: markAll(l.features as Record<string, Fact<boolean>>),
    styles: markAll(l.styles as Record<string, Fact<boolean>>),
  }
}

/** Prüft einen importierten Eintrag grob, bevor er gebaut wird */
export function validateSpec(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return 'kein Objekt'
  const s = x as Partial<Spec>
  if (!s.id || !s.title) return 'id oder title fehlt'
  if (!['DE', 'AT', 'CH'].includes(s.country ?? '')) return `${s.id}: country muss DE, AT oder CH sein`
  if (!Array.isArray(s.pos) || s.pos.length !== 2) return `${s.id}: pos [lat, lng] fehlt`
  if (!['miete', 'kauf', 'pacht'].includes(s.tx ?? '')) return `${s.id}: tx muss miete, kauf oder pacht sein`
  if (!Array.isArray(s.cats)) return `${s.id}: cats fehlt`
  return null
}
