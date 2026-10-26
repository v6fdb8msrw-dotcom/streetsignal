import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { date, dateTime, dist } from '../components/format.ts'
import { useLatestReports, usePlaces, useProperties } from '../lib/data.ts'
import { href, navigate } from '../lib/router.ts'
import { analyze, diffReports, type EnvReport } from '../services/environment.ts'
import { DATA_SOURCES } from '../sources/registry.ts'
import { deletePlace, reportsFor, saveReport } from '../store/db.ts'
import { useUi } from '../store/ui.ts'

interface Target {
  id: string
  label: string
  lat: number
  lng: number
  kind: 'Immobilie' | 'Ort'
}

function Changes({ report, target }: { report: EnvReport; target: Target }) {
  const plans = report.planning.data?.plans ?? []
  const sites = (report.pois.data?.pois ?? []).filter((p) => p.category === 'baustelle' && p.distanceM <= report.radius)
  const papers = (report.council.data?.papers ?? []).filter((p) => p.match)
  return (
    <div className="dev-cols">
      <div>
        <h4>Bebauungspläne</h4>
        {report.planning.data?.covered ? (
          plans.length ? (
            <ul>{plans.map((p) => <li key={p.name}><span className={`badge st-${p.status.replace(/\s/g, '-')}`}>{p.status}</span> {p.name.split(' – ')[0]} <small>{date(p.date)}</small></li>)}</ul>
          ) : <p className="muted small">keiner am Punkt</p>
        ) : (
          <p className="muted small">nicht angebunden · <a href={report.planning.data?.portal?.url} target="_blank" rel="noopener noreferrer">{report.planning.data?.portal?.label}</a></p>
        )}
      </div>
      <div>
        <h4>Baustellen (OSM, {dist(report.radius)})</h4>
        {sites.length ? <ul>{sites.slice(0, 5).map((s) => <li key={s.id}>{s.name ?? 'Baustelle'} <small>{dist(s.distanceM)}</small></li>)}</ul> : <p className="muted small">keine eingetragen</p>}
      </div>
      <div>
        <h4>Ratsvorlagen mit Bezug</h4>
        {report.council.data?.available ? (
          papers.length ? <ul>{papers.slice(0, 5).map((p) => <li key={p.id}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a> <small>{date(p.date)}</small></li>)}</ul> : <p className="muted small">keine mit Straßen- oder Planungsbezug</p>
        ) : <p className="muted small">{report.council.data?.note ?? 'nicht abrufbar'}</p>}
      </div>
      <button className="btn ghost small" onClick={() => navigate({ page: 'umgebung', lat: target.lat, lng: target.lng, label: target.label, target: target.kind === 'Immobilie' ? target.id : undefined })}>
        Ganze Analyse öffnen
      </button>
    </div>
  )
}

export function Developments() {
  const props = useProperties()
  const places = usePlaces()
  const bump = useUi((s) => s.bump)
  const targets: Target[] = [
    ...(props ?? []).filter((p) => p.location).map((p) => ({ id: p.id, label: p.title.value ?? 'Immobilie', lat: p.location!.lat, lng: p.location!.lng, kind: 'Immobilie' as const })),
    ...places.map((p) => ({ id: p.id, label: p.label, lat: p.lat, lng: p.lng, kind: 'Ort' as const })),
  ]
  const reports = useLatestReports(targets.map((t) => t.id))
  const [busy, setBusy] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<Record<string, string[]>>({})
  const autobahn = DATA_SOURCES.find((s) => s.id === 'autobahn')!

  const refresh = async (t: Target) => {
    setBusy(t.id)
    const prev = (await reportsFor(t.id))[0] ?? null
    const r = await analyze(t.id, t.lat, t.lng, prev?.radius ?? 500)
    await saveReport(r)
    setDiffs((d) => ({ ...d, [t.id]: prev ? diffReports(r, prev) : [] }))
    setBusy(null)
    bump()
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Neue Entwicklungen</p>
        <h1>Was sich rund um deine Orte tut</h1>
        <p className="lead">Für jede gespeicherte Immobilie und jeden gemerkten Ort: Planungen, Baustellen und Ratsvorlagen. Aktualisiert wird nur auf deinen Klick; jede Prüfung wird gespeichert, damit Änderungen sichtbar werden.</p>
      </header>
      {targets.length === 0 ? (
        <div className="empty-state">
          <p>Noch nichts gemerkt. Speichere eine Immobilie oder merke dir in „Umgebung erkunden“ einen Ort.</p>
          <a className="btn primary" href={href({ page: 'umgebung' })}>Umgebung erkunden</a>
        </div>
      ) : (
        <div className="dev-list">
          {targets.map((t) => {
            const r = reports.get(t.id)
            return (
              <article key={t.id} className="card pad dev">
                <header className="row-between">
                  <div>
                    <span className="kicker">{t.kind}</span>
                    <h3>{t.label}</h3>
                    <p className="muted small">{r ? `Letzte Prüfung ${dateTime(r.createdAt)}` : 'Noch nicht geprüft'}</p>
                  </div>
                  <div className="row">
                    <button className="btn soft small" onClick={() => refresh(t)} disabled={busy === t.id}>
                      {busy === t.id ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Jetzt prüfen
                    </button>
                    {t.kind === 'Ort' && <button className="btn ghost small" onClick={async () => { await deletePlace(t.id); bump() }}>Entfernen</button>}
                  </div>
                </header>
                {diffs[t.id] && (
                  <p className="notice soft">{diffs[t.id].length ? `Seit der letzten Prüfung: ${diffs[t.id].join(' · ')}` : 'Keine Änderungen seit der letzten Prüfung.'}</p>
                )}
                {r && <Changes report={r} target={t} />}
              </article>
            )
          })}
        </div>
      )}
      <p className="fine">
        Autobahn-Baustellen: <a href={autobahn.url} target="_blank" rel="noopener noreferrer">Baustellenkarte der Autobahn GmbH <ExternalLink size={11} /></a> (verlinkt, weil für die Schnittstelle keine Lizenz veröffentlicht ist). Automatische Beobachtung ist vorbereitet, aber nur für Quellen vorgesehen, deren wiederholter Abruf ausdrücklich erlaubt ist.
      </p>
    </div>
  )
}
