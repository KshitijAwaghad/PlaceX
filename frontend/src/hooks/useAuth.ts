import { useCallback, useState } from 'react'

const MOCK_AUTH_STORAGE_KEY = 'placenexus_auth'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem(MOCK_AUTH_STORAGE_KEY) === 'true')

  const login = useCallback(() => {
    localStorage.setItem(MOCK_AUTH_STORAGE_KEY, 'true')
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY)
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, login, logout }
}
