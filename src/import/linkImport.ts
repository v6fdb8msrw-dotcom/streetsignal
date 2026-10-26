// Linkimport im Browser: erkennt das Portal und fragt den lokalen Server, ob ein Abruf zulässig ist.
import { portalForUrl, type Portal } from '../sources/registry.ts'
import { parseListingText, type Extracted } from './parseText.ts'

export type LinkImportResult =
  | { mode: 'manual-link'; portal: Portal }
  | { mode: 'not-permitted'; host: string }
  | { mode: 'robots-disallowed'; host: string }
  | { mode: 'no-server' }
  | { mode: 'error'; message: string }
  | { mode: 'fetched'; finalUrl: string; extracted: Extracted; fetchedAt: string }

interface ServerFields {
  title?: { value: string; evidence: string }
  description?: { value: string; evidence: string }
  price?: { value: number; evidence: string }
  currency?: { value: string; evidence: string }
  livingArea?: { value: number; evidence: string }
  rooms?: { value: number; evidence: string }
  bedrooms?: { value: number; evidence: string }
  address?: { value: string; evidence: string }
  publishedAt?: { value: string; evidence: string }
}

export async function importLink(url: string, permittedHosts: string[]): Promise<LinkImportResult> {
  const portal = portalForUrl(url)
  if (portal && portal.policy === 'manual-link') return { mode: 'manual-link', portal }
  let res: Response
  try {
    res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, permittedHosts }) })
  } catch {
    return { mode: 'no-server' }
  }
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return { mode: 'no-server' }
  const data = (await res.json()) as { mode: string; host?: string; message?: string; finalUrl?: string; fields?: ServerFields; text?: string; fetchedAt?: string }
  if (data.mode === 'not-permitted' || data.mode === 'robots-disallowed') return { mode: data.mode, host: data.host ?? '' }
  if (data.mode === 'manual-link') return { mode: 'manual-link', portal: portal! }
  if (data.mode !== 'fetched') return { mode: 'error', message: data.message ?? 'Abruf fehlgeschlagen.' }
  // Strukturierte Angaben haben Vorrang vor der Texterkennung
  const fromText = parseListingText(data.text ?? '')
  const f = data.fields ?? {}
  const extracted: Extracted = { ...fromText }
  if (f.title) extracted.title = f.title
  if (f.description) extracted.description = f.description
  if (f.livingArea) extracted.livingArea = f.livingArea
  if (f.rooms) extracted.rooms = f.rooms
  if (f.bedrooms) extracted.bedrooms = f.bedrooms
  if (f.address) extracted.address = f.address
  if (f.publishedAt) extracted.publishedAt = { value: f.publishedAt.value.slice(0, 10), evidence: f.publishedAt.evidence }
  if (f.currency && (f.currency.value === 'EUR' || f.currency.value === 'CHF')) extracted.currency = { value: f.currency.value, evidence: f.currency.evidence }
  if (f.price) {
    if (extracted.transaction?.value === 'miete') extracted.coldRent ??= f.price
    else extracted.purchasePrice ??= f.price
  }
  return { mode: 'fetched', finalUrl: data.finalUrl ?? url, extracted, fetchedAt: data.fetchedAt ?? new Date().toISOString() }
}
