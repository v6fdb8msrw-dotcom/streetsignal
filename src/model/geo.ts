import type { LatLng } from './listing.ts'
import type { Country } from './taxonomy.ts'

const R = 6371000

export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180
  const dLat = (b[0] - a[0]) * toRad
  const dLng = (b[1] - a[1]) * toRad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Punkt-in-Polygon (Ray Casting), Polygon als [lat, lng]-Liste */
export function inPolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]
    const [yj, xj] = poly[j]
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export interface Place {
  id: string
  name: string
  country: Country
  region: string
  center: LatLng
  /** ungefährer Radius des Stadtgebiets in km, für „ganze Stadt“ */
  radiusKm: number
  postcodes?: string[]
}

/** Lokales Ortsverzeichnis, damit die Suche ohne Online-Dienst funktioniert. */
export const PLACES: Place[] = [
  { id: 'berlin', name: 'Berlin', country: 'DE', region: 'Berlin', center: [52.52, 13.405], radiusKm: 20, postcodes: ['10', '12', '13', '14'] },
  { id: 'hamburg', name: 'Hamburg', country: 'DE', region: 'Hamburg', center: [53.551, 9.993], radiusKm: 16, postcodes: ['20', '21', '22'] },
  { id: 'muenchen', name: 'München', country: 'DE', region: 'Bayern', center: [48.137, 11.575], radiusKm: 12, postcodes: ['80', '81'] },
  { id: 'koeln', name: 'Köln', country: 'DE', region: 'Nordrhein-Westfalen', center: [50.938, 6.96], radiusKm: 12, postcodes: ['50', '51'] },
  { id: 'frankfurt', name: 'Frankfurt am Main', country: 'DE', region: 'Hessen', center: [50.11, 8.682], radiusKm: 10, postcodes: ['60', '65'] },
  { id: 'stuttgart', name: 'Stuttgart', country: 'DE', region: 'Baden-Württemberg', center: [48.775, 9.182], radiusKm: 9, postcodes: ['70'] },
  { id: 'duesseldorf', name: 'Düsseldorf', country: 'DE', region: 'Nordrhein-Westfalen', center: [51.227, 6.773], radiusKm: 9, postcodes: ['40'] },
  { id: 'leipzig', name: 'Leipzig', country: 'DE', region: 'Sachsen', center: [51.34, 12.375], radiusKm: 10, postcodes: ['04'] },
  { id: 'dresden', name: 'Dresden', country: 'DE', region: 'Sachsen', center: [51.05, 13.738], radiusKm: 11, postcodes: ['01'] },
  { id: 'hannover', name: 'Hannover', country: 'DE', region: 'Niedersachsen', center: [52.375, 9.732], radiusKm: 9, postcodes: ['30'] },
  { id: 'nuernberg', name: 'Nürnberg', country: 'DE', region: 'Bayern', center: [49.452, 11.077], radiusKm: 9, postcodes: ['90'] },
  { id: 'bremen', name: 'Bremen', country: 'DE', region: 'Bremen', center: [53.079, 8.802], radiusKm: 10, postcodes: ['28'] },
  { id: 'freiburg', name: 'Freiburg im Breisgau', country: 'DE', region: 'Baden-Württemberg', center: [47.999, 7.842], radiusKm: 7, postcodes: ['79'] },
  { id: 'kiel', name: 'Kiel', country: 'DE', region: 'Schleswig-Holstein', center: [54.323, 10.123], radiusKm: 7, postcodes: ['24'] },
  { id: 'rostock', name: 'Rostock', country: 'DE', region: 'Mecklenburg-Vorpommern', center: [54.092, 12.099], radiusKm: 9, postcodes: ['18'] },
  { id: 'konstanz', name: 'Konstanz', country: 'DE', region: 'Baden-Württemberg', center: [47.66, 9.175], radiusKm: 5, postcodes: ['78'] },
  { id: 'garmisch', name: 'Garmisch-Partenkirchen', country: 'DE', region: 'Bayern', center: [47.492, 11.095], radiusKm: 5, postcodes: ['82'] },
  { id: 'potsdam', name: 'Potsdam', country: 'DE', region: 'Brandenburg', center: [52.39, 13.064], radiusKm: 8, postcodes: ['14'] },
  { id: 'wien', name: 'Wien', country: 'AT', region: 'Wien', center: [48.208, 16.373], radiusKm: 12, postcodes: ['1'] },
  { id: 'graz', name: 'Graz', country: 'AT', region: 'Steiermark', center: [47.071, 15.439], radiusKm: 8, postcodes: ['80'] },
  { id: 'salzburg', name: 'Salzburg', country: 'AT', region: 'Salzburg', center: [47.809, 13.055], radiusKm: 6, postcodes: ['50'] },
  { id: 'innsbruck', name: 'Innsbruck', country: 'AT', region: 'Tirol', center: [47.269, 11.404], radiusKm: 6, postcodes: ['60'] },
  { id: 'linz', name: 'Linz', country: 'AT', region: 'Oberösterreich', center: [48.306, 14.286], radiusKm: 7, postcodes: ['40'] },
  { id: 'kitzbuehel', name: 'Kitzbühel', country: 'AT', region: 'Tirol', center: [47.446, 12.392], radiusKm: 4, postcodes: ['63'] },
  { id: 'zell_see', name: 'Zell am See', country: 'AT', region: 'Salzburg', center: [47.323, 12.796], radiusKm: 4, postcodes: ['57'] },
  { id: 'zuerich', name: 'Zürich', country: 'CH', region: 'Zürich', center: [47.377, 8.541], radiusKm: 7, postcodes: ['80'] },
  { id: 'genf', name: 'Genf', country: 'CH', region: 'Genf', center: [46.204, 6.143], radiusKm: 6, postcodes: ['12'] },
  { id: 'basel', name: 'Basel', country: 'CH', region: 'Basel-Stadt', center: [47.56, 7.588], radiusKm: 5, postcodes: ['40'] },
  { id: 'bern', name: 'Bern', country: 'CH', region: 'Bern', center: [46.948, 7.447], radiusKm: 6, postcodes: ['30'] },
  { id: 'luzern', name: 'Luzern', country: 'CH', region: 'Luzern', center: [47.05, 8.309], radiusKm: 5, postcodes: ['60'] },
  { id: 'lausanne', name: 'Lausanne', country: 'CH', region: 'Waadt', center: [46.52, 6.633], radiusKm: 5, postcodes: ['10'] },
  { id: 'zermatt', name: 'Zermatt', country: 'CH', region: 'Wallis', center: [46.02, 7.749], radiusKm: 3, postcodes: ['39'] },
  { id: 'davos', name: 'Davos', country: 'CH', region: 'Graubünden', center: [46.802, 9.836], radiusKm: 5, postcodes: ['72'] },
  { id: 'lugano', name: 'Lugano', country: 'CH', region: 'Tessin', center: [46.004, 8.951], radiusKm: 5, postcodes: ['69'] },
]

export const REGIONS: Record<Country, string[]> = {
  DE: ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'],
  AT: ['Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich', 'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg', 'Wien'],
  CH: ['Aargau', 'Appenzell', 'Basel-Landschaft', 'Basel-Stadt', 'Bern', 'Freiburg', 'Genf', 'Glarus', 'Graubünden', 'Jura', 'Luzern', 'Neuenburg', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz', 'Solothurn', 'St. Gallen', 'Tessin', 'Thurgau', 'Uri', 'Waadt', 'Wallis', 'Zug', 'Zürich'],
}

/**
 * Landschaftsräume für die Suche ohne festen Ausgangspunkt („Chalets in den Alpen“).
 * Vereinfachte Abgrenzungen; die Oberfläche weist darauf hin.
 */
export interface Landscape {
  id: string
  name: string
  polygon: LatLng[]
}

export const LANDSCAPES: Landscape[] = [
  {
    id: 'alpen',
    name: 'Alpen (DACH)',
    polygon: [
      [47.85, 6.0], [47.55, 7.4], [47.75, 9.4], [47.68, 10.5], [47.62, 11.6], [47.72, 12.9], [47.95, 13.4],
      [47.95, 14.6], [47.75, 16.0], [47.2, 16.0], [46.55, 15.0], [46.45, 13.7], [46.55, 12.3], [46.35, 10.4],
      [45.9, 9.0], [45.85, 7.0], [46.2, 6.05],
    ],
  },
  {
    id: 'nordsee',
    name: 'Nordseeküste',
    polygon: [[53.2, 6.7], [53.75, 6.7], [54.0, 8.3], [54.9, 8.2], [55.1, 8.6], [54.6, 9.0], [53.9, 9.2], [53.4, 8.4], [53.2, 7.3]],
  },
  {
    id: 'ostsee',
    name: 'Ostseeküste',
    polygon: [[54.85, 9.6], [54.6, 10.2], [54.3, 10.6], [53.95, 10.85], [54.1, 11.6], [54.4, 12.8], [54.7, 13.5], [54.2, 14.3], [53.85, 14.2], [53.85, 13.2], [53.95, 11.4], [54.25, 9.9]],
  },
  {
    id: 'bodensee',
    name: 'Bodensee-Region',
    polygon: [[47.85, 8.85], [47.85, 9.65], [47.55, 9.85], [47.45, 9.55], [47.6, 9.0]],
  },
  {
    id: 'oberbayern_seen',
    name: 'Oberbayerische Seen',
    polygon: [[48.1, 11.05], [48.05, 11.5], [47.85, 12.6], [47.7, 12.6], [47.6, 11.3], [47.8, 11.0]],
  },
  {
    id: 'salzkammergut',
    name: 'Salzkammergut',
    polygon: [[47.95, 13.15], [47.95, 13.9], [47.5, 14.0], [47.5, 13.4], [47.75, 13.1]],
  },
]

export function findPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q) ||
      (/^\d/.test(q) && p.postcodes?.some((pc) => q.startsWith(pc) || pc.startsWith(q))),
  ).slice(0, 8)
}
