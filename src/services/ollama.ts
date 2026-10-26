// Optionales lokales KI-Modell über Ollama (Master-Prompt Abschnitt 10). Ohne Ollama läuft alles weiter.
import type { EnvReport } from './environment.ts'
import { ruleSummary } from './environment.ts'

const BASE = 'http://localhost:11434'

export interface OllamaStatus {
  available: boolean
  models: string[]
}

export async function ollamaStatus(): Promise<OllamaStatus> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(`${BASE}/api/tags`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return { available: false, models: [] }
    const data = (await res.json()) as { models?: { name: string }[] }
    return { available: true, models: (data.models ?? []).map((m) => m.name) }
  } catch {
    return { available: false, models: [] }
  }
}

/** Fasst ausschließlich die belegten Fakten zusammen; das Modell bekommt keine anderen Informationen. */
export async function summarizeWithOllama(model: string, report: EnvReport): Promise<string> {
  const { facts, hints, gaps } = ruleSummary(report)
  const prompt = [
    'Du fasst Umgebungsdaten einer Adresse für Wohnungssuchende auf Deutsch zusammen.',
    'Regeln: Nutze NUR die folgenden Fakten. Erfinde nichts. Keine Bewertung des Viertels, die nicht aus den Fakten folgt.',
    'Nenne fehlende Daten ausdrücklich. Höchstens 6 Sätze.',
    '',
    'Fakten:',
    ...facts.map((f) => `- ${f}`),
    'Einordnungen:',
    ...hints.map((h) => `- ${h}`),
    'Fehlende Daten:',
    ...gaps.map((g) => `- ${g}`),
  ].join('\n')
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.2 } }),
  })
  if (!res.ok) throw new Error(`Ollama antwortet mit ${res.status}`)
  return ((await res.json()) as { response: string }).response.trim()
}
