import { useState } from 'react'
import { Camera, User as UserIcon, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJson, API_BASE } from '../api/client'
import SectionTitle from '../components/SectionTitle'
import BackHeader from '../components/BackHeader'
import InstallAppCard from '../components/InstallAppCard'
import PushNotificationToggle from '../components/PushNotificationToggle'
import './Settings.css'

function Settings() {
  const { user, setUser } = useAuth()

  const [firstName, setFirstName] = useState(user.first_name)
  const [lastName, setLastName] = useState(user.last_name)
  const [filiere, setFiliere] = useState(user.filiere || '')
  const [niveau, setNiveau] = useState(user.niveau || '')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(user.photo ? `${API_BASE}${user.photo}` : null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState('')
  const [pwError, setPwError] = useState('')

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('first_name', firstName)
      formData.append('last_name', lastName)
      formData.append('filiere', filiere)
      formData.append('niveau', niveau)
      if (photo) formData.append('photo', photo)
      const updated = await apiJson('/api/auth/me/', { method: 'PATCH', body: formData })
      setUser(updated)
      setMessage('Profil mis à jour.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwSaving(true)
    setPwError('')
    setPwMessage('')
    try {
      await apiJson('/api/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      })
      setPwMessage('Mot de passe mis à jour.')
      setOldPassword('')
      setNewPassword('')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="page-padding">
      <BackHeader to="/profil" title="Paramètres" />

      <InstallAppCard />
      <PushNotificationToggle />

      <SectionTitle icon={UserIcon}>Profil</SectionTitle>
      <form onSubmit={handleSaveProfile} className="card">
        <label className="settings-photo-picker">
          <div className="avatar" style={{ width: 72, height: 72, fontSize: '1.3rem' }}>
            {preview ? <img src={preview} alt="" /> : firstName?.[0]}
          </div>
          <span className="settings-photo-edit"><Camera size={14} /> Changer la photo</span>
          <input type="file" accept="image/*" onChange={handlePhoto} hidden />
        </label>

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}

        <div className="form-field">
          <label htmlFor="firstName">Prénom</label>
          <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="lastName">Nom</label>
          <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        {user.role === 'etudiant' && (
          <>
            <div className="form-field">
              <label htmlFor="filiere">Filière</label>
              <input id="filiere" value={filiere} onChange={(e) => setFiliere(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="niveau">Niveau</label>
              <input id="niveau" value={niveau} onChange={(e) => setNiveau(e.target.value)} />
            </div>
          </>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>

      <SectionTitle icon={KeyRound}>Mot de passe</SectionTitle>
      <form onSubmit={handleChangePassword} className="card">
        {pwError && <p className="form-error">{pwError}</p>}
        {pwMessage && <p className="form-success">{pwMessage}</p>}
        <div className="form-field">
          <label htmlFor="oldPassword">Mot de passe actuel</label>
          <input id="oldPassword" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="newPassword">Nouveau mot de passe</label>
          <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
        </div>
        <button className="btn btn-outline btn-block" type="submit" disabled={pwSaving}>
          {pwSaving ? 'Enregistrement...' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  )
}

export default Settings
