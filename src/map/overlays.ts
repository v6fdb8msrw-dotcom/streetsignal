// Zuschaltbare Kartenebenen aus öffentlichen Diensten (alle geprüft: CORS, EPSG:3857, kostenlos).
import type { LayerId } from '../store/ui.ts'
import { arcgisImageTileUrl, wmsTileUrl } from '../services/wms.ts'
import { serviceUrl } from '../services/noise.ts'

export interface RasterOverlay {
  id: string
  layer: LayerId
  label: string
  tiles: string
  minzoom?: number
  opacity: number
  attribution: string
}

export const OVERLAYS: RasterOverlay[] = [
  { id: 'eea-road', layer: 'noise_road', label: 'Straßenlärm (EU, ganztags)', tiles: arcgisImageTileUrl(serviceUrl('road', 'lden')), opacity: 0.6, attribution: 'Lärmdaten: European Environment Agency (EEA)' },
  { id: 'eea-rail', layer: 'noise_rail', label: 'Schienenlärm (EU, ganztags)', tiles: arcgisImageTileUrl(serviceUrl('rail', 'lden')), opacity: 0.6, attribution: 'Lärmdaten: European Environment Agency (EEA)' },
  { id: 'eea-air', layer: 'noise_air', label: 'Fluglärm (EU, ganztags)', tiles: arcgisImageTileUrl(serviceUrl('air', 'lden')), opacity: 0.6, attribution: 'Lärmdaten: European Environment Agency (EEA)' },
  { id: 'nrw-noise', layer: 'noise_regional', label: 'Straßenlärm NRW', tiles: wmsTileUrl('https://www.wms.nrw.de/umwelt/laerm', 'STR_DEN'), minzoom: 12, opacity: 0.6, attribution: 'Lärmkarte: Land NRW (dl-de/by-2-0)' },
  { id: 'be-noise', layer: 'noise_regional', label: 'Straßenlärm Berlin', tiles: wmsTileUrl('https://gdi.berlin.de/services/wms/ua_stratlaerm_2022', 'bb_strasse_gesamt_den2022'), minzoom: 11, opacity: 0.6, attribution: 'Lärmkarte: Geoportal Berlin (dl-de/zero-2-0)' },
  { id: 'ch-noise', layer: 'noise_regional', label: 'Strassenlärm Schweiz', tiles: wmsTileUrl('https://wms.geo.admin.ch/', 'ch.bafu.laerm-strassenlaerm_tag'), minzoom: 11, opacity: 0.6, attribution: 'Lärmkarte: BAFU, geo.admin.ch' },
  { id: 'hh-bplan', layer: 'bplan', label: 'Bebauungspläne Hamburg', tiles: wmsTileUrl('https://geodienste.hamburg.de/HH_WMS_Bebauungsplaene', 'hh_hh_festgestellt,hh_lgv_imverfahren'), minzoom: 12, opacity: 0.55, attribution: 'Bebauungspläne: Freie und Hansestadt Hamburg, Behörde für Stadtentwicklung und Wohnen (dl-de/by-2-0)' },
  { id: 'be-bplan', layer: 'bplan', label: 'Bebauungspläne Berlin', tiles: wmsTileUrl('https://gdi.berlin.de/services/wms/bplan', 'a_bp_iv,b_bp_fs'), minzoom: 12, opacity: 0.55, attribution: 'Bebauungspläne: Geoportal Berlin (dl-de/zero-2-0)' },
  { id: 'nrw-brw', layer: 'landvalue', label: 'Bodenrichtwerte NRW', tiles: wmsTileUrl('https://www.wms.nrw.de/boris/wms_nw_brw', '17,18'), minzoom: 13, opacity: 0.7, attribution: 'Bodenrichtwerte: BORIS.NRW, Gutachterausschüsse NRW' },
]

export const LAYER_LABEL: Record<LayerId, string> = {
  noise_road: 'Straßenlärm',
  noise_rail: 'Schienenlärm',
  noise_air: 'Fluglärm',
  noise_regional: 'Lärm (Länderdaten, genauer)',
  bplan: 'Bebauungspläne',
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
