const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Last-mile error handler — must be registered after all routes.
 */
function errorHandler(err, req, res, _next) {
  // Multer file-size / unexpected-field errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof ApiError || err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      details: err.details || undefined,
    });
  }

  // Mongoose cast / validation
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  logger.error('Unhandled error', err);
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
}

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { errorHandler, notFound };
