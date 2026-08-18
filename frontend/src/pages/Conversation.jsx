import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Send, Paperclip, FileText, Check, X, CheckCheck, Search, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, apiJson, API_BASE, getTokens, forceLogout } from '../api/client'
import './Conversation.css'

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_URL = `${WS_PROTOCOL}://${window.location.hostname}:8000/ws/chat/`

function formatTime(ts) {
  if (!ts) return ''
  if (/^\d{2}:\d{2}$/.test(ts)) return ts
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function Conversation() {
  const { matricule } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [friend, setFriend] = useState(location.state?.friend || null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [convoStatus, setConvoStatus] = useState(null)
  const [respondBusy, setRespondBusy] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editText, setEditText] = useState('')
  const ws = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const lastTypingSentRef = useRef(0)

  useEffect(() => {
    if (friend) return
    apiJson(`/api/social/search/?q=${encodeURIComponent(matricule)}`).then((results) => {
      const match = results.find((r) => r.matricule === matricule)
      if (match) setFriend(match)
    })
  }, [matricule, friend])

  const loadStatus = () => apiJson(`/api/chat/conversations/${matricule}/status/`).then(setConvoStatus)

  useEffect(() => {
    apiJson(`/api/chat/conversations/${matricule}/messages/`).then(setMessages)
    apiJson('/api/social/notifications/mark-read-by-type/', {
      method: 'POST',
      body: JSON.stringify({ type: 'message' }),
    }).catch(() => {})
    loadStatus()
  }, [matricule])

  useEffect(() => {
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      setConnected(true)
      socket.send(JSON.stringify({ type: 'join', token: getTokens().access }))
    }

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'private' && (data.from === matricule || data.to === matricule)) {
        setMessages((prev) => [...prev, { ...data, read: false }])
        if (data.conversation_status) {
          setConvoStatus((prev) => (prev ? { ...prev, status: data.conversation_status } : prev))
        }
        if (data.from === matricule) {
          apiJson(`/api/chat/conversations/${matricule}/mark-read/`, { method: 'POST' }).catch(() => {})
        }
      } else if (data.type === 'messages_read' && data.by === matricule) {
        setMessages((prev) => prev.map((m) => ((m.username || m.from) === user.matricule ? { ...m, read: true } : m)))
      } else if (data.type === 'typing' && data.from === matricule) {
        setOtherTyping(true)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000)
      } else if (data.type === 'message_edited') {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, content: data.content, edited: true } : m)))
      } else if (data.type === 'message_deleted') {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, content: '', file_url: '', file_name: '', deleted: true } : m)))
      } else if (data.type === 'message_reaction') {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, reactions: data.reactions } : m)))
      } else if (data.type === 'private_error' && data.to === matricule) {
        setError(data.message)
      } else if (data.type === 'join_error') {
        setError(data.message)
      } else if (data.type === 'force_disconnect') {
        forceLogout()
      }
    }

    socket.onclose = () => setConnected(false)
    return () => {
      socket.close()
      clearTimeout(typingTimeoutRef.current)
    }
  }, [matricule])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || !connected) return
    ws.current.send(JSON.stringify({ type: 'private', to: matricule, content: input.trim() }))
    setInput('')
  }

  const startEdit = (m) => {
    setEditingMessageId(m.id)
    setEditText(m.content)
    setSelectedMessageId(null)
  }

  const confirmEdit = () => {
    const text = editText.trim()
    if (!text) return
    ws.current.send(JSON.stringify({ type: 'edit_message', id: editingMessageId, content: text, to: matricule }))
    setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? { ...m, content: text, edited: true } : m)))
    setEditingMessageId(null)
    setEditText('')
  }

  const deleteMessage = (id) => {
    if (!window.confirm('Supprimer ce message ?')) return
    ws.current.send(JSON.stringify({ type: 'delete_message', id, to: matricule }))
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: '', file_url: '', file_name: '', deleted: true } : m)))
    setSelectedMessageId(null)
  }

  const sendReaction = (m, emoji) => {
    const newMyReaction = m.my_reaction === emoji ? null : emoji
    ws.current.send(JSON.stringify({ type: 'react_message', id: m.id, emoji, to: matricule }))
    setMessages((prev) => prev.map((msg) => (msg.id === m.id ? { ...msg, my_reaction: newMyReaction } : msg)))
    setSelectedMessageId(null)
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    if (!connected) return
    const now = Date.now()
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now
      ws.current.send(JSON.stringify({ type: 'typing', to: matricule }))
    }
  }

  const respondToRequest = async (action) => {
    setRespondBusy(true)
    try {
      await apiJson(`/api/chat/conversations/${matricule}/${action}/`, { method: 'POST' })
      if (action === 'decline') {
        navigate('/messages')
      } else {
        loadStatus()
      }
    } finally {
      setRespondBusy(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') sendMessage()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !connected) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch('/api/chat/upload/', { method: 'POST', body: formData })
      const data = await res.json()
      ws.current.send(JSON.stringify({
        type: 'private', to: matricule, content: '', file_url: data.url, file_name: data.name,
      }))
    } finally {
      setUploading(false)
    }
  }

  const friendName = friend ? `${friend.first_name} ${friend.last_name}` : matricule
  const statusText = otherTyping ? "en train d'écrire..." : (connected ? 'Connecté' : 'Déconnecté')
  const query = searchQuery.trim().toLowerCase()
  const displayedMessages = query
    ? messages.filter((m) => m.content?.toLowerCase().includes(query))
    : messages

  return (
    <div className="conversation-page">
      <div className="conversation-header">
        <Link to="/messages" className="back-link" aria-label="Retour"><ArrowLeft size={20} /></Link>
        {friend ? (
          <Link to={`/profil/${friend.id}`} className="conversation-header-identity">
            <div className="avatar" style={{ width: 36, height: 36 }}>
              {friend.photo ? <img src={`${API_BASE}${friend.photo}`} alt="" /> : friendName[0]}
            </div>
            <div>
              <strong>{friendName}</strong>
              <p className={otherTyping ? 'status-typing' : (connected ? 'status-online' : 'status-offline')}>
                {statusText}
              </p>
            </div>
          </Link>
        ) : (
          <div className="conversation-header-identity">
            <div className="avatar" style={{ width: 36, height: 36 }}>{friendName[0]}</div>
            <div>
              <strong>{friendName}</strong>
              <p className={otherTyping ? 'status-typing' : (connected ? 'status-online' : 'status-offline')}>
                {statusText}
              </p>
            </div>
          </div>
        )}
        <button
          className="icon-btn conversation-search-toggle"
          onClick={() => { setSearchOpen((v) => !v); setSearchQuery('') }}
          aria-label="Rechercher dans la conversation"
        >
          <Search size={20} />
        </button>
      </div>

      {searchOpen && (
        <div className="conversation-search-bar">
          <input
            type="text"
            placeholder="Rechercher dans la conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <span className="conversation-search-count">
              {displayedMessages.length} résultat{displayedMessages.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {error && <p className="form-error conversation-error">{error}</p>}

      <div className="conversation-messages">
        {messages.length === 0 && (
          <p className="empty-state">Début de ta conversation avec {friendName}</p>
        )}
        {query && displayedMessages.length === 0 && (
          <p className="empty-state">Aucun résultat pour "{searchQuery}".</p>
        )}
        {displayedMessages.map((m, i) => {
          const from = m.username || m.from
          const isMine = from === user.matricule
          const isEditing = editingMessageId === m.id
          return (
            <div key={m.id ?? i} className={`conv-message ${isMine ? 'mine' : 'theirs'}`}>
              {isEditing ? (
                <div className="conv-edit-bar">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                    autoFocus
                  />
                  <button className="icon-btn" onClick={confirmEdit} aria-label="Valider"><Check size={16} /></button>
                  <button className="icon-btn" onClick={() => setEditingMessageId(null)} aria-label="Annuler"><X size={16} /></button>
                </div>
              ) : (
                <div
                  className="conv-bubble"
                  onClick={() => !m.deleted && setSelectedMessageId(selectedMessageId === m.id ? null : m.id)}
                >
                  {m.deleted ? (
                    <span className="conv-deleted">Message supprimé</span>
                  ) : (
                    <>
                      {m.file_url && (
                        <a href={`${API_BASE}${m.file_url}`} target="_blank" rel="noreferrer" className="conv-file">
                          <FileText size={16} />
                          <span>{m.file_name || 'Document'}</span>
                        </a>
                      )}
                      {m.content && <span>{m.content}</span>}
                    </>
                  )}
                </div>
              )}

              {!m.deleted && Object.keys(m.reactions || {}).length > 0 && (
                <div className="conv-reactions">
                  {Object.entries(m.reactions).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      className={`conv-reaction-badge ${m.my_reaction === emoji ? 'mine' : ''}`}
                      onClick={() => sendReaction(m, emoji)}
                    >
                      {emoji} {count}
                    </button>
                  ))}
                </div>
              )}

              {selectedMessageId === m.id && !isEditing && (
                <div className="conv-message-actions">
                  <div className="conv-reaction-picker">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button key={emoji} className="conv-reaction-picker-btn" onClick={() => sendReaction(m, emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {isMine && (
                    <div className="conv-message-actions-row">
                      {m.content && !m.file_url && (
                        <button className="icon-btn" onClick={() => startEdit(m)} aria-label="Modifier"><Pencil size={15} /></button>
                      )}
                      <button className="icon-btn" onClick={() => deleteMessage(m.id)} aria-label="Supprimer"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
              )}

              {!isEditing && (
                <span className="conv-time">
                  {formatTime(m.timestamp)}
                  {m.edited && !m.deleted && <span className="conv-edited-tag">modifié</span>}
                  {isMine && !m.deleted && (
                    m.read
                      ? <span className="conv-status conv-status-seen">Vu</span>
                      : <CheckCheck size={13} className="conv-status" />
                  )}
                </span>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {convoStatus?.status === 'pending' && !convoStatus.is_friend && !convoStatus.initiated_by_me ? (
        <div className="conversation-request-banner">
          <p>{friendName} souhaite te parler. Accepter pour pouvoir discuter.</p>
          <div className="conversation-request-actions">
            <button className="btn btn-primary" disabled={respondBusy} onClick={() => respondToRequest('accept')}>
              <Check size={16} /> Accepter
            </button>
            <button className="btn btn-outline" disabled={respondBusy} onClick={() => respondToRequest('decline')}>
              <X size={16} /> Refuser
            </button>
          </div>
        </div>
      ) : (
        <>
          {convoStatus?.status === 'pending' && !convoStatus.is_friend && convoStatus.initiated_by_me && (
            <p className="conversation-pending-note">En attente de confirmation de {friendName}.</p>
          )}
          <div className="conversation-input-bar">
            <button
              className="icon-btn conversation-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Joindre un fichier"
            >
              <Paperclip size={20} />
            </button>
            <input type="file" ref={fileInputRef} hidden onChange={handleFile} />
            <input
              type="text"
              placeholder="Écrire un message..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKey}
            />
            <button className="btn btn-primary" onClick={sendMessage} aria-label="Envoyer"><Send size={18} /></button>
          </div>
        </>
      )}
    </div>
  )
}

export default Conversation
