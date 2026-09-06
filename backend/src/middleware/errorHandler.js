export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} was not found.` }
  });
}

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Resume files must be 10MB or smaller.' : error.message;
    return res.status(400).json({ success: false, error: { code: error.code, message } });
  }

  if (error?.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_FILE_TYPE', message: error.message }
    });
  }

  if (error?.code === 'TEXT_EXTRACTION_FAILED') {
    return res.status(422).json({
      success: false,
      error: { code: error.code, message: error.message }
    });
  }

  const status = Number(error?.statusCode || error?.status) || 500;
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    error: { code: error?.code || 'SERVER_ERROR', message: error?.message || 'Unable to process this request.' }
  });
}
