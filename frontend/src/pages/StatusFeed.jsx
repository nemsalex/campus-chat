import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, X, Send, Eye, Camera, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJson, API_BASE, getTokens } from '../api/client'
import './StatusFeed.css'

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_URL = `${WS_PROTOCOL}://${window.location.hostname}:8000/ws/chat/`

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

const TEXT_BG_COLORS = ['#3b6fed', '#7c5cff', '#d94f7a', '#e0913b', '#2fa66a', '#2091b0']

function StatusRing({ count, size, children, viewed }) {
  const stroke = 2.5
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const gap = count > 1 ? circumference * 0.04 : 0
  const segLen = circumference / count - gap

  return (
    <span className="status-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="status-ring-svg">
        {Array.from({ length: count }).map((_, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={viewed ? 'var(--color-text-secondary)' : 'var(--color-secondary)'}
            strokeWidth={stroke}
            strokeDasharray={`${segLen} ${circumference - segLen}`}
            strokeDashoffset={-i * (circumference / count)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      <span className="status-ring-content">{children}</span>
    </span>
  )
}

function StatusViewer({ groups: groupsProp, startIndex, onClose, currentUserId, onView }) {
  const [groups] = useState(groupsProp)
  const [groupIndex, setGroupIndex] = useState(startIndex)
  const [itemIndex, setItemIndex] = useState(0)
  const [replyText, setReplyText] = useState('')
  const [replyState, setReplyState] = useState('idle')
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState(null)

  useEffect(() => {
    setItemIndex(0)
    setReplyText('')
    setReplyState('idle')
  }, [groupIndex])

  const group = groups[groupIndex]
  const item = group.items[itemIndex]
  const isOwn = group.author.id === currentUserId

  useEffect(() => {
    setShowViewers(false)
    setViewers(null)
    if (!isOwn) onView(item.id)
  }, [item.id])

  const goNext = () => {
    if (itemIndex < group.items.length - 1) {
      setItemIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
    } else {
      onClose()
    }
  }

  const goPrev = () => {
    if (itemIndex > 0) {
      setItemIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1)
    }
  }

  const bgColor = TEXT_BG_COLORS[(group.author.id + itemIndex) % TEXT_BG_COLORS.length]

  const toggleViewers = () => {
    if (showViewers) {
      setShowViewers(false)
      return
    }
    setShowViewers(true)
    if (viewers === null) {
      apiJson(`/api/social/statuses/${item.id}/viewers/`).then(setViewers)
    }
  }

  const sendReply = () => {
    const text = replyText.trim()
    if (!text || replyState === 'sending') return
    setReplyState('sending')
    const socket = new WebSocket(WS_URL)
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', token: getTokens().access }))
    }
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'init') {
        socket.send(JSON.stringify({ type: 'private', to: group.author.matricule, content: text }))
      } else if (data.type === 'private') {
        setReplyState('sent')
        setReplyText('')
        socket.close()
      } else if (data.type === 'private_error' || data.type === 'join_error') {
        setReplyState('error')
        socket.close()
      }
    }
    socket.onerror = () => setReplyState('error')
  }

  return (
    <div className="status-viewer">
      <div className="status-viewer-progress">
        {group.items.map((it, i) => (
          <span key={it.id} className={`status-viewer-segment ${i <= itemIndex ? 'active' : ''}`} />
        ))}
      </div>

      <div className="status-viewer-header">
        <span className="avatar" style={{ width: 36, height: 36 }}>
          {group.author.photo ? <img src={`${API_BASE}${group.author.photo}`} alt="" /> : group.author.first_name[0]}
        </span>
        <div className="status-viewer-header-info">
          <strong>{group.author.first_name} {group.author.last_name}</strong>
          <span>{timeAgo(item.created_at)}</span>
        </div>
        <button className="icon-btn status-viewer-close" onClick={onClose} aria-label="Fermer">
          <X size={22} />
        </button>
      </div>

      <div className="status-viewer-body" style={!item.image ? { background: bgColor } : undefined}>
        {item.image && <img src={`${API_BASE}${item.image}`} alt="" className="status-viewer-image" />}
        {item.text && (
          <p className={`status-viewer-text ${item.image ? 'caption' : 'standalone'}`}>{item.text}</p>
        )}
      </div>

      <div className={`status-viewer-tap-zones ${isOwn ? 'own' : ''}`}>
        <button className="status-viewer-tap-zone left" onClick={goPrev} aria-label="Précédent" />
        <button className="status-viewer-tap-zone right" onClick={goNext} aria-label="Suivant" />
      </div>

      {isOwn && (
        <div className="status-viewer-views">
          <button className="status-viewer-views-toggle" onClick={toggleViewers}>
            <Eye size={16} />
            <span>{item.view_count || 0} vue{item.view_count > 1 ? 's' : ''}</span>
          </button>
          {showViewers && (
            <div className="status-viewer-viewers-list">
              {viewers === null && <p>Chargement...</p>}
              {viewers?.length === 0 && <p>Personne n'a encore vu ce statut.</p>}
              {viewers?.map((v) => (
                <div key={v.id} className="status-viewer-viewer-row">
                  <span className="avatar" style={{ width: 26, height: 26, fontSize: '0.7rem' }}>
                    {v.photo ? <img src={`${API_BASE}${v.photo}`} alt="" /> : v.first_name[0]}
                  </span>
                  <span>{v.first_name} {v.last_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isOwn && (
        <div className="status-viewer-reply-bar">
          <input
            type="text"
            placeholder={`Répondre à ${group.author.first_name}...`}
            value={replyText}
            onChange={(e) => { setReplyText(e.target.value); setReplyState('idle') }}
            onKeyDown={(e) => e.key === 'Enter' && sendReply()}
          />
          <button
            className="icon-btn status-viewer-reply-send"
            onClick={sendReply}
            disabled={!replyText.trim() || replyState === 'sending'}
            aria-label="Envoyer"
          >
            <Send size={18} />
          </button>
          {replyState === 'sent' && <span className="status-viewer-reply-feedback">Envoyé</span>}
          {replyState === 'error' && <span className="status-viewer-reply-feedback error">Échec</span>}
        </div>
      )}
    </div>
  )
}

function StatusFeed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingIndex, setViewingIndex] = useState(null)
  const [viewedIds, setViewedIds] = useState(new Set())

  useEffect(() => {
    apiJson('/api/social/statuses/feed/').then(setStatuses).finally(() => setLoading(false))
    apiJson('/api/social/notifications/mark-read-by-type/', {
      method: 'POST',
      body: JSON.stringify({ type: 'status' }),
    }).catch(() => {})
  }, [])

  const handleView = (itemId) => {
    if (viewedIds.has(itemId)) return
    apiJson(`/api/social/statuses/${itemId}/view/`, { method: 'POST' }).catch(() => {})
    setViewedIds((prev) => new Set(prev).add(itemId))
  }

  const isSeen = (item) => item.viewed_by_me || viewedIds.has(item.id)

  const myItems = statuses.filter((s) => s.author.id === user.id)
  const hasMyStatus = myItems.length > 0
  const myGroup = { author: user, items: myItems }

  const unseenGroups = []
  const seenGroups = []
  const byAuthor = new Map()
  for (const s of statuses) {
    if (s.author.id === user.id) continue
    if (!byAuthor.has(s.author.id)) {
      byAuthor.set(s.author.id, { author: s.author, items: [] })
    }
    byAuthor.get(s.author.id).items.push(s)
  }
  for (const group of byAuthor.values()) {
    const allSeen = group.items.every(isSeen)
    ;(allSeen ? seenGroups : unseenGroups).push(group)
  }

  const orderedGroups = [...unseenGroups, ...seenGroups]
  const viewGroups = hasMyStatus ? [myGroup, ...orderedGroups] : orderedGroups

  const handleMineClick = () => {
    if (hasMyStatus) setViewingIndex(0)
    else navigate('/statuts/nouveau')
  }

  const renderRow = (g, viewIndex) => (
    <button key={g.author.id} className="status-row" onClick={() => setViewingIndex(viewIndex)}>
      <StatusRing count={g.items.length} size={48} viewed={g.items.every(isSeen)}>
        <span className="avatar" style={{ width: 40, height: 40 }}>
          {g.author.photo ? <img src={`${API_BASE}${g.author.photo}`} alt="" /> : g.author.first_name[0]}
        </span>
      </StatusRing>
      <span className="status-row-info">
        <strong>{g.author.first_name} {g.author.last_name}</strong>
        <span>{timeAgo(g.items[0].created_at)}{g.items.length > 1 ? ` · ${g.items.length} statuts` : ''}</span>
      </span>
    </button>
  )

  return (
    <div className="status-page">
      <div className="status-page-header">
        <h2 className="page-title" style={{ padding: 0 }}>Statuts</h2>
        <div className="status-page-header-actions">
          <Link to="/statuts/nouveau?mode=photo" className="icon-btn status-header-icon" aria-label="Ajouter une photo">
            <Camera size={20} />
          </Link>
          <Link to="/statuts/nouveau" className="icon-btn status-header-icon" aria-label="Écrire un statut">
            <Pencil size={18} />
          </Link>
        </div>
      </div>

      <button type="button" className="status-mine-row" onClick={handleMineClick}>
        <span className="status-mine-avatar-wrap">
          {hasMyStatus ? (
            <StatusRing count={myItems.length} size={52} viewed={false}>
              <span className="avatar" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>
                {user.photo ? <img src={`${API_BASE}${user.photo}`} alt="" /> : user.first_name[0]}
              </span>
            </StatusRing>
          ) : (
            <span className="avatar status-mine-avatar">
              {user.photo ? <img src={`${API_BASE}${user.photo}`} alt="" /> : user.first_name[0]}
            </span>
          )}
          <span className="status-mine-plus"><Plus size={12} /></span>
        </span>
        <span className="status-mine-text">
          <strong>Mon statut</strong>
          <p>{hasMyStatus ? `${myItems.length} statut${myItems.length > 1 ? 's' : ''} · appuie pour voir` : 'Appuie pour ajouter un statut'}</p>
        </span>
      </button>

      {loading && <p className="empty-state">Chargement...</p>}
      {!loading && unseenGroups.length === 0 && seenGroups.length === 0 && !hasMyStatus && (
        <p className="empty-state">Aucun statut pour le moment.</p>
      )}

      {unseenGroups.length > 0 && (
        <>
          <p className="status-section-label">Mises à jour récentes</p>
          <div className="status-list">
            {unseenGroups.map((g) => renderRow(g, viewGroups.indexOf(g)))}
          </div>
        </>
      )}

      {seenGroups.length > 0 && (
        <>
          <p className="status-section-label">Statuts vus</p>
          <div className="status-list">
            {seenGroups.map((g) => renderRow(g, viewGroups.indexOf(g)))}
          </div>
        </>
      )}

      {viewingIndex !== null && (
        <StatusViewer
          groups={viewGroups}
          startIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
          currentUserId={user.id}
          onView={handleView}
        />
      )}
    </div>
  )
}

export default StatusFeed
