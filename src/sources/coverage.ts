// Abdeckung je Region: Welche Daten sind frei nutzbar und direkt eingebunden, welche nur verlinkt – und warum.
// Stand der Prüfung: 29.10.2026. Grundlage sind die Lizenzen in registry.ts und docs/QUELLEN.md.

export type CoverageLevel = 'direkt' | 'teilweise' | 'Link' | 'gibt es nicht'

export type CoverageTopic = 'laerm' | 'hochwasser' | 'luft' | 'oepnv' | 'planung' | 'bodenwert'

export const TOPIC_LABEL: Record<CoverageTopic, string> = {
  laerm: 'Lärm',
  hochwasser: 'Hochwasser',
  luft: 'Luft',
  oepnv: 'Nahverkehr',
  planung: 'Bebauungsplan / Widmung',
  bodenwert: 'Bodenrichtwert',
}

export interface CoverageCell {
  level: CoverageLevel
  /** Kurze Begründung, vor allem wenn nicht direkt */
  note: string
}

export interface CoverageRegion {
  country: 'DE' | 'AT' | 'CH'
  region: string
  cells: Record<CoverageTopic, CoverageCell>
}

const d = (note: string): CoverageCell => ({ level: 'direkt', note })
const t = (note: string): CoverageCell => ({ level: 'teilweise', note })
const l = (note: string): CoverageCell => ({ level: 'Link', note })
const n = (note: string): CoverageCell => ({ level: 'gibt es nicht', note })

// Für ganz Deutschland gleich
const DE_BASE = {
  laerm: d('EU-Lärmkartierung (EEA): Ballungsräume und Hauptverkehrswege'),
  hochwasser: d('BfG-Gefahrenflächen HQ häufig, HQ100, HQ extrem; Starkregen-Wassertiefe (BKG) außer in Bayern und Baden-Württemberg'),
  luft: d('Jahresmittel der nächsten UBA-Messstationen'),
  oepnv: d('Abfahrten aller Linien laut Sollfahrplan (gtfs.de)'),
}
const NO_BPLAN = l('Bebauungspläne sind Sache der Gemeinden; kein landesweiter Dienst mit offener Lizenz gefunden')

function de(region: string, planung: CoverageCell, bodenwert: CoverageCell, extra: Partial<Record<CoverageTopic, CoverageCell>> = {}): CoverageRegion {
  return { country: 'DE', region, cells: { ...DE_BASE, planung, bodenwert, ...extra } }
}

const AT_BASE = {
  laerm: d('EU-Lärmkartierung (EEA)'),
  // TODO nach Fertigstellung der Kacheln wieder auf d(...) setzen
  hochwasser: t('Amtliche Überflutungsflächen HQ30/100/300 (HWRL 2026, CC BY 4.0) werden gerade als Karte eingebaut'),
  luft: d('Jahresmittel der nächsten Messstationen (EEA-Statistik)'),
  oepnv: l('Landesweite Verbund-Fahrpläne nur mit Konto und eigener Lizenz; nicht eingebunden'),
  bodenwert: n('Österreich hat keine amtlichen Bodenrichtwerte als offenen Dienst'),
}
function at(region: string, planung: CoverageCell, extra: Partial<Record<CoverageTopic, CoverageCell>> = {}): CoverageRegion {
  return { country: 'AT', region, cells: { ...AT_BASE, planung, ...extra } }
}

/** Zellen, die für ein ganzes Land gleich sind: in der Tabelle ohne Wiederholung des Texts */
export const COMMON_CELLS = new Set<CoverageCell>([...Object.values(DE_BASE), ...Object.values(AT_BASE)])
export const COUNTRY_NOTE: Record<'DE' | 'AT' | 'CH', string> = {
  DE: `Überall: Umgebung aus OpenStreetMap (Schulen, Kitas, Ärzte, Einkauf, Haltestellen, Grün, Wasser); ${DE_BASE.laerm.note}; ${DE_BASE.hochwasser.note}; ${DE_BASE.luft.note}; ${DE_BASE.oepnv.note}. Geprüft mit einer Adresse je Bundesland am 29.10.2026.`,
  AT: `Überall: ${AT_BASE.laerm.note}; ${AT_BASE.hochwasser.note}; ${AT_BASE.luft.note}. Nahverkehr: ${AT_BASE.oepnv.note}. ${AT_BASE.bodenwert.note}.`,
  CH: 'Bundesdaten von geo.admin.ch gelten für alle Kantone gleich.',
}

export const COVERAGE: CoverageRegion[] = [
  de('Baden-Württemberg', d('Flächennutzungsplan landesweit, Bebauungspläne soweit Kommunen liefern (dl-de/by)'), l('BORIS-BW nur nicht kommerziell'), { hochwasser: t('BfG-Gefahrenflächen am Punkt; Starkregenkarten gibt es nur je Kommune, nicht landesweit offen') }),
  de('Bayern', l('Direkter Link zur Bauleitplanung der Gemeinde (Landesportal, CC BY 4.0); Planinhalte nur unter CC BY-ND'), l('BORIS Bayern nur Ansicht im Portal'), { hochwasser: t('BfG-Gefahrenflächen am Punkt; Starkregen nur als Kartenebene (LfU: Senken und Fließwege)') }),
  de('Berlin', d('Bebauungspläne festgesetzt und im Verfahren (dl-de/zero)'), d('BRW 2025 (dl-de/zero)'), { laerm: d('EU-Kartierung plus Berliner Lärmkarte 2022 als Ebene') }),
  de('Brandenburg', NO_BPLAN, d('BORIS-BB 2026 (dl-de/by)')),
  de('Bremen', NO_BPLAN, l('Stadt Bremen: CC BY 4.0, aber kein öffentlicher Dienst; Bremerhaven gebührenpflichtig')),
  de('Hamburg', d('Bebauungspläne festgestellt und im Verfahren (dl-de/by)'), d('Normierte Bodenrichtwerte je Baublock als Spanne (dl-de/by)')),
  de('Hessen', l('Bebauungspläne nur als PDF je Gemeinde'), d('BORIS Hessen (dl-de/zero)')),
  de('Mecklenburg-Vorpommern', NO_BPLAN, d('BORIS M-V (CC BY 4.0)')),
  de('Niedersachsen', NO_BPLAN, d('BORIS-NI 2026, Bauland (dl-de/by)')),
  de('Nordrhein-Westfalen', t('Landesweiter INSPIRE-Dienst, soweit Kommunen liefern'), d('BORIS.NRW (dl-de/zero)'), { laerm: d('EU-Kartierung plus Umgebungslärm NRW als Ebene') }),
  de('Rheinland-Pfalz', NO_BPLAN, l('Zonale Werte nur mit Zugangsbeschränkung')),
  de('Saarland', NO_BPLAN, l('Nur Ansicht im Portal')),
  de('Sachsen', NO_BPLAN, d('BORIS.SACHSEN 2026 (dl-de/by)')),
  de('Sachsen-Anhalt', NO_BPLAN, d('BORIS ST 2026, Bauland (dl-de/by)')),
  de('Schleswig-Holstein', NO_BPLAN, l('Keine offene Lizenz gefunden')),
  de('Thüringen', NO_BPLAN, d('BORIS Thüringen (CC BY 4.0)')),
  at('Burgenland', l('Flächenwidmung nicht als offene Daten veröffentlicht')),
  at('Kärnten', d('Flächenwidmung (CC BY 4.0), Klassen nach EU-Schema')),
  at('Niederösterreich', l('Flächenwidmung nicht als offene Daten veröffentlicht')),
  at('Oberösterreich', t('Flächenwidmung als Kartenebene (CC BY 4.0); Abfrage liefert nur Codes')),
  at('Salzburg', l('Offen (CC BY 4.0), aber nur als großer Download; Einbau geplant')),
  at('Steiermark', d('Flächenwidmungsplan mit Dichte (CC BY 4.0)')),
  at('Tirol', d('Flächenwidmung (CC BY 4.0)')),
  at('Vorarlberg', d('Flächenwidmungsplan (CC BY 4.0)')),
  at('Wien', d('Flächenwidmung generalisiert (CC BY 4.0)'), { oepnv: t('Wiener Linien (CC BY 4.0); ÖBB-Züge fehlen') }),
  {
    country: 'CH',
    region: 'Schweiz (alle Kantone)',
    cells: {
      laerm: d('EU-Kartierung plus sonBASE Strassenlärm als Ebene'),
      hochwasser: t('Aquaprotect des BAFU: grobe Übersicht ohne Schutzmaßnahmen'),
      luft: d('Modellierte Jahresmittel des BAFU am Punkt (Klassen)'),
      oepnv: t('ÖV-Güteklasse A–D, keine Abfahrtszahlen'),
      planung: t('Harmonisierte Bauzonen; die kommunale Zone ist maßgeblich'),
      bodenwert: n('Die Schweiz hat kein öffentliches Bodenrichtwertsystem'),
    },
  },
]
