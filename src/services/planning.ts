// Bebauungspläne am Standort (Master-Prompt Abschnitt 8: Bauprojekte und kommunale Planung).
// Angebunden: Hamburg, Berlin, Wien, Steiermark, Vorarlberg, Tirol, Kärnten, Schweiz (Abfrage am Punkt). Andernorts: Link zum Portal.
import { cached } from '../store/db.ts'
import { fetchJson } from './http.ts'
import { featureInfo } from './wms.ts'

export type PlanStatus = 'festgesetzt' | 'im Verfahren' | 'außer Kraft' | 'unbekannt' | 'Flächenwidmung' | 'Bauzone'

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

const WIEN = 'https://data.wien.gv.at/daten/geo'

/** Wien: generalisierte Flächenwidmung (CC BY 4.0, Stadt Wien – data.wien.gv.at) */
export function parseWien(json: GeoJsonFC): Plan[] {
  return json.features.map((f) => {
    const p = f.properties as Record<string, string | null>
    return {
      name: p.WIDMUNG_TXT ?? p.WIDMUNGSKLASSE_TXT ?? 'Flächenwidmung',
      status: 'Flächenwidmung',
      date: p.BEFRISTUNG_DATUM ? `befristet bis ${p.BEFRISTUNG_DATUM}` : null,
      documentUrl: null,
      explanationUrl: null,
      sourceId: 'wien_fwp',
      detail: [p.WIDMUNGSKLASSE_TXT && `Widmungsklasse: ${p.WIDMUNGSKLASSE_TXT}`, p.BEZIRK && `Bezirk ${p.BEZIRK}`].filter(Boolean).join(' · ') || null,
    }
  })
}

interface GeoAdminIdentify {
  results: { layerBodId: string; attributes: Record<string, string | number | null> }[]
}

/** Schweiz: harmonisierte Bauzonen (ARE, geo.admin.ch) */
export function parseBauzonen(res: GeoAdminIdentify): Plan[] {
  return res.results
    .filter((r) => r.layerBodId === 'ch.are.bauzonen')
    .map((r) => ({
      name: String(r.attributes.ch_bez_d ?? 'Bauzone'),
      status: 'Bauzone' as PlanStatus,
      date: null,
      documentUrl: null,
      explanationUrl: null,
      sourceId: 'ch_bauzonen',
      detail: `Gemeinde ${r.attributes.name ?? '?'} (${r.attributes.kt_kz ?? ''}) · harmonisierte Zonenbezeichnung, die kommunale Zone kann abweichen`,
    }))
}

interface ArcgisIdentify {
  results?: { layerId: number; layerName: string; attributes: Record<string, string | null> }[]
}
const val = (v: string | null | undefined) => (v && v !== 'Null' && v.trim() ? v.trim() : null)

/** Steiermark: Flächenwidmungsplan (CC BY 4.0, Land Steiermark). Änderungen (Ebene 22) gehen dem Stammplan (45) vor. */
export function parseSteiermark(res: ArcgisIdentify): Plan[] {
  const rows = (res.results ?? []).filter((r) => r.layerId === 22 || r.layerId === 45)
  const pick = rows.find((r) => r.layerId === 22) ?? rows.find((r) => r.layerId === 45)
  if (!pick) return []
  const a = pick.attributes
  const dichte = val(a.MIND) && val(a.MAXD) ? `Bebauungsdichte ${a.MIND}–${a.MAXD}` : null
  return [{
    name: val(a.Infotext) ?? val(a.WIDMUNG) ?? 'Flächenwidmung',
    status: 'Flächenwidmung',
    date: null,
    documentUrl: null,
    explanationUrl: null,
    sourceId: 'stmk_fwp',
    detail: [val(a.WIDMUNG) && `Kürzel ${a.WIDMUNG}`, dichte, pick.layerId === 22 ? 'aus einer Planänderung' : 'Stammplan'].filter(Boolean).join(' · ') || null,
  }]
}

/** Vorarlberg: Flächenwidmungsplan (CC BY 4.0, Land Vorarlberg, VoGIS) */
export function parseVorarlberg(json: GeoJsonFC): Plan[] {
  return json.features.map((f) => {
    const p = f.properties as Record<string, string | null>
    return {
      name: p.wi_em_txt ?? p.wi_em_kn ?? 'Flächenwidmung',
      status: 'Flächenwidmung' as PlanStatus,
      date: p.stand ?? null,
      documentUrl: null,
      explanationUrl: null,
      sourceId: 'vbg_fwp',
      detail: [p.gemeinde, p.wi_em_kn && `Kürzel ${p.wi_em_kn}`, p.folge_wi && `Folgewidmung ${p.folge_wi}`].filter(Boolean).join(' · ') || null,
    }
  })
}

/** Tirol: Flächenwidmung (CC BY 4.0, Land Tirol, tiris) */
export function parseTirol(json: { features?: { attributes: Record<string, string | number | null> }[] }): Plan[] {
  return (json.features ?? []).map((f) => {
    const a = f.attributes
    return {
      name: String(a.WIDMUNG ?? 'Flächenwidmung'),
      status: 'Flächenwidmung' as PlanStatus,
      date: typeof a.STAND === 'number' ? new Date(a.STAND).toISOString().slice(0, 10) : null,
      documentUrl: null,
      explanationUrl: null,
      sourceId: 'tirol_fwp',
      detail: [a.FESTLEGUNG && String(a.FESTLEGUNG), a.BEFRISTUNG && `befristet: ${a.BEFRISTUNG}`].filter(Boolean).join(' · ') || null,
    }
  })
}

/** Kärnten: Flächenwidmung im INSPIRE-Dienst des Landes (CC BY 4.0, Land Kärnten), Klassen nach HILUCS */
export function parseKaernten(res: ArcgisIdentify): Plan[] {
  return (res.results ?? []).map((r) => {
    const a = r.attributes
    return {
      name: val(a.LEVEL_3_TXT) ?? val(a.LEVEL_2_TXT) ?? val(a.LEVEL_1_TXT) ?? 'Flächenwidmung',
      status: 'Flächenwidmung' as PlanStatus,
      date: val(a.VALIDFROM) ? `gültig seit ${a.VALIDFROM}` : null,
      documentUrl: null,
      explanationUrl: null,
      sourceId: 'ktn_fwp',
      detail: [val(a.LEVEL_1_TXT), val(a.WIDCODE) && `Widmungscode ${a.WIDCODE}`, val(a.OFFICIALDOCUMENT_XLINK_HREF) && `Bescheid ${a.OFFICIALDOCUMENT_XLINK_HREF}`].filter(Boolean).join(' · ') || null,
    }
  })
}

const arcgisIdentifyUrl = (base: string, layers: string, lat: number, lng: number) => {
  const d = 0.005
  return `${base}/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=${layers}&tolerance=0&mapExtent=${lng - d},${lat - d},${lng + d},${lat + d}&imageDisplay=600,600,96&returnGeometry=false&f=json`
}

/** Semikolon-Text der NRW-Dienste: „@layer“ + Feldnamen bis shape_Area, danach Wertzeilen */
function semicolonRows(text: string, lastField: string): Record<string, string>[] {
  const out: Record<string, string>[] = []
  for (const block of text.split('@').slice(1)) {
    const cells = block.split(';')
    const end = cells.indexOf(lastField)
    if (end < 0) continue
    const header = [cells[0].replace(/^LU\.SpatialPlan\.[A-Za-z_]+/, ''), ...cells.slice(1, end + 1)]
    const values = cells.slice(end + 1)
    for (let i = 0; i + header.length <= values.length; i += header.length) {
      const row: Record<string, string> = {}
      header.forEach((h, j) => (row[h] = (values[i + j] ?? '').trim()))
      out.push(row)
    }
  }
  return out
}

/** NRW: Bebauungspläne aus dem INSPIRE-Dienst des Landes (IT.NRW), soweit Kommunen sie melden */
export function parseNrwBplan(text: string): Plan[] {
  return semicolonRows(text, 'shape_Area').map((r) => {
    const v = (k: string) => (r[k] && r[k] !== 'Null' ? r[k] : null)
    const stand = v('Rechtsstand') ?? ''
    return {
      name: [v('Nummer'), v('Offizieller Name')].filter(Boolean).join(' – ') || 'Bebauungsplan',
      status: /kraft getreten|rechtskräftig|festgesetzt/i.test(stand) ? 'festgesetzt' : /verfahren|aufstellung|entwurf|auslegung/i.test(stand) ? 'im Verfahren' : /außer kraft|aufgehoben/i.test(stand) ? 'außer Kraft' : 'unbekannt',
      date: /^0?1\.0?1\.1900$/.test(v('Datum des Inkrafttretens') ?? '') ? null : v('Datum des Inkrafttretens'), // 1.1.1900 = Platzhalter
      documentUrl: v('Dokument') ?? v('Planzeichen'),
      explanationUrl: v('Begründung'),
      sourceId: 'nrw_bplan',
      detail: [v('Kommune'), v('Planart'), stand && `Rechtsstand: ${stand}`].filter(Boolean).join(' · ') || null,
    }
  })
}

/** Baden-Württemberg: Bebauungspläne landesweit (INSPIRE, Geoportal Raumordnung BW), MapServer-Text */
export function parseBwBplan(text: string): Plan[] {
  return text.split(/\n(?=SpatialPlan:)/).filter((b) => b.trim().startsWith('SpatialPlan:')).map((b) => {
    const f = (k: string) => {
      const m = b.match(new RegExp(`\\n\\s*${k}: ([^\\n]*)`))
      const x = m?.[1]?.trim()
      return x && x !== 'null' && !x.startsWith('org.deegree') ? x : null
    }
    const valid = f('validFrom')
    return {
      name: [f('officialTitle'), f('alternativeTitle') && `(${f('alternativeTitle')})`].filter(Boolean).join(' ') || 'Bebauungsplan',
      status: valid ? 'festgesetzt' : 'unbekannt',
      date: valid,
      documentUrl: f('officialDocument'),
      explanationUrl: null,
      sourceId: 'bw_bplan',
      detail: valid ? `in Kraft seit ${valid}` : null,
    }
  })
}

/** Zuständige Portale, wenn kein Dienst angebunden ist */
const PORTALS: Record<string, { label: string; url: string }> = {
  Hessen: { label: 'Geoportal Hessen (Bauleitpläne der Kommunen)', url: 'https://www.geoportal.hessen.de' },
  Bayern: { label: 'BayernAtlas Bauleitplanung', url: 'https://geoportal.bayern.de/bayernatlas' },
  Niedersachsen: { label: 'Geodatenportal Niedersachsen', url: 'https://www.geodaten.niedersachsen.de' },
  Sachsen: { label: 'Geoportal Sachsen', url: 'https://geoportal.sachsen.de' },
  Oberösterreich: { label: 'DORIS Flächenwidmung (als Kartenebene zuschaltbar)', url: 'https://www.doris.at' },
  Salzburg: { label: 'SAGIS Salzburg (Flächenwidmung; offene Daten nur als Download, Einbau geplant)', url: 'https://www.salzburg.gv.at/sagis' },
  Niederösterreich: { label: 'NÖ Atlas (Flächenwidmung nicht als offene Daten veröffentlicht)', url: 'https://atlas.noe.gv.at' },
  Burgenland: { label: 'GeoDaten Burgenland (Flächenwidmung nicht als offene Daten veröffentlicht)', url: 'https://geodaten.bgld.gv.at' },
}

export async function fetchPlanning(lat: number, lng: number, state: string | null, country: string | null = 'DE'): Promise<PlanningResult> {
  const key = `plan:${lat.toFixed(5)},${lng.toFixed(5)}`
  const now = new Date().toISOString()
  if (country === 'CH') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const d = 0.01
      const res = await fetchJson<GeoAdminIdentify>(
        'ch_bauzonen',
        `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lng},${lat}&sr=4326&layers=all:ch.are.bauzonen&tolerance=0&mapExtent=${lng - d},${lat - d},${lng + d},${lat + d}&imageDisplay=600,600,96&returnGeometry=false&lang=de`,
      )
      return { covered: true, region: 'Schweiz', plans: parseBauzonen(res), portal: { label: 'Kantonale Nutzungsplanung über geo.admin.ch', url: 'https://map.geo.admin.ch' }, fetchedAt: now }
    })
  }
  if (state === 'Wien') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('wien_fwp', WIEN, 'ogdwien:GENFLWIDMUNGOGD', lat, lng, 'application/json')
      return { covered: true, region: 'Wien', plans: parseWien(JSON.parse(text) as GeoJsonFC), portal: { label: 'Flächenwidmungs- und Bebauungsplan Wien', url: 'https://www.wien.gv.at/flaechenwidmung/public/' }, fetchedAt: now }
    })
  }
  if (state === 'Steiermark') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const res = await fetchJson<ArcgisIdentify>('stmk_fwp', arcgisIdentifyUrl('https://gis.stmk.gv.at/arcgis/rest/services/OGD/flaewi/MapServer', 'all:22,45', lat, lng))
      return { covered: true, region: 'Steiermark', plans: parseSteiermark(res), portal: { label: 'Digitaler Atlas Steiermark', url: 'https://gis.stmk.gv.at' }, fetchedAt: now }
    })
  }
  if (state === 'Vorarlberg') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('vbg_fwp', 'https://vogis.cnv.at/geoserver/ows', 'vogis:fwp_flaeche', lat, lng, 'application/json')
      return { covered: true, region: 'Vorarlberg', plans: parseVorarlberg(JSON.parse(text) as GeoJsonFC), portal: { label: 'VoGIS Vorarlberg', url: 'https://vogis.cnv.at' }, fetchedAt: now }
    })
  }
  if (state === 'Tirol') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const url = `https://services3.arcgis.com/hG7UfxX49PQ8XkXh/arcgis/rest/services/FLW_Flaechenwidmung/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=WIDMUNG,FESTLEGUNG,BEFRISTUNG,STAND&returnGeometry=false&f=json`
      const res = await fetchJson<{ features?: { attributes: Record<string, string | number | null> }[] }>('tirol_fwp', url)
      return { covered: true, region: 'Tirol', plans: parseTirol(res), portal: { label: 'tiris – Flächenwidmung Tirol', url: 'https://www.tirol.gv.at/statistik-budget/tiris/' }, fetchedAt: now }
    })
  }
  if (state === 'Kärnten') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const res = await fetchJson<ArcgisIdentify>('ktn_fwp', arcgisIdentifyUrl('https://gis.ktn.gv.at/arcgis/rest/services/INSPIRE/INSPIRE/MapServer', 'all:13', lat, lng))
      return { covered: true, region: 'Kärnten', plans: parseKaernten(res), portal: { label: 'KAGIS Kärnten', url: 'https://kagis.ktn.gv.at' }, fetchedAt: now }
    })
  }
  if (state === 'Nordrhein-Westfalen') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('nrw_bplan', 'https://www.wms.nrw.de/wms/wms_nw_inspire-bauleitplanung', 'LU.SpatialPlan.Bebauungsplaene', lat, lng, 'text/plain')
      return { covered: true, region: 'Nordrhein-Westfalen', plans: parseNrwBplan(text), portal: { label: 'Bauleitplanung NRW', url: 'https://www.bauleitplanung.nrw.de' }, fetchedAt: now }
    })
  }
  if (state === 'Baden-Württemberg') {
    return cached(key, 7 * 24 * 3600 * 1000, async () => {
      const text = await featureInfo('bw_bplan', 'https://www.geoportal-raumordnung-bw.de/ows/services/org.1.a12db7e6-88fc-4652-b350-3c25496ebc7a_wms', 'LU.SpatialPlan', lat, lng, 'text/plain')
      return { covered: true, region: 'Baden-Württemberg', plans: parseBwBplan(text), portal: { label: 'Geoportal Raumordnung BW', url: 'https://www.geoportal-raumordnung-bw.de' }, fetchedAt: now }
    })
  }
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
