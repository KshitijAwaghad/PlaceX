import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { validateLogin, type LoginFieldErrors } from '../utils/validation'

type LoginPageProps = {
  onSuccess: () => void
  onReturnToApp: () => void
}

export default function Login({ onSuccess, onReturnToApp }: LoginPageProps) {
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [state, setState] = useState<'idle' | 'loading'>('idle')
  const [notice, setNotice] = useState('')
  const completionTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current)
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    const nextErrors = validateLogin(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setState('loading')
    completionTimer.current = window.setTimeout(() => {
      completionTimer.current = null
      onSuccess()
    }, 500)
  }

  return <main className="login-shell">
    <div className="login-grid">
      <section className="login-intro" aria-labelledby="login-product-heading">
        <button className="login-brand" type="button" onClick={onReturnToApp} aria-label="Return to PlaceNexus application">
          <span className="brand-mark">P<span>N</span></span>
          <span>PlaceNexus <i>AI</i></span>
        </button>
        <div className="login-intro-copy">
          <p className="eyebrow">CAREER INTELLIGENCE, MADE PERSONAL</p>
          <h1 id="login-product-heading">Your career, <em>decoded.</em></h1>
          <p>Upload your resume. Understand your fit. Build your next move.</p>
          <ul className="login-promise" aria-label="PlaceNexus benefits">
            <li>Evidence-led role matching</li>
            <li>Prioritized next steps</li>
            <li>A clearer interview story</li>
          </ul>
        </div>
        <div className="login-accent" aria-hidden="true"><span /><span /><span /></div>
        <button className="return-link" type="button" onClick={onReturnToApp}><ArrowLeft size={15} /> Back to PlaceNexus</button>
      </section>

      <section className="login-form-area" aria-labelledby="login-heading">
        <div className="login-card">
          <p className="eyebrow">PLACE NEXUS ACCOUNT</p>
          <h2 id="login-heading">Welcome back</h2>
          <p className="login-lede">Continue your career intelligence journey.</p>

          <form noValidate onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor={emailId}>Email</label>
              <input id={emailId} name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })) }} autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${emailId}-error` : undefined} />
              {errors.email && <p id={`${emailId}-error`} className="field-error" role="alert">{errors.email}</p>}
            </div>
            <div className="login-field">
              <div className="label-row"><label htmlFor={passwordId}>Password</label><button type="button" className="forgot-link" onClick={() => setNotice('Password recovery will be available soon.')}>Forgot password?</button></div>
              <div className="password-input"><input id={passwordId} name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })) }} autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${passwordId}-error` : undefined} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              {errors.password && <p id={`${passwordId}-error`} className="field-error" role="alert">{errors.password}</p>}
            </div>
            <button className="login-submit" type="submit" disabled={state === 'loading'}>{state === 'loading' ? <><LoaderCircle className="spin" size={17} /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}</button>
          </form>

          <>
            <div className="login-divider"><span>or</span></div>
            <button className="google-button" type="button" onClick={() => setNotice('Google sign-in will be available soon.')} aria-describedby={notice ? 'login-notice' : undefined}><span className="google-g" aria-hidden="true">G</span> Continue with Google</button>
            {notice && <p id="login-notice" className="login-notice" role="status">{notice}</p>}
            <p className="signup-copy">Don’t have an account? <button type="button" onClick={() => setNotice('Account creation will be available soon.')}>Create account</button></p>
          </>
        </div>
      </section>
    </div>
  </main>
}
