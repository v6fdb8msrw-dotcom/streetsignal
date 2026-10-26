import type { SourceDef } from '../model/listing.ts'

// Quellenverzeichnis. Nur „integrated: true“ liefert Angebote in die Suche.
// Große Portale sind bewusst nicht angebunden: ohne zulässige Schnittstelle wird nicht abgefragt.
export const SOURCES: SourceDef[] = [
  { id: 'demo_a', name: 'Beispieldaten A', kind: 'demo', integrated: true, note: 'Erfundene Beispielinserate zum Ausprobieren. Keine echten Angebote, keine Originalanzeigen.' },
  { id: 'demo_b', name: 'Beispieldaten B', kind: 'demo', integrated: true, note: 'Zweiter Beispieldatensatz; einige Objekte sind doppelt vorhanden, um die Gruppierung zu zeigen.' },
  { id: 'manual', name: 'Manuell gespeichert', kind: 'manual', integrated: true, note: 'Objekte, die du selbst mit Link zur Originalanzeige gespeichert hast.' },
  { id: 'import', name: 'Datei-Import', kind: 'import', integrated: true, note: 'Inserate aus einer JSON-Datei, z. B. aus einem Feed, den du nutzen darfst.' },
  { id: 'immoscout24', name: 'ImmoScout24', kind: 'feed', integrated: false, note: 'Nicht angebunden. Aktuelle Angebote sind nicht in der Suche enthalten.' },
  { id: 'immowelt', name: 'Immowelt', kind: 'feed', integrated: false, note: 'Nicht angebunden. Aktuelle Angebote sind nicht in der Suche enthalten.' },
  { id: 'kleinanzeigen', name: 'Kleinanzeigen', kind: 'feed', integrated: false, note: 'Nicht angebunden. Aktuelle Angebote sind nicht in der Suche enthalten.' },
  { id: 'willhaben', name: 'willhaben (AT)', kind: 'feed', integrated: false, note: 'Nicht angebunden. Aktuelle Angebote sind nicht in der Suche enthalten.' },
  { id: 'homegate', name: 'Homegate (CH)', kind: 'feed', integrated: false, note: 'Nicht angebunden. Aktuelle Angebote sind nicht in der Suche enthalten.' },
]

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id)
