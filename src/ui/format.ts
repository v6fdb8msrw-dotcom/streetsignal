import type { Fact } from '../model/provenance.ts'

export function money(v: number | null, currency: string, digits = 0): string {
  if (v === null) return 'k. A.'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: digits }).format(v)
}

export function area(f: Fact<number> | number | null): string {
  const v = typeof f === 'number' || f === null ? f : f.value
  if (v === null) return 'k. A.'
  return `${v.toLocaleString('de-DE')} m²`
}

export function num(v: number | null): string {
  return v === null ? 'k. A.' : v.toLocaleString('de-DE')
}

/** Eingabefeld → Zahl oder null */
export function parseNum(s: string): number | null {
  const t = s.replace(/\./g, '').replace(',', '.').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
