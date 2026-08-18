import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiJson, API_BASE } from '../api/client'
import BackHeader from '../components/BackHeader'
import './ClassDirectory.css'

function ClassDirectory() {
  const { user } = useAuth()
  const [students, setStudents] = useState(null)

  useEffect(() => {
    apiJson('/api/social/class-directory/').then(setStudents)
  }, [])

  return (
    <div className="page-padding">
      <BackHeader to="/campus" title="Annuaire de classe" />

      {user.filiere && user.niveau && (
        <p className="profile-subline" style={{ marginBottom: '1rem' }}>{user.filiere} · {user.niveau}</p>
      )}

      {students === null && <p className="empty-state">Chargement...</p>}
      {students?.length === 0 && (
        <p className="empty-state">Aucun autre étudiant trouvé dans ta classe.</p>
      )}

      <div className="class-directory-grid">
        {students?.map((s) => (
          <Link to={`/profil/${s.id}`} key={s.id} className="class-directory-card">
            <div className="avatar class-directory-avatar">
              {s.photo ? <img src={`${API_BASE}${s.photo}`} alt="" /> : s.first_name[0]}
            </div>
            <span className="class-directory-name">{s.first_name} {s.last_name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default ClassDirectory
