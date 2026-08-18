import { useAuth } from '../context/AuthContext'
import BackHeader from '../components/BackHeader'
import TimetableList from '../components/TimetableList'

function MyTimetable() {
  const { user } = useAuth()

  return (
    <div className="page-padding">
      <BackHeader to="/campus" title="Mon emploi du temps" />

      {user.filiere && user.niveau ? (
        <>
          <p className="profile-subline" style={{ marginBottom: '1rem' }}>{user.filiere} · {user.niveau}</p>
          <TimetableList
            filiere={user.filiere}
            niveau={user.niveau}
            title="Cette semaine"
            emptyMessage="Aucun cours renseigné pour ta classe pour le moment."
          />
        </>
      ) : (
        <p className="empty-state">Renseigne ta filière et ton niveau dans ton profil pour voir ton emploi du temps.</p>
      )}
    </div>
  )
}

export default MyTimetable
