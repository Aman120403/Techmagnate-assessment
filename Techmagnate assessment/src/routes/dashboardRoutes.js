/**
 * Module 3 — Dashboard routes.
 * List (paginated/filtered) and single-task detail for the UI and API clients.
 */
const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/tasks', dashboardController.listTasks);
router.get('/tasks/:id', dashboardController.getTask);

module.exports = router;
