import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('fetch', async () => new Response(readFileSync('public/data/laender.json')))
const { germanStateAt } = await import('./region.ts')

describe('Bundesland aus den amtlichen Ländergrenzen', () => {
  it.each([
    [49.4875, 8.4660, 'Baden-Württemberg'], // Mannheim
    [49.4774, 8.4452, 'Rheinland-Pfalz'], // Ludwigshafen
    [48.3984, 9.9916, 'Baden-Württemberg'], // Ulm
    [48.3925, 10.0110, 'Bayern'], // Neu-Ulm
    [49.9929, 8.2473, 'Rheinland-Pfalz'], // Mainz
    [50.0782, 8.2398, 'Hessen'], // Wiesbaden
    [49.97327, 8.82793, 'Hessen'], // Rödermark
    [53.0793, 8.8017, 'Bremen'],
    [53.5450, 8.5800, 'Bremen'], // Bremerhaven
    [53.5511, 9.9937, 'Hamburg'],
    [52.5200, 13.4050, 'Berlin'],
    [52.3906, 13.0645, 'Brandenburg'], // Potsdam
    [54.5850, 13.1100, 'Mecklenburg-Vorpommern'], // Hiddensee
    [53.6800, 7.0000, 'Niedersachsen'], // Juist
    [54.9000, 8.3100, 'Schleswig-Holstein'], // Sylt
  ])('%f, %f → %s', async (lat, lng, state) => {
    expect(await germanStateAt(lat, lng)).toBe(state)
  })
  it('außerhalb Deutschlands null', async () => {
    expect(await germanStateAt(48.2082, 16.3738)).toBeNull() // Wien
    expect(await germanStateAt(47.3769, 8.5417)).toBeNull() // Zürich
  })
})
