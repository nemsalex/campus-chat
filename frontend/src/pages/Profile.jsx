import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, MessageCircle, Ban, Settings, Lock, LogOut, ShieldCheck, Flag, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJson, API_BASE } from '../api/client'
import BackHeader from '../components/BackHeader'
import './Profile.css'

const ROLE_LABELS = {
  etudiant: 'Étudiant',
  professeur: 'Professeur',
  administration: 'Administration',
  admin_principal: 'Admin principal',
}

function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isOwn = !id

  const [profile, setProfile] = useState(null)
  const [friendsCount, setFriendsCount] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportMessage, setReportMessage] = useState('')

  const load = useCallback(async () => {
    if (isOwn) {
      setProfile({ ...user, relation: 'self' })
    } else {
      const data = await apiJson(`/api/social/users/${id}/`)
      setProfile(data)
    }
  }, [isOwn, id, user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    apiJson('/api/social/friends/').then((list) => setFriendsCount(list.length)).catch(() => {})
  }, [id])

  if (!profile) return <p className="empty-state">Chargement...</p>

  const runAction = async (fn) => {
    setBusy(true)
    try {
      await fn()
      await load()
    } finally {
      setBusy(false)
    }
  }

  const sendRequest = () => runAction(() =>
    apiJson('/api/social/friends/requests/', { method: 'POST', body: JSON.stringify({ to_user: profile.id }) })
  )
  const cancelRequest = () => runAction(() =>
    apiJson(`/api/social/friends/requests/${profile.friendship_id}/cancel/`, { method: 'POST' })
  )
  const acceptRequest = () => runAction(() =>
    apiJson(`/api/social/friends/requests/${profile.friendship_id}/accept/`, { method: 'POST' })
  )
  const refuseRequest = () => runAction(() =>
    apiJson(`/api/social/friends/requests/${profile.friendship_id}/refuse/`, { method: 'POST' })
  )
  const removeFriend = () => runAction(() =>
    apiJson(`/api/social/friends/${profile.friendship_id}/remove/`, { method: 'POST' })
  )
  const blockUser = () => runAction(() =>
    apiJson('/api/social/block/', { method: 'POST', body: JSON.stringify({ user_id: profile.id }) })
  )
  const unblockUser = () => runAction(() =>
    apiJson('/api/social/unblock/', { method: 'POST', body: JSON.stringify({ user_id: profile.id }) })
  )
  const forceUnblock = () => runAction(() =>
    apiJson('/api/social/creator/force-unblock/', { method: 'POST', body: JSON.stringify({ user_id: profile.id }) })
  )

  const submitReport = async (e) => {
    e.preventDefault()
    if (!reportReason.trim()) return
    setBusy(true)
    try {
      const res = await apiJson('/api/social/report/', {
        method: 'POST',
        body: JSON.stringify({ user_id: profile.id, reason: reportReason.trim() }),
      })
      setReportMessage(res.detail)
      setReportReason('')
      setReporting(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-padding profile-page">
      {!isOwn && <BackHeader title="Profil" />}
      <div className="profile-header">
        <div className="avatar" style={{ width: 84, height: 84, fontSize: '1.6rem' }}>
          {profile.photo ? <img src={`${API_BASE}${profile.photo}`} alt="" /> : profile.first_name?.[0]}
        </div>
        <h2>{profile.first_name} {profile.last_name}</h2>
        <p className="profile-subline">
          {ROLE_LABELS[profile.role]}
          {profile.filiere ? ` — ${profile.filiere}` : ''}{profile.niveau ? ` ${profile.niveau}` : ''}
        </p>
        {isOwn && friendsCount !== null && (
          <p className="profile-friends-count"><Users size={14} /> {friendsCount} amis</p>
        )}
      </div>

      {!isOwn && profile.relation !== 'blocked_by_me' && profile.relation !== 'blocked_me' && (
        <div className="profile-actions">
          {profile.relation === 'none' && (
            <button className="btn btn-primary btn-block" disabled={busy} onClick={sendRequest}>Ajouter comme ami</button>
          )}
          {profile.relation === 'request_sent' && (
            <button className="btn btn-outline btn-block" disabled={busy} onClick={cancelRequest}>Annuler la demande</button>
          )}
          {profile.relation === 'request_received' && (
            <div className="profile-action-row">
              <button className="btn btn-primary" disabled={busy} onClick={acceptRequest}>Accepter</button>
              <button className="btn btn-outline" disabled={busy} onClick={refuseRequest}>Refuser</button>
            </div>
          )}
          {profile.relation === 'friends' && (
            <div className="profile-action-row">
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/messages/${profile.matricule}`, { state: { friend: profile } })}
              >
                <MessageCircle size={16} /> Message
              </button>
              <button className="btn btn-outline" disabled={busy} onClick={removeFriend}>Retirer</button>
            </div>
          )}
          <button className="btn-link-danger" disabled={busy} onClick={blockUser}>
            <Ban size={14} /> Bloquer cet utilisateur
          </button>
        </div>
      )}

      {!isOwn && profile.relation === 'blocked_by_me' && (
        <div className="profile-actions">
          <p className="empty-state">Tu as bloqué cette personne.</p>
          <button className="btn btn-outline btn-block" disabled={busy} onClick={unblockUser}>Débloquer</button>
        </div>
      )}

      {!isOwn && profile.relation === 'blocked_me' && !user.is_creator && (
        <p className="empty-state">Cette personne t'a bloqué.</p>
      )}

      {!isOwn && profile.relation === 'blocked_me' && user.is_creator && (
        <div className="profile-actions">
          <p className="empty-state">Cette personne t'a bloqué — sans effet sur ton compte créateur.</p>
          <div className="profile-action-row">
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/messages/${profile.matricule}`, { state: { friend: profile } })}
            >
              <MessageCircle size={16} /> Message
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={forceUnblock}>Débloquer</button>
          </div>
        </div>
      )}

      {!isOwn && (
        <div className="profile-report">
          {reportMessage && <p className="form-success">{reportMessage}</p>}
          {reporting ? (
            <form onSubmit={submitReport}>
              <div className="form-field">
                <label htmlFor="report-reason">Pourquoi signales-tu ce compte ?</label>
                <textarea
                  id="report-reason"
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                />
              </div>
              <div className="profile-action-row">
                <button className="btn btn-primary" type="submit" disabled={busy}>Envoyer</button>
                <button className="btn btn-outline" type="button" onClick={() => setReporting(false)}>Annuler</button>
              </div>
            </form>
          ) : (
            <button className="btn-link-danger" onClick={() => setReporting(true)}>
              <Flag size={14} /> Signaler ce compte
            </button>
          )}
        </div>
      )}

      {isOwn && (
        <div className="profile-menu">
          <Link to="/amis" className="profile-menu-item"><Users size={16} /> Mes amis</Link>
          {(profile.role !== 'etudiant' || profile.is_creator) && (
            <Link to="/espace-admin" className="profile-menu-item"><ShieldCheck size={16} /> Espace Admin</Link>
          )}
          {profile.is_creator && (
            <Link to="/espace-createur" className="profile-menu-item"><Sparkles size={16} /> Espace Créateur</Link>
          )}
          <Link to="/parametres" className="profile-menu-item"><Settings size={16} /> Paramètres</Link>
          <Link to="/confidentialite" className="profile-menu-item"><Lock size={16} /> Confidentialité</Link>
          <button className="profile-menu-item danger" onClick={logout}><LogOut size={16} /> Déconnexion</button>
        </div>
      )}
    </div>
  )
}

export default Profile
