// Wert am Punkt aus einem Kartenbild ablesen: Manche Bundesdienste (z. B. geo.admin.ch) bieten für Luft- und
// Überschwemmungskarten keine Abfrage am Punkt, nur das Bild. Wir holen ein kleines Bild um den Punkt und
// ordnen die Farbe in der Mitte der amtlichen Legende zu.
import { fetchWithLimits } from './http.ts'

export type Rgba = [number, number, number, number]

/**
 * Kleines Kartenbild um den Punkt. halfM = halbe Kantenlänge in Metern, size = Pixel je Kante.
 * Liefert eine Funktion, die die Farbe eines Pixels relativ zur Mitte zurückgibt.
 */
export async function wmsImage(sourceId: string, base: string, layer: string, lat: number, lng: number, extra = '', halfM = 30, size = 7): Promise<(dx?: number, dy?: number) => Rgba> {
  const x = (lng * 20037508.34) / 180
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI
  const h = halfM / Math.cos((lat * Math.PI) / 180) // Mercator-Strecken sind um diesen Faktor länger
  const sep = base.includes('?') ? '&' : '?'
  const url = `${base}${sep}SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:3857&BBOX=${x - h},${y - h},${x + h},${y + h}&WIDTH=${size}&HEIGHT=${size}&FORMAT=image/png&TRANSPARENT=true${extra}`
  const blob = await (await fetchWithLimits(sourceId, url)).blob()
  const bmp = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  ctx.drawImage(bmp, 0, 0)
  const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data
  const c = Math.floor(bmp.width / 2)
  return (dx = 0, dy = 0) => {
    const i = ((c + dy) * bmp.width + (c + dx)) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }
}

/** Farbe in der Bildmitte */
export async function wmsPixel(sourceId: string, base: string, layer: string, lat: number, lng: number, extra = '', halfM = 30): Promise<Rgba> {
  return (await wmsImage(sourceId, base, layer, lat, lng, extra, halfM))()
}

/** Nächste Legendenfarbe (Index) oder null, wenn transparent oder keine Farbe nahe genug liegt */
export function matchLegend(px: Rgba, legend: [number, number, number][], maxDist = 40): number | null {
  if (px[3] < 128) return null
  let best = -1
  let bestD = Infinity
  legend.forEach((c, i) => {
    const d = Math.hypot(c[0] - px[0], c[1] - px[1], c[2] - px[2])
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return bestD <= maxDist ? best : null
}
