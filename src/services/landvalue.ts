// Amtliche Bodenrichtwerte (Master-Prompt Abschnitt 9). Direkt angebunden: NRW. Sonst Link zum amtlichen Portal.
import { cached } from '../store/db.ts'
import { featureInfo } from './wms.ts'

export interface LandValue {
  valueEurPerSqm: number
  referenceDate: string | null
  usage: string | null
  district: string | null
  municipality: string | null
  committee: string | null
  documentUrl: string | null
}

export interface LandValueResult {
  covered: boolean
  values: LandValue[]
  portal: { label: string; url: string } | null
  note: string
  fetchedAt: string
}

const NRW = 'https://www.wms.nrw.de/boris/wms_nw_brw'
/** Layer-Nummern mit Bodenrichtwerten (je Bauweise/Nutzung); die *_label-Layer werden ausgelassen */
const NRW_LAYERS = '2,5,8,11,14,17,20'

const NUTZUNG: Record<string, string> = {
  W: 'Wohnbaufläche',
  WR: 'Reines Wohngebiet',
  WA: 'Allgemeines Wohngebiet',
  M: 'Gemischte Baufläche',
  MI: 'Mischgebiet',
  MK: 'Kerngebiet',
  G: 'Gewerbliche Baufläche',
  GE: 'Gewerbegebiet',
  GI: 'Industriegebiet',
  S: 'Sonderbaufläche',
  LW: 'Landwirtschaft',
  F: 'Forstwirtschaft',
}

/**
 * NRW liefert Text: „@layer“ + Feldnamen, dann Werte, alles mit Semikolon getrennt.
 * Mehrere Treffer folgen als weitere Wertzeilen bzw. weitere @-Blöcke.
 */
export function parseNrw(text: string): LandValue[] {
  const out: LandValue[] = []
  for (const block of text.split('@').slice(1)) {
    const cells = block.split(';')
    const firstName = cells[0].replace(/^[a-z_]+/i, (m) => m) // „brw_…ANL“: Layername klebt am ersten Feld
    const nameEnd = cells.indexOf('SHAPE_Area')
    if (nameEnd < 0) continue
    const header = [firstName.replace(/^.*?([A-Z][A-Z_]*)$/, '$1'), ...cells.slice(1, nameEnd + 1)]
    const values = cells.slice(nameEnd + 1)
    for (let i = 0; i + header.length <= values.length; i += header.length) {
      const row: Record<string, string> = {}
      header.forEach((h, j) => (row[h] = (values[i + j] ?? '').trim()))
      const brw = Number((row.BRW ?? '').replace(',', '.'))
      if (!Number.isFinite(brw) || brw <= 0) continue
      out.push({
        valueEurPerSqm: brw,
        referenceDate: row.STAG || null,
        usage: NUTZUNG[row.NUTA] ?? (row.NUTA || null),
        district: row.ORTST || null,
        municipality: row.GENA || null,
        committee: row.GABE || null,
        documentUrl: row.UDOK_URL || null,
      })
    }
  }
  return out
}

const HESSEN = 'https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-maps.ows'

/** Hessen liefert „KEY = 'Wert'“ je Zeile (MapServer text/plain) */
export function parseHessen(text: string): LandValue[] {
  const out: LandValue[] = []
  for (const block of text.split(/\n\s*Feature \d+:/).slice(1)) {
    const f = (k: string) => block.match(new RegExp(`\\n\\s*${k} = '([^']*)'`))?.[1]?.replace(/\s+/g, ' ').trim() || null
    const brw = Number((f('BRW') ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    if (!Number.isFinite(brw) || brw <= 0) continue
    const [d, m, y] = (f('STAG') ?? '').split('.')
    out.push({
      valueEurPerSqm: brw,
      referenceDate: y ? `${y}-${m}-${d}` : null,
      usage: f('NUTA_KLART') ?? f('ERGN_KLART'),
      district: f('ENTW_KLART'),
      municipality: f('GENA'),
      committee: f('GABE'),
      documentUrl: f('URL'),
    })
  }
  return out
}

const PORTALS: Record<string, { label: string; url: string }> = {
  Niedersachsen: { label: 'BORIS Niedersachsen', url: 'https://immobilienmarkt.niedersachsen.de/bodenrichtwerte' },
  Bayern: { label: 'BORIS Bayern', url: 'https://www.boris-bayern.de' },
  'Baden-Württemberg': { label: 'BORIS-BW', url: 'https://www.gutachterausschuesse-bw.de/borisbw/' },
  Berlin: { label: 'Bodenrichtwerte Berlin', url: 'https://www.berlin.de/gutachterausschuss/' },
  Hamburg: { label: 'Bodenrichtwerte Hamburg', url: 'https://geoportal-hamburg.de' },
}

export async function fetchLandValue(lat: number, lng: number, country: string | null, state: string | null): Promise<LandValueResult> {
  const now = new Date().toISOString()
  if (country === 'AT' || country === 'CH')
    return { covered: false, values: [], portal: null, note: country === 'CH' ? 'Die Schweiz hat kein öffentliches Bodenrichtwertsystem wie Deutschland.' : 'Für Österreich gibt es keine vergleichbaren amtlichen Bodenrichtwerte als offenen Dienst.', fetchedAt: now }
  if (state === 'Hessen') {
    return cached(`brw:${lat.toFixed(5)},${lng.toFixed(5)}`, 30 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('he_boris', HESSEN, 'hboris_feature', lat, lng, 'text/plain')
      return {
        covered: true,
        values: parseHessen(text),
        portal: { label: 'BORIS Hessen', url: 'https://www.geoportal.hessen.de' },
        note: 'Bodenrichtwerte sind Durchschnittswerte einer Zone, kein Verkehrswert eines bestimmten Grundstücks.',
        fetchedAt: now,
      }
    })
  }
  if (state === 'Nordrhein-Westfalen') {
    return cached(`brw:${lat.toFixed(5)},${lng.toFixed(5)}`, 30 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('nrw_boris', NRW, NRW_LAYERS, lat, lng, 'text/plain')
      return {
        covered: true,
        values: parseNrw(text),
        portal: { label: 'BORIS.NRW', url: 'https://www.boris.nrw.de' },
        note: 'Bodenrichtwerte sind Durchschnittswerte einer Zone, kein Verkehrswert eines bestimmten Grundstücks.',
        fetchedAt: now,
      }
    })
  }
  return {
    covered: false,
    values: [],
    portal: (state && PORTALS[state]) || { label: 'BORIS-D (Bodenrichtwerte der Länder)', url: 'https://www.bodenrichtwerte-boris.de' },
    note: 'Für dieses Bundesland ist noch kein kostenloser maschinenlesbarer Dienst angebunden. Den amtlichen Wert findest du im verlinkten Portal.',
    fetchedAt: now,
  }
}
