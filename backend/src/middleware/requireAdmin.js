function authorizationError() {
  const error = new Error('Only placement administrators can manage jobs.');
  error.statusCode = 403;
  error.code = 'ADMIN_ACCESS_REQUIRED';
  return error;
}

function configuredAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function requireAdmin(req, _res, next) {
  if (!configuredAdminEmails().has(String(req.user?.email || '').toLowerCase())) return next(authorizationError());
  return next();
}
