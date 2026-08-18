import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Megaphone, Calendar, UserCheck, BarChart3, Check, X, Crown, Clock, Flag, Ban } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJson } from '../api/client'
import SectionTitle from '../components/SectionTitle'
import BackHeader from '../components/BackHeader'
import './AdminSpace.css'

const ROLE_LABELS = {
  etudiant: 'Étudiant',
  professeur: 'Professeur',
  administration: 'Administration',
  admin_principal: 'Admin principal',
}

function NiveauSelect({ value, onChange }) {
  const [options, setOptions] = useState(null)

  useEffect(() => {
    apiJson('/api/social/niveau-groups/list/').then(setOptions)
  }, [])

  const currentValue = value ? `${value.filiere}|${value.niveau}` : ''

  return (
    <div className="form-field">
      <label htmlFor="niveau-select">Classe (filière + niveau)</label>
      <select
        id="niveau-select"
        value={currentValue}
        onChange={(e) => {
          if (!e.target.value) return onChange(null)
          const [filiere, niveau] = e.target.value.split('|')
          onChange({ filiere, niveau })
        }}
        required
      >
        <option value="">— Choisir une classe —</option>
        {(options || []).map((o) => (
          <option key={`${o.filiere}|${o.niveau}`} value={`${o.filiere}|${o.niveau}`}>
            {o.filiere} — {o.niveau}
          </option>
        ))}
      </select>
      {options && options.length === 0 && (
        <p className="admin-niveau-empty">
          Aucune classe pour l'instant — elles apparaissent automatiquement dès qu'un étudiant s'inscrit avec cette filière/niveau.
        </p>
      )}
    </div>
  )
}

function AnnouncementForm() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('content', content.trim())
      formData.append('is_urgent', isUrgent)
      if (file) formData.append('file', file)
      await apiJson('/api/social/announcements/', { method: 'POST', body: formData })
      setTitle('')
      setContent('')
      setIsUrgent(false)
      setFile(null)
      setMessage('Annonce publiée.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      {message && <p className="form-success">{message}</p>}
      <div className="form-field">
        <label htmlFor="ann-title">Titre</label>
        <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="form-field">
        <label htmlFor="ann-content">Contenu</label>
        <textarea id="ann-content" rows={3} value={content} onChange={(e) => setContent(e.target.value)} required />
      </div>
      <div className="form-field">
        <label htmlFor="ann-file">Pièce jointe (optionnel)</label>
        <input id="ann-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <label className="announcement-urgent-toggle">
        <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
        Annonce urgente
      </label>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? 'Publication...' : "Publier l'annonce"}
      </button>
    </form>
  )
}

function EventForm() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await apiJson('/api/social/events/', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          date: new Date(date).toISOString(),
        }),
      })
      setTitle('')
      setDescription('')
      setDate('')
      setLocation('')
      setMessage('Événement publié.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      {message && <p className="form-success">{message}</p>}
      <div className="form-field">
        <label htmlFor="ev-title">Titre</label>
        <input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="form-field">
        <label htmlFor="ev-date">Date et heure</label>
        <input id="ev-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="form-field">
        <label htmlFor="ev-location">Lieu</label>
        <input id="ev-location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="ev-desc">Description</label>
        <textarea id="ev-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? 'Publication...' : "Publier l'événement"}
      </button>
    </form>
  )
}

function PendingAccounts() {
  const [pending, setPending] = useState([])
  const [busy, setBusy] = useState(null)

  const load = () => apiJson('/api/auth/pending/').then(setPending)

  useEffect(() => { load() }, [])

  const act = async (id, action) => {
    setBusy(id)
    try {
      await apiJson(`/api/auth/pending/${id}/${action}/`, { method: 'POST' })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (pending.length === 0) return <p className="empty-state">Aucun compte en attente.</p>

  return (
    <div className="card">
      {pending.map((u) => (
        <div key={u.id} className="admin-pending-row">
          <div>
            <strong>{u.first_name} {u.last_name}</strong>
            <p>{u.role === 'professeur' ? u.email : u.matricule} · {ROLE_LABELS[u.role]}</p>
          </div>
          <div className="admin-pending-actions">
            <button className="btn btn-primary" disabled={busy === u.id} onClick={() => act(u.id, 'approve')} aria-label="Valider">
              <Check size={16} />
            </button>
            <button className="btn btn-outline" disabled={busy === u.id} onClick={() => act(u.id, 'reject')} aria-label="Refuser">
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportsQueue() {
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState(null)

  const load = () => apiJson('/api/social/reports/').then(setReports)

  useEffect(() => { load() }, [])

  const act = async (id, action) => {
    setBusy(id)
    try {
      await apiJson(`/api/social/reports/${id}/${action}/`, { method: 'POST' })
      await load()
    } finally {
      setBusy(null)
    }
  }

  const suspend = async (r) => {
    if (!window.confirm(`Suspendre le compte de ${r.reported_user.first_name} ${r.reported_user.last_name} ?`)) return
    await act(r.id, 'suspend')
  }

  if (reports.length === 0) return <p className="empty-state">Aucun signalement en attente.</p>

  return (
    <div className="card">
      {reports.map((r) => (
        <div key={r.id} className="admin-pending-row">
          <div>
            <strong>{r.reported_user.first_name} {r.reported_user.last_name}</strong>
            <p>Signalé par {r.reporter.first_name} {r.reporter.last_name} · {r.reason}</p>
          </div>
          <div className="admin-pending-actions">
            <button className="btn btn-primary" disabled={busy === r.id} onClick={() => act(r.id, 'resolve')} aria-label="Traiter">
              <Check size={16} />
            </button>
            <button className="btn btn-danger" disabled={busy === r.id} onClick={() => suspend(r)} aria-label="Suspendre le compte">
              <Ban size={16} />
            </button>
            <button className="btn btn-outline" disabled={busy === r.id} onClick={() => act(r.id, 'dismiss')} aria-label="Rejeter">
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function CurrentChiefs({ refreshKey, onChanged }) {
  const [chiefs, setChiefs] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => apiJson('/api/social/niveau-groups/chiefs/').then(setChiefs)
  useEffect(() => { load() }, [refreshKey])

  const remove = async (chief) => {
    setBusyId(chief.id)
    try {
      await apiJson('/api/social/niveau-groups/remove-chief/', {
        method: 'POST',
        body: JSON.stringify({ filiere: chief.filiere, niveau: chief.niveau, user_id: chief.id }),
      })
      await load()
      onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  if (chiefs === null) return null
  if (chiefs.length === 0) return <p className="empty-state">Aucun chef de classe nommé pour le moment.</p>

  return (
    <div className="card">
      {chiefs.map((c) => (
        <div key={`${c.id}-${c.filiere}-${c.niveau}`} className="admin-pending-row">
          <div>
            <strong>{c.first_name} {c.last_name}</strong>
            <p>{c.filiere} — {c.niveau} · {c.matricule}</p>
          </div>
          <button className="btn btn-danger" disabled={busyId === c.id} onClick={() => remove(c)}>
            Retirer
          </button>
        </div>
      ))}
    </div>
  )
}

function ClassChiefAssigner({ onChanged }) {
  const [selected, setSelected] = useState(null)
  const [matricule, setMatricule] = useState('')
  const [students, setStudents] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState('')

  const loadStudents = async (e) => {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams({ filiere: selected.filiere, niveau: selected.niveau })
      if (matricule.trim()) params.set('matricule', matricule.trim())
      const data = await apiJson(`/api/social/niveau-groups/students/?${params.toString()}`)
      setStudents(data)
    } finally {
      setLoading(false)
    }
  }

  const assign = async (userId) => {
    setBusyId(userId)
    try {
      const res = await apiJson('/api/social/niveau-groups/assign-chief/', {
        method: 'POST',
        body: JSON.stringify({ filiere: selected.filiere, niveau: selected.niveau, user_id: userId }),
      })
      setMessage(res.detail)
      setStudents((prev) => prev.map((s) => (s.id === userId ? { ...s, is_chief: true } : { ...s, is_chief: false })))
      onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (userId) => {
    setBusyId(userId)
    try {
      const res = await apiJson('/api/social/niveau-groups/remove-chief/', {
        method: 'POST',
        body: JSON.stringify({ filiere: selected.filiere, niveau: selected.niveau, user_id: userId }),
      })
      setMessage(res.detail)
      setStudents((prev) => prev.map((s) => (s.id === userId ? { ...s, is_chief: false } : s)))
      onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card">
      {message && <p className="form-success">{message}</p>}
      <form onSubmit={loadStudents}>
        <NiveauSelect value={selected} onChange={setSelected} />
        <div className="form-field">
          <label htmlFor="chief-matricule">Matricule (optionnel, pour affiner)</label>
          <input id="chief-matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="ex: L2A" />
        </div>
        <button className="btn btn-outline btn-block" type="submit" disabled={loading || !selected}>
          {loading ? 'Recherche...' : 'Chercher les étudiants'}
        </button>
      </form>

      {students !== null && (
        <div className="class-chief-students">
          {students.length === 0 && <p className="empty-state">Aucun étudiant trouvé pour cette filière/niveau.</p>}
          {students.map((s) => (
            <div key={s.id} className="admin-pending-row">
              <div>
                <strong>{s.first_name} {s.last_name}</strong>
                <p>{s.matricule}{s.is_chief ? ' · Chef de classe actuel' : ''}</p>
              </div>
              {s.is_chief ? (
                <button className="btn btn-danger" disabled={busyId === s.id} onClick={() => remove(s.id)}>
                  Retirer
                </button>
              ) : (
                <button className="btn btn-primary" disabled={busyId === s.id} onClick={() => assign(s.id)}>
                  Nommer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DAY_OPTIONS = [
  { value: 'lundi', label: 'Lundi' },
  { value: 'mardi', label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi', label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi', label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
]

function TimetableForm() {
  const [selected, setSelected] = useState(null)
  const [day, setDay] = useState('lundi')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [subject, setSubject] = useState('')
  const [room, setRoom] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    setMessage('')
    try {
      await apiJson('/api/social/timetable/', {
        method: 'POST',
        body: JSON.stringify({
          filiere: selected.filiere, niveau: selected.niveau, day,
          start_time: startTime, end_time: endTime, subject: subject.trim(), room: room.trim(),
        }),
      })
      setSubject('')
      setRoom('')
      setMessage('Créneau ajouté.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      {message && <p className="form-success">{message}</p>}
      <NiveauSelect value={selected} onChange={setSelected} />
      <div className="form-field">
        <label htmlFor="tt-day">Jour</label>
        <select id="tt-day" value={day} onChange={(e) => setDay(e.target.value)}>
          {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>
      <div className="admin-time-row">
        <div className="form-field">
          <label htmlFor="tt-start">Début</label>
          <input id="tt-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="tt-end">Fin</label>
          <input id="tt-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="tt-subject">Matière</label>
        <input id="tt-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="form-field">
        <label htmlFor="tt-room">Salle (optionnel)</label>
        <input id="tt-room" value={room} onChange={(e) => setRoom(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving || !selected}>
        {saving ? 'Ajout...' : 'Ajouter le créneau'}
      </button>
    </form>
  )
}

function AdminStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    apiJson('/api/auth/admin-stats/').then(setStats)
  }, [])

  if (!stats) return null

  return (
    <div className="card admin-stats-grid">
      <div className="admin-stat"><span>{stats.students}</span><p>Étudiants</p></div>
      <div className="admin-stat"><span>{stats.teachers}</span><p>Professeurs</p></div>
      <div className="admin-stat"><span>{stats.admin_staff}</span><p>Administration</p></div>
      <div className="admin-stat"><span>{stats.pending}</span><p>En attente</p></div>
    </div>
  )
}

const TABS = [
  { key: 'publications', label: 'Publications', icon: Megaphone },
  { key: 'classes', label: 'Classes', icon: Crown },
  { key: 'stats', label: 'Stats', icon: BarChart3, mainAdminOnly: true },
]

function AdminSpace() {
  const { user } = useAuth()
  const [tab, setTab] = useState('publications')
  const [chiefsVersion, setChiefsVersion] = useState(0)

  if (user.role === 'etudiant' && !user.is_creator) {
    return <Navigate to="/" replace />
  }

  const isMainAdmin = user.role === 'admin_principal' || user.is_creator
  const tabs = TABS.filter((t) => !t.mainAdminOnly || isMainAdmin)

  return (
    <div className="page-padding">
      <BackHeader to="/profil" title="Espace Admin" />

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'publications' && (
        <>
          <SectionTitle icon={Megaphone}>Publier une annonce</SectionTitle>
          <AnnouncementForm />

          <SectionTitle icon={Calendar}>Publier un événement</SectionTitle>
          <EventForm />
        </>
      )}

      {tab === 'classes' && (
        <>
          <SectionTitle icon={Crown}>Chefs de classe actuels</SectionTitle>
          <CurrentChiefs refreshKey={chiefsVersion} onChanged={() => setChiefsVersion((v) => v + 1)} />

          <SectionTitle icon={Crown}>Nommer un chef de classe</SectionTitle>
          <ClassChiefAssigner onChanged={() => setChiefsVersion((v) => v + 1)} />

          <SectionTitle icon={Clock}>Ajouter un créneau à l'emploi du temps</SectionTitle>
          <TimetableForm />
        </>
      )}

      {tab === 'stats' && isMainAdmin && (
        <>
          <SectionTitle icon={BarChart3}>Statistiques</SectionTitle>
          <AdminStats />

          <SectionTitle icon={UserCheck}>Comptes en attente de validation</SectionTitle>
          <PendingAccounts />

          <SectionTitle icon={Flag}>Signalements</SectionTitle>
          <ReportsQueue />
        </>
      )}
    </div>
  )
}

export default AdminSpace
