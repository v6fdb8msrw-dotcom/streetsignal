import { describe, expect, it } from 'vitest'
import type { Property } from '../model/property.ts'
import { emptyFilter } from '../model/query.ts'
import type { EnvReport } from '../services/environment.ts'
import { score } from './compare.ts'
import { applyFilter } from './filter.ts'

const unknown = { value: null, provenance: 'unavailable' as const }
const src = <T,>(value: T) => ({ value, provenance: 'user' as const })

function prop(id: string, over: Partial<Property> = {}): Property {
  return {
    id,
    createdAt: '2026-10-26T00:00:00Z',
    updatedAt: '2026-10-26T00:00:00Z',
    country: 'DE',
    title: src(id),
    description: unknown,
    category: src('wohnung'),
    transaction: src('miete'),
    currency: 'EUR',
    purchasePrice: unknown,
    coldRent: src(1000),
    warmRent: unknown,
    livingArea: src(80),
    plotArea: unknown,
    rooms: src(3),
    bedrooms: unknown,
    address: unknown,
    location: { lat: 50.11, lng: 8.68, precision: 'exact', basis: 'Test' },
    publishedAt: unknown,
    offers: [],
    notes: '',
    status: 'neu',
    ...over,
  }
}

function report(parkM: number | null, noiseClass: number | null, flood = false, deps: number | null = null): EnvReport {
  const pois = parkM === null ? [] : [{ id: 'w/1', category: 'gruen' as const, name: 'Park', lat: 0, lng: 0, distanceM: parkM, tags: {}, osmUrl: '' }]
  const values = (['road', 'rail', 'air', 'ind'] as const).flatMap((source) =>
    (['lden', 'lnight'] as const).map((period) => ({ source, period, rawClass: source === 'road' && period === 'lden' ? noiseClass : null, range: source === 'road' && period === 'lden' && noiseClass ? ([50 + noiseClass * 5, 55 + noiseClass * 5] as [number, number]) : null })),
  )
  const ok = <T,>(data: T) => ({ status: 'ok' as const, data, error: null, sourceIds: [] })
  return {
    id: 'r',
    targetId: 't',
    createdAt: '2026-10-26T00:00:00Z',
    lat: 0,
    lng: 0,
    radius: 500,
    place: null,
    pois: ok({ pois, dataTimestamp: null, fetchedAt: '' }),
    noise: ok({ values, nearby: [], dataDate: '', fetchedAt: '', note: '' }),
    planning: ok({ covered: false, region: null, plans: [], portal: null, fetchedAt: '' }),
    landValue: ok({ covered: false, values: [], portal: null, note: '', fetchedAt: '' }),
    council: ok({ available: false, system: null, papers: [], note: '', fetchedAt: '' }),
    flood: ok({ covered: true, inArea: { haeufig: false, hq100: flood, extrem: flood }, reportYear: '2016', fetchedAt: '', note: '' }),
    air: ok({ covered: true, year: 2025, stations: [], note: '' }),
    transit: ok({ covered: true, source: 'gtfs' as const, ovClass: null, stops: [], departures500: deps, nearestLongDistance: null, dataDate: '2026-10-28', note: '' }),
  }
}

describe('Filter', () => {
  it('Wohnfläche ist Muss, unbekannt fliegt raus – außer man schließt Unbekanntes ein', () => {
    const props = [prop('a'), prop('b', { livingArea: unknown }), prop('c', { livingArea: src(50) })]
    const f = { ...emptyFilter(), livingArea: { min: 70, max: null } }
    expect(applyFilter(props, new Map(), f).map((r) => r.property.id)).toEqual(['a'])
    const g = { ...f, includeUnknown: true }
    const res = applyFilter(props, new Map(), g)
    expect(res.map((r) => r.property.id).sort()).toEqual(['a', 'b'])
    expect(res.find((r) => r.property.id === 'b')!.unknown).toEqual(['Wohnfläche'])
  })

  it('vergleicht keine Preise zwischen Währungen', () => {
    const props = [prop('eur'), prop('chf', { currency: 'CHF', country: 'CH', coldRent: src(900) })]
    const f = { ...emptyFilter(), price: { min: null, max: 1200, currency: 'EUR' as const } }
    expect(applyFilter(props, new Map(), f).map((r) => r.property.id)).toEqual(['eur'])
  })

  it('Muss-Kriterium Park: ohne Analyse unbekannt, mit Analyse gemessen', () => {
    const props = [prop('nah'), prop('fern'), prop('ohne')]
    const reports = new Map([
      ['nah', report(200, null)],
      ['fern', report(1200, null)],
    ])
    const f = { ...emptyFilter(), criteria: [{ id: 'park', mode: 'must' as const }] }
    expect(applyFilter(props, reports, f).map((r) => r.property.id)).toEqual(['nah'])
  })

  it('Wünsche sortieren nur und bleiben sichtbar', () => {
    const props = [prop('laut'), prop('ruhig')]
    const reports = new Map([
      ['laut', report(200, 3)],
      ['ruhig', report(200, null)],
    ])
    const f = { ...emptyFilter(), criteria: [{ id: 'ruhe', mode: 'wish' as const }] }
    const res = applyFilter(props, reports, f)
    expect(res.map((r) => r.property.id)).toEqual(['ruhig', 'laut'])
    expect(res[1].outcomes[0]).toMatchObject({ status: 'no', evidence: 'kartiert ab 65 dB' })
  })
})

describe('Neue Kriterien', () => {
  it('Hochwasser und Takt werden gemessen, ohne Daten unbekannt', () => {
    const props = [prop('trocken'), prop('nass'), prop('ohne')]
    const reports = new Map([
      ['trocken', report(200, null, false, 340)],
      ['nass', report(200, null, true, 40)],
    ])
    const f = { ...emptyFilter(), criteria: [{ id: 'kein_hochwasser', mode: 'must' as const }, { id: 'guter_takt', mode: 'wish' as const }] }
    const res = applyFilter(props, reports, f)
    expect(res.map((r) => r.property.id)).toEqual(['trocken'])
    expect(res[0].wishes).toEqual({ yes: 1, total: 1 })
  })
})

describe('Vergleich', () => {
  it('rechnet offen nach Gewichtung, unbekannt gibt 0 Punkte', () => {
    const a = prop('a', { coldRent: src(1000), livingArea: src(100) })
    const b = prop('b', { coldRent: src(1200), livingArea: src(80) })
    const rows = score(
      [
        { property: a, report: report(100, null) },
        { property: b, report: null },
      ],
      { ruhe: 1, gruen: 1, oepnv: 0, takt: 0, hochwasser: 0, versorgung: 0, baustellen: 0, preis_qm: 1 },
    )
    const ra = rows[0]
    const rb = rows[1]
    expect(ra.cells.find((c) => c.factor === 'preis_qm')!.points).toBe(1) // 10 €/m² besser als 15 €/m²
    expect(rb.cells.find((c) => c.factor === 'preis_qm')!.points).toBe(0)
    expect(rb.cells.find((c) => c.factor === 'gruen')!.note).toBe('unbekannt, 0 Punkte')
    // Grün nur bei a bekannt: nicht verglichen, keine Punkte
    expect(ra.cells.find((c) => c.factor === 'gruen')!.points).toBe(0)
    expect(ra.cells.find((c) => c.factor === 'gruen')!.note).toBe('nur hier bekannt, nicht verglichen')
    expect(ra.max).toBe(3)
    expect(ra.total).toBe(1)
  })
})
