// Zuschaltbare Kartenebenen aus öffentlichen Diensten (alle geprüft: CORS, EPSG:3857, kostenlos).
import type { LayerId } from '../store/ui.ts'
import { arcgisImageTileUrl, arcgisMapTileUrl, wmsTileUrl } from '../services/wms.ts'
import { BFG } from '../services/hazards.ts'
import { serviceUrl } from '../services/noise.ts'

export interface RasterOverlay {
  id: string
  layer: LayerId
  label: string
  tiles: string
  minzoom?: number
  /** Nur in diesem Gebiet Kacheln laden (West, Süd, Ost, Nord), damit Landesdienste nicht außerhalb abgefragt werden */
  bounds?: [number, number, number, number]
  opacity: number
  attribution: string
}

export const OVERLAYS: RasterOverlay[] = [
  { id: 'eea-road', layer: 'noise_road', label: 'Straßenlärm (EU, ganztags)', tiles: arcgisImageTileUrl(serviceUrl('road', 'lden')), opacity: 0.6, attribution: 'Lärmdaten: European Environment Agency (EEA)' },
  { id: 'eea-rail', layer: 'noise_rail', label: 'Schienenlärm (EU, ganztags)', tiles: arcgisImageTileUrl(serviceUrl('rail', 'lden')), opacity: 0.6, attribution: 'Lärmdaten: European Environment Agency (EEA)' },
  { id: 'eea-air', layer: 'noise_air', label: 'Fluglärm (EU, ganztags)', tiles: arcgisImageTileUrl(serviceUrl('air', 'lden')), opacity: 0.6, attribution: 'Lärmdaten: European Environment Agency (EEA)' },
  { id: 'nrw-noise', layer: 'noise_regional', label: 'Straßenlärm NRW', tiles: wmsTileUrl('https://www.wms.nrw.de/umwelt/laerm', 'STR_DEN'), minzoom: 12, opacity: 0.6, attribution: 'Lärmkarte: Land NRW (dl-de/by-2-0)', bounds: [5.86, 50.32, 9.47, 52.54] },
  { id: 'be-noise', layer: 'noise_regional', label: 'Straßenlärm Berlin', tiles: wmsTileUrl('https://gdi.berlin.de/services/wms/ua_stratlaerm_2022', 'bb_strasse_gesamt_den2022'), minzoom: 11, opacity: 0.6, attribution: 'Lärmkarte: Geoportal Berlin (dl-de/zero-2-0)', bounds: [13.08, 52.33, 13.77, 52.68] },
  { id: 'ch-noise', layer: 'noise_regional', label: 'Strassenlärm Schweiz', tiles: wmsTileUrl('https://wms.geo.admin.ch/', 'ch.bafu.laerm-strassenlaerm_tag'), minzoom: 11, opacity: 0.6, attribution: 'Lärmkarte: BAFU, geo.admin.ch', bounds: [5.95, 45.81, 10.5, 47.81] },
  { id: 'hh-bplan', layer: 'bplan', label: 'Bebauungspläne Hamburg', tiles: wmsTileUrl('https://geodienste.hamburg.de/HH_WMS_Bebauungsplaene', 'hh_hh_festgestellt,hh_lgv_imverfahren'), minzoom: 12, opacity: 0.55, attribution: 'Bebauungspläne: Freie und Hansestadt Hamburg, Behörde für Stadtentwicklung und Wohnen (dl-de/by-2-0)', bounds: [8.42, 53.39, 10.33, 54.03] },
  { id: 'nrw-bplan', layer: 'bplan', label: 'Bebauungspläne NRW', tiles: wmsTileUrl('https://www.wms.nrw.de/wms/wms_nw_inspire-bauleitplanung', 'LU.SpatialPlan.Bebauungsplaene'), minzoom: 12, opacity: 0.55, attribution: 'Bebauungspläne: Land NRW (IT.NRW), Kommunen', bounds: [5.86, 50.32, 9.47, 52.54] },
  { id: 'bw-bplan', layer: 'bplan', label: 'Bebauungspläne Baden-Württemberg', tiles: wmsTileUrl('https://www.geoportal-raumordnung-bw.de/ows/services/org.1.a12db7e6-88fc-4652-b350-3c25496ebc7a_wms', 'LU.SpatialPlan'), minzoom: 12, opacity: 0.55, attribution: '© Daten aus dem Geoportal Raumordnung Baden-Württemberg', bounds: [7.5, 47.53, 10.5, 49.8] },
  { id: 'be-bplan', layer: 'bplan', label: 'Bebauungspläne Berlin', tiles: wmsTileUrl('https://gdi.berlin.de/services/wms/bplan', 'a_bp_iv,b_bp_fs'), minzoom: 12, opacity: 0.55, attribution: 'Bebauungspläne: Geoportal Berlin (dl-de/zero-2-0)', bounds: [13.08, 52.33, 13.77, 52.68] },
  { id: 'bfg-extrem', layer: 'flood', label: 'Hochwasser extrem (BfG)', tiles: arcgisMapTileUrl(`${BFG}/HWRMRL_DE_LL`), opacity: 0.35, attribution: 'Hochwasser: Bundesanstalt für Gewässerkunde (BfG), Daten der Länder' },
  { id: 'bfg-hq100', layer: 'flood', label: 'Hochwasser HQ100 (BfG)', tiles: arcgisMapTileUrl(`${BFG}/HWRMRL_DE_LM`), opacity: 0.5, attribution: 'Hochwasser: Bundesanstalt für Gewässerkunde (BfG), Daten der Länder' },
  { id: 'bfg-kueste', layer: 'flood', label: 'Küstenhochwasser HQ100 (BfG)', tiles: arcgisMapTileUrl(`${BFG}/HWRMRL_DE_SM`), opacity: 0.5, attribution: 'Hochwasser: Bundesanstalt für Gewässerkunde (BfG), Daten der Länder' },
  { id: 'ch-aquaprotect', layer: 'flood', label: 'Überschwemmungsgebiete Schweiz (Aquaprotect 100)', tiles: wmsTileUrl('https://wms.geo.admin.ch/', 'ch.bafu.aquaprotect_100'), opacity: 0.5, attribution: 'Überschwemmungsgebiete: BAFU, geo.admin.ch', bounds: [5.95, 45.81, 10.5, 47.81] },
  { id: 'wien-fwp', layer: 'zoning', label: 'Flächenwidmung Wien', tiles: wmsTileUrl('https://data.wien.gv.at/daten/geo', 'ogdwien:GENFLWIDMUNGOGD'), minzoom: 11, opacity: 0.55, attribution: 'Flächenwidmung: Stadt Wien – data.wien.gv.at', bounds: [16.18, 48.11, 16.58, 48.33] },
  { id: 'ooe-fwp', layer: 'zoning', label: 'Flächenwidmung Oberösterreich', tiles: wmsTileUrl('https://ags.doris.at/arcgis/services/INSPIRE/MapServer/WMSServer', '8'), minzoom: 12, opacity: 0.55, attribution: 'Flächenwidmung: Land Oberösterreich, DORIS', bounds: [12.73, 47.45, 14.99, 48.78] },
  { id: 'stmk-fwp', layer: 'zoning', label: 'Flächenwidmung Steiermark', tiles: wmsTileUrl('https://gis.stmk.gv.at/arcgis/services/OGD/flaewi/MapServer/WMSServer', 'Widmung-Stammplan'), minzoom: 13, opacity: 0.55, attribution: 'Flächenwidmung: © Land Steiermark // GIS-Steiermark', bounds: [13.55, 46.6, 16.17, 47.83] },
  { id: 'vbg-fwp', layer: 'zoning', label: 'Flächenwidmung Vorarlberg', tiles: wmsTileUrl('https://vogis.cnv.at/geoserver/ows', 'vogis:fwp_flaeche'), minzoom: 13, opacity: 0.55, attribution: 'Flächenwidmung: Land Vorarlberg', bounds: [9.53, 46.84, 10.24, 47.6] },
  { id: 'ch-bauzonen', layer: 'zoning', label: 'Bauzonen Schweiz', tiles: wmsTileUrl('https://wms.geo.admin.ch/', 'ch.are.bauzonen'), minzoom: 10, opacity: 0.55, attribution: 'Bauzonen: Bundesamt für Raumentwicklung ARE, geo.admin.ch', bounds: [5.95, 45.81, 10.5, 47.81] },
  { id: 'ch-oev', layer: 'transit_quality', label: 'ÖV-Güteklassen Schweiz', tiles: wmsTileUrl('https://wms.geo.admin.ch/', 'ch.are.gueteklassen_oev'), minzoom: 9, opacity: 0.5, attribution: 'ÖV-Güteklassen: Bundesamt für Raumentwicklung ARE, geo.admin.ch', bounds: [5.95, 45.81, 10.5, 47.81] },
  { id: 'he-brw', layer: 'landvalue', label: 'Bodenrichtwerte Hessen', tiles: wmsTileUrl('https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-maps.ows', 'hboris_zonen_t'), minzoom: 13, opacity: 0.7, attribution: 'Bodenrichtwerte: BORIS Hessen, Gutachterausschüsse', bounds: [7.7, 49.39, 10.24, 51.66] },
  { id: 'be-brw', layer: 'landvalue', label: 'Bodenrichtwerte Berlin', tiles: wmsTileUrl('https://gdi.berlin.de/services/wms/brw2025', 'brw2025'), minzoom: 13, opacity: 0.7, attribution: 'Bodenrichtwerte: Geoportal Berlin, Gutachterausschuss (dl-de/zero-2-0)', bounds: [13.08, 52.33, 13.77, 52.68] },
  { id: 'bb-brw', layer: 'landvalue', label: 'Bodenrichtwerte Brandenburg', tiles: wmsTileUrl('https://isk.geobasis-bb.de/ows/boris_wms', 'brw_2026'), minzoom: 13, opacity: 0.7, attribution: '© GeoBasis-DE/LGB, dl-de/by-2-0', bounds: [11.26, 51.35, 14.77, 53.56] },
  { id: 'sn-brw', layer: 'landvalue', label: 'Bodenrichtwerte Sachsen', tiles: wmsTileUrl('https://www.landesvermessung.sachsen.de/fp/httpproxy/svcdep/wms/boris_2026', 'brw_2026'), minzoom: 13, opacity: 0.7, attribution: 'Quelle: GeoSN, dl-de/by-2-0', bounds: [11.87, 50.17, 15.04, 51.69] },
  { id: 'ni-brw', layer: 'landvalue', label: 'Bodenrichtwerte Niedersachsen', tiles: wmsTileUrl('https://opendata.lgln.niedersachsen.de/doorman/noauth/boris_2026_wms', 'Bauland'), minzoom: 13, opacity: 0.7, attribution: '© LGLN, Gutachterausschüsse Niedersachsen, dl-de/by-2-0', bounds: [6.65, 51.29, 11.6, 53.9] },
  { id: 'st-brw', layer: 'landvalue', label: 'Bodenrichtwerte Sachsen-Anhalt', tiles: wmsTileUrl('https://www.geodatenportal.sachsen-anhalt.de/ows_st_lvermgeo_brw2026', 'Bauland'), minzoom: 13, opacity: 0.7, attribution: '© GeoBasis-DE / LVermGeo ST, dl-de/by-2-0', bounds: [10.56, 50.94, 13.19, 53.05] },
  { id: 'mv-brw', layer: 'landvalue', label: 'Bodenrichtwerte Mecklenburg-Vorpommern', tiles: wmsTileUrl('https://www.geodaten-mv.de/dienste/bodenrichtwerte_wms', 'bodenrichtwerte'), minzoom: 13, opacity: 0.7, attribution: '© GeoBasis-DE/M-V 2025, CC BY 4.0', bounds: [10.59, 53.11, 14.42, 54.69] },
  { id: 'hh-brw', layer: 'landvalue', label: 'Bodenrichtwerte Hamburg', tiles: wmsTileUrl('https://geodienste.hamburg.de/HH_WMS_Bodenrichtwerte', 'lgv_brw_zonen_2026'), minzoom: 13, opacity: 0.7, attribution: 'Bodenrichtwerte: Freie und Hansestadt Hamburg, LGV (dl-de/by-2-0)', bounds: [8.42, 53.39, 10.33, 54.03] },
  { id: 'nrw-brw', layer: 'landvalue', label: 'Bodenrichtwerte NRW', tiles: wmsTileUrl('https://www.wms.nrw.de/boris/wms_nw_brw', '17,18'), minzoom: 13, opacity: 0.7, attribution: 'Bodenrichtwerte: BORIS.NRW, Gutachterausschüsse NRW', bounds: [5.86, 50.32, 9.47, 52.54] },
]

export const LAYER_LABEL: Record<LayerId, string> = {
  noise_road: 'Straßenlärm',
  noise_rail: 'Schienenlärm',
  noise_air: 'Fluglärm',
  noise_regional: 'Lärm (Länderdaten, genauer)',
  bplan: 'Bebauungspläne',
  zoning: 'Flächenwidmung und Bauzonen',
  flood: 'Hochwassergefahren',
  transit_quality: 'ÖV-Güteklassen',
  landvalue: 'Bodenrichtwerte',
  pois: 'Umgebung',
  properties: 'Meine Immobilien',
  radius: 'Radius',
}

export const NOISE_LEGEND = [
  // Farben aus der Legende des EEA-Dienstes ausgelesen
  { label: '55–60 dB', color: '#ffc74a' },
  { label: '60–65 dB', color: '#ff6600' },
  { label: '65–70 dB', color: '#ff3333' },
  { label: '70–75 dB', color: '#990033' },
  { label: 'über 75 dB', color: '#ad9ad6' },
]
