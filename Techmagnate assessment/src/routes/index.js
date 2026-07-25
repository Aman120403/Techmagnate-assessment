/**
 * API root router — mounted at /api from app.js.
 * Aggregates health check, task module, and dashboard module routes.
 */
const express = require('express');
const taskRoutes = require('./taskRoutes');
const dashboardRoutes = require('./dashboardRoutes');

const router = express.Router();

/** Liveness probe for local QA / load balancers */
router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ok', ts: new Date().toISOString() });
});

router.use('/tasks', taskRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
