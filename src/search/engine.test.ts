import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEMO_LISTINGS } from '../data/demo.ts'
import { SOURCES } from '../data/sources.ts'
import { PLACES } from '../model/geo.ts'
import { emptyQuery, type SearchQuery } from '../model/query.ts'
import { search } from './engine.ts'

const integrated = new Set(SOURCES.filter((s) => s.integrated).map((s) => s.id))
const run = (q: SearchQuery) => search(DEMO_LISTINGS, q, integrated)
const ids = (q: SearchQuery) => run(q).groups.flatMap((g) => g.offers.map((o) => o.listing.id))

test('ohne Filter: alle Beispielinserate, Dubletten gruppiert', () => {
  const out = run(emptyQuery())
  assert.equal(out.total, DEMO_LISTINGS.length)
  assert.equal(out.groups.length, DEMO_LISTINGS.length - 1)
  const g = out.groups.find((x) => x.objectId === 'obj-ffm-sachsenhausen')!
  assert.deepEqual(g.offers.map((o) => o.listing.sourceId).sort(), ['demo_a', 'demo_b'])
})

test('Umkreis um Frankfurt: 10 km schließt Bad Homburg aus, 25 km ein', () => {
  const ffm = PLACES.find((p) => p.id === 'frankfurt')!
  const q = emptyQuery()
  q.areas = [{ id: 'a', kind: 'radius', label: 'Frankfurt', center: ffm.center, radiusKm: 10 }]
  assert.ok(!ids(q).includes('ffm-5'))
  q.areas = [{ id: 'a', kind: 'radius', label: 'Frankfurt', center: ffm.center, radiusKm: 25 }]
  assert.ok(ids(q).includes('ffm-5'))
})

test('mehrere Gebiete werden mit ODER verknüpft', () => {
  const q = emptyQuery()
  q.areas = [
    { id: 'a', kind: 'region', country: 'DE', region: 'Hamburg' },
    { id: 'b', kind: 'country', country: 'CH' },
  ]
  const found = ids(q)
  assert.ok(found.includes('ham-1') && found.includes('zh-1'))
  assert.ok(!found.includes('ffm-1'))
})

test('Landschaftsraum Alpen ohne festen Ausgangspunkt findet Chalets', () => {
  const q = emptyQuery()
  q.areas = [{ id: 'a', kind: 'landscape', landscapeId: 'alpen', label: 'Alpen' }]
  q.categories = ['chalet']
  assert.deepEqual(ids(q).sort(), ['gap-1', 'tir-1', 'zer-1'])
})

test('Miete ist nie Kauf', () => {
  const q = emptyQuery()
  q.transactions = ['kauf']
  const out = run(q)
  assert.ok(out.groups.every((g) => g.offers.every((o) => o.listing.transaction === 'kauf')))
})

test('vermutete Kategorie zählt nur mit „unsichere Angaben zulassen“', () => {
  const q = emptyQuery()
  q.categories = ['villa']
  assert.ok(!ids(q).includes('kn-1'))
  q.allowUncertain = true
  assert.ok(ids(q).includes('kn-1'))
})

test('fehlende Grundstücksfläche wird nicht erfunden, nur auf Wunsch eingeschlossen', () => {
  const q = emptyQuery()
  q.plotArea = { min: 300, max: null }
  assert.ok(!ids(q).includes('stu-1'))
  q.includeUnknown.plotArea = true
  const r = run(q).groups.flatMap((g) => g.offers).find((o) => o.listing.id === 'stu-1')!
  assert.deepEqual(r.includedUnknown, ['Grundstücksfläche'])
  assert.equal(r.mustOk, false)
})

test('Preisgrenze in EUR vergleicht keine CHF-Preise', () => {
  const q = emptyQuery()
  q.price.max = 5000
  q.transactions = ['miete']
  assert.ok(!ids(q).includes('zh-1'))
  q.price.currency = 'CHF'
  assert.ok(ids(q).includes('zh-1'))
  assert.ok(!ids(q).includes('ffm-1'))
})

test('Muss-Kriterium: nah am See ≠ direkt am See', () => {
  const q = emptyQuery()
  q.criteria = [{ id: 'n_see', mode: 'must' }]
  const near = ids(q)
  q.criteria = [{ id: 'w_direkt', mode: 'must' }]
  const direct = ids(q)
  assert.ok(near.includes('muc-3'), 'Landhaus 350 m vom See ist „nah“')
  assert.ok(!direct.includes('muc-3'), 'aber nicht „direkt am Wasser“')
  assert.ok(direct.includes('ber-4'))
})

test('Beispiel aus Punkt 10: Muss Haus ≥120 m² ≤900.000 €, Wunsch Landhaus/Grün/See', () => {
  const q = emptyQuery()
  q.categories = ['einfamilienhaus', 'doppelhaushaelfte', 'reihenhaus', 'reihenendhaus', 'landhaus', 'bauernhaus', 'freistehend', 'bungalow', 'villa', 'stadthaus', 'fachwerkhaus']
  q.transactions = ['kauf']
  q.livingArea = { min: 120, max: null }
  q.price.max = 900000
  q.criteria = [
    { id: 'art_landhaus', mode: 'wish' },
    { id: 'n_gruen', mode: 'wish' },
    { id: 'n_see', mode: 'wish' },
  ]
  const out = run(q)
  for (const g of out.groups) {
    const l = g.primary.listing
    assert.ok((l.sizes.livingArea.value ?? 0) >= 120)
    assert.ok((l.prices.purchase.value ?? Infinity) <= 900000)
  }
  // Sortierung nur nach Anzahl erfüllter Wünsche, offen einsehbar
  const yes = out.groups.map((g) => g.primary.wishes.yes)
  assert.deepEqual(yes, [...yes].sort((a, b) => b - a))
  assert.equal(out.groups[0].primary.listing.id, 'nord-1')
})

test('unbekannte Ausstattung gilt nicht als erfüllt', () => {
  const q = emptyQuery()
  q.criteria = [{ id: 'f_haustiere', mode: 'must' }]
  const found = ids(q)
  assert.ok(found.includes('ffm-2'))
  assert.ok(!found.includes('ffm-1'), 'keine Angabe → nicht erfüllt')
})
