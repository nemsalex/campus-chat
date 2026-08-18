import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, FileText } from 'lucide-react'
import { apiJson, API_BASE } from '../api/client'
import BackHeader from '../components/BackHeader'
import './AnnouncementDetail.css'

function AnnouncementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    apiJson(`/api/social/announcements/${id}/`).then(setAnnouncement)
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiJson(`/api/social/announcements/${id}/`, { method: 'DELETE' })
      navigate(-1)
    } finally {
      setDeleting(false)
    }
  }

  if (!announcement) return <p className="empty-state">Chargement...</p>

  return (
    <div className="page-padding">
      <BackHeader title="Annonce" />

      <div className="card announcement-detail">
        {announcement.is_urgent && (
          <p className="announcement-urgent-badge"><AlertTriangle size={14} /> Urgente</p>
        )}
        <h2>{announcement.title}</h2>
        {announcement.author && (
          <p className="profile-subline">{announcement.author.first_name} {announcement.author.last_name}</p>
        )}
        <p className="announcement-detail-content">{announcement.content}</p>
        {announcement.file && (
          <a href={`${API_BASE}${announcement.file}`} target="_blank" rel="noreferrer" className="conv-file announcement-detail-file">
            <FileText size={16} />
            <span>Pièce jointe</span>
          </a>
        )}
        {announcement.can_delete && (
          <button className="btn btn-danger btn-block" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Suppression...' : "Supprimer l'annonce"}
          </button>
        )}
      </div>
    </div>
  )
}

export default AnnouncementDetail
