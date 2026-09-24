import { authenticateGoogleUser, authenticateUser, createSession, getGoogleSignInStatus, registerUser } from '../services/authService.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_AUTH_INPUT';
  return error;
}

function validateCredentials(email, password) {
  if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
    throw validationError('Please provide a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw validationError('Password must be at least 8 characters.');
  }
}

function sessionResponse(user, token) {
  return { user, token };
}

export async function register(req, res, next) {
  try {
    const { email, password } = req.body || {};
    validateCredentials(email, password);
    const user = await registerUser(email, password);
    const token = await createSession(user);
    return res.status(201).json({ success: true, data: sessionResponse(user, token) });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    validateCredentials(email, password);
    const user = await authenticateUser(email, password);
    const token = await createSession(user);
    return res.status(200).json({ success: true, data: sessionResponse(user, token) });
  } catch (error) {
    return next(error);
  }
}

export async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body || {};
    if (typeof credential !== 'string' || !credential.trim()) {
      throw validationError('A Google sign-in credential is required.');
    }
    const user = await authenticateGoogleUser(credential);
    const token = await createSession(user);
    return res.status(200).json({ success: true, data: sessionResponse(user, token) });
  } catch (error) {
    return next(error);
  }
}

export async function googleStatus(_req, res, next) {
  try {
    const status = await getGoogleSignInStatus();
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return next(error);
  }
}

export function currentUser(req, res) {
  return res.status(200).json({ success: true, data: { user: req.user } });
}
