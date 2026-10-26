// React-Hooks für gespeicherte Daten; laden neu, sobald irgendwo etwas gespeichert wurde.
import { useEffect, useState } from 'react'
import type { Property } from '../model/property.ts'
import type { EnvReport } from '../services/environment.ts'
import { listPlaces, listProperties, reportsFor, type SavedPlace } from '../store/db.ts'
import { useUi } from '../store/ui.ts'

export function useProperties(): Property[] | null {
  const v = useUi((s) => s.dataVersion)
  const [props, setProps] = useState<Property[] | null>(null)
  useEffect(() => {
    let alive = true
    listProperties().then((p) => alive && setProps(p))
    return () => {
      alive = false
    }
  }, [v])
  return props
}

export function usePlaces(): SavedPlace[] {
  const v = useUi((s) => s.dataVersion)
  const [places, setPlaces] = useState<SavedPlace[]>([])
  useEffect(() => {
    listPlaces().then(setPlaces)
  }, [v])
  return places
}

/** Neuester Bericht je Ziel-ID */
export function useLatestReports(ids: string[]): Map<string, EnvReport> {
  const v = useUi((s) => s.dataVersion)
  const [map, setMap] = useState(new Map<string, EnvReport>())
  const key = ids.join(',')
  useEffect(() => {
    let alive = true
    Promise.all(ids.map(async (id) => [id, (await reportsFor(id))[0]] as const)).then((rows) => {
      if (alive) setMap(new Map(rows.filter((r): r is readonly [string, EnvReport] => !!r[1])))
    })
    return () => {
      alive = false
    }
  }, [key, v])
  return map
}
