import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UserCheck, MessageCircle, Image, Megaphone, Bell } from 'lucide-react'
import { apiJson } from '../api/client'
import BackHeader from '../components/BackHeader'
import './Notifications.css'

const ICONS = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  message: MessageCircle,
  status: Image,
  announcement: Megaphone,
}

const TARGETS = {
  friend_request: () => '/demandes',
  friend_accepted: () => '/demandes',
  message: (n) => `/profil/${n.related_id}`,
  status: () => '/',
  announcement: () => '/campus',
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson('/api/social/notifications/').then(setNotifications).finally(() => setLoading(false))
  }, [])

  const handleClick = async (n) => {
    if (!n.read) {
      apiJson(`/api/social/notifications/${n.id}/read/`, { method: 'POST' })
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    const target = TARGETS[n.type]
    if (target) navigate(target(n))
  }

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await apiJson('/api/social/notifications/mark-all-read/', { method: 'POST' })
  }

  const hasUnread = notifications.some((n) => !n.read)

  return (
    <div className="page-padding">
      <BackHeader
        to="/"
        title="Notifications"
        action={hasUnread && (
          <button className="notifications-mark-all" onClick={markAllRead}>Tout lire</button>
        )}
      />

      {loading && <p className="empty-state">Chargement...</p>}
      {!loading && notifications.length === 0 && (
        <p className="empty-state">Aucune notification pour le moment.</p>
      )}

      {notifications.map((n) => {
        const Icon = ICONS[n.type] || Bell
        return (
          <button
            key={n.id}
            className={`notification-row ${n.read ? '' : 'unread'}`}
            onClick={() => handleClick(n)}
          >
            <span className={`notification-icon notification-icon-${n.type}`}><Icon size={18} /></span>
            <span className="notification-body">
              <span className="notification-message">{n.message}</span>
              <span className="notification-time">{timeAgo(n.created_at)}</span>
            </span>
            {!n.read && <span className="notification-dot" />}
          </button>
        )
      })}
    </div>
  )
}

export default Notifications
