import { describe, expect, it } from 'vitest'
import { parseHessen, parseNrw } from './landvalue.ts'
import { classToRange, formatRange } from './noise.ts'
import { matchEndpoint } from './oparl.ts'
import { tileKey } from './transit.ts'
import { buildQuery, categorize } from './overpass.ts'
import { parseBauzonen, parseBerlin, parseHamburg, parseWien } from './planning.ts'

describe('Lärmklassen', () => {
  it('übersetzt die EEA-Klassen in dB-Spannen', () => {
    expect(classToRange('lden', 1)).toEqual([55, 60])
    expect(classToRange('lden', 5)).toEqual([75, null])
    expect(classToRange('lnight', 1)).toEqual([50, 55])
    expect(classToRange('lden', 'NoData')).toBeNull()
  })
  it('sagt bei fehlender Klasse nicht „ruhig“', () => {
    expect(formatRange(null, 'lden')).toBe('unter 55 dB oder nicht kartiert')
  })
})

describe('OpenStreetMap', () => {
  it('ordnet Merkmale den Kategorien zu', () => {
    expect(categorize({ leisure: 'park', name: 'Grüneburgpark' })).toBe('gruen')
    expect(categorize({ amenity: 'kindergarten' })).toBe('kita')
    expect(categorize({ highway: 'bus_stop' })).toBe('oepnv')
    expect(categorize({ leisure: 'garden', access: 'private' })).toBeNull()
    expect(categorize({ landuse: 'construction' })).toBe('baustelle')
  })
  it('baut eine Abfrage mit Radius', () => {
    const q = buildQuery(50.1, 8.6, 500)
    expect(q).toContain('around:500,50.1,8.6')
    expect(q).toContain('around:1500,50.1,8.6') // Grünflächen weiter suchen
  })
})

describe('Bebauungspläne', () => {
  it('liest Hamburgs Textantwort', () => {
    const plans = parseHamburg(`hh_hh_festgestellt:
  geltendes_planrecht: Hamburg-Altstadt47-Neustadt49
  planrecht: https://example.org/plan.pdf
  begruendung: https://example.org/begr.pdf
  feststellungsdatum: 2011-07-05
`)
    expect(plans).toEqual([
      { name: 'Hamburg-Altstadt47-Neustadt49', status: 'festgesetzt', date: '2011-07-05', documentUrl: 'https://example.org/plan.pdf', explanationUrl: 'https://example.org/begr.pdf', sourceId: 'hh_bplan' },
    ])
  })
  it('liest Berlins JSON-Antwort', () => {
    const [p] = parseBerlin({
      features: [{ id: 'a_bp_iv.1-23', properties: { 'Name des Plans': '1-23', Geltungsbereich: 'Gelände an der Spree', Rechtsstand: 'Öffentliche Auslegung', 'Aufstellungsbeschluss': '01.02.2024', 'Link zur Planzeichnung': 'https://example.org/1-23.pdf', Inhalte: 'Wohngebiet' } }],
    })
    expect(p.status).toBe('im Verfahren')
    expect(p.name).toBe('1-23 – Gelände an der Spree')
    expect(p.date).toBe('01.02.2024')
    expect(p.detail).toContain('Wohngebiet')
  })
})

describe('Bodenrichtwerte NRW', () => {
  it('liest Wert, Stichtag und Nutzung aus der Textantwort', () => {
    const header = '@brw_mehrgeschossige_bauweiseANL;BKO;BRW;GABE;GENA;NUTA;ORTST;STAG;UDOK_URL;SHAPE_Length;SHAPE_Area;'
    const values = ' ; ;24000;Der Gutachterausschuss Köln;Köln;MK;Altstadt/Nord;2026-01-01;https://example.org/brw.pdf;1;2;'
    const [v] = parseNrw(header + values)
    expect(v.valueEurPerSqm).toBe(24000)
    expect(v.referenceDate).toBe('2026-01-01')
    expect(v.usage).toBe('Kerngebiet')
    expect(v.district).toBe('Altstadt/Nord')
  })
  it('liefert nichts bei „No features found“', () => {
    expect(parseNrw('No features found')).toEqual([])
  })
})

describe('OParl', () => {
  const eps = [
    { title: 'Stadt Köln', url: 'https://k/system' },
    { title: 'München Transparent', url: 'https://m' },
    { title: 'Stadt Bad Münstereifel', url: 'https://b' },
  ]
  it('findet die Kommune', () => {
    expect(matchEndpoint(eps, 'Köln')?.url).toBe('https://k/system')
    expect(matchEndpoint(eps, 'München')?.url).toBe('https://m')
    expect(matchEndpoint(eps, 'Münster')).toBeNull()
  })
})

describe('Neue Quellen', () => {
  it('liest Bodenrichtwerte Hessen', () => {
    const [v] = parseHessen(`GetFeatureInfo results:

Layer 'hboris_feature'
  Feature 19921: 
    GENA = 'Frankfurt am Main'
    BRW = '6800 EUR/m²'
    STAG = '01.01.2026'
    ENTW_KLART = 'Baureifes Land'
    NUTA_KLART = 'Wohnbaufläche  Mehrfamilienhäuser (MFH)'
    GABE = 'Gutachterausschuss Frankfurt'
    URL = 'https://example.org/gaa.pdf'
`)
    expect(v.valueEurPerSqm).toBe(6800)
    expect(v.referenceDate).toBe('2026-01-01')
    expect(v.usage).toContain('Mehrfamilienhäuser')
  })
  it('liest Flächenwidmung Wien', () => {
    const [p] = parseWien({ features: [{ properties: { WIDMUNG_TXT: 'Gemischtes Baugebiet Bauklasse 5', WIDMUNGSKLASSE_TXT: 'Gemischtes Baugebiet', BEZIRK: '1' } }] })
    expect(p.status).toBe('Flächenwidmung')
    expect(p.name).toBe('Gemischtes Baugebiet Bauklasse 5')
  })
  it('liest Bauzonen Schweiz', () => {
    const [p] = parseBauzonen({ results: [{ layerBodId: 'ch.are.bauzonen', attributes: { ch_bez_d: 'Mischzonen', name: 'Zürich', kt_kz: 'ZH' } }, { layerBodId: 'ch.are.gueteklassen_oev', attributes: {} }] })
    expect(p.name).toBe('Mischzonen')
    expect(p.status).toBe('Bauzone')
  })
  it('bildet Kachelschlüssel für Fahrplandaten', () => {
    expect(tileKey(50.11, 8.68)).toBe('50_8p5')
    expect(tileKey(52.49, 13.43)).toBe('52p25_13p25')
  })
})

describe('Flächenwidmung Österreich', () => {
  it('Steiermark: Planänderung vor Stammplan', async () => {
    const { parseSteiermark } = await import('./planning.ts')
    const [p] = parseSteiermark({
      results: [
        { layerId: 45, layerName: 'Widmung-Stammplan', attributes: { WIDMUNG: 'WA', Infotext: 'Allgemeines Wohngebiet', MIND: '0,2', MAXD: '0,6' } },
        { layerId: 22, layerName: 'Widmung_Aenderung', attributes: { WIDMUNG: 'KG', Infotext: 'Kerngebiet', MIND: '0,8', MAXD: '2,5' } },
      ],
    })
    expect(p.name).toBe('Kerngebiet')
    expect(p.detail).toContain('Planänderung')
  })
  it('Vorarlberg, Tirol, Kärnten', async () => {
    const { parseVorarlberg, parseTirol, parseKaernten } = await import('./planning.ts')
    expect(parseVorarlberg({ features: [{ properties: { gemeinde: 'Bregenz', stand: '2026-01-28', wi_em_txt: 'Baufläche Wohngebiet', wi_em_kn: 'BW' } }] })[0].name).toBe('Baufläche Wohngebiet')
    const [t] = parseTirol({ features: [{ attributes: { WIDMUNG: 'Kerngebiet § 40 (3)', STAND: 1783468800000 } }] })
    expect(t.name).toBe('Kerngebiet § 40 (3)')
    expect(t.date).toBe('2026-07-08')
    const [k] = parseKaernten({ results: [{ layerId: 13, layerName: 'LU.ZoningElement', attributes: { LEVEL_1_TXT: 'Wohnnutzung', LEVEL_3_TXT: 'Wohngebiet', VALIDFROM: '18.04.2003', WIDCODE: 'B101' } }] })
    expect(k.name).toBe('Wohngebiet')
  })
})

describe('Bebauungspläne landesweit', () => {
  it('NRW (Semikolon-Text)', async () => {
    const { parseNrwBplan } = await import('./planning.ts')
    const text = '@LU.SpatialPlan.BebauungsplaeneOBJECTID;Offizieller Name;Kommune;Nummer;Plantyp;Planart;Dokument;InspireID;Beschreibung;Rechtsstand;Datum des Inkrafttretens;Ändert;Name Änderung;Nummer Änderung;Verfahren;Festsetzungen;Planzeichen;Begründung;Umweltbericht;Zusammenfassende Erklärung;Sonstige URL;Gemeindekennziffer;Level of Spatialplan;Shape;shape_Length;shape_Area;7906820;InW 109 City;Dortmund;InW_109;Bebauungsplan;Einfacher BPlan;https://example.org/InW_109.html;DE_05913000_InW_109;Null;In Kraft getreten;24.9.1988;Null;Null;Null;Null;https://example.org/f.html;https://example.org/p.html;Null;Null;Null;https://example.org/s.html;05913000;local;Polygon;7536,7;465299,8;'
    const [p] = parseNrwBplan(text)
    expect(p.name).toBe('InW_109 – InW 109 City')
    expect(p.status).toBe('festgesetzt')
    expect(p.date).toBe('24.9.1988')
    expect(p.documentUrl).toBe('https://example.org/InW_109.html')
    expect(p.detail).toContain('Dortmund')
  })
  it('Baden-Württemberg (MapServer-Text)', async () => {
    const { parseBwBplan } = await import('./planning.ts')
    const [p] = parseBwBplan(`SpatialPlan:
  identifier: https://example.org/BP_1
  extent: MULTIPOLYGON (((1 2,3 4,1 2)))
  officialTitle: Gewerbegebiet Haid - Erweiterung
  levelOfSpatialPlan: org.deegree.gml.reference.FeatureReference@4d431832
  validFrom: 1992-06-30
  alternativeTitle: 21-2511.2-5/6-26c
  officialDocument: null
`)
    expect(p.name).toBe('Gewerbegebiet Haid - Erweiterung (21-2511.2-5/6-26c)')
    expect(p.status).toBe('festgesetzt')
    expect(p.date).toBe('1992-06-30')
    expect(p.documentUrl).toBeNull()
  })
})
