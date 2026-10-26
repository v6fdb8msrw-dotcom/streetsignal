// Kartenstil: OpenFreeMap „Positron“, beim Laden in die StreetSignal-Farben umgefärbt.
// Austauschbar: Nur STYLE_URL und recolor() hängen am Anbieter.
import type { Map as MlMap } from 'maplibre-gl'

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

const RULES: [RegExp, string, string][] = [
  [/^background$/, 'background-color', '#f4f1e8'],
  [/water/, 'fill-color', '#d3e3df'],
  [/park|wood|grass|landcover/, 'fill-color', '#dfe9d6'],
  [/building/, 'fill-color', '#ebe5d8'],
  [/landuse_residential|residential/, 'fill-color', '#f1ede2'],
]

export function recolor(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    for (const [re, prop, color] of RULES) {
      if (!re.test(layer.id)) continue
      if ((prop === 'fill-color' && layer.type !== 'fill') || (prop === 'background-color' && layer.type !== 'background')) continue
      try {
        map.setPaintProperty(layer.id, prop, color)
      } catch {
        // Ebene unterstützt die Eigenschaft nicht
      }
    }
  }
}

/** Kreis als Polygon (für den Umgebungsradius) */
export function circlePolygon(lat: number, lng: number, radiusM: number, steps = 72): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } }
}
