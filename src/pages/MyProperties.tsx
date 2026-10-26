import { Bookmark, Columns3, Lock, PlusCircle, SlidersHorizontal, Star, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { FilterPanel } from '../components/FilterPanel.tsx'
import { area, money, num } from '../components/format.ts'
import { PropertyDetail } from '../components/PropertyDetail.tsx'
import { useLatestReports, useProperties } from '../lib/data.ts'
import { href } from '../lib/router.ts'
import { mainPrice, STATUS_LABEL } from '../model/property.ts'
import { emptyFilter, type PropertyFilter, type SavedProfile } from '../model/query.ts'
import { category } from '../model/taxonomy.ts'
import { applyFilter } from '../search/filter.ts'
import { deleteProfile, getSetting, listProfiles, saveProfile, setSetting, uid } from '../store/db.ts'

export function MyProperties() {
  const props = useProperties()
  const reports = useLatestReports((props ?? []).map((p) => p.id))
  const [filter, setFilterState] = useState<PropertyFilter>(emptyFilter())
  const [sheet, setSheet] = useState<'filter' | 'detail' | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [active, setActive] = useState<SavedProfile | null>(null)

  useEffect(() => {
    getSetting<PropertyFilter | null>('lastFilter', null).then((f) => f && setFilterState({ ...emptyFilter(), ...f }))
    listProfiles().then(setProfiles)
  }, [])

  const setFilter = (fn: (f: PropertyFilter) => PropertyFilter) =>
    setFilterState((f) => {
      const next = fn(f)
      setSetting('lastFilter', next)
      return next
    })

  const results = useMemo(() => applyFilter(props ?? [], reports, filter), [props, reports, filter])
  const sel = props?.find((p) => p.id === selected)
  const filterCount = filter.countries.length + filter.purposes.length + filter.transactions.length + filter.categories.length + filter.criteria.length + (filter.area ? 1 : 0) + (filter.price.min !== null || filter.price.max !== null ? 1 : 0) + (filter.livingArea.min !== null || filter.livingArea.max !== null ? 1 : 0) + (filter.roomsMin !== null ? 1 : 0)

  const saveAsProfile = async () => {
    const name = prompt('Name für dieses Suchprofil', active?.name ?? 'z. B. Landhaus im Grünen bis 450.000 €')
    if (!name) return
    const now = new Date().toISOString()
    const p: SavedProfile = active && active.name === name ? { ...active, filter, updatedAt: now } : { id: uid(), name, filter, createdAt: now, updatedAt: now }
    await saveProfile(p)
    setActive(p)
    setProfiles(await listProfiles())
  }

  if (props === null) return <div className="page" />

  return (
    <div className="page">
      <header className="page-head row-between">
        <div>
          <p className="eyebrow">Meine Immobilien</p>
          <h1>
            {results.length} {results.length === 1 ? 'Objekt' : 'Objekte'}
            {results.length !== props.length && <small> von {props.length}</small>}
          </h1>
        </div>
        <div className="row">
          <button className="btn soft" onClick={() => setSheet('filter')}>
            <SlidersHorizontal size={16} /> Filter{filterCount ? ` (${filterCount})` : ''}
          </button>
          <a className="btn soft" href={href({ page: 'vergleich' })}>
            <Columns3 size={16} /> Vergleichen
          </a>
          <a className="btn primary" href={href({ page: 'hinzufuegen' })}>
            <PlusCircle size={16} /> Hinzufügen
          </a>
        </div>
      </header>

      {profiles.length > 0 && (
        <div className="profiles">
          <span className="fine">Suchprofile:</span>
          {profiles.map((p) => (
            <span key={p.id} className={`chip ${active?.id === p.id ? 'on' : ''}`}>
              <button onClick={() => { setActive(p); setFilter(() => ({ ...emptyFilter(), ...p.filter })) }}>
                <Bookmark size={12} /> {p.name}
              </button>
              <button className="x" aria-label={`Profil ${p.name} löschen`} onClick={async () => { await deleteProfile(p.id); setProfiles(await listProfiles()); if (active?.id === p.id) setActive(null) }}>
                <Trash2 size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {props.length === 0 ? (
        <div className="empty-state">
          <h2>Noch keine Immobilien gespeichert</h2>
          <p>Füge ein Inserat per Link, Text oder PDF hinzu. StreetSignal zeigt keine erfundenen Beispielobjekte.</p>
          <a className="btn primary" href={href({ page: 'hinzufuegen' })}>Erste Immobilie hinzufügen</a>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h2>Keine Treffer mit diesen Filtern</h2>
          <button className="btn soft" onClick={() => { setFilter(() => emptyFilter()); setActive(null) }}>Filter zurücksetzen</button>
        </div>
      ) : (
        <div className="pgrid">
          {results.map((r, k) => {
            const p = r.property
            const price = mainPrice(p)
            return (
              <motion.button
                key={p.id}
                className={`pcard st-${p.status}`}
                onClick={() => { setSelected(p.id); setSheet('detail') }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(k, 10) * 0.04 }}
              >
                <div className="pcard-top">
                  <span className="kicker">{p.category.value ? category(p.category.value)?.label : 'Art unbekannt'}</span>
                  <span className="badge">{STATUS_LABEL[p.status]}</span>
                </div>
                <h3>{p.title.value ?? 'Ohne Titel'}</h3>
                <p className="muted small">{p.address.value ?? 'Lage unbekannt'}</p>
                <div className="pcard-meta">
                  <strong>{price.value !== null ? money(price.value, p.currency) : 'Preis unbekannt'}</strong>
                  <small>{price.label}</small>
                  <span>{area(p.livingArea.value)}</span>
                  <span>{num(p.rooms.value)} Zi.</span>
                </div>
                {r.outcomes.length > 0 && (
                  <ul className="outcomes">
                    {r.outcomes.map((o) => (
                      <li key={o.id} className={o.status} title={o.evidence}>
                        {o.mode === 'must' ? <Lock size={11} /> : <Star size={11} />} {o.label}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pcard-foot">
                  {r.wishes.total > 0 && <span>{r.wishes.yes} von {r.wishes.total} Wünschen erfüllt</span>}
                  {!r.report && <span className="muted">Umgebung noch nicht analysiert</span>}
                  {r.unknown.length > 0 && <span className="warn-text">unbekannt: {r.unknown.join(', ')}</span>}
                  <span>{p.offers.length} {p.offers.length === 1 ? 'Quelle' : 'Quellen'}</span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {sheet && (
          <motion.div className="sheet-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)}>
            <motion.aside className="sheet" initial={{ x: 60 }} animate={{ x: 0 }} exit={{ x: 60 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} onClick={(e) => e.stopPropagation()}>
              <header className="drawer-head">
                <h2>{sheet === 'filter' ? 'Filter' : (sel?.title.value ?? 'Immobilie')}</h2>
                <button className="icon" onClick={() => setSheet(null)} aria-label="Schließen"><X size={18} /></button>
              </header>
              <div className="drawer-body">
                {sheet === 'filter' ? (
                  <>
                    <FilterPanel f={filter} set={setFilter} />
                    <div className="row sticky-actions">
                      <button className="btn ghost" onClick={() => { setFilter(() => emptyFilter()); setActive(null) }}>Zurücksetzen</button>
                      <button className="btn soft" onClick={saveAsProfile}><Bookmark size={14} /> Als Profil speichern</button>
                      <button className="btn primary" onClick={() => setSheet(null)}>{results.length} anzeigen</button>
                    </div>
                  </>
                ) : sel ? (
                  <PropertyDetail p={sel} onDeleted={() => setSheet(null)} />
                ) : null}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
