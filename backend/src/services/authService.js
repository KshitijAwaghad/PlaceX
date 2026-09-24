import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDirectory = process.env.AUTH_DATA_DIR
  ? resolve(process.env.AUTH_DATA_DIR)
  : join(backendDirectory, 'data');
const usersFile = join(dataDirectory, 'users.json');
const secretFile = join(dataDirectory, 'auth-secret');
const tokenLifetimeSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS) || 60 * 60 * 24 * 7;

let userWriteQueue = Promise.resolve();
let tokenSecretPromise;
const googleClient = new OAuth2Client();
const googleReadiness = {
  checkedAt: 0,
  ready: false,
  pending: null
};
const googleReadyCacheDurationMs = 5 * 60 * 1000;
const googleUnavailableCacheDurationMs = 30 * 1000;

function authError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (clientId) return clientId;
  throw authError('Google sign-in is not configured on the server.', 503, 'GOOGLE_SIGN_IN_NOT_CONFIGURED');
}

function googleServiceUnavailable() {
  return authError(
    'Google sign-in is temporarily unavailable because the server cannot reach Google\'s verification service. Please try again shortly.',
    503,
    'GOOGLE_IDENTITY_UNAVAILABLE'
  );
}

function shouldUseCachedGoogleReadiness() {
  if (!googleReadiness.checkedAt) return false;
  const cacheDuration = googleReadiness.ready ? googleReadyCacheDurationMs : googleUnavailableCacheDurationMs;
  return Date.now() - googleReadiness.checkedAt < cacheDuration;
}

async function ensureGoogleIdentityReady() {
  getGoogleClientId();

  if (shouldUseCachedGoogleReadiness()) {
    if (googleReadiness.ready) return;
    throw googleServiceUnavailable();
  }

  if (!googleReadiness.pending) {
    googleReadiness.pending = googleClient.getFederatedSignonCerts()
      .then(({ certs }) => {
        if (!Object.keys(certs || {}).length) throw new Error('Google returned no signing certificates.');
        googleReadiness.ready = true;
        googleReadiness.checkedAt = Date.now();
      })
      .catch(() => {
        googleReadiness.ready = false;
        googleReadiness.checkedAt = Date.now();
        throw googleServiceUnavailable();
      })
      .finally(() => {
        googleReadiness.pending = null;
      });
  }

  return googleReadiness.pending;
}

function isGoogleServiceNetworkError(error) {
  const code = String(error?.code || '');
  const status = Number(error?.response?.status || error?.status);
  const message = String(error?.message || '');
  return /^(EAI_AGAIN|ECONNABORTED|ECONNREFUSED|ECONNRESET|ENETUNREACH|ENOTFOUND|ETIMEDOUT|UND_ERR_)/.test(code)
    || status >= 500
    || /certificate|connect|fetch failed|network|socket|timeout/i.test(message);
}

export async function getGoogleSignInStatus() {
  await ensureGoogleIdentityReady();
  return { ready: true };
}

export async function warmGoogleIdentityService() {
  try {
    await ensureGoogleIdentityReady();
    console.log('Google sign-in verification service is ready.');
  } catch (error) {
    console.warn(`Google sign-in verification service is unavailable: ${error.message}`);
  }
}

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

async function readUserStore() {
  await ensureDataDirectory();
  try {
    const contents = await readFile(usersFile, 'utf8');
    const store = JSON.parse(contents);
    if (!store || !Array.isArray(store.users)) throw new Error('Invalid user store.');
    return store;
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: 1, users: [] };
    if (error instanceof SyntaxError || error?.message === 'Invalid user store.') {
      throw authError('The account store could not be read.', 500, 'AUTH_STORE_UNAVAILABLE');
    }
    throw error;
  }
}

async function writeUserStore(store) {
  await writeFile(usersFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function withUserWriteLock(operation) {
  const pending = userWriteQueue.then(operation, operation);
  userWriteQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

function derivePassword(password, salt) {
  return new Promise((resolveHash, reject) => {
    scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolveHash(derivedKey);
    });
  });
}

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString('base64');
  const derivedKey = await derivePassword(password, salt);
  return `${salt}:${derivedKey.toString('base64')}`;
}

async function passwordMatches(password, passwordHash) {
  const [salt, encodedHash] = String(passwordHash || '').split(':');
  if (!salt || !encodedHash) return false;
  const expectedHash = Buffer.from(encodedHash, 'base64');
  const derivedKey = await derivePassword(password, salt);
  return expectedHash.length === derivedKey.length && timingSafeEqual(expectedHash, derivedKey);
}

async function getTokenSecret() {
  if (process.env.AUTH_SECRET?.trim()) return Buffer.from(process.env.AUTH_SECRET.trim(), 'utf8');
  if (!tokenSecretPromise) {
    tokenSecretPromise = (async () => {
      await ensureDataDirectory();
      try {
        return Buffer.from((await readFile(secretFile, 'utf8')).trim(), 'utf8');
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        const secret = randomBytes(48).toString('base64url');
        await writeFile(secretFile, secret, { encoding: 'utf8', mode: 0o600 });
        console.warn('AUTH_SECRET is not set. A local development signing secret was created in the ignored auth data folder.');
        return Buffer.from(secret, 'utf8');
      }
    })();
  }
  return tokenSecretPromise;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encodedPayload) {
  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw authError('Your session is invalid. Please sign in again.', 401, 'INVALID_SESSION');
  }
}

export async function registerUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  return withUserWriteLock(async () => {
    const store = await readUserStore();
    if (store.users.some((user) => user.email === normalizedEmail)) {
      throw authError('An account with that email already exists.', 409, 'EMAIL_ALREADY_REGISTERED');
    }
    const user = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: await createPasswordHash(password),
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
    await writeUserStore(store);
    return publicUser(user);
  });
}

export async function authenticateUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const store = await readUserStore();
  const user = store.users.find((entry) => entry.email === normalizedEmail);
  if (!user || !(await passwordMatches(password, user.passwordHash))) {
    throw authError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
  }
  return publicUser(user);
}

export async function authenticateGoogleUser(credential) {
  let payload;
  try {
    await ensureGoogleIdentityReady();
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: getGoogleClientId() });
    payload = ticket.getPayload();
  } catch (error) {
    if (error?.statusCode) throw error;
    if (isGoogleServiceNetworkError(error)) throw googleServiceUnavailable();
    throw authError('Google could not verify this sign-in. Please try again.', 401, 'INVALID_GOOGLE_CREDENTIAL');
  }

  if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
    throw authError('Google did not provide a verified email address.', 401, 'UNVERIFIED_GOOGLE_EMAIL');
  }

  const email = normalizeEmail(payload.email);
  return withUserWriteLock(async () => {
    const store = await readUserStore();
    let user = store.users.find((entry) => entry.googleSubject === payload.sub);
    let storeChanged = false;

    if (user) {
      if (user.email !== email) {
        const accountUsingEmail = store.users.find((entry) => entry.email === email && entry.id !== user.id);
        if (accountUsingEmail) throw authError('That Google account is already linked to another PlaceNexus account.', 409, 'GOOGLE_ACCOUNT_CONFLICT');
        user.email = email;
        storeChanged = true;
      }
    } else {
      user = store.users.find((entry) => entry.email === email);
      if (user) {
        if (user.googleSubject && user.googleSubject !== payload.sub) {
          throw authError('That email is already linked to another Google account.', 409, 'GOOGLE_ACCOUNT_CONFLICT');
        }
        user.googleSubject = payload.sub;
      } else {
        user = {
          id: randomUUID(),
          email,
          googleSubject: payload.sub,
          createdAt: new Date().toISOString()
        };
        store.users.push(user);
      }
      storeChanged = true;
    }

    if (storeChanged) await writeUserStore(store);
    return publicUser(user);
  });
}

export async function createSession(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds
  };
  const encodedPayload = encodePayload(payload);
  const secret = await getTokenSecret();
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export async function getSessionUser(token) {
  const [encodedPayload, suppliedSignature, ...extraParts] = String(token || '').split('.');
  if (!encodedPayload || !suppliedSignature || extraParts.length) {
    throw authError('Your session is invalid. Please sign in again.', 401, 'INVALID_SESSION');
  }

  const secret = await getTokenSecret();
  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  const suppliedSignatureBuffer = Buffer.from(suppliedSignature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (suppliedSignatureBuffer.length !== expectedSignatureBuffer.length || !timingSafeEqual(suppliedSignatureBuffer, expectedSignatureBuffer)) {
    throw authError('Your session is invalid. Please sign in again.', 401, 'INVALID_SESSION');
  }

  const payload = decodePayload(encodedPayload);
  if (!payload?.sub || !payload?.email || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw authError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
  }

  const store = await readUserStore();
  const user = store.users.find((entry) => entry.id === payload.sub && entry.email === payload.email);
  if (!user) throw authError('Your account is no longer available.', 401, 'INVALID_SESSION');
  return publicUser(user);
}
