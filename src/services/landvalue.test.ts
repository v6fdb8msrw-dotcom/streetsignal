// Bodenrichtwerte der Länder: Parser an echten Antworten der Dienste (abgerufen am 28.10.2026)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseAdvGml, parseBerlinBrw, parseMv, parseSachsen, parseThueringen, rankValues } from './landvalue.ts'

const fx = (name: string) => readFileSync(new URL(`./fixtures/brw_${name}`, import.meta.url), 'utf-8')

describe('Bodenrichtwerte der Länder', () => {
  it('Berlin (GeoJSON)', () => {
    const [v] = parseBerlinBrw(JSON.parse(fx('be.json')))
    expect(v.valueEurPerSqm).toBe(8500)
    expect(v.referenceDate).toBe('2025-01-01')
    expect(v.usage).toContain('Kerngebiet')
  })
  it('Brandenburg (AdV-GML): Bauland vor Acker und Forst', () => {
    const vs = rankValues(parseAdvGml(fx('bb.xml')))
    expect(vs[0].valueEurPerSqm).toBe(1200)
    expect(vs[0].usage).toBe('Mischgebiet')
    expect(vs[0].district).toBe('Potsdam, Leipziger Straße')
    expect(vs[0].buildingLand).toBe(true)
    expect(vs.slice(1).every((v) => v.buildingLand === false)).toBe(true)
  })
  it('Sachsen-Anhalt (AdV-GML)', () => {
    const [v] = rankValues(parseAdvGml(fx('st.xml')))
    expect(v.valueEurPerSqm).toBe(1100)
    expect(v.usage).toBe('Kerngebiet')
    expect(v.referenceDate).toBe('2026-01-01')
  })
  it('Niedersachsen (BORIS-GML)', () => {
    const [v] = parseAdvGml(fx('ni.xml'))
    expect(v.valueEurPerSqm).toBe(1800)
    expect(v.usage).toBe('Kerngebiet')
    expect(v.committee).toContain('Hameln-Hannover')
  })
  it('Thüringen ($#$-Text)', () => {
    const [v] = parseThueringen(fx('th.txt'))
    expect(v.valueEurPerSqm).toBe(2700)
    expect(v.municipality).toBe('Erfurt')
    expect(v.district).toBe('Fischmarkt')
  })
  it('Sachsen (MapServer-Text)', () => {
    const [v] = parseSachsen(fx('sn.txt'))
    expect(v.valueEurPerSqm).toBe(3500)
    expect(v.usage).toBe('Kerngebiet')
    expect(v.documentUrl).toMatch(/^https:\/\/www\.landesvermessung/)
  })
  it('Mecklenburg-Vorpommern: Bauland zuerst', () => {
    const [v] = rankValues(parseMv(fx('mv.txt')))
    expect(v.valueEurPerSqm).toBe(970)
    expect(v.buildingLand).toBe(true)
  })
})
