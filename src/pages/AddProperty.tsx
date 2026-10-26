import { AlertTriangle, CheckCircle2, ClipboardPaste, FileUp, Link2, Loader2, MapPin, PenLine, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { area as fmtArea, parseInput } from '../components/format.ts'
import { Prov } from '../components/Prov.tsx'
import { textFromImage, textFromPdf } from '../import/document.ts'
import { importLink, type LinkImportResult } from '../import/linkImport.ts'
import { missingFields, parseListingText, type Extracted } from '../import/parseText.ts'
import { findDuplicates, type DuplicateHint } from '../lib/duplicates.ts'
import { navigate } from '../lib/router.ts'
import { PRECISION_LABEL } from '../model/listing.ts'
import { IMPORT_METHOD_LABEL, type ImportMethod, type Offer, type Property } from '../model/property.ts'
import type { Fact, Provenance } from '../model/provenance.ts'
import { CATEGORIES, CATEGORY_GROUPS, type Country, type Currency, type Transaction } from '../model/taxonomy.ts'
import { searchAddress, type GeoResult } from '../services/geocode.ts'
import { hostOf, portalForUrl } from '../sources/registry.ts'
import { getSetting, listProperties, saveProperty, setSetting, uid } from '../store/db.ts'
import { useUi } from '../store/ui.ts'

type Tab = 'link' | 'text' | 'doc' | 'form'

interface Draft {
  values: Record<string, string>
  prov: Record<string, Provenance>
  evidence: Record<string, string>
}

const NUM_FIELDS = ['purchasePrice', 'coldRent', 'warmRent', 'livingArea', 'plotArea', 'rooms', 'bedrooms'] as const
const FIELD_LABEL: Record<string, string> = {
  title: 'Titel',
  category: 'Immobilienart',
  transaction: 'Miete, Kauf oder Pacht',
  currency: 'Währung',
  purchasePrice: 'Kaufpreis',
  coldRent: 'Kaltmiete',
  warmRent: 'Warmmiete',
  livingArea: 'Wohnfläche (m²)',
  plotArea: 'Grundstücksfläche (m²)',
  rooms: 'Zimmer',
  bedrooms: 'Schlafzimmer',
  address: 'Adresse oder Lage',
  publishedAt: 'Inseriert am',
  description: 'Beschreibung',
}

function draftFrom(e: Extracted, basis: Provenance): Draft {
  const d: Draft = { values: {}, prov: {}, evidence: {} }
  for (const [k, f] of Object.entries(e)) {
    if (!f) continue
    d.values[k] = String(f.value)
    d.prov[k] = basis
    d.evidence[k] = f.evidence
  }
  return d
}

const emptyDraft = (): Draft => ({ values: { currency: 'EUR' }, prov: {}, evidence: {} })

export function AddProperty() {
  const bump = useUi((s) => s.bump)
  const [tab, setTab] = useState<Tab>('link')
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState<ImportMethod>('user-form')
  const [linkResult, setLinkResult] = useState<LinkImportResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [docText, setDocText] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [permitted, setPermitted] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [geo, setGeo] = useState<GeoResult[] | null>(null)
  const [location, setLocation] = useState<GeoResult | null>(null)
  const [dups, setDups] = useState<DuplicateHint[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSetting<string[]>('permittedHosts', []).then(setPermitted)
  }, [])

  const portal = url ? portalForUrl(url) : null

  const doLink = async (hosts = permitted) => {
    setBusy('Prüfe den Link …')
    setError(null)
    const r = await importLink(url.trim(), hosts)
    setLinkResult(r)
    setBusy(null)
    if (r.mode === 'fetched') {
      setMethod('permitted-public-page')
      setDraft(draftFrom(r.extracted, 'extracted'))
    } else {
      setMethod('manual-link')
      setDraft((d) => d ?? emptyDraft())
    }
  }

  const allowHost = async (host: string) => {
    const next = [...new Set([...permitted, host])]
    await setSetting('permittedHosts', next)
    setPermitted(next)
    setConsent(false)
    doLink(next)
  }

  const doText = (t: string, m: ImportMethod) => {
    const e = parseListingText(t)
    const d = draftFrom(e, 'extracted')
    // bereits eingegebene eigene Werte bleiben erhalten
    if (draft) for (const [k, v] of Object.entries(draft.values)) if (draft.prov[k] === 'user' && v) Object.assign(d, { values: { ...d.values, [k]: v }, prov: { ...d.prov, [k]: 'user' } })
    setMethod(m)
    setDraft(d)
  }

  const doFile = async (file: File) => {
    setError(null)
    try {
      setBusy(file.type === 'application/pdf' ? 'Lese PDF lokal …' : 'Erkenne Text im Bild lokal …')
      const t = file.type === 'application/pdf' ? await textFromPdf(file) : await textFromImage(file, (p) => setBusy(`Erkenne Text im Bild … ${Math.round(p * 100)} %`))
      setDocText(t)
      if (!t.trim()) setError('In der Datei wurde kein Text gefunden.')
      doText(t, 'user-provided-document')
    } catch (e) {
      setError(`Die Datei konnte nicht gelesen werden: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const set = (k: string, v: string) => setDraft((d) => (d ? { values: { ...d.values, [k]: v }, prov: { ...d.prov, [k]: 'user' }, evidence: d.evidence } : d))

  const locate = async () => {
    const q = draft?.values.address
    if (!q) return
    setBusy('Suche die Lage …')
    try {
      setGeo(await searchAddress(q))
    } catch {
      setError('Adresssuche nicht erreichbar.')
    } finally {
      setBusy(null)
    }
  }

  const build = (): Property => {
    const v = draft!.values
    const fact = <T,>(k: string, value: T | null): Fact<T> =>
      value === null || value === undefined || (value as unknown) === '' ? { value: null, provenance: 'unavailable' } : { value, provenance: draft!.prov[k] ?? 'user', basis: draft!.prov[k] === 'extracted' ? (method === 'permitted-public-page' ? 'freigegebene Seite' : IMPORT_METHOD_LABEL[method]) : 'eigene Eingabe' }
    const n = (k: string) => fact<number>(k, v[k] ? parseInput(v[k]) : null)
    const tx = (v.transaction as Transaction) || null
    const now = new Date().toISOString()
    const priceKind: Offer['priceKind'] = tx === 'kauf' ? 'kauf' : tx === 'pacht' ? 'pacht' : v.coldRent ? 'kalt' : 'warm'
    const priceVal = tx === 'kauf' ? n('purchasePrice') : v.coldRent ? n('coldRent') : n('warmRent')
    const p = portal ?? null
    const country: Country = location?.country ?? (v.currency === 'CHF' ? 'CH' : 'DE')
    return {
      id: uid(),
      createdAt: now,
      updatedAt: now,
      country,
      title: fact('title', v.title || (url ? `Inserat auf ${hostOf(url)}` : null)),
      description: fact('description', v.description || null),
      category: fact('category', v.category || null),
      transaction: fact('transaction', tx),
      currency: (v.currency as Currency) || 'EUR',
      purchasePrice: n('purchasePrice'),
      coldRent: n('coldRent'),
      warmRent: n('warmRent'),
      livingArea: n('livingArea'),
      plotArea: n('plotArea'),
      rooms: n('rooms'),
      bedrooms: n('bedrooms'),
      address: fact('address', v.address || null),
      location: location ? { lat: location.lat, lng: location.lng, precision: location.precision, basis: `Photon-Geocoding von „${location.label}“` } : null,
      publishedAt: fact('publishedAt', v.publishedAt || null),
      offers: url || method !== 'user-form'
        ? [{ portalId: p?.id ?? (url ? (hostOf(url) ?? 'unbekannt') : 'eigene Angabe'), url: url.trim() || null, price: priceVal, priceKind, importMethod: method, importedAt: now, lastChecked: method === 'permitted-public-page' ? now : null, active: true }]
        : [],
      notes: '',
      status: 'neu',
    }
  }

  const save = async (mergeInto?: Property) => {
    const candidate = build()
    if (!mergeInto && dups === null) {
      const found = findDuplicates(candidate, await listProperties())
      if (found.length) {
        setDups(found)
        return
      }
    }
    if (mergeInto) await saveProperty({ ...mergeInto, offers: [...mergeInto.offers, ...candidate.offers] })
    else await saveProperty(candidate)
    bump()
    navigate({ page: 'meine' })
  }

  const missing = draft ? missingFields(Object.fromEntries(Object.entries(draft.values).filter(([, x]) => x).map(([k, x]) => [k, { value: x, evidence: '' }])) as Extracted) : []
  const hasUrl = /^https?:\/\/\S+\.\S+/.test(url.trim())

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Immobilien hinzufügen</p>
        <h1>Ein Inserat auf deine Karte holen</h1>
        <p className="lead">Füge einen Link ein, kopiere den Inseratstext oder lade ein Exposé hoch. Alles wird lokal ausgewertet; du prüfst jeden Wert, bevor er gespeichert wird.</p>
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ['link', Link2, 'Per Link'],
            ['text', ClipboardPaste, 'Text einfügen'],
            ['doc', FileUp, 'PDF oder Screenshot'],
            ['form', PenLine, 'Selbst eintragen'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="card pad">
        {tab === 'link' && (
          <>
            <label className="field">
              <span>Link zum Inserat</span>
              <div className="row">
                <input value={url} onChange={(e) => { setUrl(e.target.value); setLinkResult(null) }} placeholder="https://…" />
                <button className="btn primary" disabled={!hasUrl || !!busy} onClick={() => doLink()}>
                  Zur Karte hinzufügen
                </button>
              </div>
            </label>
            {portal && !linkResult && <p className="fine">Erkannt: {portal.name}</p>}
            {linkResult?.mode === 'manual-link' && (
              <div className="notice warn">
                <ShieldCheck size={18} />
                <div>
                  <b>{linkResult.portal.name} erkannt, Link gespeichert.</b>
                  <p>{linkResult.portal.note} Übernimm die Angaben am schnellsten, indem du den sichtbaren Inseratstext kopierst oder das Exposé hochlädst.</p>
                  <div className="row">
                    <button className="btn soft small" onClick={() => setTab('text')}>Text einfügen</button>
                    <button className="btn soft small" onClick={() => setTab('doc')}>PDF/Screenshot</button>
                    <button className="btn ghost small" onClick={() => setTab('form')}>Selbst eintragen</button>
                  </div>
                </div>
              </div>
            )}
            {linkResult?.mode === 'not-permitted' && (
              <div className="notice">
                <ShieldCheck size={18} />
                <div>
                  <b>{linkResult.host} ist nicht freigegeben.</b>
                  <p>StreetSignal ruft unbekannte Seiten nicht automatisch ab. Gib die Domain nur frei, wenn ihre Nutzungsbedingungen einen automatisierten Abruf erlauben (zum Beispiel deine eigene Maklerseite oder eine Seite mit ausdrücklicher Erlaubnis).</p>
                  <label className="check">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>Ich habe die Nutzungsbedingungen von {linkResult.host} geprüft; der Abruf einzelner Inserate ist erlaubt.</span>
                  </label>
                  <div className="row">
                    <button className="btn primary small" disabled={!consent} onClick={() => allowHost(linkResult.host)}>Freigeben und abrufen</button>
                    <button className="btn ghost small" onClick={() => setTab('text')}>Lieber Text einfügen</button>
                  </div>
                </div>
              </div>
            )}
            {linkResult?.mode === 'robots-disallowed' && <div className="notice warn"><AlertTriangle size={18} /><p>Die Seite untersagt automatische Abrufe (robots.txt). Der Link wird nur gespeichert; übernimm die Angaben per Text oder Formular.</p></div>}
            {linkResult?.mode === 'no-server' && <div className="notice"><AlertTriangle size={18} /><p>Der automatische Abruf braucht die lokale Version (<code>npm run dev</code>). Hier wird nur der Link gespeichert; übernimm die Angaben per Text, Dokument oder Formular.</p></div>}
            {linkResult?.mode === 'error' && <div className="notice warn"><AlertTriangle size={18} /><p>{linkResult.message} Der Link bleibt gespeichert.</p></div>}
            {linkResult?.mode === 'fetched' && <div className="notice ok"><CheckCircle2 size={18} /><p>Seite abgerufen. Erkannte Werte unten prüfen. Alles Erkannte ist als „extrahiert“ markiert, bis du es bestätigst oder änderst.</p></div>}
          </>
        )}

        {tab === 'text' && (
          <>
            <label className="field">
              <span>Sichtbarer Inseratstext</span>
              <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Markiere im Inserat den Text (Titel, Preis, Fläche, Zimmer, Adresse, Beschreibung), kopiere ihn und füge ihn hier ein." />
            </label>
            <label className="field">
              <span>Link zum Original (empfohlen)</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </label>
            <button className="btn primary" disabled={text.trim().length < 20} onClick={() => doText(text, 'user-provided-text')}>
              Angaben erkennen
            </button>
          </>
        )}

        {tab === 'doc' && (
          <>
            <label className="drop">
              <FileUp size={26} />
              <b>PDF-Exposé oder Screenshot wählen</b>
              <span>Wird nur auf deinem Rechner gelesen (PDF.js, Tesseract). Bei Bildern lädt Tesseract einmalig das deutsche Sprachmodell.</span>
              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && doFile(e.target.files[0])} />
            </label>
            <label className="field">
              <span>Link zum Original (empfohlen)</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </label>
            {docText !== null && (
              <details className="fine">
                <summary>Erkannter Text ({docText.length} Zeichen)</summary>
                <pre className="doc-text">{docText.slice(0, 4000)}</pre>
              </details>
            )}
          </>
        )}

        {tab === 'form' && !draft && (
          <button className="btn primary" onClick={() => { setMethod(url ? 'manual-link' : 'user-form'); setDraft(emptyDraft()) }}>
            Formular öffnen
          </button>
        )}
        {busy && (
          <p className="busy">
            <Loader2 size={16} className="spin" /> {busy}
          </p>
        )}
        {error && <p className="rfail">{error}</p>}
      </div>

      {draft && (
        <motion.div className="card pad review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="review-head">
            <h2>Angaben prüfen</h2>
            <span className="badge">{IMPORT_METHOD_LABEL[method]}</span>
          </div>
          {missing.length > 0 && (
            <p className="notice soft">
              Noch nicht bekannt: <b>{missing.join(', ')}</b>. Fehlende Werte bleiben „unbekannt“, StreetSignal erfindet nichts.
            </p>
          )}
          <div className="form-grid">
            {(['title', 'category', 'transaction', 'currency', 'purchasePrice', 'coldRent', 'warmRent', 'livingArea', 'plotArea', 'rooms', 'bedrooms', 'publishedAt'] as const).map((k) => (
              <label key={k} className={`field ${k === 'title' ? 'wide' : ''}`}>
                <span>
                  {k === 'coldRent' && draft.values.transaction === 'pacht' ? 'Pacht pro Monat' : FIELD_LABEL[k]} {draft.values[k] && draft.prov[k] && <Prov p={draft.prov[k]} />}
                </span>
                {k === 'category' ? (
                  <select value={draft.values[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
                    <option value="">unbekannt</option>
                    {CATEGORY_GROUPS.map((g) => (
                      <optgroup key={g.id} label={g.label}>
                        {CATEGORIES.filter((c) => c.group === g.id).map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : k === 'transaction' ? (
                  <select value={draft.values[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
                    <option value="">unbekannt</option>
                    <option value="miete">Miete</option>
                    <option value="kauf">Kauf</option>
                    <option value="pacht">Pacht</option>
                  </select>
                ) : k === 'currency' ? (
                  <select value={draft.values[k] ?? 'EUR'} onChange={(e) => set(k, e.target.value)}>
                    <option value="EUR">EUR</option>
                    <option value="CHF">CHF</option>
                  </select>
                ) : (
                  <input
                    type={k === 'publishedAt' ? 'date' : 'text'}
                    inputMode={(NUM_FIELDS as readonly string[]).includes(k) ? 'decimal' : undefined}
                    value={draft.values[k] ?? ''}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder="unbekannt"
                  />
                )}
                {draft.evidence[k] && draft.prov[k] === 'extracted' && <small className="evidence">aus: „{draft.evidence[k].slice(0, 90)}“</small>}
              </label>
            ))}
            <label className="field wide">
              <span>
                {FIELD_LABEL.address} {draft.values.address && draft.prov.address && <Prov p={draft.prov.address} />}
              </span>
              <div className="row">
                <input value={draft.values.address ?? ''} onChange={(e) => { set('address', e.target.value); setLocation(null); setGeo(null) }} placeholder="Straße Nr., PLZ Ort – oder nur Stadtteil/Ort" />
                <button className="btn soft" onClick={locate} disabled={!draft.values.address}>
                  <MapPin size={15} /> Lage bestimmen
                </button>
              </div>
              {geo && !location && (
                <ul className="geo-pick">
                  {geo.length === 0 && <li className="muted">Nichts gefunden. Versuche es mit PLZ und Ort.</li>}
                  {geo.map((g, i) => (
                    <li key={i}>
                      <button onClick={() => setLocation(g)}>
                        <b>{g.label}</b> <small>{g.detail} · {PRECISION_LABEL[g.precision]}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {location && (
                <small className="evidence ok">
                  Position: {location.label}, {location.detail} · Genauigkeit: {PRECISION_LABEL[location.precision]}
                  {location.precision !== 'exact' && ' (wird auf der Karte als Bereich gezeigt, nicht als genauer Punkt)'}
                </small>
              )}
            </label>
            <label className="field wide">
              <span>{FIELD_LABEL.description}</span>
              <textarea rows={3} value={draft.values.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="optional" />
            </label>
          </div>
          {draft.values.livingArea && <p className="fine">Wohnfläche: {fmtArea(parseInput(draft.values.livingArea))}</p>}

          {dups && dups.length > 0 ? (
            <div className="notice warn">
              <AlertTriangle size={18} />
              <div>
                <b>Möglicherweise schon gespeichert</b>
                {dups.map((d) => (
                  <div key={d.property.id} className="dup">
                    <span>
                      „{d.property.title.value}“ ({d.reasons.join(', ')})
                    </span>
                    <button className="btn soft small" onClick={() => save(d.property)}>Als weiteres Angebot dazu</button>
                  </div>
                ))}
                <button className="btn ghost small" onClick={() => { setDups([]); }}>Nein, eigenes Objekt</button>
              </div>
            </div>
          ) : dups === null && (
            <div className="row end">
              {!location && <span className="fine">Ohne Lage erscheint das Objekt nicht auf der Karte.</span>}
              <button className="btn primary" onClick={() => save()}>
                Speichern
              </button>
            </div>
          )}
          {dups && dups.length === 0 && (
            <div className="row end">
              <button className="btn primary" onClick={() => save()}>Als eigenes Objekt speichern</button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
