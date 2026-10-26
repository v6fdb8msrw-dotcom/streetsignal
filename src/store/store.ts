import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEMO_LISTINGS } from '../data/demo.ts'
import type { Listing } from '../model/listing.ts'
import { emptyQuery, type SavedProfile, type SearchQuery } from '../model/query.ts'

export type MapMode = 'idle' | 'pick_area' | 'pick_target'

interface State {
  query: SearchQuery
  profiles: SavedProfile[]
  /** Profil, das gerade bearbeitet wird (Speichern überschreibt es) */
  activeProfileId: string | null
  manualListings: Listing[]
  importedListings: Listing[]
  selectedId: string | null
  hoveredId: string | null
  mapMode: MapMode
  /** Zuletzt geänderter Schritt im Filterpanel */
  openStep: number

  setQuery: (fn: (q: SearchQuery) => void) => void
  resetQuery: () => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  setMapMode: (m: MapMode) => void
  setOpenStep: (n: number) => void
  saveProfile: (name: string, asNew: boolean) => void
  loadProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void
  deleteProfile: (id: string) => void
  toggleNotify: (id: string) => void
  addManual: (l: Listing) => void
  removeManual: (id: string) => void
  setImported: (ls: Listing[]) => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      query: emptyQuery(),
      profiles: [],
      activeProfileId: null,
      manualListings: [],
      importedListings: [],
      selectedId: null,
      hoveredId: null,
      mapMode: 'idle',
      openStep: 1,

      setQuery: (fn) =>
        set((s) => {
          const q = structuredClone(s.query)
          fn(q)
          return { query: q }
        }),
      resetQuery: () => set({ query: emptyQuery(), activeProfileId: null, selectedId: null }),
      select: (id) => set({ selectedId: id }),
      hover: (id) => set({ hoveredId: id }),
      setMapMode: (m) => set({ mapMode: m }),
      setOpenStep: (n) => set({ openStep: n }),

      saveProfile: (name, asNew) => {
        const now = new Date().toISOString()
        const { activeProfileId, profiles, query } = get()
        if (!asNew && activeProfileId && profiles.some((p) => p.id === activeProfileId)) {
          set({ profiles: profiles.map((p) => (p.id === activeProfileId ? { ...p, name, query: structuredClone(query), updatedAt: now } : p)) })
          return
        }
        const p: SavedProfile = { id: uid(), name, query: structuredClone(query), createdAt: now, updatedAt: now, notify: false }
        set({ profiles: [p, ...profiles], activeProfileId: p.id })
      },
      loadProfile: (id) => {
        const p = get().profiles.find((x) => x.id === id)
        if (p) set({ query: { ...emptyQuery(), ...structuredClone(p.query) }, activeProfileId: id, selectedId: null })
      },
      renameProfile: (id, name) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, name } : p)) })),
      deleteProfile: (id) =>
        set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id), activeProfileId: s.activeProfileId === id ? null : s.activeProfileId })),
      toggleNotify: (id) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, notify: !p.notify } : p)) })),
      addManual: (l) => set((s) => ({ manualListings: [l, ...s.manualListings] })),
      removeManual: (id) => set((s) => ({ manualListings: s.manualListings.filter((l) => l.id !== id) })),
      setImported: (ls) => set({ importedListings: ls }),
    }),
    {
      name: 'streetsignal',
      version: 1,
      partialize: (s) => ({
        query: s.query,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        manualListings: s.manualListings,
        importedListings: s.importedListings,
      }),
      // Neue Filterfelder späterer Versionen bekommen ihre Standardwerte
      merge: (persisted, current) => {
        const p = persisted as Partial<State>
        return { ...current, ...p, query: { ...emptyQuery(), ...(p.query ?? {}) } }
      },
    },
  ),
)

export function allListings(s: Pick<State, 'manualListings' | 'importedListings'>): Listing[] {
  return [...DEMO_LISTINGS, ...s.manualListings, ...s.importedListings]
}
