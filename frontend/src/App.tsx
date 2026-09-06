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
  const { isAuthenticated, login, logout } = useAuth()

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextRoute: Route) => {
    const path = nextRoute === 'login' ? '/login' : '/'
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setRoute(nextRoute)
  }

  const completeMockLogin = () => {
    login()
    navigate('app')
  }

  const completeLogout = () => {
    logout()
    navigate('login')
  }

  return route === 'login'
    ? <Login onSuccess={completeMockLogin} onReturnToApp={() => navigate('app')} />
    : <Dashboard isAuthenticated={isAuthenticated} onOpenLogin={() => navigate('login')} onLogout={completeLogout} />
}
