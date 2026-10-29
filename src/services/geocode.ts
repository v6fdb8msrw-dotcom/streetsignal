// Adresssuche über Photon (kostenlos, OSM-Daten), Ausweich: Nominatim (OSM, höchstens 1 Anfrage/s, keine Live-Vorschläge).
// Mit Zwischenspeicher und Mindestabstand.
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
    state: normalizeState(p.state ?? null, p.city ?? null),
    precision: precisionOf(p),
  }
}

/** Suche, nur DE/AT/CH. Leere oder zu kurze Eingaben fragen nicht an. */
interface NominatimItem {
  lat: string
  lon: string
  type?: string
  addresstype?: string
  name?: string
  address?: Record<string, string>
}

function fromNominatim(n: NominatimItem): GeoResult | null {
  const a = n.address ?? {}
  const cc = COUNTRY[(a.country_code ?? '').toUpperCase()] ?? null
  if (!cc) return null
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? null
  const street = a.road ?? a.pedestrian ?? null
  const streetLine = street ? `${street}${a.house_number ? ` ${a.house_number}` : ''}` : null
  const label = streetLine ?? n.name ?? city ?? '?'
  return {
    label,
    detail: [a.postcode, city, a.state, a.country].filter(Boolean).join(', '),
    lat: Number(n.lat),
    lng: Number(n.lon),
    country: cc,
    city,
    street,
    postcode: a.postcode ?? null,
    state: normalizeState(a.state ?? null, city),
    precision: a.house_number ? 'exact' : street ? 'street' : a.postcode && n.addresstype === 'postcode' ? 'postcode' : 'city',
  }
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'

/** Ausweichsuche über Nominatim (nur auf ausdrücklichen Wunsch, nicht beim Tippen) */
export async function searchAddressFallback(query: string): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', addressdetails: '1', limit: '7', countrycodes: 'de,at,ch', 'accept-language': 'de' })
  const data = await cached(`nominatim:${params}`, 7 * DAY, () => fetchJson<NominatimItem[]>('nominatim', `${NOMINATIM}/search?${params}`))
  return data.map(fromNominatim).filter((r): r is GeoResult => r !== null)
}

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
  try {
    const data = await cached(key, 30 * DAY, () =>
      fetchJson<{ features: PhotonFeature[] }>('photon', `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=de&limit=1`),
    )
    const f = data.features[0]
    const r = f ? toResult(f) : null
    if (r) return { ...r, lat, lng }
  } catch {
    // Photon nicht erreichbar: Nominatim versuchen (eine Anfrage je Analyse)
  }
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', 'accept-language': 'de', zoom: '18' })
  const n = await cached(`nominatim-rev:${lat.toFixed(4)},${lng.toFixed(4)}`, 30 * DAY, () => fetchJson<NominatimItem>('nominatim', `${NOMINATIM}/reverse?${params}`))
  const r = fromNominatim(n)
  return r ? { ...r, lat, lng } : null
}

/**
 * Amtliche Ländernamen vereinheitlichen, damit die Quellen je Land greifen:
 * „Freie Hansestadt Bremen“ → „Bremen“, „Freistaat Bayern“ → „Bayern“; Stadtstaaten ohne Land → Stadt.
 */
export function normalizeState(state: string | null, city: string | null = null): string | null {
  const s = state?.replace(/^(Freie und Hansestadt|Freie Hansestadt|Freistaat|Land)\s+/, '').trim() || null
  if (!s && city && ['Berlin', 'Hamburg', 'Bremen'].includes(city)) return city
  return s
}
