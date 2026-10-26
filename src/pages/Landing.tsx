import { ArrowRight, Building2, Compass, FileText, Layers, Leaf, Scale, Sparkles, Trees, Volume2 } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { AddressSearch } from '../components/AddressSearch.tsx'
import { Wordmark } from '../components/Logo.tsx'
import { href, navigate } from '../lib/router.ts'
import type { GeoResult } from '../services/geocode.ts'
import { DATA_SOURCES } from '../sources/registry.ts'

const base = import.meta.env.BASE_URL

const SLIDES = [
  { src: `${base}images/haus-im-gruenen.jpg`, caption: 'Modernes Wohnen im Grünen' },
  { src: `${base}images/dachterrasse.jpg`, caption: 'Penthouse mit Weitblick' },
  { src: `${base}images/alpenchalet.jpg`, caption: 'Chalet in den Alpen' },
]

const SIGNALS = [
  { icon: Volume2, label: 'Lärmkarten', x: '1%', y: '8%' },
  { icon: Trees, label: 'Parks & Natur', x: '86%', y: '4%' },
  { icon: FileText, label: 'Bebauungspläne', x: '87%', y: '72%' },
  { icon: Scale, label: 'Bodenrichtwerte', x: '0%', y: '78%' },
]

function Hero({ onPick }: { onPick: (r: GeoResult) => void }) {
  const [i, setI] = useState(0)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 40, damping: 18 })
  const sy = useSpring(my, { stiffness: 40, damping: 18 })
  const imgX = useTransform(sx, (v) => v * -18)
  const imgY = useTransform(sy, (v) => v * -12)
  const chipX = useTransform(sx, (v) => v * 22)
  const chipY = useTransform(sy, (v) => v * 16)

  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 7000)
    return () => clearInterval(t)
  }, [])

  const onMove = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }

  return (
    <section className="hero" onMouseMove={onMove}>
      <motion.div className="hero-media" style={{ x: imgX, y: imgY }}>
        <AnimatePresence>
          <motion.img
            key={SLIDES[i].src}
            src={SLIDES[i].src}
            alt={SLIDES[i].caption}
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1.02 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.6 }, scale: { duration: 9, ease: 'linear' } }}
          />
        </AnimatePresence>
      </motion.div>
      <div className="hero-veil" />

      <header className="hero-top">
        <Wordmark light />
        <nav>
          <a href={href({ page: 'umgebung' })}>Umgebung erkunden</a>
          <a href={href({ page: 'hinzufuegen' })}>Immobilie hinzufügen</a>
          <a href={href({ page: 'quellen' })}>Datenquellen</a>
          <a className="btn glass" href={href({ page: 'uebersicht' })}>
            Zur Karte <ArrowRight size={16} />
          </a>
        </nav>
      </header>

      <motion.div className="hero-signals" style={{ x: chipX, y: chipY }} aria-hidden>
        {SIGNALS.map((s, k) => (
          <motion.span
            key={s.label}
            className="signal-chip"
            style={{ left: s.x, top: s.y }}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
            transition={{ opacity: { delay: 0.8 + k * 0.25 }, scale: { delay: 0.8 + k * 0.25 }, y: { duration: 5 + k, repeat: Infinity, ease: 'easeInOut', delay: k * 0.6 } }}
          >
            <s.icon size={15} /> {s.label}
          </motion.span>
        ))}
      </motion.div>

      <div className="hero-center">
        <motion.p className="eyebrow light" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.8 }}>
          Standortanalyse für Deutschland, Österreich und die Schweiz
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
          Discover what surrounds you.
          <br />
          <em>Understand what comes next.</em>
        </motion.h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.8 }}>
          Gib eine Adresse ein und sieh, was eine Wohnung wirklich umgibt: Lärm, Grün, Nahverkehr, Bebauungspläne und Bodenrichtwerte, jeweils mit Quelle und Datenstand.
        </motion.p>
        <motion.div className="hero-search" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <div className="pulse" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <AddressSearch size="hero" onPick={onPick} placeholder="z. B. Berger Straße 120, Frankfurt" />
        </motion.div>
        <div className="hero-dots" role="tablist" aria-label="Bilder">
          {SLIDES.map((s, k) => (
            <button key={s.src} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={s.caption} />
          ))}
          <span>{SLIDES[i].caption}</span>
        </div>
      </div>
    </section>
  )
}

function TiltCard({ img, title, text, items }: { img: string; title: string; text: string; items: string[] }) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 120, damping: 14 })
  const sry = useSpring(ry, { stiffness: 120, damping: 14 })
  return (
    <motion.article
      className="tilt"
      style={{ rotateX: srx, rotateY: sry }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 10)
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8)
      }}
      onMouseLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <img src={img} alt="" loading="lazy" />
      <div className="tilt-body">
        <h3>{title}</h3>
        <p>{text}</p>
        <ul>
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </motion.article>
  )
}

const STEPS = [
  { icon: Compass, title: 'Adresse wählen', text: 'Suche einen Ort oder klick in die Karte. Lege den Umkreis fest: 250 m bis 3 km.' },
  { icon: Layers, title: 'Umgebung verstehen', text: 'StreetSignal fragt offene Daten ab und zeigt jede Angabe mit Quelle, Datenstand und Aussagekraft.' },
  { icon: Building2, title: 'Immobilien vergleichen', text: 'Speichere Inserate per Link, Text oder PDF und vergleiche sie nach deinen eigenen Gewichtungen.' },
]

export function Landing() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const bandY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])
  const live = DATA_SOURCES.filter((s) => s.status === 'aktiv' && s.category !== 'Bilder')

  const pick = (r: GeoResult) => navigate({ page: 'umgebung', lat: r.lat, lng: r.lng, label: r.label })

  return (
    <div className="landing">
      <Hero onPick={pick} />

      <section className="lp-section">
        <motion.div className="lp-head" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <p className="eyebrow">Was eine Anzeige nicht verrät</p>
          <h2>Jede Wohnung hat eine Umgebung. Wir machen sie sichtbar.</h2>
        </motion.div>
        <div className="tilt-grid">
          <TiltCard img={`${base}images/haus-im-gruenen.jpg`} title="Im Grünen" text="Wie weit ist der nächste Park, Wald oder See wirklich?" items={['Parks und Grünflächen', 'Wälder und Gewässer', 'Aussichtspunkte']} />
          <TiltCard img={`${base}images/dachterrasse.jpg`} title="In der Stadt" text="Wie laut ist es, und wie gut komme ich weg?" items={['Kartierte Lärmbelastung', 'Bus, Tram und Bahn', 'Schulen, Kitas, Ärzte']} />
          <TiltCard img={`${base}images/alpenchalet.jpg`} title="Was kommt" text="Was ist rundherum geplant oder im Bau?" items={['Bebauungspläne', 'Baustellen', 'Vorlagen aus dem Stadtrat']} />
        </div>
      </section>

      <section className="lp-band" ref={ref}>
        <motion.img src={`${base}images/waldhaus.jpg`} alt="" style={{ y: bandY }} />
        <div className="lp-band-veil" />
        <div className="lp-band-inner">
          <p className="eyebrow light">So funktioniert StreetSignal</p>
          <div className="steps">
            {STEPS.map((s, k) => (
              <motion.div key={s.title} className="step" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.15, duration: 0.7 }}>
                <span className="step-n">{k + 1}</span>
                <s.icon size={22} />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-sources">
        <div className="lp-head">
          <p className="eyebrow">Offene Daten, offen gezeigt</p>
          <h2>Keine Blackbox. Jede Zahl hat eine Quelle.</h2>
          <p className="lead">StreetSignal nutzt ausschließlich kostenlose, öffentlich lizenzierte Daten. Was nicht angebunden ist, steht auch so da, statt geschätzt zu werden.</p>
        </div>
        <div className="source-cloud">
          {live.map((s, k) => (
            <motion.a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: k * 0.05 }}>
              <Leaf size={13} /> {s.name}
            </motion.a>
          ))}
        </div>
        <a className="btn ghost" href={href({ page: 'quellen' })}>
          Alle Quellen, Lizenzen und Grenzen ansehen <ArrowRight size={16} />
        </a>
      </section>

      <section className="lp-cta">
        <Sparkles size={22} />
        <h2>Bereit, deinen nächsten Ort zu verstehen?</h2>
        <div className="lp-cta-row">
          <a className="btn primary lg" href={href({ page: 'umgebung' })}>
            Umgebung erkunden <ArrowRight size={18} />
          </a>
          <a className="btn soft lg" href={href({ page: 'hinzufuegen' })}>
            Immobilie hinzufügen
          </a>
        </div>
      </section>

      <footer className="lp-footer">
        <Wordmark />
        <p>
          Lokaler Prototyp. Alle Daten bleiben in deinem Browser. Karten © OpenFreeMap, © OpenStreetMap-Mitwirkende. Fotos: Unsplash. Rechtsverbindlich sind nur die Originaldokumente der jeweiligen Behörden.
        </p>
      </footer>
    </div>
  )
}
