// Oberflächenzustand (nicht dauerhaft): aktueller Standort, Radius, Ebenen, Auswahl.
import { create } from 'zustand'
import type { Radius } from '../services/environment.ts'

export type LayerId = 'noise_road' | 'noise_rail' | 'noise_air' | 'noise_regional' | 'bplan' | 'landvalue' | 'pois' | 'properties' | 'radius'

export interface Focus {
  lat: number
  lng: number
  label: string
  /** Immobilie oder gespeicherter Ort; null = nur gesucht */
  targetId: string | null
}

interface UiState {
  focus: Focus | null
  radius: Radius
  layers: Record<LayerId, boolean>
  selectedPropertyId: string | null
  /** Zähler, damit Listen nach Änderungen in IndexedDB neu laden */
  dataVersion: number
  setFocus: (f: Focus | null) => void
  setRadius: (r: Radius) => void
  toggleLayer: (id: LayerId) => void
  selectProperty: (id: string | null) => void
  bump: () => void
}

export const useUi = create<UiState>((set) => ({
  focus: null,
  radius: 500,
  layers: { noise_road: false, noise_rail: false, noise_air: false, noise_regional: false, bplan: false, landvalue: false, pois: true, properties: true, radius: true },
  selectedPropertyId: null,
  dataVersion: 0,
  setFocus: (focus) => set({ focus }),
  setRadius: (radius) => set({ radius }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  selectProperty: (selectedPropertyId) => set({ selectedPropertyId }),
  bump: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}))
