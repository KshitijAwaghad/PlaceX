import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import type { AuthUser } from './services/auth'

type Route = 'app' | 'login' | 'tpoLogin'

function currentRoute(): Route {
  if (window.location.pathname === '/tpo/login') return 'tpoLogin'
  return window.location.pathname === '/login' ? 'login' : 'app'
}

function hasTpoAccess(role: AuthUser['role'] | undefined) {
  return role === 'TPO' || role === 'ADMIN'
}

function homePath(role: AuthUser['role'] | undefined) {
  return hasTpoAccess(role) ? '/tpo/dashboard' : '/placement-hub'
}

function isProtectedTpoPath(pathname = window.location.pathname) {
  return pathname.startsWith('/tpo/') && pathname !== '/tpo/login'
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute)
  const { user, isAuthenticated, isCheckingSession, login, register, loginWithGoogle, logout } = useAuth()

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextRoute: Route, replace = false) => {
    const path = nextRoute === 'login' ? '/login' : nextRoute === 'tpoLogin' ? '/tpo/login' : '/placement-hub'
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(nextRoute)
  }

  const navigateToPath = (path: string, replace = false) => {
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(currentRoute())
  }

  useEffect(() => {
    if (isCheckingSession) return
    if (!isAuthenticated) {
      if (route === 'app') navigate(isProtectedTpoPath() ? 'tpoLogin' : 'login', true)
      return
    }
    if (route === 'login' || route === 'tpoLogin' || window.location.pathname === '/') {
      navigateToPath(homePath(user?.role), true)
      return
    }
    if (isProtectedTpoPath() && !hasTpoAccess(user?.role)) navigateToPath('/placement-hub', true)
  }, [isAuthenticated, isCheckingSession, route, user?.role])

  const completeLogin = async (email: string, password: string) => {
    const authenticatedUser = await login(email, password)
    navigateToPath(homePath(authenticatedUser.role))
  }

  const completeRegistration = async (email: string, password: string) => {
    const authenticatedUser = await register(email, password)
    navigateToPath(homePath(authenticatedUser.role))
  }

  const completeGoogleLogin = async (credential: string) => {
    const authenticatedUser = await loginWithGoogle(credential)
    navigateToPath(homePath(authenticatedUser.role))
  }

  const completeTpoLogin = async (email: string, password: string) => {
    const authenticatedUser = await login(email, password, (user) => hasTpoAccess(user.role))
    navigateToPath('/tpo/dashboard')
  }

  const completeTpoGoogleLogin = async (credential: string) => {
    const authenticatedUser = await loginWithGoogle(credential, (user) => hasTpoAccess(user.role))
    navigateToPath('/tpo/dashboard')
  }

  const completeLogout = () => {
    logout()
    navigate('login')
  }

  if (isCheckingSession) return <main className="login-shell" aria-busy="true" />
  if (!isAuthenticated) return <Login key={route} onLogin={route === 'tpoLogin' ? completeTpoLogin : completeLogin} onRegister={completeRegistration} onGoogleLogin={route === 'tpoLogin' ? completeTpoGoogleLogin : completeGoogleLogin} tpoOnly={route === 'tpoLogin'} onOpenTpoLogin={() => navigate('tpoLogin')} onOpenStudentLogin={() => navigate('login')} />
  return <Dashboard isAuthenticated studentEmail={user?.email} userRole={user?.role} onLogout={completeLogout} />
}
