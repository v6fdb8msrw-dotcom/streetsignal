import { Info } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { area, date, money } from '../components/format.ts'
import { useLatestReports, useProperties } from '../lib/data.ts'
import { href } from '../lib/router.ts'
import { completeness, mainPrice } from '../model/property.ts'
import { FACTORS, score, type FactorId } from '../search/compare.ts'
import { getSetting, setSetting } from '../store/db.ts'

const DEFAULT_WEIGHTS: Record<FactorId, number> = { ruhe: 3, gruen: 2, oepnv: 2, versorgung: 1, baustellen: 1, preis_qm: 2 }

export function Compare() {
  const props = useProperties()
  const [ids, setIds] = useState<string[]>([])
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const reports = useLatestReports(ids)

  useEffect(() => {
    getSetting<Record<FactorId, number>>('weights', DEFAULT_WEIGHTS).then((w) => setWeights({ ...DEFAULT_WEIGHTS, ...w }))
    getSetting<string[]>('compareIds', []).then(setIds)
  }, [])

  const chosen = (props ?? []).filter((p) => ids.includes(p.id))
  const rows = useMemo(() => score(chosen.map((p) => ({ property: p, report: reports.get(p.id) ?? null })), weights), [chosen, reports, weights])
  const best = Math.max(...rows.map((r) => r.total))

  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-4)
    setIds(next)
    setSetting('compareIds', next)
  }
  const setW = (id: FactorId, v: number) => {
    const next = { ...weights, [id]: v }
    setWeights(next)
    setSetting('weights', next)
  }

  if (props === null) return <div className="page" />

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Immobilien vergleichen</p>
        <h1>Welche Lage passt zu dir?</h1>
        <p className="lead">Wähle bis zu vier Objekte und gewichte, was dir wichtig ist. Die Rechnung ist vollständig sichtbar: Beim jeweiligen Faktor bekommt das beste Objekt die volle Gewichtung, das schlechteste null.</p>
      </header>

      {props.length === 0 ? (
        <div className="empty-state">
          <p>Speichere zuerst Immobilien.</p>
          <a className="btn primary" href={href({ page: 'hinzufuegen' })}>Immobilie hinzufügen</a>
        </div>
      ) : (
        <>
          <div className="pick-row">
            {props.map((p) => (
              <button key={p.id} className={`chip ${ids.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id)}>
                {p.title.value ?? 'Ohne Titel'}
              </button>
            ))}
          </div>

          <div className="card pad weights">
            <h3>Deine Gewichtung</h3>
            <div className="weight-grid">
              {FACTORS.map((f) => (
                <label key={f.id} title={f.describe}>
                  <span>{f.label}</span>
                  <input type="range" min={0} max={5} value={weights[f.id]} onChange={(e) => setW(f.id, Number(e.target.value))} />
                  <b>{weights[f.id]}</b>
                </label>
              ))}
            </div>
          </div>

          {chosen.length >= 2 ? (
            <div className="card compare-wrap">
              <table className="compare">
                <thead>
                  <tr>
                    <th />
                    {rows.map((r) => (
                      <th key={r.property.id} className={r.total === best && best > 0 ? 'win' : ''}>
                        <span>{r.property.title.value ?? 'Ohne Titel'}</span>
                        <motion.div className="score" initial={{ width: 0 }} animate={{ width: `${r.max ? (r.total / r.max) * 100 : 0}%` }} />
                        <small>
                          {r.total.toFixed(1)} von {r.max} Punkten
                        </small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="sub"><td colSpan={rows.length + 1}>Objekt</td></tr>
                  <tr>
                    <td>Preis</td>
                    {rows.map((r) => {
                      const m = mainPrice(r.property)
                      return <td key={r.property.id}>{m.value !== null ? `${money(m.value, r.property.currency)} (${m.label})` : 'unbekannt'}</td>
                    })}
                  </tr>
                  <tr>
                    <td>Wohnfläche</td>
                    {rows.map((r) => <td key={r.property.id}>{area(r.property.livingArea.value)}</td>)}
                  </tr>
                  <tr>
                    <td>Grundstück</td>
                    {rows.map((r) => <td key={r.property.id}>{area(r.property.plotArea.value)}</td>)}
                  </tr>
                  <tr className="sub"><td colSpan={rows.length + 1}>Faktoren (Wert · Punkte)</td></tr>
                  {FACTORS.map((f) => (
                    <tr key={f.id}>
                      <td title={f.describe}>
                        {f.label} <small>×{weights[f.id]}</small>
                      </td>
                      {rows.map((r) => {
                        const c = r.cells.find((x) => x.factor === f.id)!
                        return (
                          <td key={r.property.id} className={c.raw === null ? 'unknown' : ''}>
                            {c.raw !== null ? f.format(c.raw, r.property) : c.note}
                            <small>
                              {c.points.toFixed(1)} P.{c.raw !== null && c.note ? ` · ${c.note}` : ''}
                            </small>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="sub"><td colSpan={rows.length + 1}>Datengrundlage</td></tr>
                  <tr>
                    <td>Umgebungsanalyse</td>
                    {rows.map((r) => {
                      const rep = reports.get(r.property.id)
                      return <td key={r.property.id}>{rep ? `vom ${date(rep.createdAt)}, Umkreis ${rep.radius} m` : 'fehlt – bitte analysieren'}</td>
                    })}
                  </tr>
                  <tr>
                    <td>Bodenrichtwert</td>
                    {rows.map((r) => {
                      const v = reports.get(r.property.id)?.landValue.data?.values[0]
                      return <td key={r.property.id}>{v ? `${v.valueEurPerSqm.toLocaleString('de-DE')} €/m² (Stichtag ${date(v.referenceDate)})` : 'nicht verfügbar'}</td>
                    })}
                  </tr>
                  <tr>
                    <td>Vollständigkeit</td>
                    {rows.map((r) => {
                      const c = completeness(r.property)
                      return <td key={r.property.id}>{c.known} von {c.total} Kernangaben</td>
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="fine pad-x">
                <Info size={12} /> Keine pauschale Bewertung: Die Punkte sagen nur, wie die gewählten Objekte untereinander bei deinen Faktoren abschneiden. Unbekannte Werte zählen nie als erfüllt.
              </p>
            </div>
          ) : (
            <p className="muted">Wähle mindestens zwei Objekte aus.</p>
          )}
        </>
      )}
    </div>
  )
}
