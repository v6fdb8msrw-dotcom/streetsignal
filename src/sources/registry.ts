// Verzeichnis aller Datenquellen (Master-Prompt Abschnitte 5, 8, 14; Meta-Suche Abschnitt 8).
// Geprüft am 26.10.2026: Abruf direkt aus dem Browser (CORS), ohne Schlüssel, ohne Kosten.

export type SourceStatus = 'aktiv' | 'nur Link' | 'nicht angebunden'

export interface DataSource {
  id: string
  name: string
  provider: string
  category: 'Karte' | 'Adresssuche' | 'Umgebung' | 'Lärm' | 'Planung' | 'Bodenrichtwerte' | 'Baustellen' | 'Kommunales' | 'KI' | 'Bilder'
  status: SourceStatus
  access: string
  coverage: string
  license: string
  licenseUrl?: string
  /** Bezugsjahr bzw. Datenstand, so wie die Quelle ihn angibt */
  dataDate: string
  limits: string
  url: string
  /** Quellenvermerk, der laut Lizenz bei der Anzeige stehen muss */
  attribution: string
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'openfreemap',
    name: 'OpenFreeMap (Kartenstil Positron)',
    provider: 'OpenFreeMap, Daten © OpenStreetMap-Mitwirkende',
    category: 'Karte',
    status: 'aktiv',
    access: 'Vektorkacheln, kein Schlüssel',
    coverage: 'weltweit',
    license: 'Kartendaten ODbL, Stil BSD',
    licenseUrl: 'https://openfreemap.org',
    dataDate: 'laufend aktualisiert',
    limits: 'Kostenloser Dienst ohne Garantie; Quellenangabe Pflicht. Austauschbar über src/map/style.ts.',
    url: 'https://openfreemap.org',
    attribution: '© OpenFreeMap, © OpenStreetMap-Mitwirkende',
  },
  {
    id: 'photon',
    name: 'Photon Geocoder',
    provider: 'komoot, Daten © OpenStreetMap-Mitwirkende',
    category: 'Adresssuche',
    status: 'aktiv',
    access: 'JSON-Schnittstelle, kein Schlüssel',
    coverage: 'weltweit, Suche auf DE/AT/CH beschränkt',
    license: 'ODbL (Daten)',
    licenseUrl: 'https://photon.komoot.io',
    dataDate: 'laufend aktualisiert',
    limits: 'Faire Nutzung: StreetSignal fragt höchstens einmal pro Sekunde und speichert Antworten zwischen.',
    url: 'https://photon.komoot.io',
    attribution: 'Suche: Photon (komoot), © OpenStreetMap-Mitwirkende',
  },
  {
    id: 'overpass',
    name: 'OpenStreetMap über Overpass API',
    provider: 'OpenStreetMap-Mitwirkende, Server overpass-api.de',
    category: 'Umgebung',
    status: 'aktiv',
    access: 'Abfragesprache Overpass QL, kein Schlüssel; Ausweichserver overpass.private.coffee (laut Betreiber frei nutzbar)',
    coverage: 'DE, AT, CH (weltweit)',
    license: 'ODbL 1.0',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
    dataDate: 'Minutenaktuell (Zeitstempel je Abfrage)',
    limits: 'Öffentlicher Server mit Lastgrenzen; StreetSignal fragt nur auf Klick und speichert Ergebnisse. Vollständigkeit hängt von der Kartierung vor Ort ab.',
    url: 'https://overpass-api.de',
    attribution: '© OpenStreetMap-Mitwirkende (ODbL)',
  },
  {
    id: 'eea_noise',
    name: 'EU-Umgebungslärmkartierung (Straße, Schiene, Flug, Industrie)',
    provider: 'Europäische Umweltagentur (EEA), Daten der Mitgliedstaaten',
    category: 'Lärm',
    status: 'aktiv',
    access: 'ArcGIS ImageServer (Kartenbild und Wert am Punkt)',
    coverage: 'Ballungsräume, Hauptverkehrsstraßen, Haupteisenbahnstrecken, Großflughäfen in DE, AT, CH',
    license: 'EEA-Weiterverwendungsregeln: kostenlos, auch kommerziell, mit Quellenangabe EEA',
    licenseUrl: 'https://www.eea.europa.eu/en/legal-notice',
    dataDate: 'Kartierungsrunde 4 (Bezugsjahr 2022), Datenbank-Update April 2026',
    limits: 'Klassen ab 55 dB (L_DEN) bzw. 50 dB (L_Night). „Keine Klasse“ heißt: unter der Kartierungsschwelle oder nicht kartiert, nicht „ruhig“.',
    url: 'https://noise.discomap.eea.europa.eu/arcgis/rest/services/noiseStoryMap',
    attribution: 'Lärmdaten: European Environment Agency (EEA)',
  },
  {
    id: 'nrw_noise',
    name: 'Umgebungslärm NRW (Runde 4, 2022)',
    provider: 'Land Nordrhein-Westfalen (LANUV)',
    category: 'Lärm',
    status: 'aktiv',
    access: 'WMS',
    coverage: 'Nordrhein-Westfalen',
    license: 'Datenlizenz Deutschland – Namensnennung – 2.0 (Quellenvermerk „Land NRW“)',
    licenseUrl: 'https://www.govdata.de/dl-de/by-2-0',
    dataDate: 'Bezugsjahr 2022',
    limits: 'Nur Kartenebene; erst ab Stadtteil-Zoom sichtbar.',
    url: 'https://www.wms.nrw.de/umwelt/laerm',
    attribution: 'Lärmkarte: Land NRW (dl-de/by-2-0)',
  },
  {
    id: 'berlin_noise',
    name: 'Strategische Lärmkarten Berlin 2022',
    provider: 'Senatsverwaltung Berlin (Geoportal Berlin)',
    category: 'Lärm',
    status: 'aktiv',
    access: 'WMS',
    coverage: 'Berlin',
    license: 'Datenlizenz Deutschland – Zero – 2.0',
    dataDate: 'Bezugsjahr 2022',
    limits: 'Nur Kartenebene.',
    url: 'https://gdi.berlin.de/services/wms/ua_stratlaerm_2022',
    attribution: 'Lärmkarte: Geoportal Berlin (dl-de/zero-2-0)',
  },
  {
    id: 'ch_noise',
    name: 'Strassenlärm Tag (sonBASE)',
    provider: 'Bundesamt für Umwelt BAFU, geo.admin.ch',
    category: 'Lärm',
    status: 'aktiv',
    access: 'WMS',
    coverage: 'Schweiz',
    license: 'Open Government Data Schweiz (Quellenangabe)',
    licenseUrl: 'https://www.geo.admin.ch/de/allgemeine-nutzungsbedingungen-bgdi',
    dataDate: 'laut Dienst (sonBASE)',
    limits: 'Nur Kartenebene.',
    url: 'https://wms.geo.admin.ch',
    attribution: 'Lärmkarte: Bundesamt für Umwelt BAFU, geo.admin.ch',
  },
  {
    id: 'hh_bplan',
    name: 'Bebauungspläne Hamburg (festgestellt und im Verfahren)',
    provider: 'Freie und Hansestadt Hamburg, LGV',
    category: 'Planung',
    status: 'aktiv',
    access: 'WMS mit Abfrage am Punkt (Planname, Datum, PDF)',
    coverage: 'Hamburg',
    license: 'Datenlizenz Deutschland – Namensnennung – 2.0 (laut Dienstbeschreibung)',
    licenseUrl: 'https://www.govdata.de/dl-de/by-2-0',
    dataDate: 'laufend (Feststellungsdatum je Plan)',
    limits: 'Rechtsverbindlich ist nur der Originalplan der Stadt.',
    url: 'https://geodienste.hamburg.de/HH_WMS_Bebauungsplaene',
    attribution: 'Bebauungspläne: Freie und Hansestadt Hamburg, Behörde für Stadtentwicklung und Wohnen (dl-de/by-2-0)',
  },
  {
    id: 'be_bplan',
    name: 'Bebauungspläne Berlin (im Verfahren, festgesetzt)',
    provider: 'Senatsverwaltung für Stadtentwicklung Berlin',
    category: 'Planung',
    status: 'aktiv',
    access: 'WMS mit Abfrage am Punkt',
    coverage: 'Berlin',
    license: 'Datenlizenz Deutschland – Zero – 2.0',
    dataDate: 'laufend',
    limits: 'Rechtsverbindlich ist nur der Originalplan.',
    url: 'https://gdi.berlin.de/services/wms/bplan',
    attribution: 'Bebauungspläne: Geoportal Berlin (dl-de/zero-2-0)',
  },
  {
    id: 'nrw_boris',
    name: 'Bodenrichtwerte NRW (BORIS.NRW)',
    provider: 'Gutachterausschüsse NRW',
    category: 'Bodenrichtwerte',
    status: 'aktiv',
    access: 'WMS mit Abfrage am Punkt (Wert, Stichtag, Nutzung)',
    coverage: 'Nordrhein-Westfalen',
    license: 'Datenlizenz Deutschland – Zero – 2.0',
    dataDate: 'Stichtag je Wert (aktuell 01.01.2026)',
    limits: 'Ein Bodenrichtwert ist ein Durchschnittswert für eine Zone, nicht der Verkehrswert eines Grundstücks.',
    url: 'https://www.wms.nrw.de/boris/wms_nw_brw',
    attribution: 'Bodenrichtwerte: BORIS.NRW, Gutachterausschüsse NRW',
  },
  {
    id: 'boris_d',
    name: 'BORIS-D und Landesportale',
    provider: 'Gutachterausschüsse der Länder',
    category: 'Bodenrichtwerte',
    status: 'nur Link',
    access: 'Verlinkung auf das amtliche Portal',
    coverage: 'Deutschland außer NRW (dort direkt angebunden)',
    license: 'je Land unterschiedlich',
    dataDate: 'je Land',
    limits: 'Für Hessen ist der WMS-Dienst laut Katalog kostenfrei, antwortet aber derzeit mit Fehler; daher Link statt Wert. Österreich und Schweiz haben kein vergleichbares öffentliches System.',
    url: 'https://www.bodenrichtwerte-boris.de',
    attribution: 'Bodenrichtwerte: Gutachterausschüsse der Länder',
  },
  {
    id: 'autobahn',
    name: 'Autobahn-Baustellen und Sperrungen',
    provider: 'Die Autobahn GmbH des Bundes',
    category: 'Baustellen',
    status: 'nur Link',
    access: 'Verlinkung auf die offizielle Verkehrsinfo',
    coverage: 'Bundesautobahnen in Deutschland',
    license: 'Für die JSON-Schnittstelle verkehr.autobahn.de ist keine Lizenz veröffentlicht',
    dataDate: 'tagesaktuell (auf autobahn.de)',
    limits: 'Technisch frei abrufbar, aber ohne ausdrückliche Nutzungserlaubnis. Deshalb ruft StreetSignal sie nicht automatisch ab, sondern verlinkt. Wird eine Lizenz veröffentlicht (z. B. über die Mobilithek), kann der Adapter aktiviert werden.',
    url: 'https://www.autobahn.de/betrieb-verkehr/baustellenkarte',
    attribution: '–',
  },
  {
    id: 'oparl',
    name: 'Ratsinformationssysteme (OParl)',
    provider: 'Kommunen, Verzeichnis dev.oparl.org',
    category: 'Kommunales',
    status: 'aktiv',
    access: 'OParl-Schnittstelle (Vorlagen, Sitzungen)',
    coverage: '127 Systeme laut Verzeichnis, u. a. Köln, Münster, Bonn, Freiburg, Dresden, München Transparent',
    license: 'je Kommune',
    dataDate: 'laufend',
    limits: 'Nicht jede Kommune bietet OParl an, manche Systeme antworten nicht. Vorlagen sind nicht georeferenziert: StreetSignal sucht nach Ort, Straße und Stichworten.',
    url: 'https://dev.oparl.org',
    attribution: 'Ratsinformationen der jeweiligen Kommune',
  },
  {
    id: 'ollama',
    name: 'Ollama (lokales KI-Modell, optional)',
    provider: 'läuft auf deinem Rechner',
    category: 'KI',
    status: 'nicht angebunden',
    access: 'lokal unter http://localhost:11434, nur wenn installiert',
    coverage: '–',
    license: 'je Modell',
    dataDate: '–',
    limits: 'Ohne Ollama erstellt StreetSignal regelbasierte Zusammenfassungen aus den belegten Daten.',
    url: 'https://ollama.com',
    attribution: '–',
  },
  {
    id: 'unsplash',
    name: 'Fotos der Startseite',
    provider: 'Unsplash (siehe public/images/CREDITS.md)',
    category: 'Bilder',
    status: 'aktiv',
    access: 'im Projekt gespeichert',
    coverage: '–',
    license: 'Unsplash-Lizenz: kostenlos, auch kommerziell',
    licenseUrl: 'https://unsplash.com/de/lizenz',
    dataDate: '–',
    limits: 'Keine Weitergabe als eigene Bildsammlung.',
    url: 'https://unsplash.com',
    attribution: 'Fotos: Unsplash',
  },
]

/** Immobilienportale: Zugriffsregel je Domain (Master-Prompt 4.1, 4.3; Meta-Suche 1, 4) */
export type PortalPolicy = 'manual-link' | 'permitted-public-page' | 'authorized-api'

export interface Portal {
  id: string
  name: string
  domains: string[]
  country: 'DE' | 'AT' | 'CH' | 'DACH'
  policy: PortalPolicy
  note: string
}

export const PORTALS: Portal[] = [
  { id: 'immoscout24', name: 'ImmobilienScout24', domains: ['immobilienscout24.de'], country: 'DE', policy: 'manual-link', note: 'Kein kostenloser, zulässiger Abruf bekannt. Link wird gespeichert, Daten übernimmst du per Text, PDF oder Formular.' },
  { id: 'kleinanzeigen', name: 'Kleinanzeigen', domains: ['kleinanzeigen.de', 'ebay-kleinanzeigen.de'], country: 'DE', policy: 'manual-link', note: 'Keine Erlaubnis für automatisierten Abruf bekannt; bis zu einer Freigabe nur Link.' },
  { id: 'immowelt', name: 'Immowelt', domains: ['immowelt.de', 'immowelt.at', 'immowelt.ch'], country: 'DACH', policy: 'manual-link', note: 'Die kostenlose Anbieterschnittstelle ist kein allgemeiner Abrufweg für fremde Inserate; daher nur Link.' },
  { id: 'immonet', name: 'Immonet', domains: ['immonet.de'], country: 'DE', policy: 'manual-link', note: 'Kein zulässiger kostenloser Abruf bekannt; nur Link.' },
  { id: 'wggesucht', name: 'WG-Gesucht', domains: ['wg-gesucht.de'], country: 'DE', policy: 'manual-link', note: 'Kein zulässiger kostenloser Abruf bekannt; nur Link.' },
  { id: 'willhaben', name: 'willhaben', domains: ['willhaben.at'], country: 'AT', policy: 'manual-link', note: 'Kein zulässiger kostenloser Abruf bekannt; nur Link.' },
  { id: 'immosuchmaschine', name: 'immosuchmaschine.at', domains: ['immosuchmaschine.at'], country: 'AT', policy: 'manual-link', note: 'Meta-Suche; verlinkt selbst auf Originalportale.' },
  { id: 'homegate', name: 'Homegate', domains: ['homegate.ch'], country: 'CH', policy: 'manual-link', note: 'Kein zulässiger kostenloser Abruf bekannt; nur Link.' },
  { id: 'immoscout_ch', name: 'ImmoScout24 Schweiz', domains: ['immoscout24.ch'], country: 'CH', policy: 'manual-link', note: 'Kein zulässiger kostenloser Abruf bekannt; nur Link.' },
  { id: 'flatfox', name: 'Flatfox', domains: ['flatfox.ch'], country: 'CH', policy: 'manual-link', note: 'Schnittstelle und Nutzungsbedingungen noch nicht geprüft; bis dahin nur Link.' },
  { id: 'newhome', name: 'Newhome', domains: ['newhome.ch'], country: 'CH', policy: 'manual-link', note: 'Kein zulässiger kostenloser Abruf bekannt; nur Link.' },
  { id: 'comparis', name: 'Comparis', domains: ['comparis.ch'], country: 'CH', policy: 'manual-link', note: 'Meta-Suche; verlinkt auf Originalportale.' },
]

export function portalForUrl(raw: string): Portal | null {
  let host: string
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  return PORTALS.find((p) => p.domains.some((d) => host === d || host.endsWith(`.${d}`))) ?? null
}

export function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}
