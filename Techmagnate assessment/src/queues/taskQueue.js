const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Tech Magnate Assessment — in-process FIFO queue for bulk SERP tasks.
 *
 * Why not Bull/Redis? Keeps the stack to Express + Mongo for this assessment.
 * Swap the adapter later if you need persistence across restarts.
 *
 * Concurrency = how many live API calls run in parallel (env QUEUE_CONCURRENCY).
 */
class TaskQueue {
  constructor({ concurrency = 3, processor } = {}) {
    this.concurrency = concurrency;
    this.processor = processor;
    this.jobs = [];
    this.active = 0;
    this.stats = { enqueued: 0, completed: 0, failed: 0 };
  }

  /**
   * Inject the processor after modules load (avoids circular require with taskService).
   */
  setProcessor(fn) {
    this.processor = fn;
  }

  enqueue(job) {
    this.jobs.push(job);
    this.stats.enqueued += 1;
    logger.info(
      `Queue +1 (batch ${job.batchIndex}/${job.totalBatches}, ${job.taskIds.length} tasks) | waiting=${this.jobs.length}`
    );
    this.#pump();
  }

  getStatus() {
    return {
      waiting: this.jobs.length,
      active: this.active,
      ...this.stats,
      concurrency: this.concurrency,
    };
  }

  #pump() {
    while (this.active < this.concurrency && this.jobs.length > 0) {
      const job = this.jobs.shift();
      this.active += 1;
      this.#run(job).finally(() => {
        this.active -= 1;
        this.#pump();
      });
    }
  }

  async #run(job) {
    const { batchId, batchIndex, totalBatches, taskIds } = job;
    logger.info(
      `Processing batch ${batchIndex}/${totalBatches} [${batchId}] — ${taskIds.length} tasks`
    );

    try {
      // Within a batch we still go one-by-one against live/advanced (1 task/call).
      // Outer concurrency controls how many batches overlap.
      for (const taskId of taskIds) {
        await this.processor(taskId);
      }
      this.stats.completed += 1;
      logger.info(`Batch ${batchIndex}/${totalBatches} done`);
    } catch (err) {
      this.stats.failed += 1;
      logger.error(`Batch ${batchIndex} failed:`, err.message);
    }
  }
}

const taskQueue = new TaskQueue({ concurrency: env.queueConcurrency });

module.exports = taskQueue;
