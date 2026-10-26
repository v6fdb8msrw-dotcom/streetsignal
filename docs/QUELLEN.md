# Datenquellen

Stand der Prüfung: 26.10.2026. Geprüft wurden Erreichbarkeit, Abruf ohne Schlüssel, Abruf direkt aus dem Browser (CORS) und die Lizenzangabe des Dienstes selbst (WMS-Capabilities bzw. Dienstbeschreibung). Die Liste in der App (`src/sources/registry.ts`) ist dieselbe.

## Umgebung und Planung

| Quelle | Art | Kostenlos | Registrierung | Berechtigung | Zugriff | Übernommene Felder | Lizenz und Pflichtvermerk | Einschränkungen |
|---|---|---|---|---|---|---|---|---|
| OpenFreeMap (Positron) | Kartenkacheln | ja | nein | – | Vektorkacheln | Kartenbild | ODbL (Daten), „© OpenFreeMap, © OpenStreetMap-Mitwirkende“ | ohne Garantie |
| Photon (komoot) | Geocoding | ja | nein | faire Nutzung | JSON | Adresse, Koordinaten, Genauigkeit | ODbL, „© OpenStreetMap-Mitwirkende“ | max. 1 Anfrage/s, Zwischenspeicher |
| Overpass API (overpass-api.de, Ausweich: overpass.private.coffee) | OSM-Abfrage | ja | nein | für browserbasierte Werkzeuge vorgesehen | Overpass QL | Name, Kategorie, Lage, Abstand | ODbL 1.0, „© OpenStreetMap-Mitwirkende“ | öffentlich, teils überlastet; nur auf Klick |
| EEA Lärmkonturen (noiseStoryMap) | Lärm DACH | ja | nein | – | ArcGIS ImageServer (Kachel, Wert am Punkt) | Lärmklasse Straße/Schiene/Flug/Industrie, L_DEN und L_Night | EEA-Weiterverwendung: kostenlos, auch kommerziell, Quellenangabe „European Environment Agency (EEA)“ | Runde 4 (2022); nur kartierte Gebiete |
| Umgebungslärm NRW | Lärm | ja | nein | – | WMS | Kartenebene | dl-de/by-2-0, Vermerk „Land NRW“ | nur NRW |
| Strategische Lärmkarten Berlin 2022 | Lärm | ja | nein | – | WMS | Kartenebene | dl-de/zero-2-0 | nur Berlin |
| sonBASE Strassenlärm (BAFU) | Lärm | ja | nein | – | WMS geo.admin.ch | Kartenebene | OGD Schweiz, Quellenangabe BAFU | nur Schweiz |
| Bebauungspläne Hamburg | Planung | ja | nein | – | WMS + GetFeatureInfo | Planname, Status, Feststellungsdatum, PDF, Begründung | dl-de/by-2-0, „Freie und Hansestadt Hamburg, Behörde für Stadtentwicklung und Wohnen“ | nur Hamburg; rechtsverbindlich nur das Original |
| Bebauungspläne Berlin | Planung | ja | nein | – | WMS 1.3.0 + GetFeatureInfo | Planname, Geltungsbereich, Rechtsstand, Inhalte, Daten, PDF | dl-de/zero-2-0 | nur Berlin |
| BORIS.NRW | Bodenrichtwerte | ja | nein | – | WMS + GetFeatureInfo | Wert €/m², Stichtag, Nutzung, Ortsteil, Gutachterausschuss, Dokument | dl-de/zero-2-0 (laut Open.NRW) | Zonenwert, kein Verkehrswert |
| BORIS-D / Landesportale | Bodenrichtwerte | ja | nein | – | nur Link | – | je Land | Hessen-Dienst antwortet fehlerhaft |
| OParl-Verzeichnis + Ratsinformationssysteme | Kommunales | ja | nein | – | OParl JSON | Titel, Datum, Art, Aktenzeichen, Link | je Kommune; nur Metadaten und Link | 127 Systeme, nicht alle erreichbar, nicht verortet |
| Autobahn GmbH (verkehr.autobahn.de) | Baustellen | technisch ja | nein | **keine Lizenz veröffentlicht** | nur Link zur Baustellenkarte | – | – | wird nicht automatisch abgerufen |
| Unsplash | Fotos | ja | nein | – | im Projekt gespeichert | 4 Fotos | Unsplash-Lizenz | siehe public/images/CREDITS.md |
| Ollama (optional) | lokale KI | ja | nein | – | localhost:11434 | Zusammenfassung belegter Fakten | je Modell | muss selbst installiert werden |

## Immobilienportale

| Portal | Art | Kostenlos | Registrierung | Berechtigung | Zugriff in StreetSignal | Übernehmbare Felder | Lizenz/Bedingungen | Einschränkungen |
|---|---|---|---|---|---|---|---|---|
| ImmobilienScout24 | Portal DE | – | – | keine Freigabe bekannt | nur Link | per Text/PDF/Formular durch dich | Nutzungsbedingungen des Portals | kein automatischer Abruf |
| Kleinanzeigen | Portal DE | – | – | keine Freigabe bekannt | nur Link | wie oben | wie oben | wie oben |
| Immowelt / Immonet | Portal DACH | – | – | Anbieterschnittstelle ≠ Abruf fremder Inserate | nur Link | wie oben | wie oben | wie oben |
| WG-Gesucht | Portal DE | – | – | keine Freigabe bekannt | nur Link | wie oben | wie oben | wie oben |
| willhaben, immosuchmaschine.at | Portale AT | – | – | keine Freigabe bekannt | nur Link | wie oben | wie oben | wie oben |
| Homegate, ImmoScout24.ch, Flatfox, Newhome, Comparis | Portale CH | – | – | nicht geprüft bzw. keine Freigabe | nur Link | wie oben | wie oben | wie oben |
| Eigene Maklerseite o. Ä. | öffentliche Seite | ja | – | **deine Prüfung und Freigabe** | lokaler Abruf nach Freigabe, robots.txt beachtet | schema.org/Open Graph, sichtbarer Text | Bedingungen der Seite | nur lokal (`npm run dev`) |
| OpenImmo-Feeds | Maklerfeed | Format frei | – | nur mit Freigabe des Maklers | vorbereitet (Adaptertyp `authorized-broker-feed`) | – | – | noch kein Feed angebunden |

## Bewusst nicht genutzt

- Kostenpflichtige Immobilien-APIs und Datenaggregatoren
- Google Maps, Mapbox und andere kostenpflichtige Karten- oder Geocoding-Dienste
- Inoffizielle interne Endpunkte von Portalen
- Cloud-KI zur Laufzeit
