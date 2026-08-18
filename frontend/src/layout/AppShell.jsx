import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { GraduationCap, Search, UserPlus, Bell } from 'lucide-react'
import { apiJson } from '../api/client'
import BottomNav from './BottomNav'
import './AppShell.css'

function AppShell() {
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [navCounts, setNavCounts] = useState({ status: 0, message: 0, campus: 0 })

  useEffect(() => {
    apiJson('/api/social/friends/requests/')
      .then((data) => setPendingCount(data.received.length))
      .catch(() => {})
    apiJson('/api/social/notifications/unread-count/')
      .then((data) => setUnreadCount(data.count))
      .catch(() => {})

    Promise.all([
      apiJson('/api/social/notifications/unread-count/?type=status').catch(() => ({ count: 0 })),
      apiJson('/api/social/notifications/unread-count/?type=message').catch(() => ({ count: 0 })),
      apiJson('/api/social/notifications/unread-count/?type=announcement,leave_request').catch(() => ({ count: 0 })),
    ]).then(([statusRes, messageRes, campusRes]) => {
      setNavCounts({ status: statusRes.count, message: messageRes.count, campus: campusRes.count })
    })
  }, [location.pathname])

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo">
          <GraduationCap size={22} />
          Campus
        </Link>
        <div className="app-header-actions">
          <Link to="/recherche" className="icon-btn app-icon-btn" aria-label="Recherche">
            <Search size={20} />
          </Link>
          <Link to="/demandes" className="icon-btn app-icon-btn app-icon-btn-badge" aria-label="Demandes d'amitié">
            <UserPlus size={20} />
            {pendingCount > 0 && <span className="header-badge">{pendingCount}</span>}
          </Link>
          <Link to="/notifications" className="icon-btn app-icon-btn" aria-label="Notifications">
            <Bell size={20} />
            {unreadCount > 0 && <span className="header-badge">{unreadCount}</span>}
          </Link>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <BottomNav counts={navCounts} />
    </div>
  )
}

export default AppShell
