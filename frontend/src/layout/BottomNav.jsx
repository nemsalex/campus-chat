import { NavLink } from 'react-router-dom'
import { Image, MessageCircle, School, User } from 'lucide-react'
import './AppShell.css'

const TABS = [
  { to: '/', icon: Image, label: 'Statuts', end: true, countKey: 'status' },
  { to: '/messages', icon: MessageCircle, label: 'Messages', countKey: 'message' },
  { to: '/campus', icon: School, label: 'Campus', countKey: 'campus' },
  { to: '/profil', icon: User, label: 'Profil' },
]

function BottomNav({ counts = {} }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, icon: Icon, label, end, countKey }) => {
        const count = countKey ? counts[countKey] : 0
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon-wrap">
              <Icon size={22} className="bottom-nav-icon" />
              {count > 0 && <span className="bottom-nav-badge">{count > 9 ? '9+' : count}</span>}
            </span>
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export default BottomNav
