export type LoginFieldErrors = {
  email?: string
  password?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  if (!email.trim()) errors.email = 'Please enter your email.'
  else if (!emailPattern.test(email.trim())) errors.email = 'Please enter a valid email.'
  if (!password) errors.password = 'Please enter your password.'
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.'
  return errors
}
