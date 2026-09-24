import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { FormEvent, useId, useState } from 'react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { validateLogin, validateRegistration, type LoginFieldErrors } from '../utils/validation'

type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<void>
  onGoogleLogin: (credential: string) => Promise<void>
}

type Mode = 'login' | 'register'

export default function Login({ onLogin, onRegister, onGoogleLogin }: LoginPageProps) {
  const emailId = useId()
  const passwordId = useId()
  const confirmPasswordId = useId()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [state, setState] = useState<'idle' | 'loading'>('idle')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')

  const isRegistration = mode === 'register'

  const switchMode = () => {
    setMode((current) => current === 'login' ? 'register' : 'login')
    setErrors({})
    setFormError('')
    setNotice('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    setFormError('')
    const nextErrors = isRegistration
      ? validateRegistration(email, password, confirmPassword)
      : validateLogin(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setState('loading')
    try {
      if (isRegistration) await onRegister(email.trim(), password)
      else await onLogin(email.trim(), password)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to complete that request.')
    } finally {
      setState('idle')
    }
  }

  return <main className="login-shell">
    <div className="login-grid">
      <section className="login-intro" aria-labelledby="login-product-heading">
        <div className="login-brand">
          <span className="brand-mark" aria-label="PlaceNexus"><span className="brand-mark-p">P</span><span className="brand-mark-n">N</span></span>
          <span>PlaceNexus <i>AI</i></span>
        </div>
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
      </section>

      <section className="login-form-area" aria-labelledby="login-heading">
        <div className="login-card">
          <p className="eyebrow">PLACE NEXUS ACCOUNT</p>
          <h2 id="login-heading">{isRegistration ? 'Create your account' : 'Welcome back'}</h2>
          <p className="login-lede">{isRegistration ? 'Create an account to begin your career intelligence journey.' : 'Sign in to continue your career intelligence journey.'}</p>

          <form noValidate onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor={emailId}>Email</label>
              <input id={emailId} name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })) }} autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${emailId}-error` : undefined} />
              {errors.email && <p id={`${emailId}-error`} className="field-error" role="alert">{errors.email}</p>}
            </div>
            <div className="login-field">
              <div className="label-row"><label htmlFor={passwordId}>Password</label>{!isRegistration && <button type="button" className="forgot-link" onClick={() => setNotice('Password recovery will be available soon.')}>Forgot password?</button>}</div>
              <div className="password-input"><input id={passwordId} name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })) }} autoComplete={isRegistration ? 'new-password' : 'current-password'} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${passwordId}-error` : undefined} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              {errors.password && <p id={`${passwordId}-error`} className="field-error" role="alert">{errors.password}</p>}
            </div>
            {isRegistration && <div className="login-field">
              <label htmlFor={confirmPasswordId}>Confirm password</label>
              <input id={confirmPasswordId} name="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setErrors((current) => ({ ...current, confirmPassword: undefined })) }} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? `${confirmPasswordId}-error` : undefined} />
              {errors.confirmPassword && <p id={`${confirmPasswordId}-error`} className="field-error" role="alert">{errors.confirmPassword}</p>}
            </div>}
            {formError && <p className="field-error" role="alert">{formError}</p>}
            <button className="login-submit" type="submit" disabled={state === 'loading'}>{state === 'loading' ? <><LoaderCircle className="spin" size={17} /> {isRegistration ? 'Creating account…' : 'Signing in…'}</> : <>{isRegistration ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}</button>
          </form>

          <div className="login-divider"><span>or</span></div>
          <GoogleSignInButton disabled={state === 'loading'} onCredential={onGoogleLogin} />
          {notice && <p id="login-notice" className="login-notice" role="status">{notice}</p>}
          <p className="signup-copy">{isRegistration ? 'Already have an account?' : 'Don’t have an account?'} <button type="button" onClick={switchMode}>{isRegistration ? 'Sign in' : 'Create account'}</button></p>
        </div>
      </section>
    </div>
  </main>
}
