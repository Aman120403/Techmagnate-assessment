const asyncHandler = require('../utils/asyncHandler');
const taskService = require('../services/taskService');
const { parseAndValidateCsv } = require('../services/csvService');
const { validateTaskPayload } = require('../validators/taskValidator');
const taskQueue = require('../queues/taskQueue');
const ApiError = require('../utils/ApiError');

/**
 * Tech Magnate Assessment — Module 1 & 2 controllers (single create + bulk CSV).
 */
const createSingle = asyncHandler(async (req, res) => {
  // Re-run through shared normaliser so language/location aliases stay consistent
  const check = validateTaskPayload({
    keyword: req.body.keyword,
    language: req.body.language ?? req.body.language_code,
    location: req.body.location ?? req.body.location_code,
    priority: req.body.priority,
  });

  if (!check.ok) {
    throw new ApiError(422, 'Validation failed', check.errors);
  }

  const createdBy = req.body.created_by || req.headers['x-user'] || 'api';
  const task = await taskService.createSingle(check.value, createdBy);

  res.status(201).json({
    success: true,
    message: 'Task created',
    data: task,
  });
});

/**
 * Module 2 — Bulk CSV Upload (Tech Magnate Assessment)
 * POST /api/tasks/bulk  (multipart field: file)
 *
 * Returns invalid rows immediately; only valid ones get queued.
 */
const createBulk = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'CSV file is required (field name: file)');
  }
  
  const { valid, invalid, totalRows } = parseAndValidateCsv(req.file.buffer);

  let enqueueResult = null;
  if (valid.length) {
    const createdBy = req.body.created_by || req.headers['x-user'] || 'bulk-upload';
    //Calling enqueueBulk()
    enqueueResult = await taskService.enqueueBulk(valid, createdBy);
  }

  //sending the final response back to the client after the CSV has been processed
  //it also provides an endpoint to check the queue status.
  res.status(acceptedStatus(valid, invalid)).json({
    success: true,
    message: buildBulkMessage(valid, invalid),
    data: {
      total_rows: totalRows,
      valid_count: valid.length,
      invalid_count: invalid.length,
      invalid_rows: invalid,
      queue: enqueueResult
        ? {
            batch_id: enqueueResult.batch_id,
            total_tasks: enqueueResult.total_tasks,
            total_batches: enqueueResult.total_batches,
            batch_sizes: enqueueResult.batch_sizes,
          }
        : null,
      // IDs only — full docs are heavy for 100+ rows
      task_ids: enqueueResult
        ? enqueueResult.tasks.map((t) => t._id)
        : [],
    },
  });
});

//Creates an API endpoint like:
const queueStatus = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: taskQueue.getStatus(),
  });
});

function acceptedStatus(valid, invalid) {
  if (valid.length && invalid.length) return 207; // partial success: some queued, some rejected
  if (!valid.length && invalid.length) return 422;
  return 202; // accepted for async processing
}

function buildBulkMessage(valid, invalid) {
  if (valid.length && !invalid.length) {
    return `${valid.length} tasks queued for processing`;
  }
  if (!valid.length && invalid.length) {
    return 'All rows failed validation — nothing queued';
  }
  return `${valid.length} tasks queued, ${invalid.length} rows rejected`;
}

module.exports = {
  createSingle,
  createBulk,
  queueStatus,
};
