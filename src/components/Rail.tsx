import { Columns3, Compass, Database, Home, Map, PlusCircle, Sparkles, Star } from 'lucide-react'
import type { Route } from '../lib/router.ts'
import { href } from '../lib/router.ts'
import { Logo } from './Logo.tsx'

const ITEMS: { route: Route; label: string; icon: typeof Map }[] = [
  { route: { page: 'uebersicht' }, label: 'Übersicht', icon: Map },
  { route: { page: 'umgebung' }, label: 'Umgebung erkunden', icon: Compass },
  { route: { page: 'hinzufuegen' }, label: 'Immobilie hinzufügen', icon: PlusCircle },
  { route: { page: 'meine' }, label: 'Meine Immobilien', icon: Star },
  { route: { page: 'vergleich' }, label: 'Vergleichen', icon: Columns3 },
  { route: { page: 'entwicklungen' }, label: 'Neue Entwicklungen', icon: Sparkles },
  { route: { page: 'quellen' }, label: 'Datenquellen & Einstellungen', icon: Database },
]

export function Rail({ current }: { current: Route['page'] }) {
  return (
    <nav className="rail" aria-label="Hauptnavigation">
      <a href={href({ page: 'start' })} className="rail-logo" aria-label="Zur Startseite">
        <Logo size={30} />
      </a>
      <div className="rail-items">
        {ITEMS.map(({ route, label, icon: Icon }) => (
          <a key={route.page} href={href(route)} className={`rail-item ${current === route.page ? 'on' : ''}`} aria-label={label} aria-current={current === route.page ? 'page' : undefined}>
            <Icon size={20} strokeWidth={1.7} />
            <span className="rail-tip">{label}</span>
          </a>
        ))}
      </div>
      <a href={href({ page: 'start' })} className="rail-item rail-home" aria-label="Startseite">
        <Home size={18} strokeWidth={1.7} />
        <span className="rail-tip">Startseite</span>
      </a>
    </nav>
  )
}
