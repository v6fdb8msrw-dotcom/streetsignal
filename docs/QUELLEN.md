# Datenquellen

Stand der Prüfung: 26.10.2026, Erweiterung 27.10.2026. Geprüft wurden Erreichbarkeit, Abruf ohne Schlüssel, Abruf direkt aus dem Browser (CORS) und die Lizenzangabe des Dienstes selbst (WMS-Capabilities bzw. Dienstbeschreibung). Die Liste in der App (`src/sources/registry.ts`) ist dieselbe.

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
| BORIS Hessen | Bodenrichtwerte | ja | nein | – | WMS + GetFeatureInfo (gds-srv.hessen.de) | Wert €/m², Stichtag, Nutzung, Entwicklungszustand, Gutachterausschuss | dl-de/zero-2-0; laut Dienst „jede Nutzung ohne Einschränkung“, kostenfrei nach § 24 HVGG | Zonenwert, kein Verkehrswert |
| BORIS-D / übrige Landesportale | Bodenrichtwerte | ja | nein | – | nur Link | – | je Land | keine belastbare offene Lizenz für automatischen Abruf gefunden |
| Hochwassergefahrenflächen (BfG) | Naturgefahren | ja | nein | – | ArcGIS MapServer (Bild, Abfrage am Punkt) | Betroffenheit häufig/HQ100/extrem, Berichtsjahr | GeoNutzV des Bundes: kostenlos, auch kommerziell, Quellenvermerk | Deutschland; keine kleinen Bäche, kein Starkregen |
| Luftqualität Umweltbundesamt | Umwelt | ja | nein | – | einmalig aufbereitet (keine Browser-Freigabe der API) | Jahresmittel NO₂, PM10, PM2,5 je Station | § 12a EGovG laut UBA-Nutzungsbedingungen: kommerziell und nicht kommerziell, Vermerk „Umweltbundesamt“, Änderungen kennzeichnen | Wert gilt an der Station |
| Fahrpläne gtfs.de (DELFI) | Verkehr | ja | nein | – | GTFS, einmalig zu Abfahrten je Haltestelle aufbereitet | Haltestelle, Lage, Abfahrten am Stichtag, Verkehrsmittel | CC BY 4.0; Feeds enthalten teils OpenStreetMap-Daten (ODbL) | Sollfahrplan, ohne Gewähr; Nahverkehr wird nachgereicht |
| ÖV-Güteklassen (ARE) | Verkehr | ja | nein | Fair Use | geo.admin.ch Abfrage + WMS | Güteklasse A–D | BGDI-Nutzungsbedingungen, Quellenangabe | Schweiz |
| Bauzonen Schweiz harmonisiert (ARE) | Planung | ja | nein | Fair Use | geo.admin.ch Abfrage + WMS | Hauptnutzung, Gemeinde | opendata.swiss: kommerziell erlaubt, Quellenangabe | Schweiz; kommunale Zone maßgeblich |
| Flächenwidmung Wien (generalisiert) | Planung | ja | nein | – | WMS + GetFeatureInfo | Widmung, Bauklasse, Bezirk | CC BY 4.0, „Stadt Wien – data.wien.gv.at“ | generalisiert |
| Flächenwidmung Oberösterreich (DORIS) | Planung | ja | nein | – | WMS (Kartenebene) | Kartenbild | CC BY 4.0 (Katalog), Dienst „kostenfrei“ | Abfrage liefert nur Codes |
| OParl-Verzeichnis + Ratsinformationssysteme | Kommunales | ja | nein | – | OParl JSON | Titel, Datum, Art, Aktenzeichen, Link | je Kommune; nur Metadaten und Link | 127 Systeme, nicht alle erreichbar, nicht verortet |
| Autobahn GmbH (verkehr.autobahn.de) | Baustellen | technisch ja | nein | **keine Lizenz veröffentlicht** (erneut geprüft 27.10.: weder API-Spezifikation noch Mobilithek) | nur Link zur Baustellenkarte | – | – | wird nicht automatisch abgerufen |
| Unsplash | Fotos | ja | nein | – | im Projekt gespeichert | 4 Fotos | Unsplash-Lizenz | siehe public/images/CREDITS.md |
| Ollama (optional) | lokale KI | ja | nein | – | localhost:11434 | Zusammenfassung belegter Fakten | je Modell | muss selbst installiert werden |

## Geprüft, aber noch nicht eingebunden

| Quelle | Grund |
|---|---|
| Flächenwidmung Steiermark | Lizenz CC BY 4.0 AT, aber keine bestätigte Dienst-Adresse gefunden; nur verlinkt |
| Lärmkarten Österreich (laerminfo.at) | CC BY 4.0, aber nur als Download; die EU-Lärmdaten decken dieselbe Kartierung bereits ab |
| Bebauungspläne einzelner Gemeinden (z. B. Hessen) | Lizenz je Gemeinde verschieden, teils nur nicht kommerziell; nur verlinkt |

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
