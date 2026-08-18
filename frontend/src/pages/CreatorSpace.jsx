import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Sparkles, Users, MessageSquare, ShieldPlus, GraduationCap, Crown, ArrowLeft, Search, Trash2, Circle, Ban } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJson, API_BASE } from '../api/client'
import SectionTitle from '../components/SectionTitle'
import BackHeader from '../components/BackHeader'
import './CreatorSpace.css'

const ROLE_LABELS = {
  etudiant: 'Étudiant',
  professeur: 'Professeur',
  administration: 'Administration',
  admin_principal: 'Admin principal',
}

function OnlineNow() {
  const [online, setOnline] = useState(null)

  useEffect(() => {
    const load = () => apiJson('/api/auth/creator/online/').then(setOnline).catch(() => {})
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <SectionTitle icon={Circle}>En ligne maintenant</SectionTitle>
      <div className="card">
        {online === null && <p className="empty-state">Chargement...</p>}
        {online?.length === 0 && <p className="empty-state">Personne n'est connecté en ce moment.</p>}
        {online?.map((u) => (
          <div key={u.matricule} className="admin-pending-row">
            <div>
              <strong>{u.first_name} {u.last_name}</strong>
              <p>{u.matricule} · {ROLE_LABELS[u.role]}</p>
            </div>
            <span className="creator-online-dot" />
          </div>
        ))}
      </div>
    </>
  )
}

function BlockedByList() {
  const [blockers, setBlockers] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => apiJson('/api/social/creator/blocked-by/').then(setBlockers).catch(() => {})
  useEffect(() => { load() }, [])

  const unblock = async (u) => {
    setBusyId(u.id)
    try {
      await apiJson('/api/social/creator/force-unblock/', { method: 'POST', body: JSON.stringify({ user_id: u.id }) })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <SectionTitle icon={Ban}>Comptes qui t'ont bloqué</SectionTitle>
      <div className="card">
        {blockers === null && <p className="empty-state">Chargement...</p>}
        {blockers?.length === 0 && <p className="empty-state">Personne ne t'a bloqué (ou sans effet de toute façon).</p>}
        {blockers?.map((u) => (
          <div key={u.id} className="admin-pending-row">
            <div>
              <strong>{u.first_name} {u.last_name}</strong>
              <p>{u.matricule} · {ROLE_LABELS[u.role]}</p>
            </div>
            <button className="btn btn-outline" disabled={busyId === u.id} onClick={() => unblock(u)}>Débloquer</button>
          </div>
        ))}
      </div>
    </>
  )
}

function Overview() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    apiJson('/api/auth/creator/overview/').then(setStats)
  }, [])

  if (!stats) return <p className="empty-state">Chargement...</p>

  return (
    <>
      <div className="card creator-stats-grid">
        <div className="creator-stat"><span>{stats.total_users}</span><p>Inscrits au total</p></div>
        <div className="creator-stat"><span>{stats.total_messages}</span><p>Messages envoyés</p></div>
        <div className="creator-stat"><span>{stats.users_by_role.etudiant}</span><p>Étudiants</p></div>
        <div className="creator-stat"><span>{stats.users_by_role.professeur}</span><p>Professeurs</p></div>
        <div className="creator-stat"><span>{stats.users_by_role.administration}</span><p>Administration</p></div>
        <div className="creator-stat"><span>{stats.users_by_role.admin_principal}</span><p>Admin principal</p></div>
      </div>
      <OnlineNow />
      <BlockedByList />
    </>
  )
}

function MessageThread({ room, onBack }) {
  const [messages, setMessages] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    apiJson(`/api/chat/creator/rooms/${room}/messages/`).then(setMessages)
  }, [room])

  const deleteMessage = async (id) => {
    if (!window.confirm('Supprimer ce message ?')) return
    setBusyId(id)
    try {
      await apiJson(`/api/chat/creator/messages/${id}/delete/`, { method: 'POST' })
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: '', file_url: '', file_name: '', deleted: true } : m)))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="creator-thread">
      <button className="btn btn-outline creator-thread-back" onClick={onBack}>
        <ArrowLeft size={15} /> Retour aux conversations
      </button>
      <div className="creator-thread-messages">
        {messages === null && <p className="empty-state">Chargement...</p>}
        {messages?.length === 0 && <p className="empty-state">Aucun message dans cette conversation.</p>}
        {messages?.map((m) => (
          <div key={m.id} className="conv-message theirs">
            <span className="group-chat-author">{m.display_name || m.username}</span>
            <div className="conv-bubble">
              {m.deleted ? (
                <span className="conv-deleted">Message supprimé</span>
              ) : (
                <>
                  {m.file_url && (
                    <a href={`${API_BASE}${m.file_url}`} target="_blank" rel="noreferrer" className="conv-file">
                      {m.file_name || 'Document'}
                    </a>
                  )}
                  {m.content && <span>{m.content}</span>}
                </>
              )}
            </div>
            <span className="conv-time">
              {new Date(m.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {m.edited && !m.deleted && <span className="conv-edited-tag">modifié</span>}
              {!m.deleted && (
                <button
                  className="icon-btn creator-msg-delete"
                  disabled={busyId === m.id}
                  onClick={() => deleteMessage(m.id)}
                  aria-label="Supprimer ce message"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UserConversations({ user, onBack }) {
  const [conversations, setConversations] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)

  useEffect(() => {
    apiJson(`/api/chat/creator/users/${user.matricule}/conversations/`).then(setConversations)
  }, [user.matricule])

  if (selectedRoom) {
    return <MessageThread room={selectedRoom} onBack={() => setSelectedRoom(null)} />
  }

  return (
    <div className="creator-thread">
      <button className="btn btn-outline creator-thread-back" onClick={onBack}>
        <ArrowLeft size={15} /> Retour aux utilisateurs
      </button>
      <SectionTitle icon={MessageSquare}>Conversations de {user.first_name} {user.last_name}</SectionTitle>
      {conversations === null && <p className="empty-state">Chargement...</p>}
      {conversations?.length === 0 && <p className="empty-state">Aucune conversation pour cet utilisateur.</p>}
      {conversations && conversations.length > 0 && (
        <div className="card">
          {conversations.map((c) => (
            <button key={c.room} className="creator-user-row creator-convo-row" onClick={() => setSelectedRoom(c.room)}>
              <div>
                <strong>
                  {c.type === 'private'
                    ? c.participants.map((p) => `${p.first_name} ${p.last_name}`).join(' ↔ ')
                    : `📢 ${c.group_name}`}
                </strong>
                <p>{c.last_message || '—'}</p>
              </div>
              <span className="creator-msg-count">{c.message_count} msg</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UsersList() {
  const [users, setUsers] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => apiJson('/api/auth/creator/users/').then(setUsers)
  useEffect(() => { load() }, [])

  if (selectedUser) {
    return <UserConversations user={selectedUser} onBack={() => setSelectedUser(null)} />
  }

  if (!users) return <p className="empty-state">Chargement...</p>

  const toggleSuspend = async (u, e) => {
    e.stopPropagation()
    if (!window.confirm(u.is_active ? `Suspendre ${u.first_name} ${u.last_name} ?` : `Réactiver ${u.first_name} ${u.last_name} ?`)) return
    setBusyId(u.id)
    try {
      const action = u.is_active ? 'suspend' : 'reactivate'
      await apiJson(`/api/auth/${action}/${u.id}/`, { method: 'POST' })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? users.filter((u) =>
        `${u.first_name} ${u.last_name} ${u.matricule} ${u.email}`.toLowerCase().includes(q)
      )
    : users

  return (
    <div className="card">
      <div className="creator-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Chercher un utilisateur..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered.map((u) => (
        <div key={u.id} className="creator-user-row-wrap">
          <button className="creator-user-row creator-convo-row" onClick={() => setSelectedUser(u)}>
            <div>
              <strong>{u.first_name} {u.last_name}{u.is_creator ? ' 👑' : ''}</strong>
              <p>{u.matricule} · {ROLE_LABELS[u.role]}{u.filiere ? ` · ${u.filiere} ${u.niveau}` : ''}{!u.is_active ? ' · suspendu' : ''}</p>
            </div>
            <span className="creator-msg-count">{u.message_count} msg</span>
          </button>
          {!u.is_creator && (
            <button
              className={`btn ${u.is_active ? 'btn-outline' : 'btn-primary'} creator-suspend-btn`}
              disabled={busyId === u.id}
              onClick={(e) => toggleSuspend(u, e)}
            >
              {u.is_active ? 'Suspendre' : 'Réactiver'}
            </button>
          )}
        </div>
      ))}
      {filtered.length === 0 && <p className="empty-state">Aucun utilisateur trouvé.</p>}
    </div>
  )
}

function AdminsManager() {
  const [admins, setAdmins] = useState(null)
  const [users, setUsers] = useState(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    apiJson('/api/auth/creator/admins/').then(setAdmins)
    apiJson('/api/auth/creator/users/').then(setUsers)
  }

  useEffect(() => { load() }, [])

  const promote = async (userId) => {
    setBusyId(userId)
    try {
      await apiJson('/api/auth/creator/promote-admin/', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
      load()
    } finally {
      setBusyId(null)
    }
  }

  const demote = async (userId) => {
    setBusyId(userId)
    try {
      await apiJson('/api/auth/creator/demote-admin/', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
      load()
    } finally {
      setBusyId(null)
    }
  }

  const q = query.trim().toLowerCase()
  const candidates = (users || []).filter((u) =>
    u.role !== 'admin_principal' && !u.is_creator &&
    q && `${u.first_name} ${u.last_name} ${u.matricule}`.toLowerCase().includes(q)
  )

  return (
    <>
      <SectionTitle icon={ShieldPlus}>Admins principaux actuels</SectionTitle>
      <div className="card">
        {admins === null && <p className="empty-state">Chargement...</p>}
        {admins?.length === 0 && <p className="empty-state">Aucun admin principal pour le moment.</p>}
        {admins?.map((a) => (
          <div key={a.id} className="admin-pending-row">
            <div>
              <strong>{a.first_name} {a.last_name}</strong>
              <p>{a.matricule}</p>
            </div>
            <button className="btn btn-danger" disabled={busyId === a.id} onClick={() => demote(a.id)}>Retirer</button>
          </div>
        ))}
      </div>

      <SectionTitle icon={ShieldPlus}>Nommer un admin principal</SectionTitle>
      <div className="card">
        <div className="creator-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Chercher par nom ou matricule..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {q && candidates.length === 0 && <p className="empty-state">Aucun résultat.</p>}
        {candidates.slice(0, 10).map((u) => (
          <div key={u.id} className="admin-pending-row">
            <div>
              <strong>{u.first_name} {u.last_name}</strong>
              <p>{u.matricule} · {ROLE_LABELS[u.role]}</p>
            </div>
            <button className="btn btn-primary" disabled={busyId === u.id} onClick={() => promote(u.id)}>Nommer</button>
          </div>
        ))}
      </div>
    </>
  )
}

function TeachersList() {
  const [teachers, setTeachers] = useState(null)

  useEffect(() => {
    apiJson('/api/auth/creator/teachers/').then(setTeachers)
  }, [])

  if (!teachers) return <p className="empty-state">Chargement...</p>
  if (teachers.length === 0) return <p className="empty-state">Aucun professeur inscrit.</p>

  return (
    <div className="card">
      {teachers.map((t) => (
        <div key={t.id} className="admin-pending-row">
          <div>
            <strong>{t.first_name} {t.last_name}</strong>
            <p>{t.email}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChiefsList() {
  const [chiefs, setChiefs] = useState(null)

  useEffect(() => {
    apiJson('/api/social/niveau-groups/chiefs/').then(setChiefs)
  }, [])

  if (!chiefs) return <p className="empty-state">Chargement...</p>
  if (chiefs.length === 0) return <p className="empty-state">Aucun chef de classe nommé.</p>

  return (
    <div className="card">
      {chiefs.map((c) => (
        <div key={`${c.id}-${c.filiere}-${c.niveau}`} className="admin-pending-row">
          <div>
            <strong>{c.first_name} {c.last_name}</strong>
            <p>{c.filiere} — {c.niveau} · {c.matricule}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const TABS = [
  { key: 'apercu', label: 'Aperçu', icon: Sparkles },
  { key: 'utilisateurs', label: 'Utilisateurs', icon: Users },
  { key: 'admins', label: 'Admins', icon: ShieldPlus },
  { key: 'profs', label: 'Profs', icon: GraduationCap },
  { key: 'chefs', label: 'Chefs', icon: Crown },
]

function CreatorSpace() {
  const { user } = useAuth()
  const [tab, setTab] = useState('apercu')

  if (!user.is_creator) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="page-padding">
      <BackHeader to="/profil" title="Espace Créateur" />

      <div className="creator-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`creator-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={16} />
          </button>
        ))}
      </div>
      <p className="creator-tab-label">{TABS.find((t) => t.key === tab).label}</p>

      {tab === 'apercu' && <Overview />}
      {tab === 'utilisateurs' && <UsersList />}
      {tab === 'admins' && <AdminsManager />}
      {tab === 'profs' && <TeachersList />}
      {tab === 'chefs' && <ChiefsList />}
    </div>
  )
}

export default CreatorSpace
