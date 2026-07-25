/**
 * Tech Magnate Assessment — Express app factory.
 * Middleware, static dashboard, API routes, error handlers.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const taskQueue = require('./queues/taskQueue');
const taskService = require('./services/taskService');
const { env } = require('./config/env');

const app = express();

// Wire queue → service after both modules exist (breaks the circular require)
taskQueue.setProcessor((taskId) => taskService.processQueuedTask(taskId));

app.use(
  helmet({
    // Dashboard is same-origin static UI; CSP disabled so inline scripts in public/ can run
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static dashboard
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
