import { AlertTriangle, Check, CircleHelp, ExternalLink, HelpCircle, Layers, Minus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { sourceById } from '../data/sources.ts'
import { FEATURE_LABEL, STYLE_LABEL, type MatchStatus } from '../model/criteria.ts'
import { PRECISION_LABEL, type FeatureKey, type StyleKey } from '../model/listing.ts'
import { PROVENANCE_LABEL, PROVENANCE_SHORT, type Fact, type Provenance } from '../model/provenance.ts'
import { category } from '../model/taxonomy.ts'
import type { ListingResult, ResultGroup } from '../search/engine.ts'
import { useStore } from '../store/store.ts'
import { area, money, num } from './format.ts'

function Prov({ p }: { p: Provenance }) {
  return <span className={`prov ${p}`} title={PROVENANCE_LABEL[p]}>{PROVENANCE_SHORT[p]}</span>
}

function FactRow({ label, f, fmt }: { label: string; f: Fact<number>; fmt: (v: number) => string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <b>{f.value === null ? 'nicht angegeben' : fmt(f.value)}</b>
      <Prov p={f.provenance} />
    </div>
  )
}

const STATUS_ICON: Record<MatchStatus, typeof Check> = { yes: Check, uncertain: HelpCircle, no: Minus, unknown: CircleHelp }
const STATUS_TEXT: Record<MatchStatus, string> = { yes: 'erfüllt', uncertain: 'unsicher erfüllt', no: 'nicht erfüllt', unknown: 'unbekannt' }

function Detail({ r, offers }: { r: ListingResult; offers: ListingResult[] }) {
  const l = r.listing
  const removeManual = useStore((s) => s.removeManual)
  const featureEntries = Object.entries(l.features) as [FeatureKey, Fact<boolean>][]
  const styleEntries = Object.entries(l.styles) as [StyleKey, Fact<boolean>][]
  return (
    <div className="detail" onClick={(e) => e.stopPropagation()}>
      {r.criteria.length > 0 && (
        <div className="crit-table">
          <p className="label">Deine Kriterien für dieses Objekt</p>
          {r.criteria.map((c) => {
            const Icon = STATUS_ICON[c.evaluation.status]
            return (
              <div key={c.id} className={`crit-row ${c.evaluation.status}`}>
                <Icon size={14} />
                <span className={`tag ${c.mode}`}>{c.mode === 'must' ? 'Muss' : 'Wunsch'}</span>
                <span className="crit-name">{c.label}</span>
                <span className="crit-ev" title={STATUS_TEXT[c.evaluation.status]}>{c.evaluation.evidence}</span>
                {c.evaluation.status !== 'unknown' && <Prov p={c.evaluation.provenance} />}
              </div>
            )
          })}
        </div>
      )}

      <div className="facts">
        <FactRow label="Wohnfläche" f={l.sizes.livingArea} fmt={(v) => area(v)} />
        {l.sizes.usableArea.value !== null && <FactRow label="Nutzfläche" f={l.sizes.usableArea} fmt={(v) => area(v)} />}
        <FactRow label="Grundstücksfläche" f={l.sizes.plotArea} fmt={(v) => area(v)} />
        <FactRow label="Zimmer" f={l.sizes.rooms} fmt={num} />
        {l.prices.coldRent.value !== null && <FactRow label="Kaltmiete" f={l.prices.coldRent} fmt={(v) => money(v, l.prices.currency)} />}
        {l.prices.warmRent.value !== null && <FactRow label="Warmmiete" f={l.prices.warmRent} fmt={(v) => money(v, l.prices.currency)} />}
        {l.prices.serviceCharges.value !== null && <FactRow label="Nebenkosten" f={l.prices.serviceCharges} fmt={(v) => money(v, l.prices.currency)} />}
        {l.prices.purchase.value !== null && <FactRow label="Kaufpreis" f={l.prices.purchase} fmt={(v) => money(v, l.prices.currency)} />}
        {l.prices.lease.value !== null && <FactRow label="Pacht/Monat" f={l.prices.lease} fmt={(v) => money(v, l.prices.currency)} />}
        {r.price.perSqm !== null && <div className="fact"><span>Preis pro m²</span><b>{money(r.price.perSqm, r.price.currency, r.price.perSqm < 100 ? 2 : 0)}</b><span className="prov calc" title="aus Preis und Fläche berechnet">berechnet</span></div>}
      </div>

      <div className="tags-line">
        {l.categories.map((c) => <span key={c.value} className="pill">{category(c.value ?? '')?.label ?? c.value} <Prov p={c.provenance} /></span>)}
        {featureEntries.map(([k, f]) => <span key={k} className={`pill ${f.value ? '' : 'neg'}`}>{f.value ? '' : 'kein/e '}{FEATURE_LABEL[k]} <Prov p={f.provenance} /></span>)}
        {styleEntries.map(([k, f]) => <span key={k} className="pill style">{STYLE_LABEL[k]} <Prov p={f.provenance} /></span>)}
      </div>

      {l.description && <p className="desc">„{l.description}“</p>}
      <p className="fine">
        Standort: {PRECISION_LABEL[l.precision]}{l.address.street ? `, ${l.address.street}` : ''}, {l.address.postcode ?? ''} {l.address.city}
        {l.availableFrom.value && ` · frei ab ${new Date(l.availableFrom.value).toLocaleDateString('de-DE')}`}
      </p>

      <div className="offers">
        {offers.map((o) => {
          const src = sourceById(o.listing.sourceId)
          return (
            <div key={o.listing.id} className="offer">
              <span>{src?.name ?? o.listing.sourceId}</span>
              <span>{money(o.price.value, o.price.currency)}</span>
              {o.listing.url ? (
                <a href={o.listing.url} target="_blank" rel="noopener noreferrer">Originalanzeige <ExternalLink size={12} /></a>
              ) : (
                <span className="muted">Beispieldatensatz, keine Originalanzeige</span>
              )}
              {o.listing.sourceId === 'manual' && <button className="icon" onClick={() => removeManual(o.listing.id)} aria-label="Gespeichertes Objekt löschen"><Trash2 size={13} /></button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ g }: { g: ResultGroup }) {
  const r = g.primary
  const l = r.listing
  const selected = useStore((s) => s.selectedId === l.id)
  const hovered = useStore((s) => s.hoveredId === l.id)
  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const cat = l.categories.find((c) => c.provenance === 'source' || c.provenance === 'user') ?? l.categories[0]
  const size = l.sizes.livingArea.value ?? l.sizes.usableArea.value
  return (
    <div
      ref={ref}
      className={`card ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`}
      onClick={() => select(selected ? null : l.id)}
      onMouseEnter={() => hover(l.id)}
      onMouseLeave={() => hover(null)}
    >
      <div className="card-top">
        <span className="kicker">{cat ? category(cat.value ?? '')?.label : 'Immobilie'} · {l.transaction === 'miete' ? 'Miete' : l.transaction === 'kauf' ? 'Kauf' : 'Pacht'}</span>
        {g.offers.length > 1 && <span className="badge" title="Dasselbe Objekt in mehreren Quellen"><Layers size={11} /> {g.offers.length} Quellen</span>}
        {l.sourceId === 'manual' && <span className="badge manual">gespeichert</span>}
      </div>
      <h3>{l.title}</h3>
      <div className="card-meta">
        <strong>{money(r.price.value, r.price.currency)}</strong>
        <small>{r.price.label}</small>
        <span>{size !== null ? area(size) : 'Fläche k. A.'}</span>
        {l.sizes.rooms.value !== null && <span>{num(l.sizes.rooms.value)} Zi.</span>}
        {l.sizes.plotArea.value !== null && <span>{area(l.sizes.plotArea)} Grund</span>}
      </div>
      <div className="card-foot">
        <span>{l.address.city}, {l.address.country}</span>
        {r.wishes.total > 0 && (
          <span className="wishbar" title={`${r.wishes.yes} erfüllt, ${r.wishes.uncertain} unsicher, ${r.wishes.unknown} unbekannt, ${r.wishes.no} nicht erfüllt`}>
            {Array.from({ length: r.wishes.total }, (_, i) => {
              const cls = i < r.wishes.yes ? 'yes' : i < r.wishes.yes + r.wishes.uncertain ? 'uncertain' : i < r.wishes.yes + r.wishes.uncertain + r.wishes.unknown ? 'unknown' : 'no'
              return <i key={i} className={cls} />
            })}
            {r.wishes.yes}/{r.wishes.total} Wünsche
          </span>
        )}
      </div>
      {(r.unknownMusts.length > 0 || r.includedUnknown.length > 0) && (
        <div className="warn"><AlertTriangle size={13} /> Unbekannt: {[...r.includedUnknown, ...r.unknownMusts].join(', ')}</div>
      )}
      {selected && <Detail r={r} offers={g.offers} />}
    </div>
  )
}

export function ResultList({ groups }: { groups: ResultGroup[] }) {
  if (groups.length === 0)
    return (
      <div className="empty">
        <p><strong>Keine Treffer.</strong></p>
        <p>Entferne oben einzelne Filter oder schließe unbekannte Werte ein.</p>
      </div>
    )
  return (
    <div className="list">
      {groups.map((g) => <Card key={g.objectId} g={g} />)}
    </div>
  )
}
