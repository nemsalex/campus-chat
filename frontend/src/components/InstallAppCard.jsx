import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function InstallAppCard() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !deferredPrompt) return null

  const install = async () => {
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="card install-app-card">
      <div className="install-app-icon"><Smartphone size={20} /></div>
      <div className="install-app-text">
        <strong>Installer Campus Chat</strong>
        <p>Ajoute l'application à ton écran d'accueil pour un accès rapide, même hors connexion.</p>
      </div>
      <button className="btn btn-primary" onClick={install}>
        <Download size={16} /> Installer
      </button>
    </div>
  )
}

export default InstallAppCard
