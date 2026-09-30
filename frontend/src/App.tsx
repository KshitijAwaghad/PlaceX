import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'

type Route = 'app' | 'login'

function currentRoute(): Route {
  return window.location.pathname === '/login' ? 'login' : 'app'
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
    const path = nextRoute === 'login' ? '/login' : '/placement-hub'
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(nextRoute)
  }

  useEffect(() => {
    if (isCheckingSession) return
    if (!isAuthenticated && route !== 'login') navigate('login', true)
    if (isAuthenticated && (route === 'login' || window.location.pathname === '/')) navigate('app', true)
  }, [isAuthenticated, isCheckingSession, route])

  const completeLogin = async (email: string, password: string) => {
    await login(email, password)
    navigate('app')
  }

  const completeRegistration = async (email: string, password: string) => {
    await register(email, password)
    navigate('app')
  }

  const completeGoogleLogin = async (credential: string) => {
    await loginWithGoogle(credential)
    navigate('app')
  }

  const completeLogout = () => {
    logout()
    navigate('login')
  }

  if (isCheckingSession) return <main className="login-shell" aria-busy="true" />
  if (!isAuthenticated) return <Login onLogin={completeLogin} onRegister={completeRegistration} onGoogleLogin={completeGoogleLogin} />
  return <Dashboard isAuthenticated studentEmail={user?.email} userRole={user?.role} onLogout={completeLogout} />
}
