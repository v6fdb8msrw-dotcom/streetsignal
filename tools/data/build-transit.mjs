// Bereitet die GTFS-Fahrpläne von gtfs.de (Daten DELFI e.V., CC BY 4.0) zu Abfahrten je Haltestelle auf.
// Ergebnis: public/data/oepnv/<Kachel>.json mit [lat, lng, Name, Abfahrten am Stichtag, Verkehrsmittel].
// Aufruf: node tools/data/build-transit.mjs <Ordner mit de_fv.zip, de_rv.zip, de_nv.zip, optional at_wl.zip>
// Braucht das Programm „unzip“. Stichtag: der nächste Mittwoch, an dem alle Feeds gültig sind.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const dir = process.argv[2]
if (!dir) throw new Error('Ordner mit den GTFS-ZIP-Dateien angeben')
const FEEDS = [
  { file: 'de_fv.zip', defaultMode: 'F' },
  { file: 'de_rv.zip', defaultMode: 'R' },
  { file: 'de_nv.zip', defaultMode: 'B' },
  // Österreich: frei ohne Anmeldung nur die Wiener Linien (CC BY 4.0, data.wien.gv.at)
  { file: 'at_wl.zip', defaultMode: 'B' },
]
const TILE = 0.25
const OUT = 'public/data/oepnv'

/** Liest eine Datei aus dem ZIP zeilenweise als Objekte (einfacher CSV-Leser mit Anführungszeichen) */
async function* rows(zip, name) {
  const proc = spawn('unzip', ['-p', zip, name])
  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    const cells = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (c === '"') q = false
        else cur += c
      } else if (c === '"') q = true
      else if (c === ',') {
        cells.push(cur)
        cur = ''
      } else cur += c
    }
    cells.push(cur)
    if (!header) {
      header = cells.map((h) => h.replace(/^﻿/, '').trim())
      continue
    }
    const o = {}
    header.forEach((h, i) => (o[h] = cells[i]))
    yield o
  }
}

/** GTFS-Verkehrsmittel (inkl. erweiterter Typen) → Buchstabe */
function modeOf(routeType, fallback) {
  const t = Number(routeType)
  if (t === 0 || (t >= 900 && t < 1000)) return 'T'
  if (t === 1 || t === 401 || t === 402) return 'U'
  if (t === 109 || t === 400) return 'S'
  if (t === 101 || t === 102 || t === 105) return 'F'
  if (t === 2 || (t >= 100 && t < 200)) return fallback === 'F' ? 'F' : 'R'
  if (t === 3 || (t >= 700 && t < 800) || t === 200) return 'B'
  if (t === 4 || t === 1000 || t === 1200) return 'X'
  return fallback
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')

// Stichtag: nächster Mittwoch ab übermorgen
const day = new Date()
day.setUTCDate(day.getUTCDate() + 2)
while (day.getUTCDay() !== 3) day.setUTCDate(day.getUTCDate() + 1)
const DATE = ymd(day)
const WEEKDAY = 'wednesday'
console.log(`Stichtag ${DATE}`)

const stations = new Map() // key → { lat, lng, name, deps, modes:Set }
const included = []

for (const feed of FEEDS) {
  const zip = join(dir, feed.file)
  if (!existsSync(zip)) {
    console.log(`\n${feed.file} fehlt, übersprungen`)
    continue
  }
  console.log(`\n${feed.file}`)
  included.push(feed.file.replace(/^de_|\.zip$/g, ''))
  const active = new Set()
  for await (const c of rows(zip, 'calendar.txt')) if (c[WEEKDAY] === '1' && c.start_date <= DATE && c.end_date >= DATE) active.add(c.service_id)
  for await (const c of rows(zip, 'calendar_dates.txt')) {
    if (c.date !== DATE) continue
    if (c.exception_type === '1') active.add(c.service_id)
    else active.delete(c.service_id)
  }
  console.log(`  ${active.size} aktive Verkehrstage`)
  const routeMode = new Map()
  for await (const r of rows(zip, 'routes.txt')) {
    let m = modeOf(r.route_type, feed.defaultMode)
    // S-Bahn ist in den Feeds oft als normale Bahn typisiert; Liniennamen wie „S1“ verraten sie
    if (m === 'R' && /^S\s?\d/.test(r.route_short_name ?? '')) m = 'S'
    if (m === 'B' && /^(U\s?\d)/.test(r.route_short_name ?? '')) m = 'U'
    routeMode.set(r.route_id, m)
  }
  const tripMode = new Map()
  for await (const t of rows(zip, 'trips.txt')) if (active.has(t.service_id)) tripMode.set(t.trip_id, routeMode.get(t.route_id) ?? feed.defaultMode)
  console.log(`  ${tripMode.size} Fahrten am Stichtag`)
  const stopDeps = new Map() // stop_id → { n, modes }
  let lines = 0
  for await (const st of rows(zip, 'stop_times.txt')) {
    if (++lines % 5_000_000 === 0) console.log(`  ${lines / 1e6} Mio. Halte gelesen`)
    const mode = tripMode.get(st.trip_id)
    if (!mode || st.pickup_type === '1') continue
    const e = stopDeps.get(st.stop_id) ?? { n: 0, modes: new Set() }
    e.n++
    e.modes.add(mode)
    stopDeps.set(st.stop_id, e)
  }
  const stops = new Map()
  for await (const s of rows(zip, 'stops.txt')) stops.set(s.stop_id, s)
  for (const [id, e] of stopDeps) {
    const s = stops.get(id)
    if (!s) continue
    const parent = s.parent_station && stops.get(s.parent_station)
    const base = parent || s
    const lat = Number(base.stop_lat)
    const lng = Number(base.stop_lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    // Gleiche Station aus mehreren Feeds zusammenführen: Name + Lage auf etwa 150 m gerundet
    const key = `${base.stop_name}|${lat.toFixed(3)}|${lng.toFixed(3)}`
    const st = stations.get(key) ?? { lat, lng, name: base.stop_name, deps: 0, modes: new Set() }
    st.deps += e.n
    e.modes.forEach((m) => st.modes.add(m))
    stations.set(key, st)
  }
  console.log(`  ${stopDeps.size} Haltestellen mit Abfahrten, gesamt ${stations.size} Stationen`)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const tiles = new Map()
for (const s of stations.values()) {
  const key = `${Math.floor(s.lat / TILE) * TILE}_${Math.floor(s.lng / TILE) * TILE}`.replace(/\./g, 'p')
  const list = tiles.get(key) ?? []
  list.push([Number(s.lat.toFixed(5)), Number(s.lng.toFixed(5)), s.name, s.deps, [...s.modes].sort().join('')])
  tiles.set(key, list)
}
const isoDate = `${DATE.slice(0, 4)}-${DATE.slice(4, 6)}-${DATE.slice(6)}`
for (const [key, list] of tiles) writeFileSync(join(OUT, `${key}.json`), JSON.stringify({ date: isoDate, feeds: included, stops: list }))
writeFileSync(
  join(OUT, 'LIZENZ.txt'),
  `Fahrplandaten: gtfs.de, Daten von DELFI e.V., Creative Commons Namensnennung 4.0 (https://creativecommons.org/licenses/by/4.0/).\nDie Feeds enthalten laut attributions.txt auch Daten von OpenStreetMap-Mitwirkenden (ODbL 1.0, https://opendatacommons.org/licenses/odbl/); soweit diese enthalten sind, gilt für die abgeleiteten Daten die ODbL.\nWiener Linien (at_wl): Stadt Wien – data.wien.gv.at, Creative Commons Namensnennung 4.0.\nAufbereitet von StreetSignal: Abfahrten je Haltestelle am ${isoDate} (Sollfahrplan). Ohne Gewähr.\n`,
)
console.log(`\n${stations.size} Stationen in ${tiles.size} Kacheln → ${OUT}`)
