/**
 * Centralised env access.
 * Fail fast on missing secrets in production — silent fallbacks hide broken deploys.
 */
function readEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const mock =
    String(process.env.DATAFORSEO_MOCK || 'false').toLowerCase() === 'true';

  if (nodeEnv === 'production' && !mock) {
    const required = ['MONGODB_URI', 'DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
  }

  return Object.freeze({
    port: Number(process.env.PORT) || 5000,
    nodeEnv,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tech_magnate_assessment',
    dataForSeo: {
      login: process.env.DATAFORSEO_LOGIN || '',
      password: process.env.DATAFORSEO_PASSWORD || '',
      baseUrl: process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com/v3',
      // true = docs-shaped fixture, no HTTP call (local / submission without keys)
      mock,
    },
    queueConcurrency: Number(process.env.QUEUE_CONCURRENCY) || 3,
    maxCsvRows: Number(process.env.MAX_CSV_ROWS) || 1000,
  });
}

const env = readEnv();

module.exports = { env };
