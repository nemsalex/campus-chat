import { useState } from 'react'
import { Image, MessageCircle, School, Sparkles, ChevronRight, X } from 'lucide-react'
import './Onboarding.css'

const STEPS = [
  {
    icon: Sparkles,
    title: 'Bienvenue sur Campus Chat',
    text: "Ton nouvel espace pour rester connecté avec ton campus : discussions, statuts, annonces et bien plus.",
  },
  {
    icon: Image,
    title: 'Statuts',
    text: "Partage des photos ou des messages qui disparaissent après 24h, comme sur WhatsApp. Vois qui les a vus.",
  },
  {
    icon: MessageCircle,
    title: 'Messages',
    text: "Discute en privé ou en groupe, en temps réel : indicateur de saisie, accusés de lecture, réactions, sondages.",
  },
  {
    icon: School,
    title: 'Campus',
    text: "Annonces de ta classe, emploi du temps, groupes de discussion, annuaire — tout ce qui concerne ta vie étudiante.",
  },
]

function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const Icon = current.icon

  const next = () => {
    if (isLast) onClose()
    else setStep((s) => s + 1)
  }

  return (
    <div className="onboarding-overlay">
      <button className="onboarding-skip" onClick={onClose}>
        <X size={14} /> Passer
      </button>
      <div className="onboarding-card">
        <div className="onboarding-icon"><Icon size={36} /></div>
        <h2>{current.title}</h2>
        <p>{current.text}</p>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
        <button className="btn btn-primary btn-block" onClick={next}>
          {isLast ? 'Commencer' : 'Suivant'}
          {!isLast && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  )
}

export default Onboarding
