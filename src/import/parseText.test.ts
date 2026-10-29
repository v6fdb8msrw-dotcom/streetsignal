import { describe, expect, it } from 'vitest'
import { missingFields, parseListingText, parseNumber } from './parseText.ts'

describe('parseNumber', () => {
  it('liest deutsche und Schweizer Schreibweisen', () => {
    expect(parseNumber('1.250.000')).toBe(1250000)
    expect(parseNumber("1'250'000")).toBe(1250000)
    expect(parseNumber('1.495,50')).toBe(1495.5)
    expect(parseNumber('92,5')).toBe(92.5)
    expect(parseNumber('3,5')).toBe(3.5)
    expect(parseNumber('1 250')).toBe(1250)
  })
})

describe('parseListingText', () => {
  const miete = `Helle 3-Zimmer-Altbauwohnung mit Balkon
Kaltmiete: 1.495 €
Nebenkosten: 280 €
Warmmiete: 1.775 €
Wohnfläche ca. 92 m²
Zimmer: 3
Schlafzimmer: 2
Schaumainkai 12, 60594 Frankfurt am Main
Online seit 21.10.2026
Objektbeschreibung
Die Wohnung liegt im dritten Stock eines gepflegten Altbaus direkt am Main mit Blick auf die Skyline.`

  it('erkennt eine Mietwohnung vollständig', () => {
    const e = parseListingText(miete)
    expect(e.title?.value).toBe('Helle 3-Zimmer-Altbauwohnung mit Balkon')
    expect(e.coldRent?.value).toBe(1495)
    expect(e.warmRent?.value).toBe(1775)
    expect(e.serviceCharges?.value).toBe(280)
    expect(e.livingArea?.value).toBe(92)
    expect(e.rooms?.value).toBe(3)
    expect(e.bedrooms?.value).toBe(2)
    expect(e.transaction?.value).toBe('miete')
    expect(e.category?.value).toBe('wohnung')
    expect(e.address?.value).toBe('Schaumainkai 12, 60594 Frankfurt am Main')
    expect(e.publishedAt?.value).toBe('2026-10-21')
    expect(e.currency?.value).toBe('EUR')
    expect(e.description?.value).toContain('gepflegten Altbaus')
    expect(missingFields(e)).toEqual([])
  })

  it('erkennt ein Haus zum Kauf und trennt Wohn- und Grundstücksfläche', () => {
    const e = parseListingText(`Doppelhaushälfte in ruhiger Lage
Kaufpreis 749.000 EUR
Wohnfläche 142 m²
Grundstücksfläche 310 m²
5 Zimmer
61350 Bad Homburg`)
    expect(e.transaction?.value).toBe('kauf')
    expect(e.purchasePrice?.value).toBe(749000)
    expect(e.livingArea?.value).toBe(142)
    expect(e.plotArea?.value).toBe(310)
    expect(e.rooms?.value).toBe(5)
    expect(e.category?.value).toBe('doppelhaushaelfte')
  })

  it('erkennt CHF und Schweizer Zimmerzahlen', () => {
    const e = parseListingText(`4.5-Zimmer-Wohnung am See
Mietzins netto: CHF 3'950
Wohnfläche: 115 m2
8700 Küsnacht`)
    expect(e.currency?.value).toBe('CHF')
    expect(e.coldRent?.value).toBe(3950)
    expect(e.rooms?.value).toBe(4.5)
  })

  it('erfindet nichts, wenn Angaben fehlen', () => {
    const e = parseListingText('Schönes Objekt, bitte melden Sie sich für Details.')
    expect(e.purchasePrice).toBeUndefined()
    expect(e.livingArea).toBeUndefined()
    expect(e.address).toBeUndefined()
    expect(missingFields(e)).toContain('Preis')
  })

  it('nimmt eine reine Grundstücksangabe nicht als Wohnfläche', () => {
    const e = parseListingText('Baugrundstück, 720 m² Grundstück, Kaufpreis 498.000 €')
    expect(e.livingArea).toBeUndefined()
    expect(e.plotArea?.value).toBe(720)
  })
})

describe('Zahlen aus Formularfeldern', () => {
  it('liest Dezimalpunkt, Dezimalkomma und Tausenderpunkte richtig', async () => {
    const { parseInput } = await import('../components/format.ts')
    expect(parseInput('78.5')).toBe(78.5)
    expect(parseInput('78,5')).toBe(78.5)
    expect(parseInput('1.150')).toBe(1150)
    expect(parseInput('1150')).toBe(1150)
    expect(parseInput('450.000')).toBe(450000)
    expect(parseInput("1'250'000")).toBe(1250000)
    expect(parseInput('')).toBeNull()
  })
})

describe('Exposé in Umschrift', () => {
  it('liest ae/ue und m2 und verwechselt m2 nicht mit Zimmern', async () => {
    const { parseListingText } = await import('./parseText.ts')
    const e = parseListingText('Einfamilienhaus zum Kauf Kaufpreis: 685.000 EUR Wohnflaeche: 142 m2 Grundstuecksflaeche: 520 m2 Zimmer: 5 Hauptstrasse 10, 37154 Northeim')
    expect(e.livingArea?.value).toBe(142)
    expect(e.plotArea?.value).toBe(520)
    expect(e.rooms?.value).toBe(5)
  })
})
