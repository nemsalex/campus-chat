import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { apiJson } from '../api/client'
import './auth.css'

function ConfirmCreator() {
  const { token } = useParams()
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    apiJson('/api/auth/creator/confirm/', { method: 'POST', body: JSON.stringify({ token }) })
      .then((data) => {
        setState('success')
        setMessage(data.detail)
      })
      .catch((err) => {
        setState('error')
        setMessage(err.message)
      })
  }, [token])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo"><Sparkles size={40} /></div>
        <h1>Compte créateur</h1>

        {state === 'loading' && <p className="auth-subtitle">Confirmation en cours...</p>}
        {state === 'success' && <p className="form-success">{message}</p>}
        {state === 'error' && <p className="form-error">{message}</p>}

        {state !== 'loading' && (
          <Link to="/connexion" className="btn btn-primary btn-block">Aller à la connexion</Link>
        )}
      </div>
    </div>
  )
}

export default ConfirmCreator
