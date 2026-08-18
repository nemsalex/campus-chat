import { useState, useEffect } from 'react'
import './Admin.css'

const API_PROTOCOL = window.location.protocol === 'https:' ? 'https' : 'http'
const API = `${API_PROTOCOL}://${window.location.hostname}:8000`

function Admin() {
  const [stats, setStats] = useState(null)
  const [newRoom, setNewRoom] = useState({ name: '', description: '' })
  const [msg, setMsg] = useState('')

  const fetchStats = async () => {
    const res = await fetch(`${API}/api/stats/`)
    const data = await res.json()
    setStats(data)
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) return
    await fetch(`${API}/api/create-room/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoom),
    })
    setMsg(`Salon #${newRoom.name} créé !`)
    setNewRoom({ name: '', description: '' })
    setTimeout(() => setMsg(''), 3000)
    fetchStats()
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🛡️ Panel Admin</h1>
        <a href="/" className="back-btn">← Retour au chat</a>
      </div>

      <div className="admin-grid">

        <div className="admin-card">
          <h2>📊 Statistiques</h2>
          {stats ? (
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{stats.online_count}</span>
                <span className="stat-label">Connectés</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.total_messages}</span>
                <span className="stat-label">Messages</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.total_rooms}</span>
                <span className="stat-label">Salons</span>
              </div>
            </div>
          ) : (
            <p className="loading">Chargement...</p>
          )}
        </div>

        <div className="admin-card">
          <h2>👥 Utilisateurs connectés</h2>
          {stats && stats.online_users.length > 0 ? (
            <div className="user-list">
              {stats.online_users.map((u, i) => (
                <div key={i} className="user-row">
                  <span className="green-dot"></span> {u}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">Aucun utilisateur connecté</p>
          )}
          <button className="refresh-btn" onClick={fetchStats}>🔄 Actualiser</button>
        </div>

        <div className="admin-card">
          <h2>➕ Créer un salon</h2>
          <div className="form">
            <input
              type="text"
              placeholder="Nom du salon (ex: classe-a)"
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Description (optionnel)"
              value={newRoom.description}
              onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
            />
            <button onClick={handleCreateRoom}>Créer le salon</button>
            {msg && <p className="success">{msg}</p>}
          </div>
        </div>

      </div>
    </div>
  )
}

export default Admin