import { Bookmark, Layers, Loader2, RefreshCw, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { AddressSearch } from '../components/AddressSearch.tsx'
import { dateTime } from '../components/format.ts'
import { ReportView } from '../components/ReportView.tsx'
import { useProperties } from '../lib/data.ts'
import { navigate, type Route } from '../lib/router.ts'
import { MapView } from '../map/MapView.tsx'
import { LAYER_LABEL, NOISE_LEGEND, OVERLAYS } from '../map/overlays.ts'
import { analyze, RADII, type EnvReport, type Radius } from '../services/environment.ts'
import { POI_CATEGORIES } from '../services/overpass.ts'
import { reportsFor, savePlace, saveReport, uid } from '../store/db.ts'
import { useUi, type LayerId } from '../store/ui.ts'

export function targetIdFor(lat: number, lng: number) {
  return `ort:${lat.toFixed(5)},${lng.toFixed(5)}`
}

export function LayerPanel() {
  const layers = useUi((s) => s.layers)
  const toggle = useUi((s) => s.toggleLayer)
  const [open, setOpen] = useState(false)
  const ids: LayerId[] = ['pois', 'properties', 'radius', 'noise_road', 'noise_rail', 'noise_air', 'noise_regional', 'bplan', 'landvalue']
  const noiseOn = layers.noise_road || layers.noise_rail || layers.noise_air
  return (
    <>
      <div className="layer-btn">
        <button className={`btn glass-dark ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <Layers size={16} /> Kartenebenen
        </button>
        <AnimatePresence>
          {open && (
            <motion.div className="layer-pop" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {ids.map((id) => {
                const hint = OVERLAYS.filter((o) => o.layer === id).map((o) => o.label.replace(/^[^ ]+ /, ''))
                return (
                  <label key={id} className="switch-row">
                    <input type="checkbox" checked={layers[id]} onChange={() => toggle(id)} />
                    <span className="switch" />
                    <span>
                      {LAYER_LABEL[id]}
                      {id === 'noise_regional' && <small>NRW, Berlin, Schweiz · ab Stadtteil-Zoom</small>}
                      {id === 'bplan' && <small>Hamburg, Berlin · ab Stadtteil-Zoom</small>}
                      {id === 'landvalue' && <small>NRW · ab Straßen-Zoom</small>}
                      {id.startsWith('noise_') && id !== 'noise_regional' && <small>EU-Lärmkartierung 2022 · {hint.length ? 'ganz DACH' : ''}</small>}
                    </span>
                  </label>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {(noiseOn || layers.pois) && (
        <div className="legend">
          {noiseOn && (
            <div>
              <b>Lärm ganztags (L_DEN)</b>
              {NOISE_LEGEND.map((l) => (
                <span key={l.label}>
                  <i style={{ background: l.color }} /> {l.label}
                </span>
              ))}
            </div>
          )}
          {layers.pois && (
            <div className="legend-pois">
              {POI_CATEGORIES.map((c) => (
                <span key={c.id}>
                  <i className="round" style={{ background: c.color }} /> {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function Explore({ route }: { route: Extract<Route, { page: 'umgebung' }> }) {
  const focus = useUi((s) => s.focus)
  const setFocus = useUi((s) => s.setFocus)
  const radius = useUi((s) => s.radius)
  const setRadius = useUi((s) => s.setRadius)
  const bump = useUi((s) => s.bump)
  const properties = useProperties()
  const [report, setReport] = useState<EnvReport | null>(null)
  const [previous, setPrevious] = useState<EnvReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(true)
  const [saved, setSaved] = useState(false)

  const hasPoint = route.lat !== undefined && route.lng !== undefined
  const targetId = hasPoint ? (route.target ?? targetIdFor(route.lat!, route.lng!)) : null

  useEffect(() => {
    if (!hasPoint) return
    setFocus({ lat: route.lat!, lng: route.lng!, label: route.label ?? 'Gewählter Punkt', targetId })
    setPanel(true)
    setSaved(false)
  }, [route.lat, route.lng, route.label, route.target])

  const run = async (force = false) => {
    if (!hasPoint || !targetId) return
    setBusy(true)
    const history = await reportsFor(targetId)
    const sameRadius = history.find((h) => h.radius === radius)
    if (sameRadius && !force) {
      setReport(sameRadius)
      setPrevious(history.filter((h) => h.radius === radius)[1] ?? null)
      setBusy(false)
      return
    }
    const r = await analyze(targetId, route.lat!, route.lng!, radius, (partial) => setReport(partial))
    await saveReport(r)
    setReport(r)
    setPrevious(sameRadius ?? null)
    setBusy(false)
    bump()
  }

  useEffect(() => {
    setReport(null)
    run()
  }, [targetId, radius])

  const fitTo = useMemo(() => (hasPoint ? { lat: route.lat!, lng: route.lng!, radius } : null), [route.lat, route.lng, radius])
  const label = route.label ?? report?.place?.label ?? 'Gewählter Punkt'

  return (
    <div className="map-page">
      <MapView
        pois={report?.pois.data?.pois ?? []}
        properties={properties ?? []}
        fitTo={fitTo}
        onMapClick={(lat, lng) => navigate({ page: 'umgebung', lat, lng })}
        onSelectProperty={(id) => {
          const p = properties?.find((x) => x.id === id)
          if (p?.location) navigate({ page: 'umgebung', lat: p.location.lat, lng: p.location.lng, label: p.title.value ?? 'Immobilie', target: p.id })
        }}
        interactiveHint={!hasPoint ? 'Suche eine Adresse oder klick in die Karte' : undefined}
      />

      <div className="float-search">
        <AddressSearch onPick={(r) => navigate({ page: 'umgebung', lat: r.lat, lng: r.lng, label: r.label })} autoFocus={!hasPoint} />
        <div className="radius-pills" role="radiogroup" aria-label="Umkreis">
          <span>Umkreis</span>
          {RADII.map((r) => (
            <button key={r} className={r === radius ? 'on' : ''} onClick={() => setRadius(r as Radius)} role="radio" aria-checked={r === radius}>
              {r >= 1000 ? `${r / 1000} km` : `${r} m`}
            </button>
          ))}
        </div>
      </div>

      <LayerPanel />

      <AnimatePresence>
        {hasPoint && panel && (
          <motion.aside className="drawer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <header className="drawer-head">
              <div>
                <p className="eyebrow">Umgebungsanalyse</p>
                <h2>{label}</h2>
                <p className="muted small">
                  {report?.place?.detail ?? `${route.lat!.toFixed(5)}, ${route.lng!.toFixed(5)}`}
                  {report && ` · Stand ${dateTime(report.createdAt)}`}
                </p>
              </div>
              <button className="icon" onClick={() => setPanel(false)} aria-label="Panel schließen">
                <X size={18} />
              </button>
            </header>
            <div className="drawer-actions">
              <button className="btn soft small" onClick={() => run(true)} disabled={busy}>
                <RefreshCw size={14} className={busy ? 'spin' : ''} /> Neu prüfen
              </button>
              {!route.target && (
                <button
                  className="btn soft small"
                  disabled={saved}
                  onClick={async () => {
                    await savePlace({ id: targetId ?? uid(), label, lat: route.lat!, lng: route.lng!, createdAt: new Date().toISOString() })
                    setSaved(true)
                    bump()
                  }}
                >
                  <Bookmark size={14} /> {saved ? 'Gemerkt' : 'Ort merken'}
                </button>
              )}
            </div>
            <div className="drawer-body">
              {!report ? (
                <div className="loading">
                  <Loader2 className="spin" size={22} />
                  <p>Frage offene Datenquellen ab …</p>
                  <small>OpenStreetMap, EU-Lärmkarten, Bebauungspläne, Bodenrichtwerte, Ratsinformationen</small>
                </div>
              ) : report ? (
                <ReportView report={report} previous={previous} />
              ) : null}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {hasPoint && !panel && (
        <button className="btn primary drawer-reopen" onClick={() => setPanel(true)}>
          Analyse anzeigen
        </button>
      )}
      {focus && !hasPoint && null}
    </div>
  )
}
