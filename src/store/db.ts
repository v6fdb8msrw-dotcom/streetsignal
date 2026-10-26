// Lokale Speicherung in IndexedDB (Master-Prompt Abschnitt 12): kein Konto, nichts verlässt den Rechner.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Property } from '../model/property.ts'
import type { SavedProfile } from '../model/query.ts'
import type { EnvReport } from '../services/environment.ts'

export interface SavedPlace {
  id: string
  label: string
  lat: number
  lng: number
  createdAt: string
}

interface StreetSignalDB extends DBSchema {
  properties: { key: string; value: Property }
  /** Umgebungsberichte, mehrere je Ort: daraus entsteht die Änderungshistorie */
  reports: { key: string; value: EnvReport; indexes: { byTarget: string } }
  places: { key: string; value: SavedPlace }
  profiles: { key: string; value: SavedProfile }
  cache: { key: string; value: { key: string; at: number; data: unknown } }
  settings: { key: string; value: { key: string; value: unknown } }
}

let dbPromise: Promise<IDBPDatabase<StreetSignalDB>> | null = null

export function db(): Promise<IDBPDatabase<StreetSignalDB>> {
  dbPromise ??= openDB<StreetSignalDB>('streetsignal', 1, {
    upgrade(d) {
      d.createObjectStore('properties', { keyPath: 'id' })
      const r = d.createObjectStore('reports', { keyPath: 'id' })
      r.createIndex('byTarget', 'targetId')
      d.createObjectStore('places', { keyPath: 'id' })
      d.createObjectStore('profiles', { keyPath: 'id' })
      d.createObjectStore('cache', { keyPath: 'key' })
      d.createObjectStore('settings', { keyPath: 'key' })
    },
  })
  return dbPromise
}

export const uid = () => crypto.randomUUID()

export async function listProperties(): Promise<Property[]> {
  const all = await (await db()).getAll('properties')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveProperty(p: Property): Promise<void> {
  await (await db()).put('properties', { ...p, updatedAt: new Date().toISOString() })
}

export async function deleteProperty(id: string): Promise<void> {
  const d = await db()
  await d.delete('properties', id)
  for (const r of await d.getAllFromIndex('reports', 'byTarget', id)) await d.delete('reports', r.id)
}

export async function saveReport(r: EnvReport): Promise<void> {
  await (await db()).put('reports', r)
}

/** Alle Berichte zu einem Ort, neueste zuerst */
export async function reportsFor(targetId: string): Promise<EnvReport[]> {
  const all = await (await db()).getAllFromIndex('reports', 'byTarget', targetId)
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listPlaces(): Promise<SavedPlace[]> {
  return (await (await db()).getAll('places')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function savePlace(p: SavedPlace): Promise<void> {
  await (await db()).put('places', p)
}

export async function deletePlace(id: string): Promise<void> {
  const d = await db()
  await d.delete('places', id)
  for (const r of await d.getAllFromIndex('reports', 'byTarget', id)) await d.delete('reports', r.id)
}

export async function listProfiles(): Promise<SavedProfile[]> {
  return (await (await db()).getAll('profiles')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveProfile(p: SavedProfile): Promise<void> {
  await (await db()).put('profiles', p)
}

export async function deleteProfile(id: string): Promise<void> {
  await (await db()).delete('profiles', id)
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).get('settings', key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', { key, value })
}

/** Zwischenspeicher für öffentliche Dienste, damit sie nicht unnötig belastet werden */
export async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const d = await db()
  const hit = await d.get('cache', key)
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data as T
  const data = await load()
  await d.put('cache', { key, at: Date.now(), data })
  return data
}
