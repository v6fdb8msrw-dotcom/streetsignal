// Herkunft jeder Angabe (Vorgabe Punkt 14). Nichts wird ohne Herkunft angezeigt.
export type Provenance =
  | 'source' // aus der Quelle bestätigt
  | 'user' // vom Nutzer eingegeben
  | 'extracted' // automatisch extrahiert, noch nicht bestätigt
  | 'ai_guess' // KI-gestützte Vermutung
  | 'unavailable' // nicht verfügbar

export interface Fact<T> {
  value: T | null
  provenance: Provenance
  /** Woher genau, z. B. „OpenStreetMap“, „Exposé-Text“, „Bildanalyse“ */
  basis?: string
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  source: 'aus der Quelle bestätigt',
  user: 'vom Nutzer eingegeben',
  extracted: 'automatisch extrahiert, unbestätigt',
  ai_guess: 'KI-Vermutung, unsicher',
  unavailable: 'nicht verfügbar',
}

export const PROVENANCE_SHORT: Record<Provenance, string> = {
  source: 'Quelle',
  user: 'eigene Angabe',
  extracted: 'extrahiert',
  ai_guess: 'unsicher',
  unavailable: 'unbekannt',
}

/** Angaben, die als belastbar gelten. Extrahiertes und Vermutetes nur, wenn der Nutzer es zulässt. */
export function isReliable(p: Provenance, allowUncertain: boolean): boolean {
  if (p === 'source' || p === 'user') return true
  if (p === 'extracted' || p === 'ai_guess') return allowUncertain
  return false
}

export const unknown = <T>(): Fact<T> => ({ value: null, provenance: 'unavailable' })
export const fromSource = <T>(value: T, basis?: string): Fact<T> => ({ value, provenance: 'source', basis })
export const guessed = <T>(value: T, basis = 'Bildanalyse'): Fact<T> => ({ value, provenance: 'ai_guess', basis })
export const extracted = <T>(value: T, basis = 'Exposé-Text'): Fact<T> => ({ value, provenance: 'extracted', basis })
