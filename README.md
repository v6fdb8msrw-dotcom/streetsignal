# StreetSignal

**Discover what surrounds you. Understand what comes next.**

StreetSignal zeigt, was eine Wohnung, ein Haus oder ein Grundstück umgibt: kartierter Lärm, Hochwasser, Luftqualität, Grün, Nahverkehr mit Fahrplantakt, Schulen, Ärzte, Bebauungspläne und Flächenwidmung, Bodenrichtwerte, Baustellen und Vorlagen aus dem Stadtrat. Jede Angabe mit Quelle, Datenstand und Aussagekraft. Dazu eine persönliche Karte mit gespeicherten Immobilien und ein Vergleich nach eigenen Gewichtungen.

Webseite (ohne Linkabruf, alles andere funktioniert): https://v6fdb8msrw-dotcom.github.io/streetsignal/

## Kostenlos und lokal

- Keine Kreditkarte, kein Konto, keine kostenpflichtige API, kein API-Schlüssel.
- Alle Daten bleiben im Browser (IndexedDB). Export und Löschen unter „Datenquellen & Einstellungen“.
- KI ist optional und lokal: Läuft [Ollama](https://ollama.com) auf dem Rechner, kann ein lokales Modell die belegten Fakten zusammenfassen. Ohne Ollama fasst StreetSignal regelbasiert zusammen.

## Starten

```bash
npm install
npm run dev        # App auf http://localhost:5191 und Import-Server auf 127.0.0.1:5187
npm test           # Tests (Texterkennung, SSRF-Schutz, Quellen-Parser, Filter, Vergleich)
npm run build      # Produktions-Build nach dist/
npm run deploy     # Tests + Build + Veröffentlichung auf GitHub Pages (Zweig gh-pages)
```

## Bereiche

| Bereich | Was er tut |
|---|---|
| Startseite | Bildstarker Einstieg mit Adresssuche |
| Übersicht | Persönliche Karte mit allen gespeicherten Immobilien |
| Umgebung erkunden | Adresse oder Kartenpunkt, Umkreis 250 m bis 3 km, Analyse mit allen Quellen, zuschaltbare Kartenebenen |
| Immobilie hinzufügen | Per Link, eingefügtem Text, PDF/Screenshot (lokal per PDF.js/Tesseract) oder Formular; jeder Wert mit Herkunft, vor dem Speichern prüfbar |
| Meine Immobilien | Profile, Status, Notizen, Filter (Wo, Was, Art, Miete/Kauf, Budget, Größe, Umgebung als Muss/Wunsch), Suchprofile |
| Vergleichen | Bis zu vier Objekte, eigene Gewichtungen, vollständig offengelegte Punkterechnung |
| Neue Entwicklungen | Planungen, Baustellen und Ratsvorlagen je Ort; manuelle Prüfung mit Änderungsübersicht |
| Datenquellen & Einstellungen | Alle Quellen mit Lizenz, freigegebene Domains, Ollama-Status, Datenexport |

## Rechtliche Leitplanken

- **Keine Portale werden ausgelesen.** ImmobilienScout24, Kleinanzeigen, Immowelt, Immonet, WG-Gesucht, willhaben, Homegate, ImmoScout24.ch, Flatfox, Newhome, Comparis: Link wird gespeichert, Angaben übernimmt man per Text, Dokument oder Formular.
- **Linkabruf nur nach Freigabe.** Der lokale Server ruft eine Seite nur ab, wenn du ihre Domain ausdrücklich freigegeben hast (nach Prüfung der Nutzungsbedingungen) und ihre robots.txt es erlaubt. Gelesen werden nur schema.org- und Open-Graph-Angaben sowie der sichtbare Text; Kontaktdaten werden nicht übernommen.
- **Schutz gegen SSRF:** nur http/https auf Port 80/443, keine internen oder privaten Adressen (auch nicht nach DNS-Auflösung oder Weiterleitung), feste IP je Abruf, höchstens 2 MB, 10 Sekunden, 3 Weiterleitungen, keine Skriptausführung, Server lauscht nur auf 127.0.0.1.
- **Nur lizenzierte Daten:** Jede Quelle steht mit Lizenz und Pflichtvermerk in [docs/QUELLEN.md](docs/QUELLEN.md). Quellen ohne veröffentlichte Lizenz (z. B. die Autobahn-Schnittstelle) werden nur verlinkt.
- **Nichts wird erfunden:** Fehlende Werte bleiben „unbekannt“. Ein bloß gespeicherter Link gilt nicht als Import. Keine Demo-Inserate.
- **Faire Nutzung öffentlicher Dienste:** Photon höchstens einmal pro Sekunde, Overpass nur auf Klick mit Wartezeiten bei Überlastung, alle Antworten werden zwischengespeichert.

## Aufbau

```
src/
  pages/        Landing, Overview, Explore, AddProperty, MyProperties, Compare, Developments, Sources
  components/   Rail, AddressSearch, ReportView, PropertyDetail, FilterPanel, Prov
  map/          MapView (MapLibre + OpenFreeMap), Kartenstil, Kartenebenen
  services/     geocode (Photon), overpass, noise (EEA), planning (Hamburg, Berlin), landvalue (NRW),
                oparl, environment (Analyse, Zusammenfassung, Änderungen), ollama, wms, http
  import/       parseText (Inseratstext), document (PDF/OCR), linkImport
  search/       filter (Muss/Wunsch), compare (Gewichtung)
  sources/      registry: Datenquellen und Portalregeln
  store/        IndexedDB, Oberflächenzustand
  model/        Immobilienprofil, Herkunft, Kategorien, Filter
server/         lokaler Import-Server mit SSRF-Schutz
tools/          deploy-pages.mjs
public/images/  Fotos (Unsplash, siehe CREDITS.md)
```

## Bekannte Einschränkungen

- **Bebauungspläne/Widmung** sind für Hamburg, Berlin, Wien, Oberösterreich (Kartenebene) und die Schweiz (Bauzonen) angebunden; andernorts verlinkt StreetSignal das zuständige Portal.
- **Bodenrichtwerte** sind für NRW, Hessen, Berlin, Brandenburg, Thüringen, Sachsen, Niedersachsen, Sachsen-Anhalt und Mecklenburg-Vorpommern angebunden, Hamburg als Kartenebene. Bayern, Baden-Württemberg, Saarland, Bremen, Schleswig-Holstein und Rheinland-Pfalz geben keinen frei nutzbaren Dienst her (Gründe in docs/QUELLEN.md), dort Link zum Portal. Österreich und die Schweiz haben kein vergleichbares offenes System.
- **Fahrpläne:** Fern-, Regional- und Nahverkehr in ganz Deutschland (Stichtag Mittwoch 04.11.2026, Sollfahrplan). Neu aufbereiten: `node tools/data/build-transit.mjs <Ordner mit GTFS-ZIPs von gtfs.de>`.
- **Luftqualität:** Jahresmittel 2025 der UBA-Stationen, Aufbereitung `node tools/data/build-air.mjs 2025`.
- **Hochwasser:** BfG-Gefahrenflächen nur für Deutschland, ohne Starkregen.
- **Lärm:** EU-Kartierung 2022 deckt Ballungsräume und Hauptverkehrswege ab; „keine Klasse“ heißt nicht „ruhig“. Zusätzlich wird ein Ring von 75 m abgetastet.
- **Baustellen** kommen aus OpenStreetMap und sind unvollständig; Autobahn-Baustellen nur als Link.
- **Ratsvorlagen** gibt es nur für Kommunen mit OParl-Schnittstelle; Vorlagen sind nicht verortet.
- **Overpass** (OpenStreetMap) ist ein öffentlicher, teils überlasteter Dienst; dann bitte später „Neu prüfen“.
- **Auf GitHub Pages** gibt es keinen Import-Server; Linkabruf geht nur lokal mit `npm run dev`.
- **Automatische Beobachtung** ist vorbereitet, aber deaktiviert, solange keine Quelle wiederholte Abrufe ausdrücklich erlaubt.
- **Lizenz des Codes:** Noch keine Lizenzdatei. Bis eine gewählt ist, gilt: Code ansehen ja, übernehmen nein.
