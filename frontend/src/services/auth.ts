const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const AUTH_SESSION_KEY = 'placenexus_auth_session'
const AUTH_CHANGE_EVENT = 'placenexus-auth-change'

export type AuthUser = {
  id: string
  email: string
  role: 'STUDENT' | 'TPO' | 'ADMIN'
  createdAt: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type GoogleSignInStatus = {
  ready: boolean
}

type ApiResponse<T> = {
  data?: T
  error?: { message?: string }
}

function announceAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

function readResponseError(payload: ApiResponse<unknown> | null, fallback: string) {
  return payload?.error?.message || fallback
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new Error('Unable to connect to the account service. Please make sure the backend is running.')
  }

  let payload: ApiResponse<T> | null = null
  try {
    payload = await response.json()
  } catch {
    throw new Error('The account service returned an invalid response.')
  }
  if (!response.ok) throw new Error(readResponseError(payload, 'Unable to complete that request.'))
  if (!payload?.data) throw new Error('The account service returned an incomplete response.')
  return payload.data
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<AuthSession>
  const user = session.user
  return typeof session.token === 'string' && Boolean(session.token) && Boolean(user) && typeof user?.email === 'string'
}

export function getStoredSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(AUTH_SESSION_KEY)
    if (!value) return null
    const session = JSON.parse(value)
    return isAuthSession(session) ? session : null
  } catch {
    return null
  }
}

export function getAuthToken() {
  return getStoredSession()?.token || null
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  announceAuthChange()
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY)
  announceAuthChange()
}

export function onAuthChange(callback: () => void) {
  window.addEventListener(AUTH_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function registerAccount(email: string, password: string) {
  return authRequest<AuthSession>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
}

export function signInAccount(email: string, password: string) {
  return authRequest<AuthSession>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
}

export function signInWithGoogle(credential: string) {
  return authRequest<AuthSession>('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  })
}

export function getGoogleSignInStatus() {
  return authRequest<GoogleSignInStatus>('/auth/google/status')
}

export function getCurrentUser(token: string) {
  return authRequest<{ user: AuthUser }>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(({ user }) => user)
}
