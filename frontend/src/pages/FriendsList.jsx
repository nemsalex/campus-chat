import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { apiJson, API_BASE } from '../api/client'
import BackHeader from '../components/BackHeader'
import './FriendsList.css'

function FriendsList() {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson('/api/social/friends/').then(setFriends).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-padding">
      <BackHeader to="/profil" title="Mes amis" />

      {loading && <p className="empty-state">Chargement...</p>}
      {!loading && friends.length === 0 && (
        <p className="empty-state">Tu n'as pas encore d'amis. Utilise la recherche pour en trouver !</p>
      )}
      {friends.map((f) => (
        <div key={f.friendship_id} className="card friend-row">
          <Link to={`/profil/${f.id}`} className="friend-row-user">
            <div className="avatar" style={{ width: 44, height: 44 }}>
              {f.photo ? <img src={`${API_BASE}${f.photo}`} alt="" /> : f.first_name[0]}
            </div>
            <div>
              <strong>{f.first_name} {f.last_name}</strong>
              <p><span className={`status-dot ${f.online ? 'online' : 'offline'}`} /> {f.online ? 'En ligne' : 'Hors ligne'}</p>
            </div>
          </Link>
          <Link to={`/messages/${f.matricule}`} state={{ friend: f }} className="friend-row-message" aria-label="Envoyer un message">
            <MessageCircle size={20} />
          </Link>
        </div>
      ))}
    </div>
  )
}

export default FriendsList
