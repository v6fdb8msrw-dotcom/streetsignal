import { Compass, ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../lib/router.ts'
import { PRECISION_LABEL } from '../model/listing.ts'
import { completeness, IMPORT_METHOD_LABEL, pricePerSqm, STATUS_LABEL, type PersonalStatus, type Property } from '../model/property.ts'
import type { Fact } from '../model/provenance.ts'
import { category } from '../model/taxonomy.ts'
import { PORTALS } from '../sources/registry.ts'
import { deleteProperty, saveProperty } from '../store/db.ts'
import { useUi } from '../store/ui.ts'
import { area, date, money, num } from './format.ts'
import { Prov } from './Prov.tsx'

function Row({ label, f, fmt }: { label: string; f: Fact<number> | Fact<string>; fmt: (v: never) => string }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b>{f.value === null ? 'unbekannt' : fmt(f.value as never)}</b>
      <Prov p={f.provenance} />
    </div>
  )
}

export function PropertyDetail({ p, onDeleted }: { p: Property; onDeleted?: () => void }) {
  const bump = useUi((s) => s.bump)
  const [notes, setNotes] = useState(p.notes)
  const c = completeness(p)
  const sqm = pricePerSqm(p)
  const update = async (patch: Partial<Property>) => {
    await saveProperty({ ...p, ...patch })
    bump()
  }
  return (
    <div className="pdetail">
      <div className="status-row" role="radiogroup" aria-label="Persönlicher Status">
        {(Object.keys(STATUS_LABEL) as PersonalStatus[]).map((s) => (
          <button key={s} className={`chip ${p.status === s ? 'on' : ''}`} onClick={() => update({ status: s })} role="radio" aria-checked={p.status === s}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="kvs">
        <Row label="Immobilienart" f={p.category} fmt={(v: string) => category(v)?.label ?? v} />
        <Row label="Angebot" f={p.transaction} fmt={(v: string) => ({ miete: 'Miete', kauf: 'Kauf', pacht: 'Pacht' })[v] ?? v} />
        <Row label="Kaufpreis" f={p.purchasePrice} fmt={(v: number) => money(v, p.currency)} />
        <Row label={p.transaction.value === 'pacht' ? 'Pacht/Monat' : 'Kaltmiete'} f={p.coldRent} fmt={(v: number) => money(v, p.currency)} />
        <Row label="Warmmiete" f={p.warmRent} fmt={(v: number) => money(v, p.currency)} />
        <Row label="Wohnfläche" f={p.livingArea} fmt={(v: number) => area(v)} />
        <Row label="Grundstücksfläche" f={p.plotArea} fmt={(v: number) => area(v)} />
        <Row label="Zimmer" f={p.rooms} fmt={(v: number) => num(v)} />
        <Row label="Adresse/Lage" f={p.address} fmt={(v: string) => v} />
        <Row label="Inseriert am" f={p.publishedAt} fmt={(v: string) => date(v)} />
        <div className="kv">
          <span>Preis pro m²</span>
          <b>{sqm === null ? 'nicht berechenbar' : money(sqm, p.currency, sqm < 100 ? 2 : 0)}</b>
          <span className="prov calc">berechnet</span>
        </div>
        <div className="kv">
          <span>Lage auf der Karte</span>
          <b>{p.location ? PRECISION_LABEL[p.location.precision] : 'nicht bestimmt'}</b>
          {p.location && <small className="muted">{p.location.basis}</small>}
        </div>
        <div className="kv">
          <span>Datenqualität</span>
          <b>
            {c.known} von {c.total} Kernangaben bekannt
          </b>
        </div>
      </div>

      <h4>Originalanzeigen ({p.offers.length})</h4>
      {p.offers.length === 0 && <p className="muted small">Keine Originalanzeige verknüpft (selbst eingetragen).</p>}
      <ul className="offers">
        {p.offers.map((o, i) => (
          <li key={i}>
            <span>{PORTALS.find((x) => x.id === o.portalId)?.name ?? o.portalId}</span>
            <span>{o.price.value !== null ? money(o.price.value, p.currency) : 'Preis unbekannt'}</span>
            <small>
              {IMPORT_METHOD_LABEL[o.importMethod]} · übernommen {date(o.importedAt)} · {o.lastChecked ? `geprüft ${date(o.lastChecked)}` : 'wird nicht automatisch aktualisiert'}
            </small>
            {o.url && (
              <a href={o.url} target="_blank" rel="noopener noreferrer">
                Original öffnen <ExternalLink size={12} />
              </a>
            )}
          </li>
        ))}
      </ul>

      <label className="field">
        <span>Eigene Notizen</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== p.notes && update({ notes })} placeholder="z. B. Besichtigung am …" />
      </label>

      <div className="row">
        {p.location && (
          <button className="btn primary small" onClick={() => navigate({ page: 'umgebung', lat: p.location!.lat, lng: p.location!.lng, label: p.title.value ?? 'Immobilie', target: p.id })}>
            <Compass size={14} /> Umgebung analysieren
          </button>
        )}
        <button
          className="btn ghost small danger"
          onClick={async () => {
            if (!confirm(`„${p.title.value ?? 'Immobilie'}“ und ihre Umgebungsberichte löschen?`)) return
            await deleteProperty(p.id)
            bump()
            onDeleted?.()
          }}
        >
          <Trash2 size={14} /> Löschen
        </button>
      </div>
    </div>
  )
}
