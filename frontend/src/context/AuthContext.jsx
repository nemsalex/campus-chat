import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { apiJson, setTokens, clearTokens, getTokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    const { access } = getTokens()
    if (!access) {
      setLoading(false)
      return
    }
    try {
      const me = await apiJson('/api/auth/me/')
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const login = async (identifiant, password) => {
    const data = await apiJson('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ identifiant, password }),
    })
    setTokens(data)
    setUser(data.user)
    return data.user
  }

  const register = async (payload) => {
    const data = await apiJson('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (data.access) {
      setTokens(data)
      setUser(data.user)
    }
    return data
  }

  const logout = () => {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
