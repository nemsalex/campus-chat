import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Crown, UserMinus, ShieldCheck, ShieldOff, Check, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJson, API_BASE } from '../api/client'
import TimetableList from '../components/TimetableList'
import './GroupDetail.css'

const KIND_LABELS = {
  cycle_licence: 'Cycle Licence',
  cycle_master: 'Cycle Master',
  niveau_annonces: 'Annonces de classe',
  niveau_discussion: 'Discussion de classe',
  club: 'Club / Association',
  projet: 'Groupe de projet',
}

function LeaveRequests({ groupId, onChange }) {
  const [requests, setRequests] = useState([])
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    apiJson(`/api/social/groups/${groupId}/leave-requests/`).then(setRequests)
  }, [groupId])

  useEffect(() => { load() }, [load])

  const act = async (userId, action) => {
    setBusyId(userId)
    try {
      await apiJson(`/api/social/groups/${groupId}/leave-requests/${userId}/${action}/`, { method: 'POST' })
      await load()
      onChange()
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0) return null

  return (
    <>
      <p className="section-title" style={{ marginLeft: 0 }}>Demandes de départ</p>
      <div className="card">
        {requests.map((u) => (
          <div key={u.id} className="group-member-row">
            <span>{u.first_name} {u.last_name}</span>
            <div className="group-member-actions">
              <button className="btn btn-primary" disabled={busyId === u.id} onClick={() => act(u.id, 'confirm')} aria-label="Confirmer">
                <Check size={16} />
              </button>
              <button className="btn btn-outline" disabled={busyId === u.id} onClick={() => act(u.id, 'cancel')} aria-label="Annuler">
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function MembersList({ members, isAdmin, currentUserId, onManage }) {
  return (
    <div className="card">
      {members.map((m) => (
        <div key={m.id} className="group-member-row">
          <Link to={`/profil/${m.id}`} className="group-member-link">
            <div className="avatar" style={{ width: 36, height: 36 }}>
              {m.photo ? <img src={`${API_BASE}${m.photo}`} alt="" /> : m.first_name[0]}
            </div>
            <span>{m.first_name} {m.last_name}</span>
            {m.role === 'admin' && <Crown size={14} className="group-admin-badge" />}
          </Link>
          {isAdmin && m.id !== currentUserId && (
            <div className="group-member-actions">
              {m.role === 'admin' ? (
                <button className="icon-btn" title="Rétrograder" onClick={() => onManage(m.id, 'demote')}><ShieldOff size={16} /></button>
              ) : (
                <button className="icon-btn" title="Promouvoir admin" onClick={() => onManage(m.id, 'promote')}><ShieldCheck size={16} /></button>
              )}
              <button className="icon-btn" title="Retirer" onClick={() => onManage(m.id, 'remove')}><UserMinus size={16} /></button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function GroupInfo() {
  const { id } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => apiJson(`/api/social/groups/${id}/`).then(setGroup), [id])
  useEffect(() => { load() }, [load])

  if (!group) return <p className="empty-state">Chargement...</p>

  const isCycle = group.kind === 'cycle_licence' || group.kind === 'cycle_master'
  const isNiveau = group.kind === 'niveau_annonces' || group.kind === 'niveau_discussion'
  const isPublic = group.kind === 'club' || group.kind === 'projet'

  const leaveOrJoin = async () => {
    setBusy(true)
    try {
      await apiJson(`/api/social/groups/${id}/${group.is_member ? 'leave' : 'join'}/`, { method: 'POST' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const manageMember = async (userId, action) => {
    await apiJson(`/api/social/groups/${id}/members/${userId}/${action}/`, { method: 'POST' })
    await load()
  }

  return (
    <div className="page-padding">
      <div className="back-header">
        <Link to={`/campus/groupes/${id}`} className="back-link" aria-label="Retour"><ArrowLeft size={20} /></Link>
        <h2 className="back-header-title">Infos du groupe</h2>
      </div>

      <div className="card group-detail-header">
        <h2>{group.name}</h2>
        <p className="profile-subline">{KIND_LABELS[group.kind]} · {group.member_count} membre{group.member_count > 1 ? 's' : ''}</p>
        {group.description && <p className="group-detail-description">{group.description}</p>}

        {isPublic && (
          <button
            className={`btn ${group.is_member ? 'btn-outline' : 'btn-secondary'} btn-block`}
            disabled={busy}
            onClick={leaveOrJoin}
          >
            {group.is_member ? 'Quitter le groupe' : 'Rejoindre le groupe'}
          </button>
        )}

        {isCycle && group.is_member && (
          <button className="btn btn-outline btn-block" disabled={busy} onClick={leaveOrJoin}>
            Quitter le groupe
          </button>
        )}

        {isNiveau && group.is_member && (
          group.leave_requested ? (
            <p className="group-leave-pending">Départ en attente de confirmation du chef de classe.</p>
          ) : (
            <button className="btn btn-outline btn-block" disabled={busy} onClick={leaveOrJoin}>
              Demander à quitter le groupe
            </button>
          )
        )}
      </div>

      {group.is_admin && isNiveau && <LeaveRequests groupId={group.id} onChange={load} />}

      {isNiveau && <TimetableList filiere={group.filiere} niveau={group.niveau} />}

      <p className="section-title" style={{ marginLeft: 0 }}>Membres</p>
      <MembersList
        members={group.members}
        isAdmin={isPublic && group.is_admin}
        currentUserId={user.id}
        onManage={manageMember}
      />
    </div>
  )
}

export default GroupInfo
