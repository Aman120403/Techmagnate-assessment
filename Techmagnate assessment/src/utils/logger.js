/**
 * Tiny logger — console wrappers with timestamps.
 * Swap for winston/pino later without touching call sites.
 */
function stamp() {
  return new Date().toISOString();
}

const logger = {
  info: (...args) => console.log(`[${stamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${stamp()}] [ERROR]`, ...args),
};

module.exports = logger;
