import { Bot, Download, ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ollamaStatus, type OllamaStatus } from '../services/ollama.ts'
import { COMMON_CELLS, COUNTRY_NOTE, COVERAGE, TOPIC_LABEL, type CoverageTopic } from '../sources/coverage.ts'
import { DATA_SOURCES, PORTALS } from '../sources/registry.ts'
import { db, getSetting, listPlaces, listProperties, setSetting } from '../store/db.ts'
import { useUi } from '../store/ui.ts'

export function Sources() {
  const bump = useUi((s) => s.bump)
  const [hosts, setHosts] = useState<string[]>([])
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)
  const [country, setCountry] = useState<'DE' | 'AT' | 'CH'>('DE')
  useEffect(() => {
    getSetting<string[]>('permittedHosts', []).then(setHosts)
    ollamaStatus().then(setOllama)
  }, [])

  const exportAll = async () => {
    const data = { exportedAt: new Date().toISOString(), properties: await listProperties(), places: await listPlaces() }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'streetsignal-export.json'
    a.click()
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Datenquellen & Einstellungen</p>
        <h1>Woher jede Angabe kommt</h1>
        <p className="lead">StreetSignal nutzt nur kostenlose Quellen, deren Lizenz die Nutzung erlaubt. Geprüft bis 29.10.2026. Was ohne ausdrückliche Erlaubnis ist, wird nur verlinkt.</p>
      </header>

      <h2 className="section-title">Abdeckung je Region</h2>
      <div className="seg" role="tablist">
        {(['DE', 'AT', 'CH'] as const).map((c) => (
          <button key={c} role="tab" aria-selected={country === c} className={country === c ? 'on' : ''} onClick={() => setCountry(c)}>
            {c === 'DE' ? 'Deutschland' : c === 'AT' ? 'Österreich' : 'Schweiz'}
          </button>
        ))}
      </div>
      <p className="fine">{COUNTRY_NOTE[country]}</p>
      <div className="card table-wrap">
        <table className="sources coverage">
          <thead>
            <tr>
              <th>Region</th>
              {(Object.keys(TOPIC_LABEL) as CoverageTopic[]).map((k) => (
                <th key={k}>{TOPIC_LABEL[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COVERAGE.filter((r) => r.country === country).map((r) => (
              <tr key={r.region}>
                <td><b>{r.region}</b></td>
                {(Object.keys(TOPIC_LABEL) as CoverageTopic[]).map((k) => (
                  <td key={k} title={r.cells[k].note}>
                    <span className={`badge cov-${r.cells[k].level.replace(/\s/g, '-')}`}>{r.cells[k].level}</span>
                    {!COMMON_CELLS.has(r.cells[k]) && <small>{r.cells[k].note}</small>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">„direkt“ = Wert am Punkt aus einer frei lizenzierten Quelle. „teilweise“ = nur ein Teil der Gemeinden, nur Kartenebene oder grobe Übersicht. „Link“ = keine freie Nutzung erlaubt oder kein Dienst; StreetSignal verlinkt das amtliche Portal.</p>

      <h2 className="section-title">Alle Quellen</h2>

      <div className="card table-wrap">
        <table className="sources">
          <thead>
            <tr>
              <th>Quelle</th>
              <th>Status</th>
              <th>Zugriff</th>
              <th>Abdeckung</th>
              <th>Lizenz</th>
              <th>Datenstand</th>
              <th>Einschränkungen</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <b>{s.name}</b> <ExternalLink size={11} />
                  </a>
                  <small>{s.provider}</small>
                </td>
                <td><span className={`badge src-${s.status.replace(/\s/g, '-')}`}>{s.status}</span></td>
                <td>{s.access}</td>
                <td>{s.coverage}</td>
                <td>{s.licenseUrl ? <a href={s.licenseUrl} target="_blank" rel="noopener noreferrer">{s.license}</a> : s.license}</td>
                <td>{s.dataDate}</td>
                <td>{s.limits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Immobilienportale</h2>
      <p className="muted">Kein Portal wird automatisch ausgelesen. Links werden gespeichert, die Angaben übernimmst du per Text, Dokument oder Formular. Grundlage: keine kostenlose, ausdrücklich erlaubte Schnittstelle bekannt.</p>
      <div className="card table-wrap">
        <table className="sources">
          <thead>
            <tr><th>Portal</th><th>Land</th><th>Zugriff in StreetSignal</th><th>Hinweis</th></tr>
          </thead>
          <tbody>
            {PORTALS.map((p) => (
              <tr key={p.id}>
                <td><b>{p.name}</b><small>{p.domains.join(', ')}</small></td>
                <td>{p.country}</td>
                <td><span className="badge src-nur-Link">nur Link</span></td>
                <td>{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="settings-grid">
        <section className="card pad">
          <h3>Freigegebene Domains für den Linkabruf</h3>
          <p className="muted small">Nur diese Seiten ruft der lokale Import ab, und nur, wenn ihre robots.txt es erlaubt. Gib nur Seiten frei, deren Nutzungsbedingungen das zulassen.</p>
          {hosts.length === 0 ? <p className="muted small">Keine freigegeben.</p> : (
            <ul className="host-list">
              {hosts.map((h) => (
                <li key={h}>
                  {h}
                  <button className="icon" aria-label={`${h} entfernen`} onClick={async () => { const next = hosts.filter((x) => x !== h); await setSetting('permittedHosts', next); setHosts(next) }}><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card pad">
          <h3><Bot size={16} /> Lokale KI (optional)</h3>
          {ollama === null ? <p className="muted small">Prüfe …</p> : ollama.available ? (
            <p className="small">Ollama läuft. Modelle: {ollama.models.join(', ') || 'keins installiert'}. Zusammenfassungen nutzen nur die belegten Fakten.</p>
          ) : (
            <p className="muted small">Ollama läuft nicht. Das ist in Ordnung: StreetSignal fasst ohne KI regelbasiert zusammen. Wer möchte, installiert <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a> (kostenlos, lokal) und ein Modell, z. B. <code>ollama pull llama3.2</code>.</p>
          )}
        </section>
        <section className="card pad">
          <h3>Deine Daten</h3>
          <p className="muted small">Alles liegt nur in diesem Browser (IndexedDB). Kein Konto, kein Server.</p>
          <div className="row">
            <button className="btn soft small" onClick={exportAll}><Download size={14} /> Exportieren</button>
            <button
              className="btn ghost small danger"
              onClick={async () => {
                if (!confirm('Alle gespeicherten Immobilien, Orte, Berichte und Einstellungen in diesem Browser löschen?')) return
                const d = await db()
                for (const s of ['properties', 'reports', 'places', 'profiles', 'cache', 'settings'] as const) await d.clear(s)
                setHosts([])
                bump()
              }}
            >
              <Trash2 size={14} /> Alles löschen
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
