import { useCallback, useEffect, useState } from 'react'
import { clearAuthSession, getCurrentUser, getStoredSession, onAuthChange, registerAccount, saveAuthSession, signInAccount, signInWithGoogle, type AuthSession } from '../services/auth'

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

  const login = useCallback(async (email: string, password: string, accessAllowed?: (user: AuthSession['user']) => boolean) => {
    const nextSession = await signInAccount(email, password)
    if (accessAllowed && !accessAllowed(nextSession.user)) throw new Error('This account does not have TPO/Admin access.')
    saveAuthSession(nextSession)
    setSession(nextSession)
    return nextSession.user
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const nextSession = await registerAccount(email, password)
    saveAuthSession(nextSession)
    setSession(nextSession)
    return nextSession.user
  }, [])

  const loginWithGoogle = useCallback(async (credential: string, accessAllowed?: (user: AuthSession['user']) => boolean) => {
    const nextSession = await signInWithGoogle(credential)
    if (accessAllowed && !accessAllowed(nextSession.user)) throw new Error('This account does not have TPO/Admin access.')
    saveAuthSession(nextSession)
    setSession(nextSession)
    return nextSession.user
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    setSession(null)
  }, [])

  return { user: session?.user || null, isAuthenticated: Boolean(session), isCheckingSession, login, register, loginWithGoogle, logout }
}
