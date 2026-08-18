import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, UserPlus } from 'lucide-react'
import { apiJson, API_BASE } from '../api/client'
import BackHeader from '../components/BackHeader'
import './FriendRequests.css'

function UserRow({ user, children }) {
  return (
    <div className="card friend-request-row">
      <Link to={`/profil/${user.id}`} className="friend-request-user">
        <div className="avatar" style={{ width: 40, height: 40 }}>
          {user.photo ? <img src={`${API_BASE}${user.photo}`} alt="" /> : user.first_name[0]}
        </div>
        <span>{user.first_name} {user.last_name}</span>
      </Link>
      <div className="friend-request-actions">{children}</div>
    </div>
  )
}

function FriendRequests() {
  const [data, setData] = useState({ received: [], sent: [] })
  const [suggestions, setSuggestions] = useState([])
  const [sentTo, setSentTo] = useState(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiJson('/api/social/friends/requests/').then(setData)
    apiJson('/api/social/suggestions/').then(setSuggestions)
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id, action) => {
    setBusy(true)
    try {
      await apiJson(`/api/social/friends/requests/${id}/${action}/`, { method: 'POST' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const addSuggestion = async (userId) => {
    setBusy(true)
    try {
      await apiJson('/api/social/friends/requests/', { method: 'POST', body: JSON.stringify({ to_user: userId }) })
      setSentTo((prev) => new Set(prev).add(userId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-padding">
      <BackHeader to="/" title="Demandes d'amitié" />

      <p className="section-title" style={{ marginLeft: 0 }}>Reçues</p>
      {data.received.length === 0 && <p className="empty-state">Aucune demande reçue.</p>}
      {data.received.map((r) => (
        <UserRow key={r.id} user={r.from_user}>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(r.id, 'accept')} aria-label="Accepter">
            <Check size={16} />
          </button>
          <button className="btn btn-outline" disabled={busy} onClick={() => act(r.id, 'refuse')} aria-label="Refuser">
            <X size={16} />
          </button>
        </UserRow>
      ))}

      <p className="section-title" style={{ marginLeft: 0, marginTop: '1.25rem' }}>Envoyées</p>
      {data.sent.length === 0 && <p className="empty-state">Aucune demande envoyée.</p>}
      {data.sent.map((r) => (
        <UserRow key={r.id} user={r.to_user}>
          <button className="btn btn-outline" disabled={busy} onClick={() => act(r.id, 'cancel')}>Annuler</button>
        </UserRow>
      ))}

      <p className="section-title" style={{ marginLeft: 0, marginTop: '1.25rem' }}>Suggestions</p>
      {suggestions.length === 0 && <p className="empty-state">Aucune suggestion pour le moment.</p>}
      {suggestions.map((s) => (
        <UserRow key={s.id} user={s}>
          {sentTo.has(s.id) ? (
            <span className="badge">Demande envoyée</span>
          ) : (
            <button className="btn btn-secondary" disabled={busy} onClick={() => addSuggestion(s.id)} aria-label="Ajouter">
              <UserPlus size={16} />
            </button>
          )}
        </UserRow>
      ))}
    </div>
  )
}

export default FriendRequests
