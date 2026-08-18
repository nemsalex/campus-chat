import { useEffect, useState } from 'react'
import { UserPlus, MessageCircle, Eye, Ban } from 'lucide-react'
import { apiJson, API_BASE } from '../api/client'
import SectionTitle from '../components/SectionTitle'
import BackHeader from '../components/BackHeader'
import './Privacy.css'

const FRIEND_REQUEST_OPTIONS = [
  { value: 'everyone', label: 'Tout le campus' },
  { value: 'nobody', label: 'Personne' },
]
const VISIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Tout le campus' },
  { value: 'friends', label: 'Mes amis' },
  { value: 'nobody', label: 'Personne' },
]

function Privacy() {
  const [settings, setSettings] = useState(null)
  const [blocked, setBlocked] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => {
    apiJson('/api/auth/privacy/').then(setSettings)
    apiJson('/api/social/blocked/').then(setBlocked)
  }

  useEffect(() => { load() }, [])

  const updateSetting = async (field, value) => {
    setSaving(true)
    setMessage('')
    try {
      const updated = await apiJson('/api/auth/privacy/', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      })
      setSettings(updated)
      setMessage('Préférences mises à jour.')
    } finally {
      setSaving(false)
    }
  }

  const unblock = async (userId) => {
    await apiJson('/api/social/unblock/', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
    setBlocked((prev) => prev.filter((u) => u.id !== userId))
  }

  if (!settings) return <p className="empty-state">Chargement...</p>

  return (
    <div className="page-padding">
      <BackHeader to="/profil" title="Confidentialité" />
      {message && <p className="form-success">{message}</p>}

      <SectionTitle icon={UserPlus}>Demandes d'amitié</SectionTitle>
      <div className="card privacy-options">
        {FRIEND_REQUEST_OPTIONS.map((opt) => (
          <label key={opt.value} className={`privacy-option ${settings.who_can_friend_request === opt.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="who_can_friend_request"
              checked={settings.who_can_friend_request === opt.value}
              disabled={saving}
              onChange={() => updateSetting('who_can_friend_request', opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <SectionTitle icon={MessageCircle}>Messages</SectionTitle>
      <div className="card privacy-options">
        {VISIBILITY_OPTIONS.map((opt) => (
          <label key={opt.value} className={`privacy-option ${settings.who_can_message === opt.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="who_can_message"
              checked={settings.who_can_message === opt.value}
              disabled={saving}
              onChange={() => updateSetting('who_can_message', opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <SectionTitle icon={Eye}>Statut en ligne</SectionTitle>
      <div className="card privacy-options">
        {VISIBILITY_OPTIONS.map((opt) => (
          <label key={opt.value} className={`privacy-option ${settings.show_online_status === opt.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="show_online_status"
              checked={settings.show_online_status === opt.value}
              disabled={saving}
              onChange={() => updateSetting('show_online_status', opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <SectionTitle icon={Ban}>Utilisateurs bloqués ({blocked.length})</SectionTitle>
      {blocked.length === 0 ? (
        <p className="empty-state">Aucun utilisateur bloqué.</p>
      ) : (
        <div className="card">
          {blocked.map((u) => (
            <div key={u.id} className="privacy-blocked-row">
              <div className="avatar" style={{ width: 36, height: 36 }}>
                {u.photo ? <img src={`${API_BASE}${u.photo}`} alt="" /> : u.first_name[0]}
              </div>
              <span>{u.first_name} {u.last_name}</span>
              <button className="btn btn-outline" onClick={() => unblock(u.id)}>Débloquer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Privacy
