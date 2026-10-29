// Hochwassergefahrenflächen nach EU-Hochwasserrichtlinie (Bundesanstalt für Gewässerkunde, bundesweit).
// Lizenz: Geodaten des Bundes nach GeoNutzV, kostenlos auch kommerziell, Quellenvermerk BfG.
import { cached } from '../store/db.ts'
import { fetchJson } from './http.ts'
import { wmsImage } from './pixel.ts'

export const BFG = 'https://geoportal.bafg.de/arcgis/rest/services/HWRMRL'

export type FloodScenario = 'haeufig' | 'hq100' | 'extrem'

export const FLOOD_LABEL: Record<FloodScenario, string> = {
  haeufig: 'häufiges Hochwasser (HQ häufig)',
  hq100: 'mittleres Hochwasser (HQ100, etwa alle 100 Jahre)',
  extrem: 'extremes Hochwasser (HQ extrem)',
}

/** Flusshochwasser („LAND“); Küstenhochwasser liegt in den SEA-Diensten */
export const FLOOD_SERVICES: Record<FloodScenario, string[]> = {
  haeufig: ['HWRMRL_DE_LH', 'HWRMRL_DE_SH'],
  hq100: ['HWRMRL_DE_LM', 'HWRMRL_DE_SM'],
  extrem: ['HWRMRL_DE_LL', 'HWRMRL_DE_SL'],
}

export interface FloodResult {
  covered: boolean
  /** In welchen Szenarien liegt der Punkt in einer Überflutungsfläche */
  inArea: Record<FloodScenario, boolean>
  reportYear: string | null
  fetchedAt: string
  note: string
  /** Abweichende Bezeichnungen der Szenarien (Schweiz, Österreich) */
  labels?: Record<FloodScenario, string>
  sourceId?: string
}

/** Aquaprotect (BAFU): grobe Überschwemmungsgebiete der ganzen Schweiz für 50, 100 und 500 Jahre */
const AQUAPROTECT: Record<FloodScenario, string> = { haeufig: 'ch.bafu.aquaprotect_050', hq100: 'ch.bafu.aquaprotect_100', extrem: 'ch.bafu.aquaprotect_500' }
export const CH_FLOOD_LABEL: Record<FloodScenario, string> = {
  haeufig: 'seltenes Hochwasser (etwa alle 50 Jahre)',
  hq100: 'Hochwasser etwa alle 100 Jahre',
  extrem: 'sehr seltenes Hochwasser (etwa alle 500 Jahre)',
}

async function fetchFloodCh(lat: number, lng: number): Promise<FloodResult> {
  return cached(`floodch:${lat.toFixed(5)},${lng.toFixed(5)}`, 90 * 24 * 3600 * 1000, async () => {
    const inArea = { haeufig: false, hq100: false, extrem: false }
    for (const s of ['haeufig', 'hq100', 'extrem'] as FloodScenario[]) {
      // Unter 1:50 000 zeigt der Dienst nur Schraffuren; ein Bild von 1,7 km mit 101 Pixeln (≈ 1:60 000) zeigt die Flächen voll.
      // Treffer, wenn einer der 3×3 Pixel um die Mitte (≈ ±17 m) gefärbt ist.
      const at = await wmsImage('ch_flood', 'https://wms.geo.admin.ch/', AQUAPROTECT[s], lat, lng, '', 850, 101)
      for (let dx = -1; dx <= 1 && !inArea[s]; dx++) for (let dy = -1; dy <= 1; dy++) if (at(dx, dy)[3] > 40) inArea[s] = true
    }
    return {
      covered: true,
      inArea,
      reportYear: null,
      fetchedAt: new Date().toISOString(),
      labels: CH_FLOOD_LABEL,
      sourceId: 'ch_flood',
      note: 'Aquaprotect des BAFU: grobe gesamtschweizerische Übersicht potenziell überschwemmter Gebiete, ohne bestehende Schutzmaßnahmen. Ersetzt nicht die kantonale Gefahrenkarte; wo Aquaprotect nichts zeigt, kann trotzdem Hochwassergefahr bestehen.',
    }
  })
}

/** Abfrage mit etwa 25 m Toleranz: 0,02° Kartenausschnitt auf 600 Pixel ≈ 3–4 m je Pixel, Toleranz 7 Pixel */
async function hit(service: string, lat: number, lng: number): Promise<string | null> {
  const d = 0.01
  const url = `${BFG}/${service}/MapServer/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=7&mapExtent=${lng - d},${lat - d},${lng + d},${lat + d}&imageDisplay=600,600,96&returnGeometry=false&f=json`
  const res = await fetchJson<{ results?: { attributes?: Record<string, string> }[] }>('bfg_flood', url)
  const r = res.results?.[0]
  return r ? (r.attributes?.REP_YEAR ?? 'unbekannt') : null
}

export async function fetchFlood(lat: number, lng: number, country: string | null): Promise<FloodResult> {
  const now = new Date().toISOString()
  const empty = { haeufig: false, hq100: false, extrem: false }
  if (country === 'CH') return fetchFloodCh(lat, lng)
  if (country && country !== 'DE')
    return { covered: false, inArea: empty, reportYear: null, fetchedAt: now, note: 'Für Österreich werden die amtlichen Überflutungsflächen gerade aufbereitet.' }
  return cached(`flood2:${lat.toFixed(5)},${lng.toFixed(5)}`, 30 * 24 * 3600 * 1000, async () => {
    const inArea = { ...empty }
    let year: string | null = null
    for (const s of ['haeufig', 'hq100', 'extrem'] as FloodScenario[]) {
      const hits = await Promise.all(FLOOD_SERVICES[s].map((svc) => hit(svc, lat, lng)))
      const y = hits.find((h) => h !== null)
      if (y !== undefined && y !== null) {
        inArea[s] = true
        year = year ?? y
      }
    }
    return {
      covered: true,
      inArea,
      sourceId: 'bfg_flood',
      reportYear: year,
      fetchedAt: now,
      note: 'Hochwassergefahrenflächen an Gewässern mit signifikantem Risiko (EU-Hochwasserrichtlinie, 2. Zyklus), geprüft im Umkreis von etwa 25 m. Kleine Bäche und Starkregen sind darin nicht enthalten.',
    }
  })
}
