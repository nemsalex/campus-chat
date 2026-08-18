import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './BackHeader.css'

function BackHeader({ to, title, action }) {
  const navigate = useNavigate()

  return (
    <div className="back-header">
      {to ? (
        <Link to={to} className="back-link" aria-label="Retour"><ArrowLeft size={20} /></Link>
      ) : (
        <button className="back-link" onClick={() => navigate(-1)} aria-label="Retour"><ArrowLeft size={20} /></button>
      )}
      <h2 className="back-header-title">{title}</h2>
      {action && <div className="back-header-action">{action}</div>}
    </div>
  )
}

export default BackHeader
