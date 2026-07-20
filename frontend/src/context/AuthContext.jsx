import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authAPI } from '../api'
import api, { _tokenRef } from '../api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const accessTokenRef = useRef(null)

  const setToken = (token) => {
    accessTokenRef.current = token
    _tokenRef.current = token
    api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : ''
  }

  useEffect(() => {
    const stored = localStorage.getItem('accessToken')
    if (stored) {
      setToken(stored)
      authAPI.getMe()
        .then(({ data }) => setUser(data.user))
        .catch(() => {
          setToken(null)
          localStorage.removeItem('accessToken')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password })
    setToken(data.accessToken)
    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData)
    setToken(data.accessToken)
    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch { /* proceed regardless */ }
    setToken(null)
    localStorage.removeItem('accessToken')
    setUser(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setUser((prev) => ({ ...prev, ...updates }))
  }, [])

  const isAdmin   = user?.role === 'admin'
  const isPatient = user?.role === 'patient'

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin,
      isPatient,
      login,
      register,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}