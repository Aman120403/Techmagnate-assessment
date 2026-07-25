/**
 * MongoDB connection helper.
 * Called once from server.js before the HTTP server starts listening.
 */
const mongoose = require('mongoose');
const { env } = require('./env');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.mongodbUri);

  logger.info(`MongoDB connected → ${mongoose.connection.name}`);

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', err);
  });
}

module.exports = { connectDB };
