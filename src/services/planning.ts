// Bebauungspläne am Standort (Master-Prompt Abschnitt 8: Bauprojekte und kommunale Planung).
// Angebunden: Hamburg und Berlin (Abfrage am Punkt). Andernorts: Hinweis auf das zuständige Portal.
import { cached } from '../store/db.ts'
import { featureInfo } from './wms.ts'

export type PlanStatus = 'festgesetzt' | 'im Verfahren' | 'außer Kraft' | 'unbekannt'

export interface Plan {
  name: string
  status: PlanStatus
  date: string | null
  documentUrl: string | null
  explanationUrl: string | null
  sourceId: string
  detail?: string | null
}

export interface PlanningResult {
  covered: boolean
  region: string | null
  plans: Plan[]
  portal: { label: string; url: string } | null
  fetchedAt: string
}

const HH = 'https://geodienste.hamburg.de/HH_WMS_Bebauungsplaene'
const BE = 'https://gdi.berlin.de/services/wms/bplan'

/** Hamburgs Textantwort: Blöcke „layer:\n  key: value“ */
export function parseHamburg(text: string): Plan[] {
  const plans: Plan[] = []
  for (const block of text.split(/\n(?=hh_)/)) {
    const layer = block.match(/^(hh_[a-z_]+):/)?.[1]
    if (!layer) continue
    const field = (k: string) => block.match(new RegExp(`\\n\\s*${k}:\\s*(.+)`))?.[1]?.trim() ?? null
    const name = field('geltendes_planrecht') ?? field('plan') ?? field('name')
    if (!name) continue
    plans.push({
      name,
      status: layer.includes('imverfahren') ? 'im Verfahren' : 'festgesetzt',
      date: field('feststellungsdatum') ?? field('datum'),
      documentUrl: field('planrecht'),
      explanationUrl: field('begruendung'),
      sourceId: 'hh_bplan',
    })
  }
  return plans
}

interface GeoJsonFC {
  features: { id?: string; properties: Record<string, unknown> }[]
}

export function parseBerlin(json: GeoJsonFC): Plan[] {
  return json.features.map((f) => {
    const p = f.properties
    const s = (k: string) => (typeof p[k] === 'string' && (p[k] as string).trim() ? (p[k] as string).trim() : null)
    const id = String(f.id ?? '')
    const rechtsstand = s('Rechtsstand') ?? ''
    const status: PlanStatus = /außer kraft/i.test(rechtsstand) || id.includes('bp_ak')
      ? 'außer Kraft'
      : /in kraft|festgesetzt/i.test(rechtsstand) || id.includes('bp_fs')
        ? 'festgesetzt'
        : id.includes('bp_iv') || rechtsstand
          ? 'im Verfahren'
          : 'unbekannt'
    const area = s('Geltungsbereich')
    const contents = s('Inhalte')
    return {
      name: [s('Name des Plans') ?? 'Bebauungsplan', area].filter(Boolean).join(' – '),
      status,
      date: s('Festgesetzt am') ?? s('Aufstellungsbeschluss'),
      documentUrl: s('Link zur Planzeichnung'),
      explanationUrl: s('Link zum Begründungstext'),
      sourceId: 'be_bplan',
      detail: [rechtsstand && `Rechtsstand: ${rechtsstand}`, contents && `Inhalte: ${contents}`].filter(Boolean).join(' · ') || null,
    }
  })
}

/** Zuständige Portale, wenn kein Dienst angebunden ist */
const PORTALS: Record<string, { label: string; url: string }> = {
  Hessen: { label: 'Geoportal Hessen (Bauleitpläne der Kommunen)', url: 'https://www.geoportal.hessen.de' },
  'Nordrhein-Westfalen': { label: 'Bauleitplanung NRW (bauleitplanung.nrw)', url: 'https://www.bauleitplanung.nrw.de' },
  Bayern: { label: 'BayernAtlas Bauleitplanung', url: 'https://geoportal.bayern.de/bayernatlas' },
  'Baden-Württemberg': { label: 'Geoportal BW (Bauleitpläne)', url: 'https://www.geoportal-bw.de' },
  Niedersachsen: { label: 'Geodatenportal Niedersachsen', url: 'https://www.geodaten.niedersachsen.de' },
  Sachsen: { label: 'Geoportal Sachsen', url: 'https://geoportal.sachsen.de' },
}

export async function fetchPlanning(lat: number, lng: number, state: string | null): Promise<PlanningResult> {
  const key = `plan:${lat.toFixed(5)},${lng.toFixed(5)}`
  const now = new Date().toISOString()
  if (state === 'Hamburg') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('hh_bplan', HH, 'hh_hh_festgestellt,hh_lgv_imverfahren', lat, lng, 'text/plain')
      return { covered: true, region: 'Hamburg', plans: parseHamburg(text), portal: { label: 'Bebauungspläne Hamburg', url: 'https://geoportal-hamburg.de' }, fetchedAt: now }
    })
  }
  if (state === 'Berlin') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      // Der Dienst hängt bei mehreren Ebenen mehrere JSON-Dokumente aneinander, daher je Ebene einzeln
      const texts = await Promise.all(['a_bp_iv', 'b_bp_fs'].map((l) => featureInfo('be_bplan', BE, l, lat, lng, 'application/json', '1.3.0')))
      const plans = texts.flatMap((t) => parseBerlin(JSON.parse(t) as GeoJsonFC))
      return { covered: true, region: 'Berlin', plans, portal: { label: 'FIS-Broker / Geoportal Berlin', url: 'https://fbinter.stadt-berlin.de/fb/' }, fetchedAt: now }
    })
  }
  return {
    covered: false,
    region: state,
    plans: [],
    portal: (state && PORTALS[state]) || { label: 'Geoportal.de (bundesweite Suche)', url: 'https://www.geoportal.de' },
    fetchedAt: now,
  }
}
