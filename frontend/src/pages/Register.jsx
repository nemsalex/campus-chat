import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './auth.css'

const ROLES = [
  { value: 'etudiant', label: 'Étudiant' },
  { value: 'professeur', label: 'Professeur' },
  { value: 'administration', label: 'Administration' },
]

function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState('etudiant')
  const [matricule, setMatricule] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [filiere, setFiliere] = useState('')
  const [niveau, setNiveau] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [pendingMessage, setPendingMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
        role,
        ...(role === 'professeur' ? { email: email.trim() } : { matricule: matricule.trim() }),
        ...(role === 'etudiant' ? { filiere: filiere.trim(), niveau: niveau.trim() } : {}),
      }
      const data = await register(payload)
      if (data.access) {
        navigate('/')
      } else {
        setPendingMessage(data.detail)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (pendingMessage) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo"><GraduationCap size={40} /></div>
          <h1>Campus</h1>
          <div className="auth-pending">{pendingMessage}</div>
          <Link to="/connexion" className="btn btn-primary btn-block">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo"><GraduationCap size={40} /></div>
        <h1>Campus</h1>
        <p className="auth-subtitle">Crée ton compte</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="auth-role-group">
            {ROLES.map((r) => (
              <div
                key={r.value}
                className={`auth-role-option ${role === r.value ? 'selected' : ''}`}
                onClick={() => setRole(r.value)}
              >
                {r.label}
              </div>
            ))}
          </div>

          {role === 'professeur' ? (
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          ) : (
            <div className="form-field">
              <label htmlFor="matricule">Matricule</label>
              <input id="matricule" type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} required />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="firstName">Prénom</label>
            <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="lastName">Nom</label>
            <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>

          {role === 'etudiant' && (
            <>
              <div className="form-field">
                <label htmlFor="filiere">Filière</label>
                <input id="filiere" type="text" value={filiere} onChange={(e) => setFiliere(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="niveau">Niveau</label>
                <input id="niveau" type="text" placeholder="ex: L3" value={niveau} onChange={(e) => setNiveau(e.target.value)} />
              </div>
            </>
          )}

          <div className="form-field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div className="form-field">
            <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
            <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>

          {role !== 'etudiant' && (
            <p className="auth-subtitle" style={{ marginBottom: '0.85rem' }}>
              Ce rôle nécessite une validation par l'administration avant activation.
            </p>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Création...' : "S'inscrire"}
          </button>
        </form>

        <div className="auth-links">
          <span>
            Déjà un compte ? <Link to="/connexion">Se connecter</Link>
          </span>
        </div>
      </div>
    </div>
  )
}

export default Register
