// WMS-Hilfen: Kartenebenen für MapLibre und Abfragen am Punkt (GetFeatureInfo).
import { fetchText } from './http.ts'

export function wmsTileUrl(base: string, layers: string, extra = ''): string {
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&LAYERS=${layers}${extra}&BBOX={bbox-epsg-3857}`
}

export function arcgisImageTileUrl(base: string): string {
  return `${base}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`
}

/** GetFeatureInfo um einen Punkt (kleines Fenster von etwa 20 m) */
export async function featureInfo(sourceId: string, base: string, layers: string, lat: number, lng: number, infoFormat: string, version: '1.1.1' | '1.3.0' = '1.1.1'): Promise<string> {
  const d = 0.00015
  const sep = base.includes('?') ? '&' : '?'
  // WMS 1.3.0 mit EPSG:4326 erwartet die Achsen in der Reihenfolge Breite, Länge
  const geo =
    version === '1.3.0'
      ? `CRS=EPSG:4326&I=50&J=50&BBOX=${lat - d},${lng - d},${lat + d},${lng + d}`
      : `SRS=EPSG:4326&X=50&Y=50&BBOX=${lng - d},${lat - d},${lng + d},${lat + d}`
  const url = `${base}${sep}SERVICE=WMS&VERSION=${version}&REQUEST=GetFeatureInfo&STYLES=&FORMAT=image/png&WIDTH=101&HEIGHT=101&FEATURE_COUNT=5&LAYERS=${layers}&QUERY_LAYERS=${layers}&INFO_FORMAT=${encodeURIComponent(infoFormat)}&${geo}`
  return fetchText(sourceId, url)
}
