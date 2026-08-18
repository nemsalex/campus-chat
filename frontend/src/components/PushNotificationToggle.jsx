import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { apiJson } from '../api/client'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function PushNotificationToggle() {
  const [supported] = useState('serviceWorker' in navigator && 'PushManager' in window)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription()
      setSubscribed(!!sub)
    })
  }, [supported])

  if (!supported) return null

  const subscribe = async () => {
    setBusy(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notifications refusées dans le navigateur.')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const { publicKey } = await apiJson('/api/social/push/vapid-key/')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = sub.toJSON()
      await apiJson('/api/social/push/subscribe/', {
        method: 'POST',
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      setSubscribed(true)
    } catch (err) {
      setError(err.message || "Impossible d'activer les notifications.")
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    setError('')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await apiJson('/api/social/push/unsubscribe/', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      setError(err.message || 'Erreur lors de la désactivation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card install-app-card">
      <div className="install-app-icon">{subscribed ? <Bell size={20} /> : <BellOff size={20} />}</div>
      <div className="install-app-text">
        <strong>Notifications push</strong>
        <p>
          {subscribed
            ? 'Tu reçois les nouveaux messages et notifications même app fermée.'
            : 'Reçois les nouveaux messages et notifications même app fermée.'}
        </p>
        {error && <p className="form-error">{error}</p>}
      </div>
      {subscribed ? (
        <button className="btn btn-outline" onClick={unsubscribe} disabled={busy}>Désactiver</button>
      ) : (
        <button className="btn btn-primary" onClick={subscribe} disabled={busy}>Activer</button>
      )}
    </div>
  )
}

export default PushNotificationToggle
