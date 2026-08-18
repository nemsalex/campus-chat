import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, Paperclip, FileText, AlertTriangle, Check, X, Pencil, Trash2, BarChart3, Lock, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, apiJson, API_BASE, getTokens, forceLogout } from '../api/client'
import './GroupDetail.css'

const KIND_LABELS = {
  cycle_licence: 'Cycle Licence',
  cycle_master: 'Cycle Master',
  niveau_annonces: 'Annonces de classe',
  niveau_discussion: 'Discussion de classe',
  club: 'Club / Association',
  projet: 'Groupe de projet',
}

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_URL = `${WS_PROTOCOL}://${window.location.hostname}:8000/ws/chat/`

function formatTime(ts) {
  if (!ts) return ''
  if (/^\d{2}:\d{2}$/.test(ts)) return ts
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function PollCard({ poll, onVote, canManage, onClose }) {
  const total = poll.total_votes || 0
  return (
    <div className="poll-card">
      <div className="poll-question">
        <BarChart3 size={16} />
        <span>{poll.question}</span>
      </div>
      {poll.options.map((opt) => {
        const pct = total ? Math.round((opt.vote_count / total) * 100) : 0
        const mine = poll.my_vote === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            className={`poll-option ${mine ? 'mine' : ''}`}
            onClick={() => onVote(poll, opt)}
            disabled={poll.closed}
          >
            <span className="poll-option-fill" style={{ width: `${pct}%` }} />
            <span className="poll-option-label">{opt.text}</span>
            <span className="poll-option-pct">{pct}%</span>
          </button>
        )
      })}
      <div className="poll-footer">
        <span>{total} vote{total > 1 ? 's' : ''}{poll.closed ? ' · Clos' : ''}</span>
        {canManage && !poll.closed && (
          <button type="button" className="poll-close-btn" onClick={() => onClose(poll)}>
            <Lock size={12} /> Clore
          </button>
        )}
      </div>
    </div>
  )
}

function GroupChat({ groupId, currentUsername, isGroupAdmin }) {
  const [messages, setMessages] = useState([])
  const [polls, setPolls] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editText, setEditText] = useState('')
  const [pollFormOpen, setPollFormOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [creatingPoll, setCreatingPoll] = useState(false)
  const ws = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    apiJson(`/api/social/groups/${groupId}/polls/`).then(setPolls).catch(() => {})
  }, [groupId])

  useEffect(() => {
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', token: getTokens().access }))
    }

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'init') {
        setConnected(true)
        socket.send(JSON.stringify({ type: 'join_group', group_id: groupId }))
      } else if (data.type === 'group_history' && data.group_id === groupId) {
        setMessages(data.messages)
      } else if (data.type === 'group_message' && data.group_id === groupId) {
        setMessages((prev) => [...prev, data])
      } else if (data.type === 'message_edited' && data.group_id === groupId) {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, content: data.content, edited: true } : m)))
      } else if (data.type === 'message_deleted' && data.group_id === groupId) {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, content: '', file_url: '', file_name: '', deleted: true } : m)))
      } else if (data.type === 'message_reaction' && data.group_id === groupId) {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, reactions: data.reactions } : m)))
      } else if (data.type === 'poll_created' && data.group_id === groupId) {
        setPolls((prev) => (prev.some((p) => p.id === data.poll.id) ? prev : [...prev, data.poll]))
      } else if (data.type === 'poll_updated' && data.group_id === groupId) {
        setPolls((prev) => prev.map((p) => (p.id === data.poll.id ? data.poll : p)))
      } else if (data.type === 'force_disconnect') {
        forceLogout()
      }
    }

    socket.onclose = () => setConnected(false)
    return () => socket.close()
  }, [groupId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, polls])

  const timeline = useMemo(() => {
    const items = [
      ...messages.map((m) => ({ kind: 'message', key: `m-${m.id}`, time: formatTime(m.timestamp), data: m })),
      ...polls.map((p) => ({ kind: 'poll', key: `p-${p.id}`, time: formatTime(p.created_at), data: p })),
    ]
    items.sort((a, b) => a.time.localeCompare(b.time))
    return items
  }, [messages, polls])

  const votePoll = async (poll, option) => {
    const data = await apiJson(`/api/social/polls/${poll.id}/vote/`, {
      method: 'POST', body: JSON.stringify({ option_id: option.id }),
    })
    setPolls((prev) => prev.map((p) => (p.id === poll.id ? data : p)))
  }

  const closePoll = async (poll) => {
    if (!window.confirm('Clore ce sondage ?')) return
    const data = await apiJson(`/api/social/polls/${poll.id}/close/`, { method: 'POST' })
    setPolls((prev) => prev.map((p) => (p.id === poll.id ? data : p)))
  }

  const updatePollOption = (index, value) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  const addPollOption = () => {
    if (pollOptions.length >= 8) return
    setPollOptions((prev) => [...prev, ''])
  }

  const removePollOption = (index) => {
    setPollOptions((prev) => prev.filter((_, i) => i !== index))
  }

  const submitPoll = async (e) => {
    e.preventDefault()
    const options = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (!pollQuestion.trim() || options.length < 2) return
    setCreatingPoll(true)
    try {
      const data = await apiJson(`/api/social/groups/${groupId}/polls/`, {
        method: 'POST', body: JSON.stringify({ question: pollQuestion.trim(), options }),
      })
      setPolls((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]))
      setPollQuestion('')
      setPollOptions(['', ''])
      setPollFormOpen(false)
    } finally {
      setCreatingPoll(false)
    }
  }

  const send = () => {
    if (!input.trim() || !connected) return
    ws.current.send(JSON.stringify({ type: 'group_message', group_id: groupId, content: input.trim() }))
    setInput('')
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
        type: 'group_message', group_id: groupId, content: '', file_url: data.url, file_name: data.name,
      }))
    } finally {
      setUploading(false)
    }
  }

  const startEdit = (m) => {
    setEditingMessageId(m.id)
    setEditText(m.content)
    setSelectedMessageId(null)
  }

  const confirmEdit = () => {
    const text = editText.trim()
    if (!text) return
    ws.current.send(JSON.stringify({ type: 'edit_message', id: editingMessageId, content: text, group_id: groupId }))
    setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? { ...m, content: text, edited: true } : m)))
    setEditingMessageId(null)
    setEditText('')
  }

  const deleteMessage = (id) => {
    if (!window.confirm('Supprimer ce message ?')) return
    ws.current.send(JSON.stringify({ type: 'delete_message', id, group_id: groupId }))
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: '', file_url: '', file_name: '', deleted: true } : m)))
    setSelectedMessageId(null)
  }

  const sendReaction = (m, emoji) => {
    const newMyReaction = m.my_reaction === emoji ? null : emoji
    ws.current.send(JSON.stringify({ type: 'react_message', id: m.id, emoji, group_id: groupId }))
    setMessages((prev) => prev.map((msg) => (msg.id === m.id ? { ...msg, my_reaction: newMyReaction } : msg)))
    setSelectedMessageId(null)
  }

  return (
    <div className="group-chat-body">
      <div className="conversation-messages">
        {timeline.length === 0 && <p className="empty-state">Aucun message pour le moment.</p>}
        {timeline.map((item) => {
          if (item.kind === 'poll') {
            const poll = item.data
            return (
              <PollCard
                key={item.key}
                poll={poll}
                onVote={votePoll}
                onClose={closePoll}
                canManage={isGroupAdmin || poll.created_by?.matricule === currentUsername}
              />
            )
          }
          const m = item.data
          const isMine = m.username === currentUsername
          const isEditing = editingMessageId === m.id
          return (
            <div key={item.key} className={`conv-message ${isMine ? 'mine' : 'theirs'}`}>
              {!isMine && <span className="group-chat-author">{m.display_name || m.username}</span>}
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
                </span>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {pollFormOpen && (
        <form className="poll-form" onSubmit={submitPoll}>
          <input
            type="text"
            placeholder="Question du sondage"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            autoFocus
          />
          {pollOptions.map((opt, i) => (
            <div className="poll-form-option" key={i}>
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updatePollOption(i, e.target.value)}
              />
              {pollOptions.length > 2 && (
                <button type="button" className="icon-btn" onClick={() => removePollOption(i)} aria-label="Retirer">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 8 && (
            <button type="button" className="poll-form-add" onClick={addPollOption}>
              <Plus size={14} /> Ajouter une option
            </button>
          )}
          <div className="poll-form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPollFormOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={creatingPoll}>
              {creatingPoll ? 'Création...' : 'Créer le sondage'}
            </button>
          </div>
        </form>
      )}

      <div className="conversation-input-bar">
        <button
          className="icon-btn conversation-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Joindre un fichier"
        >
          <Paperclip size={18} />
        </button>
        <input type="file" ref={fileInputRef} hidden onChange={handleFile} />
        <button
          className="icon-btn conversation-attach-btn"
          onClick={() => setPollFormOpen((v) => !v)}
          aria-label="Créer un sondage"
        >
          <BarChart3 size={18} />
        </button>
        <input
          type="text"
          placeholder="Écrire un message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn btn-primary" onClick={send} aria-label="Envoyer"><Send size={18} /></button>
      </div>
    </div>
  )
}

function AnnouncementsFeed({ groupId, isAdmin }) {
  const [posts, setPosts] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  const load = useCallback(() => {
    apiJson(`/api/social/groups/${groupId}/announcements/`).then(setPosts).finally(() => setLoading(false))
  }, [groupId])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setPosting(true)
    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('content', content.trim())
      formData.append('is_urgent', isUrgent)
      if (file) formData.append('file', file)
      await apiJson(`/api/social/groups/${groupId}/announcements/`, { method: 'POST', body: formData })
      setTitle('')
      setContent('')
      setIsUrgent(false)
      setFile(null)
      await load()
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="page-padding">
      {isAdmin && (
        <form className="card" onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="group-ann-title">Titre</label>
            <input id="group-ann-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="group-ann-content">Message</label>
            <textarea id="group-ann-content" rows={3} value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="group-ann-file">Pièce jointe (optionnel)</label>
            <input id="group-ann-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <label className="announcement-urgent-toggle">
            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
            Annonce urgente
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={posting}>
            {posting ? 'Publication...' : 'Publier'}
          </button>
        </form>
      )}

      {loading && <p className="empty-state">Chargement...</p>}
      {!loading && posts.length === 0 && <p className="empty-state">Aucune annonce pour le moment.</p>}
      {posts.map((p) => (
        <Link to={`/annonces/${p.id}`} key={p.id} className="card campus-item announcement-link">
          <strong className="announcement-title-row">
            {p.is_urgent && <AlertTriangle size={14} className="announcement-urgent-icon" />}
            {p.title}
          </strong>
          <p>{p.content}</p>
          {p.author && <p className="campus-item-author">{p.author.first_name} {p.author.last_name}</p>}
        </Link>
      ))}
    </div>
  )
}

function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)

  useEffect(() => {
    apiJson(`/api/social/groups/${id}/`).then(setGroup)
  }, [id])

  if (!group) return <p className="empty-state">Chargement...</p>

  const isAnnonces = group.kind === 'niveau_annonces'
  const isPublic = group.kind === 'club' || group.kind === 'projet'

  return (
    <div className="conversation-page">
      <div className="conversation-header">
        <Link to="/campus" className="back-link" aria-label="Retour"><ArrowLeft size={20} /></Link>
        <Link to={`/campus/groupes/${id}/infos`} className="conversation-header-identity">
          <div className="avatar" style={{ width: 36, height: 36 }}>{group.name[0]}</div>
          <div>
            <strong>{group.name}</strong>
            <p>{KIND_LABELS[group.kind]} · {group.member_count} membre{group.member_count > 1 ? 's' : ''}</p>
          </div>
        </Link>
      </div>

      {!group.is_member && isPublic ? (
        <div className="page-padding group-detail-scroll">
          <div className="card">
            {group.description && <p className="group-detail-description">{group.description}</p>}
            <Link to={`/campus/groupes/${id}/infos`} className="btn btn-secondary btn-block">Voir le groupe</Link>
          </div>
        </div>
      ) : isAnnonces ? (
        <div className="group-detail-scroll">
          <AnnouncementsFeed groupId={group.id} isAdmin={group.is_admin} />
        </div>
      ) : (
        <GroupChat groupId={group.id} currentUsername={user.matricule} isGroupAdmin={group.is_admin} />
      )}
    </div>
  )
}

export default GroupDetail
