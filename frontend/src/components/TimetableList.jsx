import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { apiJson } from '../api/client'
import SectionTitle from './SectionTitle'

export const DAY_LABELS = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
  vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
}

function TimetableList({ filiere, niveau, title = 'Emploi du temps', emptyMessage }) {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    if (!filiere || !niveau) return
    apiJson(`/api/social/timetable/?filiere=${encodeURIComponent(filiere)}&niveau=${encodeURIComponent(niveau)}`).then(setEntries)
  }, [filiere, niveau])

  if (entries === null) return null
  if (entries.length === 0) {
    if (!emptyMessage) return null
    return (
      <>
        <SectionTitle icon={Clock}>{title}</SectionTitle>
        <p className="empty-state">{emptyMessage}</p>
      </>
    )
  }

  return (
    <>
      <SectionTitle icon={Clock}>{title}</SectionTitle>
      <div className="card">
        {entries.map((e) => (
          <div key={e.id} className="timetable-row">
            <strong>{DAY_LABELS[e.day]}</strong>
            <span>{e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)} · {e.subject}{e.room ? ` · ${e.room}` : ''}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export default TimetableList
