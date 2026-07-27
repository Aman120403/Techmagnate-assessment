const { randomUUID } = require('crypto');
const Task = require('../models/Task');
const dataForSeoService = require('./dataForSeoService');
const taskQueue = require('../queues/taskQueue');
const { chunkArray } = require('../utils/batch');
const ApiError = require('../utils/ApiError');
const { TASK_STATUS, MAX_TASKS_PER_BATCH } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Tech Magnate Assessment — task business logic.
 * Controllers stay thin; this layer owns create / bulk enqueue / queue worker.
 */
class TaskService {
  /**
   * Single task: hit DataForSEO immediately, persist result.
   */
  async createSingle(input, createdBy = 'api') {
    const mapped = await dataForSeoService.createLiveOrganicTask(input);

    const doc = await Task.create({
      ...mapped,
      status:
        mapped.status_code === 20000 ? TASK_STATUS.SUCCESS : TASK_STATUS.FAILED,
      created_by: createdBy,
    });

    return doc;
  }

  /**
   * Bulk path:
   *  1. Insert all valid rows as queued documents
   *  2. Split into batches of 100
   *  3. Hand each batch to the in-process queue
   */
  async enqueueBulk(validRows, createdBy = 'bulk-upload') {
    if (!validRows.length) {
      throw new ApiError(400, 'No valid rows to submit');
    }

    //creates one unique id for this upload
    const batchId = randomUUID();
    //Convert every CSV row into a MongoDB document.
    const docs = validRows.map((row) => ({
      keyword: row.keyword,
      language_code: row.language_code,
      location_code: row.location_code,
      priority: row.priority,
      status: TASK_STATUS.QUEUED, //Initially every task is queued, meaning waiting to be processed.
      created_by: createdBy,
      batch_id: batchId, //Every task gets the same batch ID.
    }));

    //Insert all tasks into MongoDB.
    const inserted = await Task.insertMany(docs, { ordered: false });// { ordered: false }-If one document fails,MongoDB continues inserting the others.
    //Split large uploads into smaller batches.
    const batches = chunkArray(inserted, MAX_TASKS_PER_BATCH);

    logger.info(
      `Bulk enqueue: ${inserted.length} tasks → ${batches.length} batch(es) [batch_id=${batchId}]`
    );

    batches.forEach((batch, index) => {
      //Adds one batch into the queue.
      taskQueue.enqueue({
        batchId,
        batchIndex: index + 1,
        totalBatches: batches.length,
        taskIds: batch.map((t) => t._id.toString()),//Store only MongoDB IDs.
      });
    });

    return {
      batch_id: batchId,
      total_tasks: inserted.length,
      total_batches: batches.length,
      batch_sizes: batches.map((b) => b.length),
      tasks: inserted,
    };
  }

  /**
   * Worker callback — process one queued task against live API.
   */
  async processQueuedTask(taskId) {
    const task = await Task.findById(taskId);
    if (!task) {
      logger.warn(`Queue worker: task ${taskId} not found, skipping`);
      return;
    }

    task.status = TASK_STATUS.PROCESSING;
    await task.save();

    try {
      const mapped = await dataForSeoService.createLiveOrganicTask({
        keyword: task.keyword,
        language_code: task.language_code,
        location_code: task.location_code,
        priority: task.priority,
      });

      task.task_id = mapped.task_id;
      task.status_code = mapped.status_code;
      task.status_message = mapped.status_message;
      task.cost = mapped.cost;
      task.time = mapped.time;
      task.raw_response = mapped.raw_response;
      task.status =
        mapped.status_code === 20000 ? TASK_STATUS.SUCCESS : TASK_STATUS.FAILED;
      task.error_detail =
        mapped.status_code === 20000 ? null : mapped.status_message;
      await task.save();
    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.status_message = err.message;
      task.error_detail = err.details
        ? JSON.stringify(err.details).slice(0, 2000)
        : err.message;
      await task.save();
      // Don't rethrow — one bad row shouldn't kill the whole batch
      logger.error(`Task ${taskId} failed:`, err.message);
    }
  }
}

module.exports = new TaskService();
