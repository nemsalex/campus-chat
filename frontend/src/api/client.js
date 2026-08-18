const API_PROTOCOL = window.location.protocol === 'https:' ? 'https' : 'http'
export const API_BASE = `${API_PROTOCOL}://${window.location.hostname}:8000`

export function getTokens() {
  return {
    access: localStorage.getItem('access'),
    refresh: localStorage.getItem('refresh'),
  }
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem('access', access)
  if (refresh) localStorage.setItem('refresh', refresh)
}

export function clearTokens() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
}

async function refreshAccessToken() {
  const { refresh } = getTokens()
  if (!refresh) return null
  const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return null
  const data = await res.json()
  setTokens({ access: data.access })
  return data.access
}

export function forceLogout() {
  clearTokens()
  if (!window.location.pathname.startsWith('/connexion')) {
    window.location.href = '/connexion'
  }
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = { ...(options.headers || {}) }
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const { access } = getTokens()
  if (access) headers.Authorization = `Bearer ${access}`

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && getTokens().refresh) {
    const newAccess = await refreshAccessToken()
    if (newAccess) {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newAccess}` },
      })
    }
    if (!newAccess || res.status === 401) {
      forceLogout()
    }
  }

  return res
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(data?.detail || 'Une erreur est survenue.')
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}
