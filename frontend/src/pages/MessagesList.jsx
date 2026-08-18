import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Check, X, CheckCheck } from 'lucide-react'
import { apiJson, API_BASE } from '../api/client'
import './MessagesList.css'

function formatConvoTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function ConversationPreview({ c }) {
  return (
    <p className="conversation-preview">
      {c.last_message_mine && (
        <CheckCheck size={14} className={`conversation-read-icon ${c.last_message_read ? 'seen' : ''}`} />
      )}
      <span className="conversation-preview-text">
        {c.last_message_mine && 'Toi : '}{c.last_message}
      </span>
    </p>
  )
}

function MessagesList() {
  const [conversations, setConversations] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyMatricule, setBusyMatricule] = useState(null)

  const load = () => {
    Promise.all([
      apiJson('/api/chat/conversations/'),
      apiJson('/api/chat/requests/'),
    ]).then(([convos, reqs]) => {
      setConversations(convos)
      setRequests(reqs)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    apiJson('/api/social/notifications/mark-read-by-type/', {
      method: 'POST',
      body: JSON.stringify({ type: 'message' }),
    }).catch(() => {})
  }, [])

  const respond = async (matricule, action) => {
    setBusyMatricule(matricule)
    try {
      await apiJson(`/api/chat/conversations/${matricule}/${action}/`, { method: 'POST' })
      load()
    } finally {
      setBusyMatricule(null)
    }
  }

  return (
    <div className="messages-list-page">
      <div className="messages-list-header">
        <h2 className="page-title" style={{ padding: 0 }}>Messages</h2>
        <Link to="/messages/nouveau" className="icon-btn messages-new-btn" aria-label="Nouvelle discussion">
          <Plus size={20} />
        </Link>
      </div>

      {loading && <p className="empty-state">Chargement...</p>}

      {!loading && requests.length > 0 && (
        <>
          <p className="section-title">Demandes de message</p>
          {requests.map((r) => (
            <div key={r.matricule} className="message-request-row">
              <Link to={`/messages/${r.matricule}`} className="conversation-row message-request-link">
                <div className="avatar" style={{ width: 46, height: 46 }}>
                  {r.photo ? <img src={`${API_BASE}${r.photo}`} alt="" /> : r.first_name[0]}
                </div>
                <div className="conversation-info">
                  <div className="conversation-top">
                    <strong>{r.first_name} {r.last_name}</strong>
                  </div>
                  <ConversationPreview c={r} />
                </div>
                <div className="conversation-meta">
                  <span className="conversation-meta-time">{formatConvoTime(r.last_timestamp)}</span>
                  {r.unread_count > 0 && <span className="conversation-meta-badge">{r.unread_count > 99 ? '99+' : r.unread_count}</span>}
                </div>
              </Link>
              <div className="message-request-actions">
                <button
                  className="btn btn-primary"
                  disabled={busyMatricule === r.matricule}
                  onClick={() => respond(r.matricule, 'accept')}
                  aria-label="Accepter"
                >
                  <Check size={16} />
                </button>
                <button
                  className="btn btn-outline"
                  disabled={busyMatricule === r.matricule}
                  onClick={() => respond(r.matricule, 'decline')}
                  aria-label="Refuser"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          <p className="section-title">Conversations</p>
        </>
      )}

      {!loading && conversations.length === 0 && requests.length === 0 && (
        <p className="empty-state">
          Aucune conversation. Appuie sur + pour démarrer une discussion.
        </p>
      )}

      {conversations.map((c) => (
        <Link to={`/messages/${c.matricule}`} key={c.matricule} className="conversation-row">
          <div className="avatar" style={{ width: 46, height: 46 }}>
            {c.photo ? <img src={`${API_BASE}${c.photo}`} alt="" /> : c.first_name[0]}
          </div>
          <div className="conversation-info">
            <div className="conversation-top">
              <strong>{c.first_name} {c.last_name}</strong>
              {c.online && <span className="badge badge-online">en ligne</span>}
            </div>
            <ConversationPreview c={c} />
          </div>
          <div className="conversation-meta">
            <span className="conversation-meta-time">{formatConvoTime(c.last_timestamp)}</span>
            {c.unread_count > 0 && <span className="conversation-meta-badge">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}
          </div>
        </Link>
      ))}
    </div>
  )
}

export default MessagesList
