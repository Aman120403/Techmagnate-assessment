/**
 * Wraps async route handlers so rejected promises land in next(err).
 * Avoids try/catch noise in every controller method.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
