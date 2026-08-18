import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './auth.css'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(identifiant.trim(), password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo"><GraduationCap size={40} /></div>
        <h1>Campus</h1>
        <p className="auth-subtitle">Connecte-toi à ton compte</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-field">
            <label htmlFor="identifiant">Matricule ou email</label>
            <input
              id="identifiant"
              type="text"
              placeholder="Matricule (étudiants) ou email (profs)"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="auth-links">
          <span className="auth-link-disabled">Mot de passe oublié ?</span>
          <span>
            Pas encore de compte ? <Link to="/inscription">S'inscrire</Link>
          </span>
        </div>
      </div>
    </div>
  )
}

export default Login
