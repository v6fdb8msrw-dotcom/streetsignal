// Kommunale Vorlagen aus Ratsinformationssystemen (OParl). Vorlagen sind nicht georeferenziert:
// StreetSignal zeigt die neuesten Vorlagen der Kommune und hebt solche mit Bezug zu Straße oder Planung hervor.
import { cached } from '../store/db.ts'
import { fetchJson } from './http.ts'

interface Endpoint {
  title: string
  url: string
  system?: { body?: string } | null
}

export interface CouncilPaper {
  id: string
  name: string
  reference: string | null
  date: string | null
  type: string | null
  url: string
  /** Warum die Vorlage relevant sein könnte */
  match: 'Straße' | 'Planung' | null
}

export interface CouncilResult {
  available: boolean
  system: string | null
  papers: CouncilPaper[]
  note: string
  fetchedAt: string
}

const DAY = 24 * 3600 * 1000

export async function oparlDirectory(): Promise<Endpoint[]> {
  return cached('oparl:directory', 7 * DAY, async () => {
    const all: Endpoint[] = []
    for (let page = 1; page <= 10; page++) {
      const res = await fetchJson<{ data: Endpoint[]; meta?: { totalPages?: number } }>('oparl', `https://dev.oparl.org/api/endpoints?page=${page}`)
      all.push(...res.data)
      if (!res.meta?.totalPages || page >= res.meta.totalPages) break
    }
    return all
  })
}

/** Passt ein Verzeichniseintrag zur Stadt? „Stadt Köln“, „München Transparent“ … */
export function matchEndpoint(endpoints: Endpoint[], city: string): Endpoint | null {
  const c = city.toLowerCase().replace(/\s*\(.*\)/, '').trim()
  return (
    endpoints.find((e) => {
      const t = e.title.toLowerCase()
      // Nur eindeutige Treffer: keine Bezirke oder Nachbargemeinden mit ähnlichem Namen
      return [c, `stadt ${c}`, `gemeinde ${c}`, `landeshauptstadt ${c}`, `${c} transparent`, `hansestadt ${c}`].includes(t)
    }) ?? null
  )
}

const PLANNING_WORDS = /bebauungsplan|b-plan|flächennutzungsplan|bauvorhaben|neubau|bauleitplan|städtebau|sanierung|verkehrsplanung|radweg|straßenbau/i

interface OParlPaper {
  id: string
  name?: string
  reference?: string
  date?: string
  paperType?: string
  web?: string
}

export async function fetchCouncil(city: string | null, street: string | null): Promise<CouncilResult> {
  const now = new Date().toISOString()
  if (!city) return { available: false, system: null, papers: [], note: 'Ort unbekannt.', fetchedAt: now }
  const ep = matchEndpoint(await oparlDirectory(), city)
  if (!ep) return { available: false, system: null, papers: [], note: `Für ${city} ist im OParl-Verzeichnis kein Ratsinformationssystem eingetragen.`, fetchedAt: now }
  return cached(`oparl:papers:${ep.url}:${street ?? ''}`, 12 * 3600 * 1000, async () => {
    const bodiesUrl = ep.system?.body ?? `${ep.url.replace(/\/system$/, '')}/bodies`
    const bodies = await fetchJson<{ data?: { paper?: string; name?: string }[] } & { paper?: string }>('oparl', bodiesUrl)
    const body = bodies.data?.[0] ?? bodies
    if (!body.paper) return { available: false, system: ep.title, papers: [], note: 'Das System stellt keine Vorlagen bereit.', fetchedAt: now }
    // Zwei Seiten (meist die neuesten 50 Vorlagen); mehr würde den Dienst unnötig belasten
    const first = await fetchJson<{ data: OParlPaper[]; links?: { next?: string } }>('oparl', body.paper)
    const raw = [...first.data]
    if (first.links?.next) raw.push(...(await fetchJson<{ data: OParlPaper[] }>('oparl', first.links.next)).data)
    const streetWord = street?.replace(/(straße|strasse|str\.)$/i, '').trim().toLowerCase()
    const papers: CouncilPaper[] = raw.filter((p) => p.name).map((p) => {
      const name = p.name ?? 'Vorlage'
      const match = streetWord && name.toLowerCase().includes(streetWord) ? 'Straße' : PLANNING_WORDS.test(name) ? 'Planung' : null
      return { id: p.id, name, reference: p.reference ?? null, date: p.date ?? null, type: p.paperType ?? null, url: p.web ?? p.id, match }
    })
    papers.sort((a, b) => Number(!!b.match) - Number(!!a.match) || (b.date ?? '').localeCompare(a.date ?? ''))
    return {
      available: true,
      system: ep.title,
      papers: papers.slice(0, 12),
      note: 'Die Vorlagen sind nicht verortet. Hervorgehoben sind Vorlagen, die deine Straße oder Planungsbegriffe im Titel nennen.',
      fetchedAt: now,
    }
  })
}
