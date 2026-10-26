// Erkennt Immobilienmerkmale in eingefügtem Inseratstext, PDF-Text oder OCR-Ergebnis (Option C/D, Abschnitt 4.2).
// Alles Erkannte ist „automatisch extrahiert, unbestätigt“ und wird vor dem Speichern angezeigt.
import { CATEGORIES } from '../model/taxonomy.ts'
import type { Currency, Transaction } from '../model/taxonomy.ts'

export interface ExtractedField<T> {
  value: T
  /** Textstelle, aus der der Wert stammt (zur Kontrolle) */
  evidence: string
}

export interface Extracted {
  title?: ExtractedField<string>
  category?: ExtractedField<string>
  transaction?: ExtractedField<Transaction>
  currency?: ExtractedField<Currency>
  purchasePrice?: ExtractedField<number>
  coldRent?: ExtractedField<number>
  warmRent?: ExtractedField<number>
  serviceCharges?: ExtractedField<number>
  livingArea?: ExtractedField<number>
  plotArea?: ExtractedField<number>
  rooms?: ExtractedField<number>
  bedrooms?: ExtractedField<number>
  address?: ExtractedField<string>
  publishedAt?: ExtractedField<string>
  description?: ExtractedField<string>
}

/** Deutsche und Schweizer Zahlschreibweisen: 1.250.000 · 1'250'000 · 1 250 000 · 120,5 · 3,5 */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/['’\s ]/g, '')
  if (!s) return null
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = /,\d{3}$/.test(s) && s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.')
  else if (/\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, '')
  s = s.replace(/[.,-]+$/, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const NUM = String.raw`(\d{1,3}(?:[.'’\s ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`
const CUR = String.raw`(?:€|EUR|Euro|CHF|Fr\.)`

function find(text: string, patterns: RegExp[]): { value: number; evidence: string } | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const value = parseNumber(m[1])
      if (value !== null) return { value, evidence: m[0].replace(/\s+/g, ' ').trim() }
    }
  }
  return null
}

const lbl = (words: string) => new RegExp(String.raw`(?:${words})\s*(?:\(.*?\))?\s*[:\-–]?\s*(?:ca\.\s*)?(?:${CUR}\s*)?${NUM}\s*(?:${CUR})?`, 'i')

/** Kategorien anhand der Bezeichnungen der Registry, längere Begriffe zuerst */
const CATEGORY_WORDS: [RegExp, string][] = [
  [/penthouse/i, 'penthouse'],
  [/maisonette/i, 'maisonette'],
  [/\bloft\b/i, 'loft'],
  [/dachgeschoss/i, 'dachgeschoss'],
  [/erdgeschoss/i, 'erdgeschoss'],
  [/wg-zimmer|wg zimmer|wohngemeinschaft/i, 'wg_zimmer'],
  [/doppelhaushälfte|dhh\b/i, 'doppelhaushaelfte'],
  [/reihenendhaus/i, 'reihenendhaus'],
  [/reihenhaus|reihenmittelhaus/i, 'reihenhaus'],
  [/mehrfamilienhaus/i, 'mehrfamilienhaus'],
  [/einfamilienhaus|efh\b/i, 'einfamilienhaus'],
  [/bungalow/i, 'bungalow'],
  [/villa\b/i, 'villa'],
  [/chalet/i, 'chalet'],
  [/bauernhaus|resthof/i, 'bauernhaus'],
  [/fachwerkhaus/i, 'fachwerkhaus'],
  [/landhaus/i, 'landhaus'],
  [/stadthaus/i, 'stadthaus'],
  [/ferienhaus/i, 'ferienhaus'],
  [/baugrundstück|bauplatz|baugrund/i, 'baugrund_wohnen'],
  [/gewerbegrundstück/i, 'grund_gewerbe'],
  [/waldgrundstück/i, 'wald'],
  [/ladenlokal|verkaufsfläche/i, 'ladenlokal'],
  [/praxis/i, 'praxis'],
  [/büro/i, 'buero'],
  [/lagerhalle|halle\b/i, 'lagerhalle'],
  [/gastronomie|restaurant|café/i, 'cafe_restaurant'],
  [/apartment|appartement/i, 'apartment'],
  [/1-zimmer|einzimmer|studio\b/i, 'studio'],
  [/etagenwohnung|wohnung/i, 'wohnung'],
]

export function parseListingText(input: string): Extracted {
  const text = input.replace(/\r/g, '')
  const flat = text.replace(/\s+/g, ' ')
  const out: Extracted = {}

  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 8 && l.length < 140 && !/^(https?:|www\.)/i.test(l))
  if (firstLine) out.title = { value: firstLine, evidence: firstLine }

  const purchase = find(flat, [lbl('Kaufpreis'), lbl('Preis')].slice(0, /kaufpreis|zu verkaufen|kaufen/i.test(flat) ? 2 : 1))
  const cold = find(flat, [lbl('Kaltmiete|Nettokaltmiete|Nettomiete|Miete \\(kalt\\)|Mietzins netto')])
  const warm = find(flat, [lbl('Warmmiete|Gesamtmiete|Bruttomiete|Miete inkl\\. NK|Mietzins brutto')])
  const nk = find(flat, [lbl('Nebenkosten|Betriebskosten')])
  if (purchase) out.purchasePrice = purchase
  if (cold) out.coldRent = cold
  if (warm) out.warmRent = warm
  if (nk) out.serviceCharges = nk

  const living = find(flat, [
    new RegExp(String.raw`(?:Wohnfläche|Wohnfl\.|Nutzfläche|Fläche)\s*(?:ca\.\s*)?[:\-–]?\s*(?:ca\.\s*)?${NUM}\s*(?:m²|m2|qm)`, 'i'),
    new RegExp(String.raw`${NUM}\s*(?:m²|m2|qm)\s*Wohnfläche`, 'i'),
  ])
  const plot = find(flat, [
    new RegExp(String.raw`(?:Grundstücksfläche|Grundstück|Grundfläche)\s*(?:ca\.\s*)?[:\-–]?\s*(?:ca\.\s*)?${NUM}\s*(?:m²|m2|qm)`, 'i'),
    new RegExp(String.raw`${NUM}\s*(?:m²|m2|qm)\s*Grundstück`, 'i'),
  ])
  if (living) out.livingArea = living
  if (plot) out.plotArea = plot
  // Ohne Beschriftung: erste m²-Angabe als Wohnfläche nur, wenn keine Grundstücksfläche danebensteht
  if (!living) {
    const any = flat.match(new RegExp(String.raw`${NUM}\s*(?:m²|m2|qm)`, 'i'))
    if (any && !/grund/i.test(flat.slice(Math.max(0, (any.index ?? 0) - 25), (any.index ?? 0) + any[0].length + 15))) {
      const v = parseNumber(any[1])
      if (v !== null && v >= 8 && v <= 2000) out.livingArea = { value: v, evidence: `${any[0]} (ohne Beschriftung)` }
    }
  }

  const rooms = find(flat, [new RegExp(String.raw`${NUM}\s*(?:Zimmer|Zi\.|-Zimmer)`, 'i'), new RegExp(String.raw`(?:Zimmeranzahl|Zimmer|Zi\.)\s*[:\-–]\s*${NUM}`, 'i')])
  if (rooms && rooms.value > 0 && rooms.value < 60) out.rooms = rooms
  const beds = find(flat, [new RegExp(String.raw`Schlafzimmer\s*[:\-–]?\s*${NUM}`, 'i'), new RegExp(String.raw`${NUM}\s*Schlafzimmer`, 'i')])
  if (beds) out.bedrooms = beds

  out.currency = /CHF|Fr\.\s*\d/.test(flat) ? { value: 'CHF', evidence: 'CHF im Text' } : { value: 'EUR', evidence: 'Standard (kein CHF im Text)' }

  if (out.purchasePrice && !out.coldRent && !out.warmRent) out.transaction = { value: 'kauf', evidence: out.purchasePrice.evidence }
  else if (out.coldRent || out.warmRent) out.transaction = { value: 'miete', evidence: (out.coldRent ?? out.warmRent)!.evidence }
  else if (/\bpacht\b/i.test(flat)) out.transaction = { value: 'pacht', evidence: 'Pacht' }

  for (const [re, id] of CATEGORY_WORDS) {
    const m = flat.match(re)
    if (m && CATEGORIES.some((c) => c.id === id)) {
      out.category = { value: id, evidence: m[0] }
      break
    }
  }

  // Adresse zeilenweise: Zeile mit PLZ (DE 5-stellig, AT/CH 4-stellig) und Ort, davor ggf. Straße mit Hausnummer
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const STREET = /^[A-ZÄÖÜ][\wäöüß.\- ]{2,50}\s\d{1,4}\s?[a-z]?$/
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:(.+?),\s*)?(\d{5}|\d{4})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{1,40})$/)
    if (!m) continue
    const street = m[1] ?? (i > 0 && STREET.test(lines[i - 1]) ? lines[i - 1] : null)
    const value = [street, `${m[2]} ${m[3].trim()}`].filter(Boolean).join(', ')
    out.address = { value, evidence: street && !m[1] ? `${lines[i - 1]} / ${lines[i]}` : lines[i] }
    break
  }
  if (!out.address) {
    const street = flat.match(/([A-ZÄÖÜ][\wäöüß.\-]{2,40}(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm|ufer|kai|chaussee|steig))\s*(\d{1,4}\s?[a-z]?)?/i)
    if (street) out.address = { value: `${street[1]}${street[2] ? ` ${street[2].trim()}` : ''}`, evidence: street[0] }
  }

  const date = flat.match(/(?:online seit|veröffentlicht(?: am)?|eingestellt am|inseriert am)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i)
  if (date) {
    const [d, mo, y] = date[1].split('.')
    const year = y.length === 2 ? `20${y}` : y
    out.publishedAt = { value: `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, evidence: date[0] }
  }

  const descStart = text.search(/beschreibung|objektbeschreibung/i)
  if (descStart >= 0) {
    const desc = text.slice(descStart).split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 800)
    if (desc.length > 30) out.description = { value: desc, evidence: 'Abschnitt „Beschreibung“' }
  }
  return out
}

/** Welche wichtigen Angaben fehlen noch? (freundliche Erklärung, Abschnitt 4.2) */
export function missingFields(e: Extracted): string[] {
  const miss: string[] = []
  if (!e.transaction) miss.push('Miete oder Kauf')
  if (!e.purchasePrice && !e.coldRent && !e.warmRent) miss.push('Preis')
  if (!e.livingArea && e.category?.value !== 'baugrund_wohnen') miss.push('Wohnfläche')
  if (!e.rooms && !['baugrund_wohnen', 'wald', 'landwirtschaft'].includes(e.category?.value ?? '')) miss.push('Zimmerzahl')
  if (!e.address) miss.push('Adresse oder Lage')
  if (!e.category) miss.push('Immobilienart')
  return miss
}
