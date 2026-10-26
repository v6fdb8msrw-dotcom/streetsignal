// Kleiner Hash-Router: funktioniert lokal und auf GitHub Pages ohne Serverkonfiguration.
import { useEffect, useState } from 'react'

export type Route =
  | { page: 'start' }
  | { page: 'uebersicht' }
  | { page: 'umgebung'; lat?: number; lng?: number; label?: string; target?: string }
  | { page: 'hinzufuegen' }
  | { page: 'meine' }
  | { page: 'vergleich' }
  | { page: 'entwicklungen' }
  | { page: 'quellen' }

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const q = new URLSearchParams(query)
  switch (path) {
    case 'uebersicht':
    case 'hinzufuegen':
    case 'meine':
    case 'vergleich':
    case 'entwicklungen':
    case 'quellen':
      return { page: path }
    case 'umgebung': {
      const lat = q.get('lat')
      const lng = q.get('lng')
      return {
        page: 'umgebung',
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        label: q.get('label') ?? undefined,
        target: q.get('target') ?? undefined,
      }
    }
    default:
      return { page: 'start' }
  }
}

export function href(r: Route): string {
  if (r.page === 'start') return '#/'
  if (r.page === 'umgebung' && r.lat !== undefined && r.lng !== undefined) {
    const q = new URLSearchParams({ lat: r.lat.toFixed(6), lng: r.lng.toFixed(6) })
    if (r.label) q.set('label', r.label)
    if (r.target) q.set('target', r.target)
    return `#/umgebung?${q}`
  }
  return `#/${r.page}`
}

export function navigate(r: Route) {
  window.location.hash = href(r)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
