/**
 * Module 1 & 2 — Task routes.
 * Single create (validated JSON), bulk CSV upload, and in-process queue status.
 */
const express = require('express');
const taskController = require('../controllers/taskController');
const { singleTaskRules, handleValidation } = require('../validators/taskValidator');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Module 1 — synchronous single task create
router.post(
  '/',
  singleTaskRules,
  handleValidation,
  taskController.createSingle
);

// Module 2 — async bulk CSV (multipart field name: file)
router.post(
  '/bulk',
  upload.single('file'),
  taskController.createBulk
);

// Queue depth / concurrency snapshot for dashboard badge
router.get('/queue/status', taskController.queueStatus);

module.exports = router;
