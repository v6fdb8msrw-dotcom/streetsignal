import { ChevronDown, Crosshair, Lock, MapPin, Mountain, Plus, Search, Star, Target, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { SOURCES } from '../data/sources.ts'
import { CRITERIA, CRITERION_GROUPS, type CriterionGroup } from '../model/criteria.ts'
import { findPlaces, LANDSCAPES, REGIONS, type Place } from '../model/geo.ts'
import type { CriterionMode, SearchArea, SearchQuery } from '../model/query.ts'
import {
  CATEGORY_GROUPS,
  categoriesFor,
  COUNTRIES,
  dealLabel,
  PURPOSES,
  transactionsFor,
  type Country,
} from '../model/taxonomy.ts'
import { useStore } from '../store/store.ts'
import { parseNum } from './format.ts'

const uid = () => Math.random().toString(36).slice(2, 9)

function Step({ n, title, summary, children }: { n: number; title: string; summary: string; children: ReactNode }) {
  const open = useStore((s) => s.openStep === n)
  const setOpen = useStore((s) => s.setOpenStep)
  return (
    <section className={`step ${open ? 'open' : ''}`}>
      <button className="step-head" onClick={() => setOpen(open ? 0 : n)} aria-expanded={open}>
        <span className="step-n">{n}</span>
        <span className="step-title">
          {title}
          <small>{summary}</small>
        </span>
        <ChevronDown size={16} className="step-chev" />
      </button>
      {open && <div className="step-body">{children}</div>}
    </section>
  )
}

function Toggle({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button className={`chip ${on ? 'on' : ''}`} onClick={onClick} title={title} aria-pressed={on}>
      {children}
    </button>
  )
}

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

function NumField({ label, value, onChange, suffix }: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string }) {
  const [text, setText] = useState(value === null ? '' : value.toLocaleString('de-DE'))
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setText(value === null ? '' : value.toLocaleString('de-DE'))
  }
  return (
    <label className="num">
      <span>{label}</span>
      <div className="num-in">
        <input
          inputMode="decimal"
          value={text}
          placeholder="beliebig"
          onChange={(e) => {
            setText(e.target.value)
            const v = parseNum(e.target.value)
            setLast(v)
            onChange(v)
          }}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

// 1. Wo?
function WhereStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const mapMode = useStore((s) => s.mapMode)
  const setMapMode = useStore((s) => s.setMapMode)
  const [country, setCountry] = useState<Country>('DE')
  const [text, setText] = useState('')
  const [online, setOnline] = useState<{ label: string; center: [number, number] }[]>([])
  const [busy, setBusy] = useState(false)
  const hits = findPlaces(text)

  const add = (a: SearchArea) => setQuery((x) => void x.areas.push(a))
  const addPlace = (p: Place) => {
    add({ id: uid(), kind: 'city', placeId: p.id, label: p.name, center: p.center, country: p.country, city: p.name, radiusKm: p.radiusKm, wholeCity: true })
    setText('')
  }

  // Freie Adresse über OpenStreetMap Nominatim (kostenlos, optional, nur auf Klick)
  const lookup = async () => {
    setBusy(true)
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=de,at,ch&q=${encodeURIComponent(text)}`, { headers: { 'Accept-Language': 'de' } })
      const data = (await r.json()) as { display_name: string; lat: string; lon: string }[]
      setOnline(data.map((d) => ({ label: d.display_name, center: [Number(d.lat), Number(d.lon)] })))
    } catch {
      setOnline([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="row">
        {COUNTRIES.map((c) => (
          <Toggle key={c.id} on={q.areas.some((a) => a.kind === 'country' && a.country === c.id)} onClick={() => {
            const existing = q.areas.find((a) => a.kind === 'country' && a.country === c.id)
            if (existing) setQuery((x) => void (x.areas = x.areas.filter((a) => a.id !== existing.id)))
            else add({ id: uid(), kind: 'country', country: c.id })
          }}>
            {c.label}
          </Toggle>
        ))}
      </div>

      <div className="field-row">
        <select value={country} onChange={(e) => setCountry(e.target.value as Country)} aria-label="Land für Region">
          {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
        </select>
        <select
          value=""
          onChange={(e) => e.target.value && add({ id: uid(), kind: 'region', country, region: e.target.value })}
          aria-label="Region hinzufügen"
        >
          <option value="">{COUNTRIES.find((c) => c.id === country)!.regionWord} hinzufügen …</option>
          {REGIONS[country].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="search-box">
        <Search size={15} />
        <input value={text} onChange={(e) => { setText(e.target.value); setOnline([]) }} placeholder="Stadt, Gemeinde oder PLZ" />
      </div>
      {text && (
        <div className="suggest">
          {hits.map((p) => (
            <button key={p.id} onClick={() => addPlace(p)}>
              <MapPin size={13} /> {p.name} <small>{p.region}, {p.country}</small>
            </button>
          ))}
          {online.map((o, i) => (
            <button key={i} onClick={() => { add({ id: uid(), kind: 'radius', label: o.label.split(',')[0], center: o.center, radiusKm: 10 }); setText(''); setOnline([]) }}>
              <MapPin size={13} /> {o.label.split(',').slice(0, 3).join(',')}
            </button>
          ))}
          <button className="muted" onClick={lookup} disabled={busy}>
            <Search size={13} /> {busy ? 'Suche …' : 'Adresse online suchen (OpenStreetMap)'}
          </button>
        </div>
      )}

      <div className="row">
        <button className={`btn small ${mapMode === 'pick_area' ? 'primary' : ''}`} onClick={() => setMapMode(mapMode === 'pick_area' ? 'idle' : 'pick_area')}>
          <Crosshair size={14} /> {mapMode === 'pick_area' ? 'Klick in die Karte …' : 'Punkt auf der Karte wählen'}
        </button>
      </div>

      <p className="label">Ohne festen Ausgangspunkt</p>
      <div className="row">
        {LANDSCAPES.map((l) => (
          <Toggle key={l.id} on={q.areas.some((a) => a.kind === 'landscape' && a.landscapeId === l.id)} onClick={() => {
            const ex = q.areas.find((a) => a.kind === 'landscape' && a.landscapeId === l.id)
            if (ex) setQuery((x) => void (x.areas = x.areas.filter((a) => a.id !== ex.id)))
            else add({ id: uid(), kind: 'landscape', landscapeId: l.id, label: l.name })
          }}>
            <Mountain size={12} /> {l.name}
          </Toggle>
        ))}
      </div>
      <p className="fine">Landschaftsräume sind vereinfacht abgegrenzt und auf der Karte eingezeichnet.</p>

      {q.areas.length > 0 && (
        <div className="areas">
          {q.areas.map((a) => (
            <div key={a.id} className="area-box">
              <div className="area-head">
                <strong>{a.kind === 'country' ? COUNTRIES.find((c) => c.id === a.country)!.label : a.kind === 'region' ? a.region : a.label}</strong>
                <button className="icon" onClick={() => setQuery((x) => void (x.areas = x.areas.filter((y) => y.id !== a.id)))} aria-label="Gebiet entfernen"><X size={14} /></button>
              </div>
              {(a.kind === 'city' || a.kind === 'radius') && (
                <>
                  {a.kind === 'city' && (
                    <Check checked={a.wholeCity} onChange={(v) => setQuery((x) => {
                      const y = x.areas.find((z) => z.id === a.id)
                      if (y?.kind === 'city') y.wholeCity = v
                    })}>ganze Stadt (Stadtgebiet und Ortsangabe)</Check>
                  )}
                  {!(a.kind === 'city' && a.wholeCity) && (
                    <div className="radius">
                      <input type="range" min={1} max={100} value={a.radiusKm} onChange={(e) => setQuery((x) => {
                        const y = x.areas.find((z) => z.id === a.id)
                        if (y && (y.kind === 'city' || y.kind === 'radius')) y.radiusKm = Number(e.target.value)
                      })} />
                      <span>{a.radiusKm} km</span>
                      {[10, 25, 50].map((k) => (
                        <button key={k} className="mini" onClick={() => setQuery((x) => {
                          const y = x.areas.find((z) => z.id === a.id)
                          if (y && (y.kind === 'city' || y.kind === 'radius')) y.radiusKm = k
                        })}>{k}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          <p className="fine">Mehrere Gebiete gelten zusammen: Ein Objekt muss in mindestens einem liegen.</p>
        </div>
      )}
    </>
  )
}

// 2. Was?
function PurposeStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  return (
    <div className="cards">
      {PURPOSES.map((p) => (
        <button key={p.id} className={`pcard ${q.purposes.includes(p.id) ? 'on' : ''}`} onClick={() => setQuery((x) => void (x.purposes = toggleIn(x.purposes, p.id)))}>
          <strong>{p.label}</strong>
          <small>{p.description}</small>
        </button>
      ))}
      <p className="fine wide">Mehrfachauswahl möglich, z. B. Wohnen und Kapitalanlage.</p>
    </div>
  )
}

// 3. Welche Immobilie?
function TypeStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const cats = categoriesFor(q.purposes, q.transactions)
  return (
    <>
      {CATEGORY_GROUPS.map((g) => {
        const list = cats.filter((c) => c.group === g.id)
        if (list.length === 0) return null
        const allOn = list.every((c) => q.categories.includes(c.id))
        return (
          <div key={g.id} className="cat-group">
            <div className="cat-head">
              <p className="label">{g.label}</p>
              <button className="link" onClick={() => setQuery((x) => {
                x.categories = allOn ? x.categories.filter((c) => !list.some((l) => l.id === c)) : [...new Set([...x.categories, ...list.map((l) => l.id)])]
              })}>{allOn ? 'keine' : 'alle'}</button>
            </div>
            <div className="row">
              {list.map((c) => (
                <Toggle key={c.id} on={q.categories.includes(c.id)} title={c.condition} onClick={() => setQuery((x) => void (x.categories = toggleIn(x.categories, c.id)))}>
                  {c.label}
                </Toggle>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

// 4. Mieten oder kaufen?
function DealStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const options = transactionsFor(q.purposes)
  const groups = [...new Set(categoriesFor(q.purposes, q.transactions).filter((c) => q.categories.includes(c.id)).map((c) => c.group))]
  return (
    <>
      <div className="row">
        {options.map((t) => (
          <Toggle key={t.id} on={q.transactions.includes(t.id)} onClick={() => setQuery((x) => void (x.transactions = toggleIn(x.transactions, t.id)))}>
            {t.label}
          </Toggle>
        ))}
      </div>
      {q.transactions.length > 0 && groups.length > 0 && (
        <p className="fine">Gesucht: {groups.flatMap((g) => q.transactions.map((t) => dealLabel(g, t))).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</p>
      )}
      <p className="fine">Die Einordnung folgt den Angaben im Inserat. Eine reine Vermietung erscheint nie als Kaufangebot.</p>
    </>
  )
}

// 5. Budget und Größe
function BudgetStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const onlyBuy = q.transactions.length === 1 && q.transactions[0] === 'kauf'
  const onlyRent = q.transactions.length === 1 && q.transactions[0] === 'miete'
  const bases = onlyBuy ? (['auto'] as const) : onlyRent ? (['kalt', 'warm'] as const) : (['auto', 'kalt', 'warm', 'kauf', 'pacht'] as const)
  const baseLabel = { auto: onlyBuy ? 'Kaufpreis' : 'passend zur Transaktion', kalt: 'Kaltmiete', warm: 'Warmmiete', kauf: 'Kaufpreis', pacht: 'Pacht/Monat' }
  const max = q.price.perSqm ? (onlyBuy ? 20000 : 60) : onlyBuy ? 5000000 : onlyRent ? 10000 : 5000000
  const step = q.price.perSqm ? (onlyBuy ? 100 : 1) : onlyBuy ? 10000 : onlyRent ? 50 : 10000
  const currencyHint = q.areas.some((a) => (a.kind === 'country' && a.country === 'CH') || ('country' in a && a.country === 'CH'))
  return (
    <>
      <div className="field-row">
        <select value={onlyRent && q.price.basis === 'auto' ? 'kalt' : q.price.basis} onChange={(e) => setQuery((x) => void (x.price.basis = e.target.value as SearchQuery['price']['basis']))} aria-label="Preisart">
          {bases.map((b) => <option key={b} value={b}>{baseLabel[b]}</option>)}
        </select>
        <select value={q.price.currency} onChange={(e) => setQuery((x) => void (x.price.currency = e.target.value as 'EUR' | 'CHF'))} aria-label="Währung">
          <option value="EUR">EUR</option>
          <option value="CHF">CHF</option>
        </select>
      </div>
      <Check checked={q.price.perSqm} onChange={(v) => setQuery((x) => void ((x.price.perSqm = v), (x.price.min = null), (x.price.max = null)))}>Preis pro m²</Check>
      <div className="field-row">
        <NumField label="Mindestpreis" value={q.price.min} suffix={q.price.currency} onChange={(v) => setQuery((x) => void (x.price.min = v))} />
        <NumField label="Höchstpreis" value={q.price.max} suffix={q.price.currency} onChange={(v) => setQuery((x) => void (x.price.max = v))} />
      </div>
      <input type="range" min={0} max={max} step={step} value={q.price.max ?? max} onChange={(e) => setQuery((x) => void (x.price.max = Number(e.target.value) >= max ? null : Number(e.target.value)))} aria-label="Höchstpreis" />
      <p className="fine">
        Preise werden nicht umgerechnet: Eine Grenze in {q.price.currency} gilt nur für Angebote in {q.price.currency}.
        {currencyHint && q.price.currency === 'EUR' && ' In der Schweiz wird in CHF inseriert.'}
      </p>
      <Check checked={q.includeUnknown.price} onChange={(v) => setQuery((x) => void (x.includeUnknown.price = v))}>Objekte ohne vergleichbaren Preis einschließen</Check>

      <p className="label">Größe</p>
      <div className="field-row">
        <NumField label="Wohn-/Nutzfläche ab" value={q.livingArea.min} suffix="m²" onChange={(v) => setQuery((x) => void (x.livingArea.min = v))} />
        <NumField label="bis" value={q.livingArea.max} suffix="m²" onChange={(v) => setQuery((x) => void (x.livingArea.max = v))} />
      </div>
      <div className="field-row">
        <NumField label="Grundstücksfläche ab" value={q.plotArea.min} suffix="m²" onChange={(v) => setQuery((x) => void (x.plotArea.min = v))} />
        <NumField label="bis" value={q.plotArea.max} suffix="m²" onChange={(v) => setQuery((x) => void (x.plotArea.max = v))} />
      </div>
      <div className="field-row three">
        <NumField label="Zimmer ab" value={q.rooms.min} onChange={(v) => setQuery((x) => void (x.rooms.min = v))} />
        <NumField label="Zimmer bis" value={q.rooms.max} onChange={(v) => setQuery((x) => void (x.rooms.max = v))} />
        <NumField label="Schlafzimmer ab" value={q.bedroomsMin} onChange={(v) => setQuery((x) => void (x.bedroomsMin = v))} />
      </div>
      <p className="label">Fehlende Angaben</p>
      <Check checked={q.includeUnknown.livingArea} onChange={(v) => setQuery((x) => void (x.includeUnknown.livingArea = v))}>ohne Wohnfläche einschließen</Check>
      <Check checked={q.includeUnknown.plotArea} onChange={(v) => setQuery((x) => void (x.includeUnknown.plotArea = v))}>ohne Grundstücksfläche einschließen</Check>
      <Check checked={q.includeUnknown.rooms} onChange={(v) => setQuery((x) => void (x.includeUnknown.rooms = v))}>ohne Zimmerzahl einschließen</Check>
    </>
  )
}

/** Kriterium-Chip: aus → Wunsch → Muss → aus */
function CriterionChips({ groups }: { groups: CriterionGroup[] }) {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const cycle = (id: string) =>
    setQuery((x) => {
      const cur = x.criteria.find((c) => c.id === id)
      if (!cur) x.criteria.push({ id, mode: 'wish' })
      else if (cur.mode === 'wish') cur.mode = 'must'
      else x.criteria = x.criteria.filter((c) => c.id !== id)
    })
  return (
    <>
      {CRITERION_GROUPS.filter((g) => groups.includes(g.id)).map((g) => (
        <div key={g.id} className="cat-group">
          <p className="label">{g.label}</p>
          <div className="row">
            {CRITERIA.filter((c) => c.group === g.id).map((c) => {
              const mode = q.criteria.find((x) => x.id === c.id)?.mode
              return (
                <button key={c.id} className={`chip crit ${mode ?? ''}`} onClick={() => cycle(c.id)} title={`${c.hint}\n${mode === 'must' ? 'Muss' : mode === 'wish' ? 'Wunsch' : 'aus'} · Klick: Wunsch → Muss → aus`}>
                  <ModeIcon mode={mode} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

/** Feste Breite, damit die Chips beim Umschalten nicht verrutschen */
function ModeIcon({ mode }: { mode?: CriterionMode }) {
  if (mode === 'must') return <Lock size={12} className="mode-ic" />
  if (mode === 'wish') return <Star size={12} className="mode-ic" />
  return <Plus size={12} className="mode-ic" />
}

function Legend() {
  return (
    <p className="fine legend">
      Ein Klick macht ein Kriterium zum <span className="tag wish"><Star size={10} /> Wunsch</span>, der zweite zum <span className="tag must"><Lock size={10} /> Muss</span>, der dritte entfernt es. Muss-Kriterien filtern, Wünsche sortieren nur. Fährst du mit der Maus darüber, siehst du, woran gemessen wird.
    </p>
  )
}

// 6. Wie möchte ich leben oder arbeiten?
function LifestyleStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const mapMode = useStore((s) => s.mapMode)
  const setMapMode = useStore((s) => s.setMapMode)
  return (
    <>
      <Legend />
      <CriterionChips groups={['urban', 'natur', 'wasser', 'berge', 'erreichbarkeit', 'stil']} />
      <div className="cat-group">
        <p className="label">Eigene Ziele (Arbeit, Schule …)</p>
        {q.targets.map((t) => (
          <div key={t.id} className="target">
            <Target size={14} />
            <input value={t.label} onChange={(e) => setQuery((x) => void (x.targets.find((y) => y.id === t.id)!.label = e.target.value))} aria-label="Name des Ziels" />
            <input className="km" type="number" min={1} value={t.maxKm} onChange={(e) => setQuery((x) => void (x.targets.find((y) => y.id === t.id)!.maxKm = Number(e.target.value) || 1))} aria-label="höchstens km" />
            <span>km</span>
            <select value={t.mode} onChange={(e) => setQuery((x) => void (x.targets.find((y) => y.id === t.id)!.mode = e.target.value as CriterionMode))} aria-label="Muss oder Wunsch">
              <option value="wish">Wunsch</option>
              <option value="must">Muss</option>
            </select>
            <button className="icon" onClick={() => setQuery((x) => void (x.targets = x.targets.filter((y) => y.id !== t.id)))} aria-label="Ziel entfernen"><X size={14} /></button>
          </div>
        ))}
        <button className={`btn small ${mapMode === 'pick_target' ? 'primary' : ''}`} onClick={() => setMapMode(mapMode === 'pick_target' ? 'idle' : 'pick_target')}>
          <Plus size={14} /> {mapMode === 'pick_target' ? 'Klick in die Karte …' : 'Ziel auf der Karte setzen'}
        </button>
        <p className="fine">Gemessen wird die Luftlinie, nicht die Fahrzeit.</p>
      </div>
    </>
  )
}

// 7. Weitere Anforderungen
function MoreStep() {
  const q = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  return (
    <>
      <Legend />
      <CriterionChips groups={['ausstattung']} />
      <p className="label">Umgang mit unsicheren Angaben</p>
      <Check checked={q.allowUncertain} onChange={(v) => setQuery((x) => void (x.allowUncertain = v))}>
        Extrahierte und KI-vermutete Angaben für Muss-Kriterien und Immobilienart zulassen
      </Check>
      <Check checked={q.includeUnknown.mustCriteria} onChange={(v) => setQuery((x) => void (x.includeUnknown.mustCriteria = v))}>
        Objekte zeigen, bei denen ein Muss-Kriterium unbekannt ist (werden markiert)
      </Check>
      <p className="label">Quellen</p>
      <div className="row">
        {SOURCES.filter((s) => s.integrated).map((s) => (
          <Toggle key={s.id} on={q.sources.includes(s.id)} title={s.note} onClick={() => setQuery((x) => void (x.sources = toggleIn(x.sources, s.id)))}>
            {s.name}
          </Toggle>
        ))}
      </div>
      <p className="fine">Keine Auswahl = alle angebundenen Quellen. Nicht angebunden: {SOURCES.filter((s) => !s.integrated).map((s) => s.name).join(', ')}.</p>
    </>
  )
}

export function FilterPanel() {
  const q = useStore((s) => s.query)
  const summaries = useMemo(() => {
    const n = (k: number, one: string, many: string) => (k === 0 ? 'beliebig' : k === 1 ? `1 ${one}` : `${k} ${many}`)
    const env = q.criteria.filter((c) => !c.id.startsWith('f_')).length + q.targets.length
    const more = q.criteria.filter((c) => c.id.startsWith('f_')).length
    const price = q.price.min !== null || q.price.max !== null
    const size = q.livingArea.min !== null || q.livingArea.max !== null || q.plotArea.min !== null || q.plotArea.max !== null || q.rooms.min !== null || q.rooms.max !== null || q.bedroomsMin !== null
    return {
      where: n(q.areas.length, 'Gebiet', 'Gebiete'),
      what: q.purposes.length ? q.purposes.map((p) => PURPOSES.find((x) => x.id === p)!.label).join(', ') : 'beliebig',
      type: n(q.categories.length, 'Art', 'Arten'),
      deal: q.transactions.length ? q.transactions.join(', ') : 'beliebig',
      budget: price || size ? [price && 'Preis', size && 'Größe'].filter(Boolean).join(' + ') : 'beliebig',
      life: n(env, 'Kriterium', 'Kriterien'),
      more: n(more, 'Anforderung', 'Anforderungen'),
    }
  }, [q])

  return (
    <aside className="panel">
      <Step n={1} title="Wo?" summary={summaries.where}><WhereStep /></Step>
      <Step n={2} title="Was möchtest du damit machen?" summary={summaries.what}><PurposeStep /></Step>
      <Step n={3} title="Welche Immobilie?" summary={summaries.type}><TypeStep /></Step>
      <Step n={4} title="Mieten, kaufen oder pachten?" summary={summaries.deal}><DealStep /></Step>
      <Step n={5} title="Budget und Größe" summary={summaries.budget}><BudgetStep /></Step>
      <Step n={6} title="Wie möchtest du leben oder arbeiten?" summary={summaries.life}><LifestyleStep /></Step>
      <Step n={7} title="Weitere Anforderungen" summary={summaries.more}><MoreStep /></Step>
    </aside>
  )
}
