// Bereitet Jahresmittelwerte der Luftmessstationen des Umweltbundesamts als statische Datei auf.
// Grund: Die UBA-Schnittstelle erlaubt keinen direkten Abruf aus dem Browser (kein CORS).
// Lizenz: Nutzung nach § 12a EGovG, kommerziell und nicht kommerziell, Quellenvermerk „Umweltbundesamt“
// (https://www.umweltbundesamt.de/datenschutz-haftung-urheberrecht). Aufruf: node tools/data/build-air.mjs [Jahr]
import { mkdirSync, writeFileSync } from 'node:fs'

const API = 'https://luftdaten.umweltbundesamt.de/api/air-data/v3'
const year = Number(process.argv[2] ?? new Date().getFullYear() - 1)
const COMPONENTS = { no2: 5, pm10: 1, pm25: 9 }

const get = async (path) => {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${res.status} bei ${path}`)
  return res.json()
}

const stations = await get('/stations/json?use=airquality&lang=de')
const idx = Object.fromEntries(stations.indices.map((k, i) => [k, i]))
const values = {}
for (const [key, id] of Object.entries(COMPONENTS)) {
  const bal = await get(`/annualbalances/json?component=${id}&year=${year}&lang=de`)
  for (const [stationId, value] of bal.data) {
    const v = Number(value)
    if (Number.isFinite(v)) (values[stationId] ??= {})[key] = v
  }
}

const out = []
for (const row of Object.values(stations.data)) {
  const id = row[idx['station id']]
  const v = values[id]
  if (!v) continue
  out.push({
    id,
    code: row[idx['station code']],
    name: row[idx['station name']],
    city: row[idx['station city']],
    lat: Number(row[idx['station latitude']]),
    lng: Number(row[idx['station longitude']]),
    setting: row[idx['station setting name']],
    type: row[idx['station type name']],
    ...v,
  })
}

mkdirSync('public/data', { recursive: true })
writeFileSync(
  `public/data/luft-${year}.json`,
  JSON.stringify({
    year,
    source: 'Umweltbundesamt mit Daten der Messnetze der Länder und des Bundes',
    license: 'Nutzung nach § 12a EGovG, Quellenvermerk Umweltbundesamt; Daten aufbereitet (Jahresmittel je Station)',
    createdAt: new Date().toISOString(),
    stations: out,
  }),
)
console.log(`${out.length} Stationen mit Jahresmitteln ${year} → public/data/luft-${year}.json`)
