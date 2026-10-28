// Luftqualität: Jahresmittel der nächstgelegenen Messstationen (Umweltbundesamt, aufbereitet in public/data).
// Messstationen messen an ihrem Standort; der Wert gilt nicht automatisch für die Adresse.
import { distanceM } from '../model/geo.ts'

export interface AirStation {
  id: string
  code: string
  name: string
  city: string
  lat: number
  lng: number
  setting: string
  type: string
  no2?: number
  pm10?: number
  pm25?: number
}

interface AirFile {
  year: number
  source: string
  createdAt: string
  stations: AirStation[]
}

export interface AirResult {
  covered: boolean
  year: number | null
  stations: (AirStation & { distanceM: number })[]
  note: string
}

/** EU-Grenzwerte Jahresmittel (Richtlinie 2008/50/EG), nur zur Einordnung */
export const EU_LIMIT = { no2: 40, pm10: 40, pm25: 25 }

export const AIR_YEAR = 2025
let file: Promise<AirFile> | null = null

export async function fetchAir(lat: number, lng: number, country: string | null): Promise<AirResult> {
  if (country && country !== 'DE') return { covered: false, year: null, stations: [], note: 'Messdaten des Umweltbundesamts gibt es nur für Deutschland.' }
  file ??= fetch(`${import.meta.env.BASE_URL}data/luft-${AIR_YEAR}.json`).then((r) => {
    if (!r.ok) throw new Error('Luftdaten-Datei fehlt')
    return r.json() as Promise<AirFile>
  })
  const f = await file
  const stations = f.stations
    .map((s) => ({ ...s, distanceM: distanceM([lat, lng], [s.lat, s.lng]) }))
    .filter((s) => s.distanceM <= 15000)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 3)
  return {
    covered: true,
    year: f.year,
    stations,
    note: stations.length
      ? 'Jahresmittel an der Messstation. Verkehrsstationen stehen an stark befahrenen Straßen, Hintergrundstationen zeigen die allgemeine Belastung. Der Wert gilt nicht genau für deine Adresse.'
      : 'Keine Messstation im Umkreis von 15 km.',
  }
}
