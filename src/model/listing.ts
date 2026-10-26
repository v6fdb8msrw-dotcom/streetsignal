// Standortgenauigkeit: Die Karte zeigt nie mehr Genauigkeit, als die Quelle hergibt.
export type LatLng = [number, number]

export type LocationPrecision = 'exact' | 'street' | 'postcode' | 'city'

export const PRECISION_RADIUS_M: Record<LocationPrecision, number> = {
  exact: 0,
  street: 250,
  postcode: 1500,
  city: 5000,
}

export const PRECISION_LABEL: Record<LocationPrecision, string> = {
  exact: 'genaue Adresse',
  street: 'Straße bekannt',
  postcode: 'nur Postleitzahl oder Stadtteil',
  city: 'nur Ort',
}
