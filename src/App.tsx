import { Bookmark, Database, FolderOpen, ListFilter, Map as MapIcon, Plus, RotateCcw, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { SOURCES } from './data/sources.ts'
import { SORT_LABEL, type SortKey } from './model/query.ts'
import { search } from './search/engine.ts'
import { allListings, useStore } from './store/store.ts'
import { activeChips } from './ui/chips.ts'
import { ManualDialog, ProfilesDialog, SaveDialog, SourcesDialog } from './ui/Dialogs.tsx'
import { FilterPanel } from './ui/FilterPanel.tsx'
import { MapView } from './ui/MapView.tsx'
import { ResultList } from './ui/ResultList.tsx'

const INTEGRATED = new Set(SOURCES.filter((s) => s.integrated).map((s) => s.id))

type DialogName = 'save' | 'profiles' | 'manual' | 'sources' | null

export default function App() {
  const query = useStore((s) => s.query)
  const manualListings = useStore((s) => s.manualListings)
  const importedListings = useStore((s) => s.importedListings)
  const setQuery = useStore((s) => s.setQuery)
  const resetQuery = useStore((s) => s.resetQuery)
  const profiles = useStore((s) => s.profiles)
  const activeProfile = useStore((s) => s.profiles.find((p) => p.id === s.activeProfileId))
  const [dialog, setDialog] = useState<DialogName>(null)
  const [mobileView, setMobileView] = useState<'filter' | 'map' | 'list'>('list')

  // Ergebnisse aktualisieren sich ohne Neuladen; deferred hält Eingaben flüssig
  const deferred = useDeferredValue(query)
  const out = useMemo(
    () => search(allListings({ manualListings, importedListings }), deferred, INTEGRATED),
    [deferred, manualListings, importedListings],
  )
  const chips = activeChips(query)

  return (
    <div className={`app view-${mobileView}`}>
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M16 6c-4.4 0-8 3.4-8 7.8C8 19.6 16 26 16 26s8-6.4 8-12.2C24 9.4 20.4 6 16 6z" fill="#fff" /><circle cx="16" cy="14" r="3" fill="currentColor" /></svg>
          <span>StreetSignal</span>
          <small>Immobiliensuche</small>
        </div>
        {activeProfile && <span className="active-profile"><Bookmark size={13} /> {activeProfile.name}</span>}
        <nav className="top-actions">
          <button className="btn ghost" onClick={() => setDialog('sources')}><Database size={15} /> Quellen</button>
          <button className="btn ghost" onClick={() => setDialog('manual')}><Plus size={15} /> Objekt speichern</button>
          <button className="btn ghost" onClick={() => setDialog('profiles')}><FolderOpen size={15} /> Profile{profiles.length ? ` (${profiles.length})` : ''}</button>
          <button className="btn primary" onClick={() => setDialog('save')}><Bookmark size={15} /> Suche speichern</button>
        </nav>
      </header>

      <div className="demo-note">
        Beispieldaten: Die Objekte sind erfunden, Orte und Koordinaten echt. Große Portale sind nicht angebunden, ihre Angebote fehlen in der Suche.
      </div>

      <FilterPanel />

      <main className="results">
        <div className="toolbar">
          <div className="counts">
            <strong>{out.total}</strong> {out.total === 1 ? 'Treffer' : 'Treffer'}
            <span>
              {out.fromSources} aus Quellen · {out.manual} manuell gespeichert
              {out.groups.length < out.total && ` · ${out.groups.length} Objekte`}
            </span>
          </div>
          <label className="sort">
            <span>Sortieren</span>
            <select value={query.sort} onChange={(e) => setQuery((q) => void (q.sort = e.target.value as SortKey))}>
              {Object.entries(SORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="check compact">
            <input type="checkbox" checked={query.groupDuplicates} onChange={(e) => setQuery((q) => void (q.groupDuplicates = e.target.checked))} />
            <span>Dubletten gruppieren</span>
          </label>
          {chips.length > 0 && <button className="btn small" onClick={resetQuery}><RotateCcw size={13} /> Zurücksetzen</button>}
        </div>
        {chips.length > 0 && (
          <div className="active-chips">
            {chips.map((c) => (
              <button key={c.key} className={`chip on removable ${c.tone ?? ''}`} onClick={() => setQuery(c.remove)} aria-label={`Filter ${c.label} entfernen`}>
                {c.label} <X size={12} />
              </button>
            ))}
          </div>
        )}
        {(out.excluded.area + out.excluded.type + out.excluded.price + out.excluded.size + out.excluded.criteria) > 0 && (
          <p className="excluded">
            Ausgeschlossen: {[
              out.excluded.area && `${out.excluded.area} außerhalb der Gebiete`,
              out.excluded.type && `${out.excluded.type} andere Art/Transaktion`,
              out.excluded.price && `${out.excluded.price} Preis`,
              out.excluded.size && `${out.excluded.size} Größe`,
              out.excluded.criteria && `${out.excluded.criteria} Muss-Kriterien`,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="split">
          <MapView groups={out.groups} />
          <ResultList groups={out.groups} />
        </div>
      </main>

      <nav className="mobile-tabs">
        <button className={mobileView === 'filter' ? 'on' : ''} onClick={() => setMobileView('filter')}><ListFilter size={16} /> Filter</button>
        <button className={mobileView === 'map' ? 'on' : ''} onClick={() => setMobileView('map')}><MapIcon size={16} /> Karte</button>
        <button className={mobileView === 'list' ? 'on' : ''} onClick={() => setMobileView('list')}>Liste ({out.groups.length})</button>
      </nav>

      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
      {dialog === 'profiles' && <ProfilesDialog onClose={() => setDialog(null)} />}
      {dialog === 'manual' && <ManualDialog onClose={() => setDialog(null)} />}
      {dialog === 'sources' && <SourcesDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
