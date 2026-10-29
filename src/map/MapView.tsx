import maplibregl, { type Map as MlMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { mainPrice, type Property } from '../model/property.ts'
import { PRECISION_RADIUS_M } from '../model/listing.ts'
import { POI_CATEGORIES, type Poi } from '../services/overpass.ts'
import { useUi } from '../store/ui.ts'
import { money } from '../components/format.ts'
import { OVERLAYS } from './overlays.ts'
import { circlePolygon, recolor, STYLE_URL } from './style.ts'

interface Props {
  pois?: Poi[]
  properties?: Property[]
  onMapClick?: (lat: number, lng: number) => void
  onSelectProperty?: (id: string) => void
  /** Wenn gesetzt: Karte springt auf diesen Ausschnitt */
  fitTo?: { lat: number; lng: number; radius: number } | null
  interactiveHint?: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function MapView({ pois = [], properties = [], onMapClick, onSelectProperty, fitTo, interactiveHint }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const ready = useRef(false)
  const markers = useRef<Marker[]>([])
  const focusMarker = useRef<Marker | null>(null)
  const clickRef = useRef(onMapClick)
  const selectRef = useRef(onSelectProperty)
  clickRef.current = onMapClick
  selectRef.current = onSelectProperty

  const focus = useUi((s) => s.focus)
  const radius = useUi((s) => s.radius)
  const layers = useUi((s) => s.layers)
  const selectedId = useUi((s) => s.selectedPropertyId)

  // Karte einmal anlegen
  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE_URL,
      center: [10.4, 50.6],
      zoom: 5.2,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    m.on('style.load', () => {
      recolor(m)
      for (const o of OVERLAYS) {
        m.addSource(o.id, { type: 'raster', tiles: [o.tiles], tileSize: 256, attribution: o.attribution, minzoom: o.minzoom ?? 0, ...(o.bounds ? { bounds: o.bounds } : {}) })
        m.addLayer({ id: o.id, type: 'raster', source: o.id, paint: { 'raster-opacity': o.opacity }, layout: { visibility: 'none' } })
      }
      m.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#183F32', 'fill-opacity': 0.06 } })
      m.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#183F32', 'line-width': 1.5, 'line-dasharray': [2, 2] } })
      m.addSource('fuzz', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'fuzz', type: 'fill', source: 'fuzz', paint: { 'fill-color': '#a9b9a1', 'fill-opacity': 0.18, 'fill-outline-color': '#7f9378' } })
      m.addSource('pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'pois',
        type: 'circle',
        source: 'pois',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3.5, 16, 7],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fffefa',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      })
      m.on('click', 'pois', (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { name: string; label: string; dist: string; url: string }
        new maplibregl.Popup({ closeButton: false, offset: 8, className: 'ss-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${esc(p.name || 'ohne Namen')}</strong><span>${esc(p.label)} · ${esc(p.dist)}</span><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">In OpenStreetMap ansehen ↗</a>`)
          .addTo(m)
      })
      m.on('mouseenter', 'pois', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'pois', () => (m.getCanvas().style.cursor = ''))
      ready.current = true
      m.fire('ss-ready')
    })
    m.on('click', (e) => {
      if (m.queryRenderedFeatures(e.point, { layers: ['pois'] }).length) return
      clickRef.current?.(e.lngLat.lat, e.lngLat.lng)
    })
    map.current = m
    // Größe nachmessen, falls die Karte während einer Einblendung oder in einem kleinen Container entstand
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      ready.current = false
      m.remove()
      map.current = null
    }
  }, [])

  // Hilfsfunktion: erst ausführen, wenn der Stil geladen ist
  const whenReady = (fn: (m: MlMap) => void) => {
    const m = map.current
    if (!m) return
    if (ready.current) fn(m)
    else m.once('ss-ready', () => fn(m))
  }

  // Ebenen ein- und ausschalten
  useEffect(() => {
    whenReady((m) => {
      for (const o of OVERLAYS) m.setLayoutProperty(o.id, 'visibility', layers[o.layer] ? 'visible' : 'none')
      m.setLayoutProperty('pois', 'visibility', layers.pois ? 'visible' : 'none')
      for (const id of ['radius-fill', 'radius-line']) m.setLayoutProperty(id, 'visibility', layers.radius ? 'visible' : 'none')
    })
  }, [layers])

  // Fokus und Radius
  useEffect(() => {
    whenReady((m) => {
      const src = m.getSource('radius') as maplibregl.GeoJSONSource
      src.setData(focus ? circlePolygon(focus.lat, focus.lng, radius) : { type: 'FeatureCollection', features: [] })
      focusMarker.current?.remove()
      focusMarker.current = null
      if (focus) {
        const node = document.createElement('div')
        node.className = 'focus-pin'
        node.innerHTML = '<span></span><i></i><i></i>'
        focusMarker.current = new maplibregl.Marker({ element: node }).setLngLat([focus.lng, focus.lat]).addTo(m)
      }
    })
  }, [focus, radius])

  useEffect(() => {
    if (!fitTo) return
    whenReady((m) => {
      const c = circlePolygon(fitTo.lat, fitTo.lng, fitTo.radius).geometry.coordinates[0]
      const b = new maplibregl.LngLatBounds(c[0] as [number, number], c[0] as [number, number])
      for (const p of c) b.extend(p as [number, number])
      // Rechts Platz für das Analyse-Panel lassen, damit der Radius sichtbar bleibt
      const w = m.getContainer().clientWidth
      const right = w > 1000 ? 480 : 40
      m.fitBounds(b, { padding: { top: 130, bottom: 60, left: 40, right }, duration: 1400, maxZoom: 17 })
    })
  }, [fitTo?.lat, fitTo?.lng, fitTo?.radius])

  // Umgebungspunkte
  useEffect(() => {
    whenReady((m) => {
      const color = Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c.color]))
      const label = Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c.label]))
      ;(m.getSource('pois') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: pois.map((p) => ({
          type: 'Feature',
          properties: { name: p.name ?? '', label: label[p.category], color: color[p.category], dist: `${Math.round(p.distanceM)} m`, url: p.osmUrl },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
      })
    })
  }, [pois])

  // Immobilien als eigene Marker, mit Unschärfekreis bei ungenauer Lage
  useEffect(() => {
    whenReady((m) => {
      markers.current.forEach((mk) => mk.remove())
      markers.current = []
      const fuzz: GeoJSON.Feature[] = []
      if (layers.properties) {
        for (const p of properties) {
          if (!p.location) continue
          const node = document.createElement('button')
          node.className = `prop-pin ${p.id === selectedId ? 'active' : ''} ${p.status}`
          const price = mainPrice(p)
          node.innerHTML = `<span>${price.value !== null ? esc(money(price.value, p.currency)) : esc(p.title.value ?? 'Objekt')}</span>`
          node.title = p.title.value ?? 'Immobilie'
          node.onclick = (ev) => {
            ev.stopPropagation()
            selectRef.current?.(p.id)
          }
          markers.current.push(new maplibregl.Marker({ element: node, anchor: 'bottom' }).setLngLat([p.location.lng, p.location.lat]).addTo(m))
          const r = PRECISION_RADIUS_M[p.location.precision]
          if (r > 0) fuzz.push(circlePolygon(p.location.lat, p.location.lng, r))
        }
      }
      ;(m.getSource('fuzz') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: fuzz })
    })
  }, [properties, selectedId, layers.properties])

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      {interactiveHint && <div className="map-hint">{interactiveHint}</div>}
    </div>
  )
}
