import { describe, expect, it } from 'vitest'
import { categorizeTile } from './osmTiles.ts'

describe('OpenMapTiles-Klassen', () => {
  it('ordnet Punkte und Flächen den Kategorien zu', () => {
    expect(categorizeTile('poi', { class: 'school', subclass: 'kindergarten' })).toBe('kita')
    expect(categorizeTile('poi', { class: 'school', subclass: 'school' })).toBe('schule')
    expect(categorizeTile('poi', { class: 'grocery', subclass: 'supermarket' })).toBe('einkauf')
    expect(categorizeTile('poi', { class: 'hospital', subclass: 'clinic' })).toBe('medizin')
    expect(categorizeTile('poi', { class: 'bus', subclass: 'bus_stop' })).toBe('oepnv')
    expect(categorizeTile('poi', { class: 'railway', subclass: 'station' })).toBe('bahn')
    expect(categorizeTile('poi', { class: 'restaurant', subclass: 'restaurant' })).toBeNull()
    expect(categorizeTile('landcover', { class: 'wood', subclass: 'forest' })).toBe('wald')
    expect(categorizeTile('landcover', { class: 'grass', subclass: 'garden' })).toBeNull()
    expect(categorizeTile('landuse', { class: 'school' })).toBe('schule')
    expect(categorizeTile('transportation', { class: 'minor_construction' })).toBe('baustelle')
    expect(categorizeTile('water', { class: 'river' })).toBe('wasser')
  })
})
