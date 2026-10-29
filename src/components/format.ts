import { parseNumber } from '../import/parseText.ts'
export function money(v: number | null, currency: string, digits = 0): string {
  if (v === null) return 'unbekannt'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: digits }).format(v)
}

export function area(v: number | null): string {
  return v === null ? 'unbekannt' : `${v.toLocaleString('de-DE')} m²`
}

export function num(v: number | null): string {
  return v === null ? 'unbekannt' : v.toLocaleString('de-DE')
}

export function dist(m: number | null): string {
  if (m === null) return 'keine im Umkreis gefunden'
  return m >= 1000 ? `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`
}

export function date(iso: string | null | undefined): string {
  if (!iso) return 'unbekannt'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Eingabefeld → Zahl oder null (deutsche Schreibweise) */
/** Zahl aus einem Eingabefeld: 78,5 · 78.5 · 1.150 · 1'250'000 (gleiche Regeln wie die Texterkennung) */
export function parseInput(s: string): number | null {
  return parseNumber(s)
}
