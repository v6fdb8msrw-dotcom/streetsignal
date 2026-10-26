import { Loader2, MapPin, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { searchAddress, type GeoResult } from '../services/geocode.ts'

interface Props {
  onPick: (r: GeoResult) => void
  placeholder?: string
  size?: 'hero' | 'normal'
  autoFocus?: boolean
}

/** Adresssuche mit Verzögerung (Photon wird höchstens einmal pro Sekunde gefragt) */
export function AddressSearch({ onPick, placeholder = 'Adresse, Ort oder PLZ in DE, AT, CH', size = 'normal', autoFocus }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([])
      return
    }
    const my = ++seq.current
    const t = setTimeout(async () => {
      setBusy(true)
      setError(null)
      try {
        const r = await searchAddress(q)
        if (my === seq.current) {
          setResults(r)
          setActive(0)
          setOpen(true)
        }
      } catch {
        if (my === seq.current) setError('Adresssuche gerade nicht erreichbar.')
      } finally {
        if (my === seq.current) setBusy(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [q])

  const pick = (r: GeoResult) => {
    setOpen(false)
    setQ(r.label)
    onPick(r)
  }

  return (
    <div className={`addr size-${size}`} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="addr-box">
        {busy ? <Loader2 size={size === 'hero' ? 22 : 17} className="spin" /> : <Search size={size === 'hero' ? 22 : 17} />}
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
            else if (e.key === 'Enter' && results[active]) pick(results[active])
          }}
          placeholder={placeholder}
          aria-label="Adresse suchen"
          role="combobox"
          aria-expanded={open}
        />
        {size === 'hero' && (
          <button className="btn primary" onClick={() => results[active] && pick(results[active])} disabled={!results.length}>
            Umgebung entdecken
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="addr-list" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(r)}>
                <MapPin size={15} />
                <span>
                  <b>{r.label}</b>
                  <small>{r.detail}</small>
                </span>
              </button>
            </li>
          ))}
          <li className="addr-credit">Suche: Photon · © OpenStreetMap-Mitwirkende</li>
        </ul>
      )}
      {error && <p className="addr-error">{error}</p>}
    </div>
  )
}
