import { PlusCircle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { AddressSearch } from '../components/AddressSearch.tsx'
import { PropertyDetail } from '../components/PropertyDetail.tsx'
import { useProperties } from '../lib/data.ts'
import { href, navigate } from '../lib/router.ts'
import { MapView } from '../map/MapView.tsx'
import { useUi } from '../store/ui.ts'
import { LayerPanel } from './Explore.tsx'

export function Overview() {
  const props = useProperties()
  const selectedId = useUi((s) => s.selectedPropertyId)
  const select = useUi((s) => s.selectProperty)
  const sel = props?.find((p) => p.id === selectedId) ?? null
  const located = (props ?? []).filter((p) => p.location)
  const setFocus = useUi((s) => s.setFocus)
  // Die Übersicht zeigt nur Immobilien, keinen Suchkreis aus „Umgebung erkunden“
  useEffect(() => setFocus(null), [])

  // Beim ersten Öffnen auf alle Immobilien zoomen
  const fit = useMemo(() => {
    if (!located.length) return null
    const lat = located.reduce((a, p) => a + p.location!.lat, 0) / located.length
    const lng = located.reduce((a, p) => a + p.location!.lng, 0) / located.length
    const r = Math.max(2000, ...located.map((p) => Math.hypot((p.location!.lat - lat) * 111000, (p.location!.lng - lng) * 71000)))
    return { lat, lng, radius: r * 1.2 }
  }, [located.length])

  return (
    <div className="map-page">
      <MapView properties={props ?? []} fitTo={fit} onSelectProperty={select} onMapClick={() => select(null)} />
      <div className="float-search">
        <AddressSearch onPick={(r) => navigate({ page: 'umgebung', lat: r.lat, lng: r.lng, label: r.label })} placeholder="Adresse suchen und Umgebung erkunden" />
        <div className="float-meta">
          <span>
            {located.length} {located.length === 1 ? 'Immobilie' : 'Immobilien'} auf der Karte
            {props && props.length > located.length && ` · ${props.length - located.length} ohne Lage`}
          </span>
          <a href={href({ page: 'hinzufuegen' })}>
            <PlusCircle size={14} /> hinzufügen
          </a>
        </div>
      </div>
      <LayerPanel />
      {props && props.length === 0 && (
        <div className="map-empty">
          <h2>Deine persönliche Immobilienkarte</h2>
          <p>Noch leer. Füge ein Inserat hinzu oder erkunde eine Adresse.</p>
          <div className="row center">
            <a className="btn primary" href={href({ page: 'hinzufuegen' })}>Immobilie hinzufügen</a>
            <a className="btn soft" href={href({ page: 'umgebung' })}>Umgebung erkunden</a>
          </div>
        </div>
      )}
      <AnimatePresence>
        {sel && (
          <motion.aside className="drawer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <header className="drawer-head">
              <div>
                <p className="eyebrow">Immobilienprofil</p>
                <h2>{sel.title.value ?? 'Ohne Titel'}</h2>
              </div>
              <button className="icon" onClick={() => select(null)} aria-label="Schließen"><X size={18} /></button>
            </header>
            <div className="drawer-body">
              <PropertyDetail p={sel} onDeleted={() => select(null)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
