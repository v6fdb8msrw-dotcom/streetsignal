// Bereitet Jahresmittel der Luftmessstationen eines Landes aus der EEA-Statistik als statische Datei auf
// (für Länder ohne eigene bundesweite Schnittstelle, z. B. Österreich).
// Quelle: EEA, „Air quality annual statistics calculated by the EEA“ (Dienst AQ_Statistics_WM), Daten der Messnetze der Länder.
// Lizenz: EEA-Weiterverwendung kostenlos, auch kommerziell, Quellenangabe „European Environment Agency (EEA)“.
// Aufruf: node tools/data/build-air-eea.mjs AT 2025
import { mkdirSync, writeFileSync } from 'node:fs'

const SERVICE = 'https://air.discomap.eea.europa.eu/arcgis/rest/services/AirQuality/AQ_Statistics_WM/MapServer/0/query'
const country = (process.argv[2] ?? 'AT').toUpperCase()
const year = Number(process.argv[3] ?? new Date().getFullYear() - 1)
const POLLUTANTS = { NO2: 'no2', PM10: 'pm10', 'PM2.5': 'pm25' }
const SETTING = { Urban: 'städtisches Gebiet', Suburban: 'vorstädtisches Gebiet', Rural: 'ländliches Gebiet', 'Rural-nearcity': 'ländlich, stadtnah', 'Rural-regional': 'ländlich, regional', 'Rural-remote': 'ländlich, abgelegen' }
const TYPE = { Traffic: 'Verkehr', Background: 'Hintergrund', Industrial: 'Industrie' }

const rows = []
for (let offset = 0; ; offset += 1000) {
  const q = new URLSearchParams({
    where: `Country_ISO='${country}' AND YearOfStatistics=${year} AND ReportingMetric='Annual mean / average' AND AirPollutant IN ('NO2','PM10','PM2.5')`,
    outFields: 'AirPollutant,AirPollutionLevel,AirQualityEoICode,StationName,LatitudeOfMeasurementStation,LongitudeOfMeasurementStation,AreaOfMeasurementStation,TypeOfMeasurementStation,DataCoverage,Preliminary',
    returnGeometry: 'false',
    resultOffset: String(offset),
    resultRecordCount: '1000',
    f: 'json',
  })
  const res = await fetch(`${SERVICE}?${q}`)
  if (!res.ok) throw new Error(`EEA antwortet ${res.status}`)
  const d = await res.json()
  if (d.error) throw new Error(JSON.stringify(d.error))
  rows.push(...d.features.map((f) => f.attributes))
  if (!d.exceededTransferLimit && d.features.length < 1000) break
}

const byStation = new Map()
let preliminary = false
for (const r of rows) {
  // Laut EEA gehören Jahreswerte mit weniger als 75 % Datenabdeckung nicht in eine Bewertung
  if (r.DataCoverage !== null && r.DataCoverage < 75) continue
  const v = Number(r.AirPollutionLevel)
  if (!Number.isFinite(v)) continue
  if (r.Preliminary === '1' || r.Preliminary === 1) preliminary = true
  const s = byStation.get(r.AirQualityEoICode) ?? {
    id: r.AirQualityEoICode,
    code: r.AirQualityEoICode,
    name: r.StationName,
    city: '',
    lat: Number(r.LatitudeOfMeasurementStation),
    lng: Number(r.LongitudeOfMeasurementStation),
    setting: SETTING[r.AreaOfMeasurementStation] ?? r.AreaOfMeasurementStation,
    type: TYPE[r.TypeOfMeasurementStation] ?? r.TypeOfMeasurementStation,
  }
  s[POLLUTANTS[r.AirPollutant]] = Math.round(v * 10) / 10
  byStation.set(r.AirQualityEoICode, s)
}

const stations = [...byStation.values()]
mkdirSync('public/data', { recursive: true })
const file = `public/data/luft-${country.toLowerCase()}-${year}.json`
writeFileSync(
  file,
  JSON.stringify({
    year,
    source: `European Environment Agency (EEA), Jahresstatistik aus den Daten der Messnetze (${country})${preliminary ? ', teils vorläufig' : ''}`,
    license: 'EEA-Weiterverwendung: kostenlos, auch kommerziell, Quellenangabe European Environment Agency (EEA); aufbereitet (Jahresmittel je Station, nur Werte mit mindestens 75 % Datenabdeckung)',
    preliminary,
    createdAt: new Date().toISOString(),
    stations,
  }),
)
console.log(`${stations.length} Stationen (${rows.length} Werte) → ${file}${preliminary ? ' (teils vorläufig)' : ''}`)
