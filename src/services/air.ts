// Luftqualität: Jahresmittel der nächstgelegenen Messstationen (Umweltbundesamt, aufbereitet in public/data).
// Messstationen messen an ihrem Standort; der Wert gilt nicht automatisch für die Adresse.
import { distanceM } from '../model/geo.ts'
import { cached } from '../store/db.ts'
import { matchLegend, wmsPixel } from './pixel.ts'

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

export type Pollutant = 'no2' | 'pm10' | 'pm25'

export interface AirResult {
  covered: boolean
  year: number | null
  stations: (AirStation & { distanceM: number })[]
  note: string
  /** Modellierte Jahresmittel am Punkt (Schweiz, BAFU): Spanne der Legendenklasse in µg/m³ */
  model?: Record<Pollutant, [number, number | null] | null>
  sourceId?: string
}

/** EU-Grenzwerte Jahresmittel (Richtlinie 2008/50/EG), nur zur Einordnung */
export const EU_LIMIT = { no2: 40, pm10: 40, pm25: 25 }

export const AIR_YEAR = 2025
const files = new Map<string, Promise<AirFile>>()

function loadFile(name: string): Promise<AirFile> {
  let f = files.get(name)
  if (!f) {
    f = fetch(`${import.meta.env.BASE_URL}data/${name}`).then((r) => {
      if (!r.ok) throw new Error('Luftdaten-Datei fehlt')
      return r.json() as Promise<AirFile>
    })
    files.set(name, f)
  }
  return f
}

/** Legendenfarben der BAFU-Karten (gleich für alle drei Stoffe, aus den Legendenbildern von geo.admin.ch ausgelesen) */
const BAFU_COLORS: [number, number, number][] = [
  [0, 77, 168], [0, 92, 230], [0, 112, 255], [0, 197, 250], [71, 217, 250], [86, 249, 251], [46, 158, 107], [56, 189, 0], [66, 217, 0], [81, 245, 81],
  [255, 255, 0], [255, 212, 0], [255, 163, 0], [255, 96, 0], [255, 0, 0], [255, 5, 148], [222, 0, 161], [197, 0, 186], [161, 0, 186],
]
/** Klassenbreite je Stoff laut Legende: NO₂ 3, PM10 2, PM2,5 1 µg/m³; die letzte Klasse ist nach oben offen */
const BAFU_STEP: Record<Pollutant, number> = { no2: 3, pm10: 2, pm25: 1 }
const BAFU_LAYER: Record<Pollutant, string> = {
  no2: 'ch.bafu.luftreinhaltung-stickstoffdioxid',
  pm10: 'ch.bafu.luftreinhaltung-feinstaub_pm10',
  pm25: 'ch.bafu.luftreinhaltung-feinstaub_pm2_5',
}
export const CH_AIR_YEAR = 2025

export function bafuClass(p: Pollutant, index: number | null): [number, number | null] | null {
  if (index === null) return null
  const s = BAFU_STEP[p]
  return index >= BAFU_COLORS.length - 1 ? [s * index, null] : [s * index, s * (index + 1)]
}

async function fetchAirCh(lat: number, lng: number): Promise<AirResult> {
  return cached(`airch:${lat.toFixed(4)},${lng.toFixed(4)}`, 90 * 24 * 3600 * 1000, async () => {
    const model = {} as Record<Pollutant, [number, number | null] | null>
    for (const p of ['no2', 'pm10', 'pm25'] as Pollutant[]) {
      const px = await wmsPixel('ch_air', 'https://wms.geo.admin.ch/', BAFU_LAYER[p], lat, lng, `&TIME=${CH_AIR_YEAR}`, 40)
      model[p] = bafuClass(p, matchLegend(px, BAFU_COLORS))
    }
    return {
      covered: true,
      year: CH_AIR_YEAR,
      stations: [],
      model,
      sourceId: 'ch_air',
      note: 'Modellierte Jahresmittel des BAFU (NO₂ im 20-m-, Feinstaub im 100-m-Raster), abgelesen an der Kartenfarbe am Punkt als Klasse der amtlichen Legende. Laut BAFU kann der Wert lokal abweichen und ein einzelnes Pixel ist keine Bewertung eines Einzelstandorts. Grenzwerte der Luftreinhalte-Verordnung im Jahresmittel: NO₂ 30, PM10 20, PM2,5 10 µg/m³.',
    }
  })
}

/** Messstationen je Land: Deutschland vom Umweltbundesamt, Österreich aus der EEA-Jahresstatistik */
const STATION_FILES: Record<string, { file: string; sourceId: string }> = {
  DE: { file: `luft-${AIR_YEAR}.json`, sourceId: 'uba_air' },
  AT: { file: `luft-at-${AIR_YEAR}.json`, sourceId: 'eea_air' },
}

export async function fetchAir(lat: number, lng: number, country: string | null): Promise<AirResult> {
  if (country === 'CH') return fetchAirCh(lat, lng)
  const src = STATION_FILES[country ?? 'DE']
  if (!src) return { covered: false, year: null, stations: [], note: 'Für dieses Land ist keine freie Luftgüte-Quelle angebunden.' }
  const f = await loadFile(src.file)
  const stations = f.stations
    .map((s) => ({ ...s, distanceM: distanceM([lat, lng], [s.lat, s.lng]) }))
    .filter((s) => s.distanceM <= 15000)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 3)
  return {
    covered: true,
    year: f.year,
    stations,
    sourceId: src.sourceId,
    note: stations.length
      ? 'Jahresmittel an der Messstation. Verkehrsstationen stehen an stark befahrenen Straßen, Hintergrundstationen zeigen die allgemeine Belastung. Der Wert gilt nicht genau für deine Adresse.'
      : 'Keine Messstation im Umkreis von 15 km.',
  }
}
