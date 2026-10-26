import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { LANDSCAPES, PLACES } from '../model/geo.ts'
import { PRECISION_LABEL, PRECISION_RADIUS_M } from '../model/listing.ts'
import type { SearchArea } from '../model/query.ts'
import type { ResultGroup } from '../search/engine.ts'
import { useStore } from '../store/store.ts'
import { sourceById } from '../data/sources.ts'
import { area, money } from './format.ts'

const uid = () => Math.random().toString(36).slice(2, 9)

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function markerIcon(state: 'ok' | 'partial', active: boolean, count: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="pin ${state} ${active ? 'active' : ''}">${count > 1 ? `<span>${count}</span>` : ''}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

function popupHtml(g: ResultGroup): string {
  const r = g.primary
  const l = r.listing
  const sizeBits = [
    l.sizes.livingArea.value !== null ? `${area(l.sizes.livingArea)} Wohnfl.` : l.sizes.usableArea.value !== null ? `${area(l.sizes.usableArea)} Nutzfl.` : null,
    l.sizes.plotArea.value !== null ? `${area(l.sizes.plotArea)} Grundst.` : null,
    l.sizes.rooms.value !== null ? `${l.sizes.rooms.value.toLocaleString('de-DE')} Zi.` : null,
  ].filter(Boolean)
  const links = g.offers
    .map((o) => {
      const src = sourceById(o.listing.sourceId)?.name ?? o.listing.sourceId
      return o.listing.url
        ? `<a href="${esc(o.listing.url)}" target="_blank" rel="noopener noreferrer">${esc(src)}: Originalanzeige ↗</a>`
        : `<span class="muted">${esc(src)}: Beispieldatensatz, keine Originalanzeige</span>`
    })
    .join('')
  return `<div class="pop">
    <strong>${esc(l.title)}</strong>
    <div>${esc(r.price.label)}: <b>${money(r.price.value, r.price.currency)}</b></div>
    <div>${esc(sizeBits.join(' · ') || 'Größe k. A.')}</div>
    <div class="muted">${esc(l.address.city)} · Standort: ${PRECISION_LABEL[l.precision]}</div>
    ${r.wishes.total ? `<div>Wünsche: ${r.wishes.yes} von ${r.wishes.total} erfüllt${r.wishes.uncertain ? `, ${r.wishes.uncertain} unsicher` : ''}</div>` : ''}
    <div class="links">${links}</div>
  </div>`
}

function areaLayer(a: SearchArea): L.Layer | null {
  const style = { color: '#0f766e', weight: 2, fillColor: '#14b8a6', fillOpacity: 0.07, dashArray: '6 4' }
  switch (a.kind) {
    case 'city': {
      const p = PLACES.find((x) => x.id === a.placeId)
      return L.circle(a.center, { ...style, radius: (a.wholeCity ? (p?.radiusKm ?? a.radiusKm) : a.radiusKm) * 1000 }).bindTooltip(a.wholeCity ? `${a.label} (ganze Stadt, ungefähr)` : `${a.label} + ${a.radiusKm} km`)
    }
    case 'radius':
      return L.circle(a.center, { ...style, radius: a.radiusKm * 1000 }).bindTooltip(`${a.label} + ${a.radiusKm} km`)
    case 'landscape': {
      const ls = LANDSCAPES.find((x) => x.id === a.landscapeId)
      return ls ? L.polygon(ls.polygon, style).bindTooltip(`${ls.name} (vereinfachte Abgrenzung)`) : null
    }
    default:
      return null // Land und Region: Filter über die Adresse, keine Grenzlinie verfügbar
  }
}

export function MapView({ groups }: { groups: ResultGroup[] }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const layers = useRef<{ results: L.LayerGroup; areas: L.LayerGroup; fuzz: L.LayerGroup } | null>(null)
  const fittedFor = useRef('')

  const query = useStore((s) => s.query)
  const selectedId = useStore((s) => s.selectedId)
  const hoveredId = useStore((s) => s.hoveredId)
  const mapMode = useStore((s) => s.mapMode)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true, preferCanvas: false }).setView([49.2, 10.3], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
    }).addTo(m)
    layers.current = { areas: L.layerGroup().addTo(m), fuzz: L.layerGroup().addTo(m), results: L.layerGroup().addTo(m) }
    m.on('click', (e: L.LeafletMouseEvent) => {
      const s = useStore.getState()
      const pos: [number, number] = [Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))]
      if (s.mapMode === 'pick_area') {
        s.setQuery((q) => void q.areas.push({ id: uid(), kind: 'radius', label: `Punkt ${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}`, center: pos, radiusKm: 25 }))
        s.setMapMode('idle')
        s.setOpenStep(1)
      } else if (s.mapMode === 'pick_target') {
        s.setQuery((q) => void q.targets.push({ id: uid(), label: `Ziel ${q.targets.length + 1}`, position: pos, maxKm: 15, mode: 'wish' }))
        s.setMapMode('idle')
        s.setOpenStep(6)
      }
    })
    map.current = m
    // Leaflet kennt Größenänderungen des Containers nicht von selbst
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      fittedFor.current = ''
      map.current = null
    }
  }, [])

  useEffect(() => {
    el.current?.classList.toggle('picking', mapMode !== 'idle')
  }, [mapMode])

  // Suchgebiete und eigene Ziele
  useEffect(() => {
    const lg = layers.current
    if (!lg) return
    lg.areas.clearLayers()
    for (const a of query.areas) areaLayer(a)?.addTo(lg.areas)
    for (const t of query.targets) {
      L.circle(t.position, { radius: t.maxKm * 1000, color: '#7c3aed', weight: 1.5, fillOpacity: 0.04, dashArray: '2 5' }).addTo(lg.areas)
      L.marker(t.position, { icon: L.divIcon({ className: '', html: '<div class="target-pin">◎</div>', iconSize: [22, 22], iconAnchor: [11, 11] }) })
        .bindTooltip(`${t.label} (${t.mode === 'must' ? 'Muss' : 'Wunsch'} ≤ ${t.maxKm} km)`)
        .addTo(lg.areas)
    }
  }, [query.areas, query.targets])

  // Ergebnisse
  useEffect(() => {
    const lg = layers.current
    const m = map.current
    if (!lg || !m) return
    lg.results.clearLayers()
    lg.fuzz.clearLayers()
    markers.current.clear()
    for (const g of groups) {
      const l = g.primary.listing
      const state = g.primary.mustOk ? 'ok' : 'partial'
      const mk = L.marker(l.position, { icon: markerIcon(state, false, g.offers.length), title: l.title })
        .bindPopup(popupHtml(g), { maxWidth: 300 })
        .on('click', () => useStore.getState().select(l.id))
        .on('mouseover', () => useStore.getState().hover(l.id))
        .on('mouseout', () => useStore.getState().hover(null))
      mk.addTo(lg.results)
      markers.current.set(l.id, mk)
      // Ungenaue Standorte: Unschärfekreis statt falscher Präzision
      const r = PRECISION_RADIUS_M[l.precision]
      if (r > 0) L.circle(l.position, { radius: r, color: '#64748b', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(lg.fuzz)
    }
    // Ausschnitt nur anpassen, wenn sich Gebiete oder Trefferzahl geändert haben
    const key = JSON.stringify(query.areas) + groups.length
    if (key !== fittedFor.current) {
      fittedFor.current = key
      const b = L.latLngBounds([])
      for (const g of groups) b.extend(g.primary.listing.position)
      lg.areas.eachLayer((layer) => {
        if (layer instanceof L.Circle || layer instanceof L.Polygon) b.extend(layer.getBounds())
      })
      if (b.isValid()) m.fitBounds(b.pad(0.08), { maxZoom: 13, animate: false })
    }
  }, [groups, query.areas])

  // Hervorhebung aus der Liste
  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const g = groups.find((x) => x.primary.listing.id === id)
      if (!g) continue
      const active = id === selectedId || id === hoveredId
      mk.setIcon(markerIcon(g.primary.mustOk ? 'ok' : 'partial', active, g.offers.length))
      mk.setZIndexOffset(active ? 1000 : 0)
    }
  }, [selectedId, hoveredId, groups])

  useEffect(() => {
    if (!selectedId) return
    const mk = markers.current.get(selectedId)
    if (mk && map.current) {
      map.current.panTo(mk.getLatLng(), { animate: true })
      mk.openPopup()
    }
  }, [selectedId])

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      {mapMode !== 'idle' && <div className="map-hint">{mapMode === 'pick_area' ? 'Klick setzt ein Suchgebiet (25 km)' : 'Klick setzt ein eigenes Ziel'}</div>}
      <div className="map-legend">
        <span><i className="pin-dot ok" /> erfüllt alle Muss-Kriterien</span>
        <span><i className="pin-dot partial" /> mit unbekannten Angaben</span>
        <span><i className="fuzz-dot" /> Standort nur ungefähr bekannt</span>
      </div>
    </div>
  )
}
