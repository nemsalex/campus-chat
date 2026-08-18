import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ImagePlus, Eye, Globe, Users } from 'lucide-react'
import { apiJson } from '../api/client'
import SectionTitle from '../components/SectionTitle'
import BackHeader from '../components/BackHeader'
import './StatusCreate.css'

function StatusCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const photoMode = searchParams.get('mode') === 'photo'
  const fileInputRef = useRef(null)
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [visibility, setVisibility] = useState('friends')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (photoMode) fileInputRef.current?.click()
  }, [photoMode])

  const handleImage = (e) => {
    const file = e.target.files?.[0]
    setImage(file || null)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() && !image) {
      setError('Ajoute un texte ou une photo.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('text', text.trim())
      formData.append('visibility', visibility)
      if (image) formData.append('image', image)
      await apiJson('/api/social/statuses/', { method: 'POST', body: formData })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-padding">
      <BackHeader to="/" title="Créer un statut" />

      <form onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

        <label className="status-image-picker">
          {preview ? <img src={preview} alt="" /> : (
            <span className="status-image-picker-placeholder">
              <ImagePlus size={22} />
              Ajouter une photo
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture={photoMode ? 'environment' : undefined}
            onChange={handleImage}
            ref={fileInputRef}
            hidden
          />
        </label>

        <div className="form-field">
          <textarea
            placeholder="Écrire quelque chose..."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <SectionTitle icon={Eye}>Visibilité</SectionTitle>
        <div className="status-visibility-options">
          <label className={`status-visibility-option ${visibility === 'public' ? 'selected' : ''}`}>
            <input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
            <Globe size={16} /> Tout le campus
          </label>
          <label className={`status-visibility-option ${visibility === 'friends' ? 'selected' : ''}`}>
            <input type="radio" name="visibility" checked={visibility === 'friends'} onChange={() => setVisibility('friends')} />
            <Users size={16} /> Mes amis uniquement
          </label>
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Publication...' : 'Publier'}
        </button>
      </form>
    </div>
  )
}

export default StatusCreate
