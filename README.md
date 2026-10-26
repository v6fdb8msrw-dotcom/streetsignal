# StreetSignal

Immobiliensuche für Deutschland, Österreich und die Schweiz: Standort, Zweck, Immobilienart, Miete/Kauf/Pacht,
Budget und Größe, Lebensstil- und Umgebungswünsche. Karte und Liste zeigen dieselben Treffer.

Läuft komplett lokal, ohne kostenpflichtige Dienste. Kartenkacheln kommen von OpenStreetMap, die Adresssuche
nutzt optional OpenStreetMap Nominatim (nur auf Klick).

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Suchlogik-Tests
npm run build    # Produktions-Build nach dist/
```

## Aufbau

```
src/model/       typisiertes Datenmodell
  provenance.ts  Herkunft jeder Angabe: Quelle, Nutzer, extrahiert, KI-Vermutung, nicht verfügbar
  taxonomy.ts    Zwecke, Transaktionen, Immobilienarten (Registry, erweiterbar)
  criteria.ts    Wohnstil-, Umgebungs- und Ausstattungskriterien mit sichtbarer Messregel
  listing.ts     Inserat, Standortgenauigkeit, Umgebungsdaten (GeoContext)
  query.ts       Suchanfrage, Suchgebiete, Muss/Wunsch, Suchprofile
  geo.ts         Entfernungen, lokales Ortsverzeichnis, Landschaftsräume (Alpen, Küsten, Seen)
src/data/        Quellenverzeichnis, Beispielinserate (erfunden), Builder für Import
src/search/      Suchlogik + Tests
src/store/       Zustand (zustand), gespeichert im Browser
src/ui/          Filterpanel (7 Schritte), Karte (Leaflet), Ergebnisliste, Dialoge
```

## Grundregeln der Suche

- **Muss-Kriterien filtern, Wünsche sortieren nur.** Sortiert wird nach der Anzahl erfüllter Wünsche, kein verdeckter Score.
- **Unbekannt ist nie erfüllt.** Fehlende Flächen, Preise oder Merkmale schließen ein Objekt aus, außer der Nutzer schließt unbekannte Werte ausdrücklich ein (dann wird es markiert).
- **Unsichere Angaben** (aus Text extrahiert, aus Fotos vermutet) zählen für Muss-Kriterien nur, wenn der Nutzer das erlaubt.
- **Nah ≠ direkt:** „Nähe zu Seen“ (≤ 2 km) und „direkte Uferlage“ (Grundstück grenzt laut Quelle ans Wasser) sind getrennte Kriterien.
- **Keine Währungsumrechnung:** Eine Preisgrenze in EUR gilt nicht für Angebote in CHF.
- **Standortgenauigkeit:** Objekte mit nur PLZ oder Ort bekommen auf der Karte einen Unschärfekreis.

## Erweitern

- Neue Immobilienart: Eintrag in `CATEGORIES` (`src/model/taxonomy.ts`).
- Neues Umgebungs- oder Ausstattungskriterium: Eintrag in `CRITERIA` (`src/model/criteria.ts`), die Messregel ist ein Datenobjekt (`Measure`).
- Neue Quelle: Eintrag in `SOURCES` (`src/data/sources.ts`). Nur mit `integrated: true` fließen Angebote in die Suche, und nur, wenn die Abfrage rechtlich und technisch zulässig ist.
- Import: Quellen-Dialog → JSON-Datei im Format von `Spec` (`src/data/build.ts`).

## Offene Punkte

- Umgebungsdaten sind in den Beispieldaten vorberechnet. Für echte Objekte fehlt noch ein Geo-Dienst, der Entfernungen aus einem lokalen OpenStreetMap-Auszug berechnet (Schnittstelle: `GeoContext`).
- Benachrichtigungen bei neuen Treffern sind im Profil vorgemerkt, aber erst sinnvoll, wenn eine Quelle mit zulässigem Feed angebunden ist.
- Land- und Regionsgrenzen werden nicht auf der Karte gezeichnet (Filter über die Adresse).
