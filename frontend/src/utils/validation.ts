export type LoginFieldErrors = {
  email?: string
  password?: string
  confirmPassword?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  if (!email.trim()) errors.email = 'Please enter your email.'
  else if (!emailPattern.test(email.trim())) errors.email = 'Please enter a valid email.'
  if (!password) errors.password = 'Please enter your password.'
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.'
  return errors
}

export function validateRegistration(email: string, password: string, confirmPassword: string): LoginFieldErrors {
  const errors = validateLogin(email, password)
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.'
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  return errors
}
