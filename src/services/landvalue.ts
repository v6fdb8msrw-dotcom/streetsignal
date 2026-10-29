// Amtliche Bodenrichtwerte (Master-Prompt Abschnitt 9). Direkt abgefragt werden nur Länder, deren Dienst
// eine offene Lizenz hat (dl-de/zero, dl-de/by, CC BY). Sonst Link zum amtlichen Portal.
import { cached } from '../store/db.ts'
import { featureInfo } from './wms.ts'

export interface LandValue {
  valueEurPerSqm: number
  referenceDate: string | null
  usage: string | null
  /** Zone oder Ortsteil */
  district: string | null
  municipality: string | null
  committee: string | null
  documentUrl: string | null
  /** true = Bauland, false = Land-/Forstwirtschaft oder sonstige Fläche, null = unbekannt */
  buildingLand?: boolean | null
}

export interface LandValueResult {
  covered: boolean
  values: LandValue[]
  portal: { label: string; url: string } | null
  note: string
  fetchedAt: string
  /** Quelle in der Registry */
  sourceId?: string
}

const NUTZUNG: Record<string, string> = {
  W: 'Wohnbaufläche',
  WS: 'Kleinsiedlungsgebiet',
  WR: 'Reines Wohngebiet',
  WA: 'Allgemeines Wohngebiet',
  WB: 'Besonderes Wohngebiet',
  M: 'Gemischte Baufläche',
  MD: 'Dorfgebiet',
  MI: 'Mischgebiet',
  MK: 'Kerngebiet',
  MU: 'Urbanes Gebiet',
  G: 'Gewerbliche Baufläche',
  GE: 'Gewerbegebiet',
  GI: 'Industriegebiet',
  S: 'Sonderbaufläche',
  SO: 'Sondergebiet',
  LW: 'Landwirtschaft',
  A: 'Acker',
  GR: 'Grünland',
  F: 'Forstwirtschaft',
}

/** Codeliste BR_Art_Nutzung der AdV (registry.gdi-de.org) */
const ADV_NUTZUNG: Record<string, string> = {
  1100: 'Wohnbaufläche', 1110: 'Kleinsiedlungsgebiet', 1120: 'Reines Wohngebiet', 1130: 'Allgemeines Wohngebiet', 1140: 'Besonderes Wohngebiet',
  1200: 'Gemischte Baufläche', 1210: 'Dorfgebiet', 1220: 'Dörfliches Wohngebiet', 1230: 'Mischgebiet', 1240: 'Kerngebiet', 1250: 'Urbanes Gebiet',
  1300: 'Gewerbliche Baufläche', 1310: 'Gewerbegebiet', 1320: 'Industriegebiet', 1400: 'Sonderbaufläche', 1410: 'Sondergebiet für Erholung', 1420: 'Sonstiges Sondergebiet',
  1500: 'Baufläche für Gemeinbedarf', 2000: 'Landwirtschaftliche Fläche', 2100: 'Acker', 2200: 'Grünland', 2300: 'Erwerbsgartenbaufläche',
  2400: 'Sonderkulturen', 2500: 'Weingarten', 2700: 'Unland', 2800: 'Forstwirtschaftliche Fläche', 3010: 'Private Grünfläche', 3020: 'Kleingartenfläche',
  3040: 'Campingplatz', 3050: 'Sportfläche', 3070: 'Friedhof', 3080: 'Wasserfläche', 3100: 'Private Parkplätze', 3110: 'Lagerfläche', 3130: 'Gemeinbedarfsfläche',
}

/** Codeliste Entwicklungszustand der AdV: 1000/B = baureifes Land … 4000/LF = Land- und Forstwirtschaft */
const ADV_ENTW: Record<string, string> = {
  1000: 'Baureifes Land', 2000: 'Rohbauland', 3000: 'Bauerwartungsland', 4000: 'Land- und Forstwirtschaft', 5000: 'Sonstige Fläche',
  B: 'Baureifes Land', R: 'Rohbauland', E: 'Bauerwartungsland', LF: 'Land- und Forstwirtschaft', SF: 'Sonstige Fläche',
}
const isBuilding = (entw: string | null | undefined): boolean | null => {
  if (!entw) return null
  const e = entw.trim()
  if (['1000', '2000', '3000', 'B', 'R', 'E'].includes(e)) return true
  if (['4000', '5000', 'LF', 'SF'].includes(e)) return false
  return /baureif|rohbau|bauerwartung/i.test(e) ? true : /forst|landwirt|acker|grünland/i.test(e) ? false : null
}

const num = (s: string | null | undefined) => {
  const n = Number((s ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}
const isoDate = (s: string | null | undefined) => {
  if (!s) return null
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10)
}

/**
 * NRW liefert Text: „@layer“ + Feldnamen, dann Werte, alles mit Semikolon getrennt.
 * Mehrere Treffer folgen als weitere Wertzeilen bzw. weitere @-Blöcke.
 */
export function parseNrw(text: string): LandValue[] {
  const out: LandValue[] = []
  for (const block of text.split('@').slice(1)) {
    const cells = block.split(';')
    const nameEnd = cells.indexOf('SHAPE_Area')
    if (nameEnd < 0) continue
    const header = [cells[0].replace(/^.*?([A-Z][A-Z_]*)$/, '$1'), ...cells.slice(1, nameEnd + 1)]
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
        buildingLand: isBuilding(row.ENTW) ?? (['LW', 'F', 'A', 'GR'].includes(row.NUTA) ? false : null),
      })
    }
  }
  return out
}

/** MapServer-Text: Blöcke „Feature n:“ mit Zeilen „KEY = 'Wert'“ (Hessen, Sachsen, Mecklenburg-Vorpommern) */
function mapserverFeatures(text: string): ((k: string) => string | null)[] {
  return text.split(/\n\s*Feature \d+:/).slice(1).map((block) => (k: string) => block.match(new RegExp(`\\n\\s*${k} = '([^']*)'`))?.[1]?.replace(/\s+/g, ' ').trim() || null)
}

export function parseHessen(text: string): LandValue[] {
  return mapserverFeatures(text).flatMap((f) => {
    const brw = num(f('BRW'))
    if (!brw) return []
    return [{
      valueEurPerSqm: brw,
      referenceDate: isoDate(f('STAG')),
      usage: f('NUTA_KLART') ?? f('ERGN_KLART'),
      district: f('ENTW_KLART'),
      municipality: f('GENA'),
      committee: f('GABE'),
      documentUrl: f('URL'),
      buildingLand: isBuilding(f('ENTW_KLART')),
    }]
  })
}

export function parseSachsen(text: string): LandValue[] {
  return mapserverFeatures(text).flatMap((f) => {
    const brw = num(f('BODENRICHTWERT_TEXT'))
    if (!brw) return []
    const doc = f('UMRECHNUNGSTABELLEN')
    return [{
      valueEurPerSqm: brw,
      referenceDate: isoDate(f('STICHTAG_TXT')),
      usage: f('NUTZUNG_TEXT'),
      district: null,
      municipality: null,
      committee: f('GA_POST_NAME'),
      documentUrl: doc ? (doc.startsWith('http') ? doc : `https://${doc}`) : null,
      buildingLand: isBuilding(f('ENTWICKLUNGSZUSTAND_K')),
    }]
  })
}

export function parseMv(text: string): LandValue[] {
  return mapserverFeatures(text).flatMap((f) => {
    const brw = num(f('brwkon'))
    if (!brw) return []
    const nuta = f('nuta')
    return [{
      valueEurPerSqm: brw,
      referenceDate: isoDate(f('stag')),
      usage: (nuta && NUTZUNG[nuta]) ?? f('class'),
      district: f('ortst'),
      municipality: null,
      committee: f('gabe') ? `Gutachterausschuss ${f('gabe')}` : null,
      documentUrl: null,
      buildingLand: isBuilding(f('entw')),
    }]
  })
}

/** Thüringen: „$#$“-getrennte Paare KEY=Wert, Treffer beginnen mit „_featuremember_“ */
export function parseThueringen(text: string): LandValue[] {
  return text.split('_featuremember_').slice(1).flatMap((block) => {
    const row: Record<string, string> = {}
    for (const pair of block.split('$#$')) {
      const i = pair.indexOf('=')
      if (i > 0) row[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
    }
    const brw = num(row.BODENRICHTWERT)
    if (!brw) return []
    return [{
      valueEurPerSqm: brw,
      referenceDate: isoDate(row.STICHTAG),
      usage: row.NUTZUNGSART_LANG || null,
      district: row.BODENRICHTWERTZONENAME || null,
      municipality: row.GEMEINDENAME || null,
      committee: row.GUTACHTERAUSSCHUSSBEZEICHNUNG || null,
      documentUrl: null,
      buildingLand: isBuilding(row.ENTWICKLUNGSZUSTAND),
    }]
  })
}

/** AdV-Schema (VBORIS) als GML: Brandenburg, Sachsen-Anhalt (br:…), Niedersachsen (boris:…) */
export function parseAdvGml(xml: string): LandValue[] {
  return xml.split(/<[a-z]+:featureMember>/).slice(1).flatMap((block) => {
    const tag = (t: string) => block.match(new RegExp(`<[a-z]+:${t}>([^<]*)</`))?.[1]?.trim() || null
    const brw = num(tag('bodenrichtwert'))
    if (!brw) return []
    const artCode = block.match(/BR_Art_Nutzung\/(\d+)/)?.[1]
    const art = tag('art')
    const entw = tag('entwicklungszustand')
    // Niedersachsen nennt den Gutachterausschuss als zweite <boris:bezeichnung>
    const committee = [...block.matchAll(/<[a-z]+:bezeichnung>([^<]*Gutachterausschuss[^<]*)</g)][0]?.[1] ?? null
    return [{
      valueEurPerSqm: brw,
      referenceDate: tag('stichtag'),
      usage: (artCode && ADV_NUTZUNG[artCode]) || (art && NUTZUNG[art]) || art || (entw && ADV_ENTW[entw]) || null,
      district: tag('bodenrichtwertzoneName'),
      municipality: null,
      committee,
      documentUrl: null,
      buildingLand: isBuilding(entw),
    }]
  })
}

/** Berlin: GeoJSON mit deutschsprachigen Feldnamen */
export function parseBerlinBrw(json: { features?: { properties?: Record<string, string | null> }[] }): LandValue[] {
  return (json.features ?? []).flatMap((f) => {
    const p = f.properties ?? {}
    const brw = num(p['Bodenrichtwert (in EURO/m²)'])
    if (!brw) return []
    return [{
      valueEurPerSqm: brw,
      referenceDate: isoDate(p.Stichtag),
      usage: p['Art der Nutzung'] || null,
      district: p.Bezirk || null,
      municipality: 'Berlin',
      committee: 'Gutachterausschuss für Grundstückswerte in Berlin',
      documentUrl: p['GFZ-Umrechnungskoeffizienten'] || null,
      buildingLand: true,
    }]
  })
}

interface StateService {
  sourceId: string
  portal: { label: string; url: string }
  load: (lat: number, lng: number) => Promise<LandValue[]>
}

const STATES: Record<string, StateService> = {
  'Nordrhein-Westfalen': {
    sourceId: 'nrw_boris',
    portal: { label: 'BORIS.NRW', url: 'https://www.boris.nrw.de' },
    // Layer-Nummern mit Bodenrichtwerten (je Bauweise/Nutzung); die *_label-Layer werden ausgelassen
    load: async (lat, lng) => parseNrw(await featureInfo('nrw_boris', 'https://www.wms.nrw.de/boris/wms_nw_brw', '2,5,8,11,14,17,20', lat, lng, 'text/plain')),
  },
  Hessen: {
    sourceId: 'he_boris',
    portal: { label: 'BORIS Hessen', url: 'https://www.geoportal.hessen.de' },
    load: async (lat, lng) => parseHessen(await featureInfo('he_boris', 'https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-maps.ows', 'hboris_feature', lat, lng, 'text/plain')),
  },
  Berlin: {
    sourceId: 'be_boris',
    portal: { label: 'Bodenrichtwerte Berlin', url: 'https://www.berlin.de/gutachterausschuss/' },
    load: async (lat, lng) => parseBerlinBrw(JSON.parse(await featureInfo('be_boris', 'https://gdi.berlin.de/services/wms/brw2025', 'brw2025', lat, lng, 'application/json', '1.3.0'))),
  },
  Brandenburg: {
    sourceId: 'bb_boris',
    portal: { label: 'BORIS Brandenburg', url: 'https://www.boris-brandenburg.de' },
    load: async (lat, lng) => parseAdvGml(await featureInfo('bb_boris', 'https://isk.geobasis-bb.de/ows/boris_wms', 'brw_2026', lat, lng, 'text/xml')),
  },
  Thüringen: {
    sourceId: 'th_boris',
    portal: { label: 'BORIS Thüringen', url: 'https://www.geoportal-th.de' },
    load: async (lat, lng) => parseThueringen(await featureInfo('th_boris', 'https://www.geoproxy.geoportal-th.de/geoproxy/services/boris/vBORIS_simple', 'vBODENRICHTWERTZONE_aktuell', lat, lng, 'text/plain')),
  },
  Sachsen: {
    sourceId: 'sn_boris',
    portal: { label: 'BORIS Sachsen', url: 'https://www.boris.sachsen.de' },
    load: async (lat, lng) => parseSachsen(await featureInfo('sn_boris', 'https://www.landesvermessung.sachsen.de/fp/httpproxy/svcdep/wms/boris_2026', 'brw_2026', lat, lng, 'text/plain')),
  },
  Niedersachsen: {
    sourceId: 'ni_boris',
    portal: { label: 'BORIS Niedersachsen', url: 'https://immobilienmarkt.niedersachsen.de/bodenrichtwerte' },
    load: async (lat, lng) => parseAdvGml(await featureInfo('ni_boris', 'https://opendata.lgln.niedersachsen.de/doorman/noauth/boris_2026_wms', 'Bauland', lat, lng, 'text/xml')),
  },
  'Sachsen-Anhalt': {
    sourceId: 'st_boris',
    portal: { label: 'BORIS Sachsen-Anhalt', url: 'https://www.lvermgeo.sachsen-anhalt.de/de/boris.html' },
    load: async (lat, lng) => parseAdvGml(await featureInfo('st_boris', 'https://www.geodatenportal.sachsen-anhalt.de/ows_st_lvermgeo_brw2026', 'Bauland', lat, lng, 'text/xml')),
  },
  'Mecklenburg-Vorpommern': {
    sourceId: 'mv_boris',
    portal: { label: 'BORIS Mecklenburg-Vorpommern', url: 'https://www.geoportal-mv.de' },
    load: async (lat, lng) => parseMv(await featureInfo('mv_boris', 'https://www.geodaten-mv.de/dienste/bodenrichtwerte_wms', 'bodenrichtwerte', lat, lng, 'text/plain')),
  },
}

/** Länder ohne freien Abruf: Link und der Grund dafür (geprüft 28.10.2026) */
const LINK_ONLY: Record<string, { label: string; url: string; why: string }> = {
  Bayern: { label: 'BORIS Bayern', url: 'https://www.boris-bayern.de', why: 'Bayern gibt Bodenrichtwerte nur zur Ansicht im eigenen Portal frei, ein Dienst steht nur Behörden offen.' },
  'Baden-Württemberg': { label: 'BORIS-BW', url: 'https://www.gutachterausschuesse-bw.de/borisbw/', why: 'Die BORIS-BW-Lizenz erlaubt nur nicht kommerzielle Nutzung.' },
  Saarland: { label: 'BORIS Saarland', url: 'https://geoportal.saarland.de', why: 'Das Saarland erlaubt nur die Ansicht im eigenen Portal.' },
  Bremen: { label: 'Bodenrichtwerte Bremen', url: 'https://www.gutachterausschuss.bremen.de', why: 'Bremen und Bremerhaven geben die Werte nur gegen Gebühr ab.' },
  'Schleswig-Holstein': { label: 'BORIS Schleswig-Holstein', url: 'https://danord.gdi-sh.de/viewer/resources/apps/VBORIS/index.html', why: 'Für Schleswig-Holstein ist kein Dienst mit offener Lizenz veröffentlicht.' },
  'Rheinland-Pfalz': { label: 'BORIS Rheinland-Pfalz', url: 'https://www.boris.rlp.de', why: 'Laut Katalog ist der Basisdienst dl-de/by-2.0, seine Dienstadresse ist aber nicht veröffentlicht.' },
  Hamburg: { label: 'Bodenrichtwerte Hamburg', url: 'https://www.geoportal-hamburg.de/boris/', why: 'Der freie Hamburger Dienst (dl-de/by) zeigt die Zonen als Kartenebene, liefert am Punkt aber nur die Zonennummer, nicht den Wert.' },
}

const NOTE = 'Bodenrichtwerte sind Durchschnittswerte einer Zone, kein Verkehrswert eines bestimmten Grundstücks.'

/** Doppelte Treffer weg, Bauland zuerst, dann nach Wert; höchstens vier */
export function rankValues(values: LandValue[]): LandValue[] {
  const order = (v: LandValue) => (v.buildingLand === true ? 0 : v.buildingLand === null || v.buildingLand === undefined ? 1 : 2)
  const seen = new Set<string>()
  const unique = values.filter((v) => {
    const k = `${v.valueEurPerSqm}|${v.usage}|${v.referenceDate}|${v.district}`
    return !seen.has(k) && !!seen.add(k)
  })
  return unique.sort((a, b) => order(a) - order(b) || b.valueEurPerSqm - a.valueEurPerSqm).slice(0, 4)
}

export function landValueSourceIds(): string[] {
  return Object.values(STATES).map((s) => s.sourceId)
}

export async function fetchLandValue(lat: number, lng: number, country: string | null, state: string | null): Promise<LandValueResult> {
  const now = new Date().toISOString()
  if (country === 'AT' || country === 'CH')
    return { covered: false, values: [], portal: null, note: country === 'CH' ? 'Die Schweiz hat kein öffentliches Bodenrichtwertsystem wie Deutschland.' : 'Für Österreich gibt es keine vergleichbaren amtlichen Bodenrichtwerte als offenen Dienst.', fetchedAt: now }
  const svc = state ? STATES[state] : undefined
  if (svc) {
    return cached(`brw3:${lat.toFixed(5)},${lng.toFixed(5)}`, 30 * 24 * 3600 * 1000, async () => {
      const values = rankValues(await svc.load(lat, lng))
      return {
        covered: true,
        values,
        portal: svc.portal,
        note: values.length ? NOTE : 'Für diesen Punkt liefert der amtliche Dienst keinen Bodenrichtwert (z. B. Straße, Gewässer oder Zone ohne Wert).',
        fetchedAt: now,
        sourceId: svc.sourceId,
      }
    })
  }
  const link = state ? LINK_ONLY[state] : undefined
  return {
    covered: false,
    values: [],
    portal: link ? { label: link.label, url: link.url } : { label: 'BORIS-D (Bodenrichtwerte der Länder)', url: 'https://www.bodenrichtwerte-boris.de' },
    note: link ? `${link.why} Den amtlichen Wert findest du im verlinkten Portal.` : 'Für diese Region ist kein kostenloser maschinenlesbarer Dienst angebunden. Den amtlichen Wert findest du im verlinkten Portal.',
    fetchedAt: now,
    sourceId: 'boris_d',
  }
}
