// Kategorien als typisierte, erweiterbare Registries (Vorgabe Punkte 3–6, 15).
// Neue Immobilienarten: einen Eintrag in CATEGORIES anhängen, sonst nichts ändern.

export type Purpose = 'wohnen' | 'gewerbe' | 'grundstueck' | 'kapitalanlage'
export type Transaction = 'miete' | 'kauf' | 'pacht'
export type Country = 'DE' | 'AT' | 'CH'
export type Currency = 'EUR' | 'CHF'

export interface PurposeDef {
  id: Purpose
  label: string
  description: string
}

export const PURPOSES: PurposeDef[] = [
  { id: 'wohnen', label: 'Wohnen', description: 'Hauptwohnsitz, Zweitwohnsitz oder Ferienimmobilie' },
  { id: 'gewerbe', label: 'Gewerbe', description: 'Büro, Praxis, Laden, Gastronomie, Halle …' },
  { id: 'grundstueck', label: 'Grundstück', description: 'Kaufen oder pachten' },
  { id: 'kapitalanlage', label: 'Kapitalanlage', description: 'Zur Vermietung oder als Investition' },
]

export interface TransactionDef {
  id: Transaction
  label: string
  /** Für welche Zwecke die Transaktion fachlich sinnvoll ist */
  purposes: Purpose[]
}

export const TRANSACTIONS: TransactionDef[] = [
  { id: 'miete', label: 'Mieten', purposes: ['wohnen', 'gewerbe'] },
  { id: 'kauf', label: 'Kaufen', purposes: ['wohnen', 'gewerbe', 'grundstueck', 'kapitalanlage'] },
  { id: 'pacht', label: 'Pachten', purposes: ['gewerbe', 'grundstueck'] },
]

export type CategoryGroup = 'wohnung' | 'haus' | 'grundstueck' | 'gewerbe' | 'sonder'

export const CATEGORY_GROUPS: { id: CategoryGroup; label: string }[] = [
  { id: 'wohnung', label: 'Wohnungen' },
  { id: 'haus', label: 'Häuser' },
  { id: 'grundstueck', label: 'Grundstücke' },
  { id: 'gewerbe', label: 'Gewerbeimmobilien' },
  { id: 'sonder', label: 'Sonderimmobilien' },
]

export interface CategoryDef {
  id: string
  label: string
  group: CategoryGroup
  purposes: Purpose[]
  transactions: Transaction[]
  /** Hinweis, unter welcher Bedingung die Kategorie vergeben werden darf */
  condition?: string
}

const W: Purpose[] = ['wohnen', 'kapitalanlage']
const MK: Transaction[] = ['miete', 'kauf']
const G: Purpose[] = ['gewerbe', 'kapitalanlage']
const GT: Transaction[] = ['miete', 'kauf', 'pacht']
const P: Purpose[] = ['grundstueck', 'kapitalanlage']
const KP: Transaction[] = ['kauf', 'pacht']

export const CATEGORIES: CategoryDef[] = [
  // A. Wohnungen
  { id: 'wohnung', label: 'Klassische Wohnung', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'penthouse', label: 'Penthouse', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'loft', label: 'Loft', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'maisonette', label: 'Maisonette', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'dachgeschoss', label: 'Dachgeschosswohnung', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'erdgeschoss', label: 'Erdgeschosswohnung', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'studio', label: 'Studio / 1-Zimmer-Wohnung', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'apartment', label: 'Apartment', group: 'wohnung', purposes: W, transactions: MK },
  { id: 'barrierefrei_whg', label: 'Barrierearme/-freie Wohnung', group: 'wohnung', purposes: W, transactions: MK, condition: 'nur wenn im Inserat angegeben' },
  { id: 'studentenwohnung', label: 'Studentenwohnung', group: 'wohnung', purposes: ['wohnen'], transactions: ['miete'] },
  { id: 'wg_zimmer', label: 'WG-Zimmer', group: 'wohnung', purposes: ['wohnen'], transactions: ['miete'] },
  { id: 'moebliert_apt', label: 'Möbliertes Apartment', group: 'wohnung', purposes: ['wohnen'], transactions: ['miete'], condition: 'nur wenn im Inserat angegeben' },
  // B. Häuser
  { id: 'einfamilienhaus', label: 'Einfamilienhaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'doppelhaushaelfte', label: 'Doppelhaushälfte', group: 'haus', purposes: W, transactions: MK },
  { id: 'reihenhaus', label: 'Reihenhaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'reihenendhaus', label: 'Reihenendhaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'mehrfamilienhaus', label: 'Mehrfamilienhaus', group: 'haus', purposes: W, transactions: ['kauf'] },
  { id: 'freistehend', label: 'Freistehendes Haus', group: 'haus', purposes: W, transactions: MK },
  { id: 'stadthaus', label: 'Stadthaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'landhaus', label: 'Landhaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'bauernhaus', label: 'Bauernhaus / Hof', group: 'haus', purposes: W, transactions: MK },
  { id: 'villa', label: 'Villa', group: 'haus', purposes: W, transactions: MK },
  { id: 'bungalow', label: 'Bungalow', group: 'haus', purposes: W, transactions: MK },
  { id: 'fachwerkhaus', label: 'Fachwerkhaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'historisch', label: 'Historisches Gebäude', group: 'haus', purposes: W, transactions: MK, condition: 'nur wenn die Quelle es bestätigt' },
  { id: 'ferienhaus', label: 'Ferienhaus', group: 'haus', purposes: W, transactions: MK },
  { id: 'chalet', label: 'Alpenchalet', group: 'haus', purposes: W, transactions: MK },
  // C. Grundstücke
  { id: 'baugrund_wohnen', label: 'Baugrundstück Wohnen', group: 'grundstueck', purposes: P, transactions: KP, condition: 'Bebaubarkeit nur, wenn eine verlässliche Quelle sie angibt' },
  { id: 'grund_gewerbe', label: 'Grundstück für Gewerbe', group: 'grundstueck', purposes: ['grundstueck', 'gewerbe'], transactions: KP },
  { id: 'grund_gemischt', label: 'Gemischt nutzbares Grundstück', group: 'grundstueck', purposes: P, transactions: KP },
  { id: 'grund_ferienhaus', label: 'Ferienhausgrundstück', group: 'grundstueck', purposes: P, transactions: KP },
  { id: 'landwirtschaft', label: 'Landwirtschaftliche Fläche', group: 'grundstueck', purposes: P, transactions: KP },
  { id: 'wald', label: 'Waldgrundstück', group: 'grundstueck', purposes: P, transactions: KP },
  { id: 'grund_sonstig', label: 'Sonstiges Grundstück', group: 'grundstueck', purposes: P, transactions: KP },
  // D. Gewerbe
  { id: 'ladenlokal', label: 'Ladenlokal / Verkaufsfläche', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'einzelhandel', label: 'Einzelhandelsfläche', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'buero', label: 'Büro', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'praxis', label: 'Praxis', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'gastronomie', label: 'Gastronomiefläche', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'cafe_restaurant', label: 'Café / Restaurant', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'lagerhalle', label: 'Lagerhalle', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'logistik', label: 'Logistikfläche', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'werkstatt', label: 'Werkstatt', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'produktion', label: 'Produktionsfläche', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'coworking', label: 'Coworking-Fläche', group: 'gewerbe', purposes: ['gewerbe'], transactions: ['miete'], condition: 'nur wenn als Immobilie angeboten' },
  { id: 'gewerbe_sonstig', label: 'Sonstige Gewerberäume', group: 'gewerbe', purposes: G, transactions: GT },
  { id: 'gemischt', label: 'Gemischt genutzte Immobilie', group: 'gewerbe', purposes: ['gewerbe', 'wohnen', 'kapitalanlage'], transactions: MK },
  // E. Sonderimmobilien
  { id: 'ferienimmobilie', label: 'Ferienimmobilie', group: 'sonder', purposes: W, transactions: MK },
  { id: 'hotel', label: 'Hotel / Pension', group: 'sonder', purposes: G, transactions: GT },
  { id: 'mehrzweck', label: 'Mehrzweckimmobilie', group: 'sonder', purposes: G, transactions: GT },
  { id: 'wohn_geschaeftshaus', label: 'Wohn- und Geschäftshaus', group: 'sonder', purposes: ['wohnen', 'gewerbe', 'kapitalanlage'], transactions: ['kauf'] },
  { id: 'betreutes_wohnen', label: 'Betreutes Wohnen', group: 'sonder', purposes: ['wohnen'], transactions: MK, condition: 'nur wenn ausgewiesen' },
  { id: 'sonder_sonstig', label: 'Sonstige Sonderimmobilie', group: 'sonder', purposes: ['wohnen', 'gewerbe', 'kapitalanlage'], transactions: GT },
]

const CATEGORY_INDEX = new Map(CATEGORIES.map((c) => [c.id, c]))

export function category(id: string): CategoryDef | undefined {
  return CATEGORY_INDEX.get(id)
}

/** Kategorien, die zu den gewählten Zwecken und Transaktionen passen (leer = alles). */
export function categoriesFor(purposes: Purpose[], transactions: Transaction[]): CategoryDef[] {
  return CATEGORIES.filter(
    (c) =>
      (purposes.length === 0 || c.purposes.some((p) => purposes.includes(p))) &&
      (transactions.length === 0 || c.transactions.some((t) => transactions.includes(t))),
  )
}

/** Sinnvolle Transaktionen für die gewählten Zwecke. */
export function transactionsFor(purposes: Purpose[]): TransactionDef[] {
  if (purposes.length === 0) return TRANSACTIONS
  return TRANSACTIONS.filter((t) => t.purposes.some((p) => purposes.includes(p)))
}

export const COUNTRIES: { id: Country; label: string; currency: Currency; regionWord: string }[] = [
  { id: 'DE', label: 'Deutschland', currency: 'EUR', regionWord: 'Bundesland' },
  { id: 'AT', label: 'Österreich', currency: 'EUR', regionWord: 'Bundesland' },
  { id: 'CH', label: 'Schweiz', currency: 'CHF', regionWord: 'Kanton' },
]

/** Bezeichnung der Transaktion je nach Gruppe, z. B. „Mietwohnung“, „Hauskauf“ (Punkt 4). */
export function dealLabel(group: CategoryGroup, t: Transaction): string {
  const table: Record<CategoryGroup, Record<Transaction, string>> = {
    wohnung: { miete: 'Mietwohnung', kauf: 'Eigentumswohnung', pacht: 'Pacht' },
    haus: { miete: 'Miethaus', kauf: 'Hauskauf', pacht: 'Pacht' },
    grundstueck: { miete: 'Miete', kauf: 'Grundstückskauf', pacht: 'Grundstückspacht' },
    gewerbe: { miete: 'Gewerbe mieten', kauf: 'Gewerbe kaufen', pacht: 'Gewerbe pachten' },
    sonder: { miete: 'Miete', kauf: 'Kauf', pacht: 'Pacht' },
  }
  return table[group][t]
}
