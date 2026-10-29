// Gemeinsame Abrufregeln für öffentliche Dienste: Zeitlimit, Mindestabstand je Host, klare Fehler.

const lastCall = new Map<string, number>()

/** Mindestabstand zwischen zwei Anfragen an denselben Host (faire Nutzung) */
const MIN_GAP_MS: Record<string, number> = {
  'photon.komoot.io': 1000,
  'overpass-api.de': 1500,
  'nominatim.openstreetmap.org': 1100,
}

async function waitTurn(host: string) {
  const gap = MIN_GAP_MS[host] ?? 0
  if (!gap) return
  const prev = lastCall.get(host) ?? 0
  const wait = prev + gap - Date.now()
  lastCall.set(host, Math.max(Date.now(), prev + gap))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

export class SourceError extends Error {
  readonly sourceId: string
  constructor(sourceId: string, message: string) {
    super(message)
    this.sourceId = sourceId
  }
}

export async function fetchWithLimits(sourceId: string, url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const host = new URL(url).hostname
  await waitTurn(host)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    if (!res.ok) throw new SourceError(sourceId, `Antwort ${res.status} von ${host}`)
    return res
  } catch (e) {
    if (e instanceof SourceError) throw e
    const msg = (e as Error).name === 'AbortError' ? `Zeitüberschreitung bei ${host}` : `${host} nicht erreichbar`
    throw new SourceError(sourceId, msg)
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchJson<T>(sourceId: string, url: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const res = await fetchWithLimits(sourceId, url, init, timeoutMs)
  try {
    return (await res.json()) as T
  } catch {
    throw new SourceError(sourceId, 'Antwort war kein gültiges JSON')
  }
}

export async function fetchText(sourceId: string, url: string, init?: RequestInit, timeoutMs?: number): Promise<string> {
  return (await fetchWithLimits(sourceId, url, init, timeoutMs)).text()
}
