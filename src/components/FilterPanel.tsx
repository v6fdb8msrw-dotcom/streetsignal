import { Lock, Plus, Star, X } from 'lucide-react'
import type { CriterionMode, PropertyFilter } from '../model/query.ts'
import { STATUS_LABEL, type PersonalStatus } from '../model/property.ts'
import { CATEGORY_GROUPS, categoriesFor, COUNTRIES, PURPOSES, transactionsFor, type Country } from '../model/taxonomy.ts'
import { ENV_CRITERIA } from '../search/filter.ts'
import type { GeoResult } from '../services/geocode.ts'
import { AddressSearch } from './AddressSearch.tsx'
import { parseInput } from './format.ts'

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

function Num({ label, value, onChange, suffix }: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string }) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <div className="suffix">
        <input inputMode="decimal" defaultValue={value ?? ''} key={String(value)} onBlur={(e) => onChange(parseInput(e.target.value))} placeholder="beliebig" />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

/** Filter in Schritten (Erweiterung Punkt 11): Wo, Was, Art, Miete/Kauf, Budget/Größe, Umgebung, Status */
export function FilterPanel({ f, set }: { f: PropertyFilter; set: (fn: (f: PropertyFilter) => PropertyFilter) => void }) {
  const cycle = (id: string) =>
    set((x) => {
      const cur = x.criteria.find((c) => c.id === id)
      const criteria = !cur
        ? [...x.criteria, { id, mode: 'wish' as CriterionMode }]
        : cur.mode === 'wish'
          ? x.criteria.map((c) => (c.id === id ? { ...c, mode: 'must' as CriterionMode } : c))
          : x.criteria.filter((c) => c.id !== id)
      return { ...x, criteria }
    })
  const cats = categoriesFor(f.purposes, f.transactions)
  return (
    <div className="filters">
      <section>
        <h4><span>1</span> Wo?</h4>
        <div className="chips">
          {COUNTRIES.map((c) => (
            <button key={c.id} className={`chip ${f.countries.includes(c.id) ? 'on' : ''}`} onClick={() => set((x) => ({ ...x, countries: toggle(x.countries, c.id as Country) }))}>
              {c.label}
            </button>
          ))}
        </div>
        {f.area ? (
          <div className="area-row">
            <span>{f.area.label}</span>
            <input type="range" min={1} max={100} value={f.area.radiusKm} onChange={(e) => set((x) => ({ ...x, area: x.area && { ...x.area, radiusKm: Number(e.target.value) } }))} />
            <b>{f.area.radiusKm} km</b>
            <button className="icon" onClick={() => set((x) => ({ ...x, area: null }))} aria-label="Umkreis entfernen"><X size={14} /></button>
          </div>
        ) : (
          <AddressSearch placeholder="Umkreis um Ort, Adresse oder PLZ" onPick={(r: GeoResult) => set((x) => ({ ...x, area: { label: r.label, lat: r.lat, lng: r.lng, radiusKm: 10 } }))} />
        )}
      </section>
      <section>
        <h4><span>2</span> Was?</h4>
        <div className="chips">
          {PURPOSES.map((p) => (
            <button key={p.id} className={`chip ${f.purposes.includes(p.id) ? 'on' : ''}`} title={p.description} onClick={() => set((x) => ({ ...x, purposes: toggle(x.purposes, p.id) }))}>
              {p.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h4><span>3</span> Mieten, kaufen, pachten?</h4>
        <div className="chips">
          {transactionsFor(f.purposes).map((t) => (
            <button key={t.id} className={`chip ${f.transactions.includes(t.id) ? 'on' : ''}`} onClick={() => set((x) => ({ ...x, transactions: toggle(x.transactions, t.id) }))}>
              {t.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h4><span>4</span> Welche Immobilie?</h4>
        {CATEGORY_GROUPS.map((g) => {
          const list = cats.filter((c) => c.group === g.id)
          if (!list.length) return null
          return (
            <details key={g.id}>
              <summary>
                {g.label} {list.some((c) => f.categories.includes(c.id)) && <b>· {list.filter((c) => f.categories.includes(c.id)).length}</b>}
              </summary>
              <div className="chips">
                {list.map((c) => (
                  <button key={c.id} className={`chip small ${f.categories.includes(c.id) ? 'on' : ''}`} title={c.condition} onClick={() => set((x) => ({ ...x, categories: toggle(x.categories, c.id) }))}>
                    {c.label}
                  </button>
                ))}
              </div>
            </details>
          )
        })}
      </section>
      <section>
        <h4><span>5</span> Budget und Größe</h4>
        <div className="grid2">
          <Num label="Preis ab" value={f.price.min} suffix={f.price.currency} onChange={(v) => set((x) => ({ ...x, price: { ...x.price, min: v } }))} />
          <Num label="Preis bis" value={f.price.max} suffix={f.price.currency} onChange={(v) => set((x) => ({ ...x, price: { ...x.price, max: v } }))} />
          <label className="field compact">
            <span>Währung</span>
            <select value={f.price.currency} onChange={(e) => set((x) => ({ ...x, price: { ...x.price, currency: e.target.value as 'EUR' | 'CHF' } }))}>
              <option>EUR</option>
              <option>CHF</option>
            </select>
          </label>
          <Num label="Zimmer ab" value={f.roomsMin} onChange={(v) => set((x) => ({ ...x, roomsMin: v }))} />
          <Num label="Wohnfläche ab" value={f.livingArea.min} suffix="m²" onChange={(v) => set((x) => ({ ...x, livingArea: { ...x.livingArea, min: v } }))} />
          <Num label="Wohnfläche bis" value={f.livingArea.max} suffix="m²" onChange={(v) => set((x) => ({ ...x, livingArea: { ...x.livingArea, max: v } }))} />
          <Num label="Grundstück ab" value={f.plotArea.min} suffix="m²" onChange={(v) => set((x) => ({ ...x, plotArea: { ...x.plotArea, min: v } }))} />
          <Num label="Grundstück bis" value={f.plotArea.max} suffix="m²" onChange={(v) => set((x) => ({ ...x, plotArea: { ...x.plotArea, max: v } }))} />
        </div>
        <p className="fine">Preise werden nicht zwischen EUR und CHF umgerechnet.</p>
      </section>
      <section>
        <h4><span>6</span> Wie möchtest du leben?</h4>
        <p className="fine">
          Klick: <Star size={11} /> Wunsch, nochmal: <Lock size={11} /> Muss, nochmal: aus. Gemessen an der letzten Umgebungsanalyse jedes Objekts.
        </p>
        <div className="chips">
          {ENV_CRITERIA.map((c) => {
            const mode = f.criteria.find((x) => x.id === c.id)?.mode
            return (
              <button key={c.id} className={`chip crit ${mode ?? ''}`} title={c.hint} onClick={() => cycle(c.id)}>
                {mode === 'must' ? <Lock size={12} /> : mode === 'wish' ? <Star size={12} /> : <Plus size={12} />} {c.label}
              </button>
            )
          })}
        </div>
      </section>
      <section>
        <h4><span>7</span> Weiteres</h4>
        <div className="chips">
          {(Object.keys(STATUS_LABEL) as PersonalStatus[]).map((s) => (
            <button key={s} className={`chip small ${f.statuses.includes(s) ? 'on' : ''}`} onClick={() => set((x) => ({ ...x, statuses: toggle(x.statuses, s) }))}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={f.includeUnknown} onChange={(e) => set((x) => ({ ...x, includeUnknown: e.target.checked }))} />
          <span>Objekte mit unbekannten Werten trotzdem zeigen (werden markiert)</span>
        </label>
      </section>
    </div>
  )
}
