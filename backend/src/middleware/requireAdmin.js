function authorizationError() {
  const error = new Error('Only TPO or administrator accounts can manage campus jobs.');
  error.statusCode = 403;
  error.code = 'ADMIN_ACCESS_REQUIRED';
  return error;
}

export function requireAdmin(req, _res, next) {
  if (!['TPO', 'ADMIN'].includes(req.user?.role)) return next(authorizationError());
  return next();
}
