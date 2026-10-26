import { AlertCircle, Bot, Building, ExternalLink, FileText, Landmark, Loader2, MapPinned, Scale, Trees, Volume2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { diffReports, ruleSummary, summarizePois, type EnvReport } from '../services/environment.ts'
import { formatRange, NOISE_PERIOD_LABEL, NOISE_SOURCE_LABEL, type NoisePeriod, type NoiseSource } from '../services/noise.ts'
import { ollamaStatus, summarizeWithOllama } from '../services/ollama.ts'
import { DATA_SOURCES } from '../sources/registry.ts'
import { date, dateTime, dist } from './format.ts'
import { SourceLine } from './Prov.tsx'

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rblock">
      <h3>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Pending() {
  return (
    <p className="rpending">
      <Loader2 size={14} className="spin" /> wird abgefragt …
    </p>
  )
}

function Failed({ msg }: { msg: string | null }) {
  return (
    <p className="rfail">
      <AlertCircle size={14} /> Nicht abrufbar: {msg ?? 'unbekannter Fehler'}. Die übrigen Abschnitte sind davon nicht betroffen.
    </p>
  )
}

const autobahn = DATA_SOURCES.find((s) => s.id === 'autobahn')!

export function ReportView({ report, previous }: { report: EnvReport; previous?: EnvReport | null }) {
  const { facts, hints, gaps } = ruleSummary(report)
  const cats = summarizePois(report)
  const [ai, setAi] = useState<{ model: string | null; text: string | null; busy: boolean; error: string | null }>({ model: null, text: null, busy: false, error: null })
  const changes = previous ? diffReports(report, previous) : null

  useEffect(() => {
    ollamaStatus().then((s) => s.available && s.models[0] && setAi((a) => ({ ...a, model: s.models[0] })))
  }, [])

  const runAi = async () => {
    if (!ai.model) return
    setAi((a) => ({ ...a, busy: true, error: null }))
    try {
      const text = await summarizeWithOllama(ai.model, report)
      setAi((a) => ({ ...a, text, busy: false }))
    } catch (e) {
      setAi((a) => ({ ...a, busy: false, error: (e as Error).message }))
    }
  }

  return (
    <div className="report">
      <Block icon={<MapPinned size={17} />} title="Zusammenfassung">
        <ul className="facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {hints.length > 0 && (
          <ul className="hints">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        {gaps.length > 0 && (
          <ul className="gaps">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
        <p className="fine">Regelbasiert aus den belegten Daten erstellt, ohne KI und ohne Bewertung des Viertels.</p>
        {ai.model && (
          <div className="ai">
            {ai.text ? (
              <>
                <p className="ai-label">
                  <Bot size={14} /> Lokale KI ({ai.model}), nur aus den Fakten oben:
                </p>
                <p>{ai.text}</p>
              </>
            ) : (
              <button className="btn soft small" onClick={runAi} disabled={ai.busy}>
                {ai.busy ? <Loader2 size={14} className="spin" /> : <Bot size={14} />} Mit lokaler KI zusammenfassen
              </button>
            )}
            {ai.error && <p className="rfail">{ai.error}</p>}
          </div>
        )}
      </Block>

      {changes && (
        <Block icon={<FileText size={17} />} title={`Änderungen seit ${dateTime(previous!.createdAt)}`}>
          {changes.length ? (
            <ul className="facts">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Keine Änderungen in den abgerufenen Daten.</p>
          )}
        </Block>
      )}

      <Block icon={<Volume2 size={17} />} title="Lärmbelastung (kartiert)">
        {report.noise.data ? (
          <>
            <table className="noise">
              <thead>
                <tr>
                  <th />
                  {(['lden', 'lnight'] as NoisePeriod[]).map((p) => (
                    <th key={p}>{NOISE_PERIOD_LABEL[p]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['road', 'rail', 'air', 'ind'] as NoiseSource[]).map((s) => (
                  <tr key={s}>
                    <td>{NOISE_SOURCE_LABEL[s]}</td>
                    {(['lden', 'lnight'] as NoisePeriod[]).map((p) => {
                      const v = report.noise.data!.values.find((x) => x.source === s && x.period === p)!
                      return (
                        <td key={p} className={v.range ? `lvl-${v.rawClass}` : 'lvl-0'}>
                          {formatRange(v.range, p)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {report.noise.data.nearby?.length > 0 && (
              <table className="noise">
                <tbody>
                  {report.noise.data.nearby.map((v) => (
                    <tr key={v.source}>
                      <td>{NOISE_SOURCE_LABEL[v.source]}, höchster Wert im Umkreis von {v.radiusM} m</td>
                      <td className={v.range ? `lvl-${v.rawClass}` : 'lvl-0'}>{formatRange(v.range, 'lden')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="fine">{report.noise.data.note}</p>
            <SourceLine ids={['eea_noise']} dataDate={report.noise.data.dataDate} fetchedAt={report.noise.data.fetchedAt} />
          </>
        ) : (
          (report.noise.status === 'loading' ? <Pending /> : <Failed msg={report.noise.error} />)
        )}
      </Block>

      <Block icon={<Trees size={17} />} title={`Umgebung im Umkreis von ${dist(report.radius)}`}>
        {report.pois.data ? (
          <>
            <ul className="cats">
              {cats.map((c) => (
                <li key={c.id}>
                  <span className={`dot cat-${c.id}`} />
                  <span className="cat-name">{c.label}</span>
                  <span className="cat-count">{c.count}</span>
                  <span className="cat-near">{c.nearest ? `nächste: ${c.nearest.name ?? 'ohne Namen'}, ${dist(c.nearest.distanceM)}` : 'keine gefunden'}</span>
                </li>
              ))}
            </ul>
            <p className="fine">Luftlinie. Grün, Wasser, Bahnhöfe und Aussichtspunkte werden bis 1,5 km gesucht. Die Vollständigkeit hängt davon ab, was vor Ort in OpenStreetMap eingetragen ist.</p>
            <SourceLine ids={['overpass']} dataDate={report.pois.data.dataTimestamp ? `OSM-Stand ${dateTime(report.pois.data.dataTimestamp)}` : null} fetchedAt={report.pois.data.fetchedAt} />
          </>
        ) : (
          (report.pois.status === 'loading' ? <Pending /> : <Failed msg={report.pois.error} />)
        )}
      </Block>

      <Block icon={<Landmark size={17} />} title="Bebauungspläne und Planung">
        {report.planning.data ? (
          report.planning.data.covered ? (
            <>
              {report.planning.data.plans.length ? (
                <ul className="plans">
                  {report.planning.data.plans.map((p) => (
                    <li key={p.name + p.status}>
                      <span className={`badge st-${p.status.replace(/\s/g, '-')}`}>{p.status}</span>
                      <b>{p.name}</b>
                      {p.detail && <small>{p.detail}</small>}
                      <small>
                        {p.status === 'festgesetzt' ? 'festgesetzt am ' : p.status === 'im Verfahren' ? 'Aufstellungsbeschluss vom ' : 'Datum: '}
                        {date(p.date)}
                        {p.documentUrl && (
                          <>
                            {' · '}
                            <a href={p.documentUrl} target="_blank" rel="noopener noreferrer">
                              Planzeichnung <ExternalLink size={11} />
                            </a>
                          </>
                        )}
                        {p.explanationUrl && (
                          <>
                            {' · '}
                            <a href={p.explanationUrl} target="_blank" rel="noopener noreferrer">
                              Begründung <ExternalLink size={11} />
                            </a>
                          </>
                        )}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Kein Bebauungsplan an diesem Punkt verzeichnet.</p>
              )}
              <p className="fine">Ein Plan im Verfahren ist keine genehmigte Baumaßnahme. Rechtsverbindlich ist nur das Originaldokument.</p>
              <SourceLine ids={report.planning.data.region === 'Hamburg' ? ['hh_bplan'] : ['be_bplan']} fetchedAt={report.planning.data.fetchedAt} />
            </>
          ) : (
            <p className="muted">
              Für {report.planning.data.region ?? 'diese Region'} ist noch kein kostenloser Bebauungsplan-Dienst angebunden. Amtliche Quelle:{' '}
              <a href={report.planning.data.portal?.url} target="_blank" rel="noopener noreferrer">
                {report.planning.data.portal?.label} <ExternalLink size={11} />
              </a>
            </p>
          )
        ) : (
          (report.planning.status === 'loading' ? <Pending /> : <Failed msg={report.planning.error} />)
        )}
      </Block>

      <Block icon={<Scale size={17} />} title="Bodenrichtwert">
        {report.landValue.data ? (
          report.landValue.data.values.length ? (
            <>
              <ul className="plans">
                {report.landValue.data.values.map((v, k) => (
                  <li key={k}>
                    <b>{v.valueEurPerSqm.toLocaleString('de-DE')} €/m²</b>
                    <small>
                      {v.usage ?? 'Nutzung unbekannt'} · Stichtag {date(v.referenceDate)} · {v.district ?? v.municipality ?? ''}
                      {v.documentUrl && (
                        <>
                          {' · '}
                          <a href={v.documentUrl} target="_blank" rel="noopener noreferrer">
                            Amtliches Dokument <ExternalLink size={11} />
                          </a>
                        </>
                      )}
                    </small>
                  </li>
                ))}
              </ul>
              <p className="fine">{report.landValue.data.note}</p>
              <SourceLine ids={['nrw_boris']} fetchedAt={report.landValue.data.fetchedAt} />
            </>
          ) : (
            <p className="muted">
              {report.landValue.data.note}{' '}
              {report.landValue.data.portal && (
                <a href={report.landValue.data.portal.url} target="_blank" rel="noopener noreferrer">
                  {report.landValue.data.portal.label} <ExternalLink size={11} />
                </a>
              )}
            </p>
          )
        ) : (
          (report.landValue.status === 'loading' ? <Pending /> : <Failed msg={report.landValue.error} />)
        )}
      </Block>

      <Block icon={<Building size={17} />} title="Baustellen">
        {report.pois.data ? (
          (() => {
            const sites = report.pois.data.pois.filter((p) => p.category === 'baustelle' && p.distanceM <= report.radius)
            return sites.length ? (
              <ul className="plans">
                {sites.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    <b>{s.name ?? (s.tags.construction ? `Baustelle (${s.tags.construction})` : 'Baustelle')}</b>
                    <small>
                      {dist(s.distanceM)} ·{' '}
                      <a href={s.osmUrl} target="_blank" rel="noopener noreferrer">
                        OpenStreetMap <ExternalLink size={11} />
                      </a>
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Keine in OpenStreetMap eingetragene Baustelle im Umkreis.</p>
            )
          })()
        ) : (
          (report.pois.status === 'loading' ? <Pending /> : <Failed msg={report.pois.error} />)
        )}
        <p className="fine">
          Einträge in OpenStreetMap sind unvollständig. Amtliche Autobahn-Baustellen:{' '}
          <a href={autobahn.url} target="_blank" rel="noopener noreferrer">
            Baustellenkarte der Autobahn GmbH <ExternalLink size={11} />
          </a>{' '}
          (nur verlinkt, da für die Schnittstelle keine Lizenz veröffentlicht ist).
        </p>
      </Block>

      <Block icon={<FileText size={17} />} title="Aus dem Stadtrat">
        {report.council.data ? (
          report.council.data.available ? (
            <>
              <ul className="plans">
                {report.council.data.papers.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    {p.match && <span className="badge st-im-Verfahren">{p.match}</span>}
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      <b>{p.name}</b>
                    </a>
                    <small>
                      {p.type ?? 'Vorlage'} · {date(p.date)}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
              <p className="fine">{report.council.data.note}</p>
              <SourceLine ids={['oparl']} fetchedAt={report.council.data.fetchedAt} />
            </>
          ) : (
            <p className="muted">{report.council.data.note}</p>
          )
        ) : (
          (report.council.status === 'loading' ? <Pending /> : <Failed msg={report.council.error} />)
        )}
      </Block>
    </div>
  )
}
