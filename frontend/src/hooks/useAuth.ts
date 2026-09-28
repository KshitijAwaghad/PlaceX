import { useCallback, useEffect, useState } from 'react'
import { clearAuthSession, getCurrentUser, getStoredSession, onAuthChange, registerAccount, saveAuthSession, signInAccount, signInWithGoogle } from '../services/auth'

export function useAuth() {
  const [session, setSession] = useState(getStoredSession)
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getStoredSession()))

  useEffect(() => onAuthChange(() => setSession(getStoredSession())), [])

  useEffect(() => {
    if (!session) {
      setIsCheckingSession(false)
      return
    }

    let cancelled = false
    setIsCheckingSession(true)
    getCurrentUser(session.token)
      .then((user) => {
        if (!cancelled) saveAuthSession({ ...session, user })
      })
      .catch(() => {
        if (!cancelled) clearAuthSession()
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false)
      })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const nextSession = await signInAccount(email, password)
    saveAuthSession(nextSession)
    setSession(nextSession)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const nextSession = await registerAccount(email, password)
    saveAuthSession(nextSession)
    setSession(nextSession)
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const nextSession = await signInWithGoogle(credential)
    saveAuthSession(nextSession)
    setSession(nextSession)
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    setSession(null)
  }, [])

  return { user: session?.user || null, isAuthenticated: Boolean(session), isCheckingSession, login, register, loginWithGoogle, logout }
}
