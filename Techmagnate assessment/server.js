/**
 * Tech Magnate Assessment — entry point.
 * Boots config, DB, then HTTP. Wiring lives in src/app.js
 */
require('dotenv').config();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { env } = require('./src/config/env');
const logger = require('./src/utils/logger');

async function bootstrap() {
  await connectDB();
  const server = app.listen(env.port, () => {
    logger.info(`Server listening on http://localhost:${env.port} [${env.nodeEnv}]`);
  });

  // Graceful shutdown — don't leave Mongo sockets hanging on Ctrl+C
  const shutdown = (signal) => {
    logger.warn(`${signal} received, shutting down...`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
