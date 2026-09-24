import { useEffect, useRef, useState } from 'react'
import { getGoogleSignInStatus } from '../services/auth'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
const GOOGLE_SCRIPT_ID = 'google-identity-services'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (configuration: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
      }) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let googleLibraryPromise: Promise<void> | null = null

function loadGoogleIdentityLibrary() {
  if (window.google?.accounts.id) return Promise.resolve()
  if (googleLibraryPromise) return googleLibraryPromise

  googleLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Sign-In could not be loaded. Check your internet connection and try again.'))
    document.head.appendChild(script)
  })
  return googleLibraryPromise
}

type GoogleSignInButtonProps = {
  disabled?: boolean
  onCredential: (credential: string) => Promise<void>
}

export default function GoogleSignInButton({ disabled = false, onCredential }: GoogleSignInButtonProps) {
  const buttonContainer = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonContainer.current) return
    let cancelled = false

    const renderButton = async () => {
      setCheckingAvailability(true)
      setError('')
      try {
        await getGoogleSignInStatus()
        await loadGoogleIdentityLibrary()
        if (cancelled || !buttonContainer.current || !window.google?.accounts.id) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          cancel_on_tap_outside: true,
          callback: async ({ credential }) => {
            if (!credential) {
              setError('Google did not return a sign-in credential. Please try again.')
              return
            }
            setBusy(true)
            setError('')
            try {
              await onCredential(credential)
            } catch (submissionError) {
              if (!cancelled) setError(submissionError instanceof Error ? submissionError.message : 'Unable to sign in with Google.')
            } finally {
              if (!cancelled) setBusy(false)
            }
          }
        })
        buttonContainer.current.replaceChildren()
        window.google.accounts.id.renderButton(buttonContainer.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 326
        })
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Google Sign-In could not be loaded.')
      } finally {
        if (!cancelled) setCheckingAvailability(false)
      }
    }

    void renderButton()
    return () => { cancelled = true }
  }, [attempt, onCredential])

  if (!GOOGLE_CLIENT_ID) {
    return <p className="login-notice" role="status">Google sign-in is not configured yet. Add <code>VITE_GOOGLE_CLIENT_ID</code> to the frontend environment.</p>
  }

  return <>
    <div className={`google-sign-in ${busy || disabled || checkingAvailability ? 'busy' : ''}`} ref={buttonContainer} aria-busy={busy || checkingAvailability || undefined} />
    {checkingAvailability && <p className="login-notice" role="status">Checking Google sign-in…</p>}
    {error && <p className="field-error" role="alert">{error} <button className="google-retry" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></p>}
  </>
}
