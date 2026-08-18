import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson, API_BASE } from '../api/client'
import BackHeader from '../components/BackHeader'
import './Search.css'

const ROLE_LABELS = {
  etudiant: 'Étudiant',
  professeur: 'Professeur',
  administration: 'Administration',
  admin_principal: 'Admin principal',
}

function NewConversation() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  const runSearch = async (q) => {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    const data = await apiJson(`/api/social/search/?q=${encodeURIComponent(q.trim())}`)
    setResults(data)
    setSearched(true)
  }

  return (
    <div className="page-padding">
      <BackHeader to="/messages" title="Nouvelle discussion" />

      <div className="form-field">
        <input
          type="text"
          placeholder="Nom, prénom, matricule, filière..."
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          autoFocus
        />
      </div>

      {searched && results.length === 0 && (
        <p className="empty-state">Aucun étudiant trouvé.</p>
      )}

      <div className="search-results">
        {results.map((r) => (
          <button
            key={r.id}
            className="search-result-row card"
            onClick={() => navigate(`/messages/${r.matricule}`)}
          >
            <div className="avatar" style={{ width: 44, height: 44 }}>
              {r.photo ? <img src={`${API_BASE}${r.photo}`} alt="" /> : r.first_name[0]}
            </div>
            <div>
              <strong>{r.first_name} {r.last_name}</strong>
              <p>{ROLE_LABELS[r.role]}{r.filiere ? ` — ${r.filiere}` : ''}{r.niveau ? ` ${r.niveau}` : ''}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default NewConversation
