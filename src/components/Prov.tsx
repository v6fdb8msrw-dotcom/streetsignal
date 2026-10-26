import { PROVENANCE_LABEL, PROVENANCE_SHORT, type Provenance } from '../model/provenance.ts'
import { DATA_SOURCES } from '../sources/registry.ts'
import { dateTime } from './format.ts'

/** Herkunftskennzeichen einer Angabe */
export function Prov({ p }: { p: Provenance }) {
  return (
    <span className={`prov ${p}`} title={PROVENANCE_LABEL[p]}>
      {PROVENANCE_SHORT[p]}
    </span>
  )
}

/** Quelle, Datenstand und Abrufzeit unter einem Abschnitt */
export function SourceLine({ ids, fetchedAt, dataDate }: { ids: string[]; fetchedAt?: string | null; dataDate?: string | null }) {
  const srcs = DATA_SOURCES.filter((s) => ids.includes(s.id))
  return (
    <p className="source-line">
      Quelle:{' '}
      {srcs.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ', '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.attribution !== '–' ? s.attribution : s.name}
          </a>
        </span>
      ))}
      {dataDate && <> · Datenstand: {dataDate}</>}
      {fetchedAt && <> · abgerufen {dateTime(fetchedAt)}</>}
    </p>
  )
}
