import { Bell, BellOff, FolderOpen, Pencil, Trash2, Upload, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { build, validateSpec, type Spec } from '../data/build.ts'
import { SOURCES } from '../data/sources.ts'
import { PLACES } from '../model/geo.ts'
import type { LocationPrecision } from '../model/listing.ts'
import { CATEGORIES, CATEGORY_GROUPS, COUNTRIES, type Country, type Purpose, type Transaction } from '../model/taxonomy.ts'
import { useStore } from '../store/store.ts'
import { activeChips } from './chips.ts'
import { parseNum } from './format.ts'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Schließen"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function SaveDialog({ onClose }: { onClose: () => void }) {
  const { profiles, activeProfileId, query, saveProfile } = useStore()
  const active = profiles.find((p) => p.id === activeProfileId)
  const chips = activeChips(query)
  const [name, setName] = useState(active?.name ?? suggestName(chips.map((c) => c.label)))
  return (
    <Modal title="Suche als Profil speichern" onClose={onClose}>
      <label className="text">
        <span>Name</span>
        <input autoFocus onFocus={(e) => e.target.select()} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Penthouse in Frankfurt bis 2.000 € kalt" />
      </label>
      <p className="label">Gespeichert werden</p>
      <div className="row">{chips.length ? chips.map((c) => <span key={c.key} className={`chip on static ${c.tone ?? ''}`}>{c.label}</span>) : <span className="fine">keine Filter (alle Objekte)</span>}</div>
      <p className="fine">Dazu Suchradien, Sortierung, Quellen und der Umgang mit unbekannten Werten.</p>
      <div className="modal-actions">
        {active && <button className="btn" onClick={() => { saveProfile(name.trim() || 'Suche', true); onClose() }}>Als neues Profil</button>}
        <button className="btn primary" disabled={!name.trim()} onClick={() => { saveProfile(name.trim(), false); onClose() }}>
          {active ? `„${active.name}“ aktualisieren` : 'Speichern'}
        </button>
      </div>
    </Modal>
  )
}

function suggestName(labels: string[]): string {
  return labels.filter((l) => !l.startsWith('Quelle')).slice(0, 3).join(', ') || 'Meine Suche'
}

export function ProfilesDialog({ onClose }: { onClose: () => void }) {
  const { profiles, activeProfileId, loadProfile, deleteProfile, renameProfile, toggleNotify } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [text, setText] = useState('')
  return (
    <Modal title="Gespeicherte Suchprofile" onClose={onClose}>
      {profiles.length === 0 && <p className="fine">Noch keine Profile. Stell eine Suche zusammen und klick auf „Suche speichern“.</p>}
      <div className="profiles">
        {profiles.map((p) => (
          <div key={p.id} className={`profile ${p.id === activeProfileId ? 'active' : ''}`}>
            {editing === p.id ? (
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { renameProfile(p.id, text.trim() || p.name); setEditing(null) }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            ) : (
              <div className="profile-name">
                <strong>{p.name}</strong>
                <small>{activeChips(p.query).length} Filter · geändert {new Date(p.updatedAt).toLocaleDateString('de-DE')}</small>
              </div>
            )}
            <button className="btn small primary" onClick={() => { loadProfile(p.id); onClose() }}><FolderOpen size={13} /> Öffnen</button>
            <button className="icon" onClick={() => { setEditing(p.id); setText(p.name) }} aria-label="Umbenennen"><Pencil size={14} /></button>
            <button
              className={`icon ${p.notify ? 'on' : ''}`}
              onClick={() => toggleNotify(p.id)}
              title="Vorbereitet: Benachrichtigung bei neuen Treffern. Aktiv wird sie erst, wenn eine Quelle mit zulässigem Feed angebunden ist."
              aria-label="Benachrichtigung vormerken"
            >
              {p.notify ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
            <button className="icon danger" onClick={() => deleteProfile(p.id)} aria-label="Profil löschen"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <p className="fine">Benachrichtigungen sind vorgemerkt, aber noch nicht aktiv: Keine der angebundenen Quellen bietet einen Feed, der wiederholt abgefragt werden darf.</p>
    </Modal>
  )
}

export function ManualDialog({ onClose }: { onClose: () => void }) {
  const addManual = useStore((s) => s.addManual)
  const [f, setF] = useState({ title: '', url: '', country: 'DE' as Country, placeId: '', lat: '', lng: '', tx: 'miete' as Transaction, cat: 'wohnung', price: '', living: '', plot: '', rooms: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const place = PLACES.find((p) => p.id === f.placeId)
  const lat = parseNum(f.lat)
  const lng = parseNum(f.lng)
  const hasExact = lat !== null && lng !== null
  const validUrl = /^https?:\/\/\S+\.\S+/.test(f.url)
  const ok = f.title.trim() && validUrl && (place || hasExact)

  const save = () => {
    if (!ok) return
    const cat = CATEGORIES.find((c) => c.id === f.cat)!
    const purposes: Purpose[] = cat.purposes.filter((p) => p !== 'kapitalanlage')
    const price = parseNum(f.price) ?? undefined
    const spec: Spec = {
      id: `manual-${Date.now()}`,
      src: 'manual',
      prov: 'user',
      url: f.url.trim(),
      title: f.title.trim(),
      cats: [f.cat],
      purposes: purposes.length ? purposes : cat.purposes,
      tx: f.tx,
      country: place?.country ?? f.country,
      region: place?.region ?? '',
      city: place?.name ?? '',
      pos: hasExact ? [lat!, lng!] : place!.center,
      prec: (hasExact ? 'exact' : 'city') as LocationPrecision,
      cold: f.tx === 'miete' ? price : undefined,
      buy: f.tx === 'kauf' ? price : undefined,
      lease: f.tx === 'pacht' ? price : undefined,
      living: parseNum(f.living) ?? undefined,
      plot: parseNum(f.plot) ?? undefined,
      rooms: parseNum(f.rooms) ?? undefined,
      added: new Date().toISOString().slice(0, 10),
    }
    addManual(build(spec))
    onClose()
  }

  return (
    <Modal title="Objekt manuell speichern" onClose={onClose}>
      <p className="fine">Für Anzeigen, die du selbst gefunden hast. Alle Angaben gelten als „vom Nutzer eingegeben“. Umgebungsdaten werden für eigene Objekte noch nicht berechnet und bleiben „nicht verfügbar“.</p>
      <label className="text"><span>Titel</span><input value={f.title} onChange={set('title')} /></label>
      <label className="text"><span>Link zur Originalanzeige</span><input value={f.url} onChange={set('url')} placeholder="https://…" /></label>
      <div className="field-row">
        <label className="text"><span>Ort</span>
          <select value={f.placeId} onChange={set('placeId')}>
            <option value="">– Ort wählen –</option>
            {COUNTRIES.map((c) => (
              <optgroup key={c.id} label={c.label}>
                {PLACES.filter((p) => p.country === c.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text"><span>Land (falls kein Ort)</span>
          <select value={f.country} onChange={set('country')}>{COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
      </div>
      <div className="field-row">
        <label className="text"><span>Breite (optional, genau)</span><input value={f.lat} onChange={set('lat')} placeholder="50,11" /></label>
        <label className="text"><span>Länge</span><input value={f.lng} onChange={set('lng')} placeholder="8,68" /></label>
      </div>
      <div className="field-row">
        <label className="text"><span>Transaktion</span>
          <select value={f.tx} onChange={set('tx')}><option value="miete">Miete</option><option value="kauf">Kauf</option><option value="pacht">Pacht</option></select>
        </label>
        <label className="text"><span>Immobilienart</span>
          <select value={f.cat} onChange={set('cat')}>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {CATEGORIES.filter((c) => c.group === g.id && c.transactions.includes(f.tx)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row three">
        <label className="text"><span>{f.tx === 'kauf' ? 'Kaufpreis' : f.tx === 'pacht' ? 'Pacht/Monat' : 'Kaltmiete'}</span><input value={f.price} onChange={set('price')} inputMode="decimal" /></label>
        <label className="text"><span>Wohnfläche m²</span><input value={f.living} onChange={set('living')} inputMode="decimal" /></label>
        <label className="text"><span>Grundstück m²</span><input value={f.plot} onChange={set('plot')} inputMode="decimal" /></label>
      </div>
      <label className="text"><span>Zimmer</span><input value={f.rooms} onChange={set('rooms')} inputMode="decimal" /></label>
      {!validUrl && f.url && <p className="fine err">Bitte einen vollständigen Link mit https:// angeben.</p>}
      <div className="modal-actions">
        <button className="btn primary" disabled={!ok} onClick={save}>Speichern</button>
      </div>
    </Modal>
  )
}

export function SourcesDialog({ onClose }: { onClose: () => void }) {
  const { importedListings, setImported } = useStore()
  const [msg, setMsg] = useState('')
  const onFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!Array.isArray(data)) throw new Error('Die Datei muss eine Liste von Inseraten enthalten.')
      const errors = data.map(validateSpec).filter((e): e is string => e !== null)
      if (errors.length) throw new Error(errors.slice(0, 3).join('; '))
      setImported((data as Spec[]).map((s) => build({ ...s, src: 'import', id: `import-${s.id}` })))
      setMsg(`${data.length} Inserate importiert.`)
    } catch (e) {
      setMsg(`Import fehlgeschlagen: ${(e as Error).message}`)
    }
  }
  return (
    <Modal title="Quellen" onClose={onClose}>
      <div className="sources">
        {SOURCES.map((s) => (
          <div key={s.id} className={`source ${s.integrated ? '' : 'off'}`}>
            <span className={`dot ${s.integrated ? 'on' : ''}`} />
            <div>
              <strong>{s.name}</strong> <small>{s.integrated ? 'angebunden' : 'nicht angebunden'}</small>
              <p className="fine">{s.note}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="label">Inserate aus Datei importieren</p>
      <p className="fine">JSON-Liste im Format der Beispieldaten (Felder id, title, cats, purposes, tx, country, region, city, pos, prec, Preise, Flächen, optional url und geo). Nur Daten verwenden, die du nutzen darfst.</p>
      <div className="row">
        <label className="btn small"><Upload size={13} /> Datei wählen<input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        {importedListings.length > 0 && <button className="btn small" onClick={() => { setImported([]); setMsg('Import entfernt.') }}>Import entfernen ({importedListings.length})</button>}
      </div>
      {msg && <p className="fine">{msg}</p>}
    </Modal>
  )
}
