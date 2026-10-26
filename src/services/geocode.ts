// Adresssuche über Photon (kostenlos, OSM-Daten). Mit Zwischenspeicher und Mindestabstand.
import { cached } from '../store/db.ts'
import { fetchJson } from './http.ts'
import type { Country } from '../model/taxonomy.ts'
import type { LocationPrecision } from '../model/listing.ts'

export interface GeoResult {
  label: string
  detail: string
  lat: number
  lng: number
  country: Country | null
  city: string | null
  street: string | null
  postcode: string | null
  state: string | null
  precision: LocationPrecision
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    district?: string
    state?: string
    country?: string
    countrycode?: string
    type?: string
    osm_value?: string
  }
}

const COUNTRY: Record<string, Country> = { DE: 'DE', AT: 'AT', CH: 'CH' }
const DAY = 24 * 3600 * 1000

function precisionOf(p: PhotonFeature['properties']): LocationPrecision {
  if (p.housenumber || p.type === 'house') return 'exact'
  if (p.type === 'street') return 'street'
  if (p.type === 'district' || p.type === 'locality' || p.postcode && !p.street) return 'postcode'
  return 'city'
}

function toResult(f: PhotonFeature): GeoResult | null {
  const p = f.properties
  const cc = COUNTRY[(p.countrycode ?? '').toUpperCase()] ?? null
  if (!cc) return null
  const streetLine = p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}` : null
  const label = streetLine && p.name && p.name !== p.street ? `${p.name}, ${streetLine}` : streetLine ?? p.name ?? p.city ?? '?'
  const detail = [p.postcode, p.city ?? p.district, p.state, p.country].filter(Boolean).filter((x) => x !== label).join(', ')
  return {
    label,
    detail,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    country: cc,
    city: p.city ?? (p.type === 'city' ? (p.name ?? null) : null),
    street: p.street ?? null,
    postcode: p.postcode ?? null,
    state: p.state ?? null,
    precision: precisionOf(p),
  }
}

/** Suche, nur DE/AT/CH. Leere oder zu kurze Eingaben fragen nicht an. */
export async function searchAddress(query: string, bias?: { lat: number; lng: number }): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({ q, lang: 'de', limit: '7' })
  if (bias) {
    params.set('lat', bias.lat.toFixed(3))
    params.set('lon', bias.lng.toFixed(3))
  }
  // Nur Ergebnisse aus Deutschland, Österreich, Schweiz
  params.set('bbox', '5.8,45.7,17.2,55.1')
  const key = `photon:${params}`
  const data = await cached(key, 7 * DAY, () => fetchJson<{ features: PhotonFeature[] }>('photon', `https://photon.komoot.io/api/?${params}`))
  return data.features.map(toResult).filter((r): r is GeoResult => r !== null)
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const key = `photon-rev:${lat.toFixed(4)},${lng.toFixed(4)}`
  const data = await cached(key, 30 * DAY, () =>
    fetchJson<{ features: PhotonFeature[] }>('photon', `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=de&limit=1`),
  )
  const f = data.features[0]
  if (!f) return null
  const r = toResult(f)
  return r ? { ...r, lat, lng } : null
}
