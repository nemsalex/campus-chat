import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, Calendar, Users, Plus, GraduationCap, Layers, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { apiJson } from '../api/client'
import { useAuth } from '../context/AuthContext'
import SectionTitle from '../components/SectionTitle'
import TimetableList from '../components/TimetableList'
import './Campus.css'

const PUBLIC_KIND_LABELS = {
  club: 'Club / Association',
  projet: 'Groupe de projet',
}

const MY_GROUP_KIND_LABELS = {
  cycle_licence: 'Cycle Licence',
  cycle_master: 'Cycle Master',
  niveau_annonces: 'Annonces de classe',
  niveau_discussion: 'Discussion de classe',
}

const MY_GROUP_ICONS = {
  cycle_licence: GraduationCap,
  cycle_master: GraduationCap,
  niveau_annonces: Megaphone,
  niveau_discussion: Layers,
}

function Campus() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [events, setEvents] = useState([])
  const [myGroups, setMyGroups] = useState([])
  const [publicGroups, setPublicGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('club')
  const [busyId, setBusyId] = useState(null)

  const loadPublicGroups = () => apiJson('/api/social/groups/').then(setPublicGroups)

  useEffect(() => {
    Promise.all([
      apiJson('/api/social/announcements/'),
      apiJson('/api/social/events/'),
      apiJson('/api/social/groups/mine/'),
      loadPublicGroups(),
    ]).then(([a, e, mine]) => {
      setAnnouncements(a)
      setEvents(e)
      setMyGroups(mine)
      setLoading(false)
    })
    apiJson('/api/social/notifications/mark-read-by-type/', {
      method: 'POST',
      body: JSON.stringify({ type: 'announcement,leave_request' }),
    }).catch(() => {})
  }, [])

  const createGroup = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await apiJson('/api/social/groups/', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: description.trim(), kind }),
    })
    setName('')
    setDescription('')
    setShowCreate(false)
    loadPublicGroups()
  }

  const toggleMembership = async (group) => {
    setBusyId(group.id)
    try {
      await apiJson(`/api/social/groups/${group.id}/${group.is_member ? 'leave' : 'join'}/`, { method: 'POST' })
      loadPublicGroups()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page-padding">
      <h2 className="page-title" style={{ padding: 0, marginBottom: '1rem' }}>Espace Campus</h2>

      {user?.filiere && user?.niveau && (
        <Link to="/campus/emploi-du-temps" className="card campus-timetable-link">
          <div className="campus-timetable-link-icon"><Clock size={19} /></div>
          <div className="campus-group-info">
            <strong>Mon emploi du temps</strong>
            <p>{user.filiere} · {user.niveau}</p>
          </div>
          <ChevronRight size={18} className="campus-my-group-icon" />
        </Link>
      )}

      {user?.filiere && user?.niveau && (
        <Link to="/campus/annuaire" className="card campus-timetable-link" style={{ marginTop: 'var(--space-3)' }}>
          <div className="campus-timetable-link-icon"><Users size={19} /></div>
          <div className="campus-group-info">
            <strong>Annuaire de classe</strong>
            <p>Les étudiants de {user.filiere} · {user.niveau}</p>
          </div>
          <ChevronRight size={18} className="campus-my-group-icon" />
        </Link>
      )}

      <SectionTitle icon={GraduationCap}>Mes groupes</SectionTitle>
      <div className="campus-section">
        {!loading && myGroups.length === 0 && (
          <p className="empty-state">Aucun groupe de filière/niveau (renseigne ta filière et ton niveau dans ton profil).</p>
        )}
        {myGroups.map((g) => {
          const Icon = MY_GROUP_ICONS[g.kind] || Users
          return (
            <Link to={`/campus/groupes/${g.id}`} key={g.id} className="card campus-group-row campus-my-group">
              <Icon size={18} className="campus-my-group-icon" />
              <div className="campus-group-info">
                <strong>{g.name}</strong>
                <p>{MY_GROUP_KIND_LABELS[g.kind]} · {g.member_count} membre{g.member_count > 1 ? 's' : ''}{g.is_admin ? ' · Admin' : ''}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <SectionTitle icon={Megaphone}>Annonces</SectionTitle>
      <div className="campus-section">
        {loading && <p className="empty-state">Chargement...</p>}
        {!loading && announcements.length === 0 && <p className="empty-state">Aucune annonce.</p>}
        {announcements.map((a) => (
          <Link to={`/annonces/${a.id}`} key={a.id} className="card campus-item announcement-link">
            <strong className="announcement-title-row">
              {a.is_urgent && <AlertTriangle size={14} className="announcement-urgent-icon" />}
              {a.title}
            </strong>
            <p>{a.content}</p>
            {a.author && <p className="campus-item-author">{a.author.first_name} {a.author.last_name}</p>}
          </Link>
        ))}
      </div>

      <SectionTitle icon={Calendar}>Événements</SectionTitle>
      <div className="campus-section">
        {!loading && events.length === 0 && <p className="empty-state">Aucun événement à venir.</p>}
        {events.map((ev) => (
          <div key={ev.id} className="card campus-item">
            <strong>{ev.title}</strong>
            <p>{new Date(ev.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}{ev.location ? ` · ${ev.location}` : ''}</p>
            {ev.description && <p className="campus-item-desc">{ev.description}</p>}
            {ev.author && <p className="campus-item-author">{ev.author.first_name} {ev.author.last_name}</p>}
          </div>
        ))}
      </div>

      <div className="campus-section-header">
        <SectionTitle icon={Users}>Groupes publics</SectionTitle>
        <button className="btn btn-outline campus-create-btn" onClick={() => setShowCreate((v) => !v)}>
          <Plus size={14} /> Créer
        </button>
      </div>

      <div className="campus-section">
        {showCreate && (
          <form className="card" style={{ marginBottom: 'var(--space-3)' }} onSubmit={createGroup}>
            <div className="form-field">
              <label htmlFor="group-name">Nom du groupe</label>
              <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="group-kind">Type</label>
              <select id="group-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(PUBLIC_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="group-desc">Description</label>
              <textarea id="group-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" type="submit">Créer le groupe</button>
          </form>
        )}

        {!loading && publicGroups.length === 0 && <p className="empty-state">Aucun groupe public pour le moment.</p>}
        {publicGroups.map((g) => (
          <div key={g.id} className="card campus-group-row">
            <Link to={`/campus/groupes/${g.id}`} className="campus-group-info">
              <strong>{g.name}</strong>
              <p>{PUBLIC_KIND_LABELS[g.kind]} · {g.member_count} membre{g.member_count > 1 ? 's' : ''}</p>
            </Link>
            <button
              className={`btn ${g.is_member ? 'btn-outline' : 'btn-secondary'}`}
              disabled={busyId === g.id}
              onClick={() => toggleMembership(g)}
            >
              {g.is_member ? 'Quitter' : 'Rejoindre'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Campus
