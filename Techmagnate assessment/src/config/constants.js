/**
 * Magic numbers / shared limits — one place to tweak behaviour.
 */
module.exports = {
  // DataForSEO task_post allows up to 100; we keep the same ceiling for our batches.
  // Note: live/advanced accepts 1 task per HTTP call — batch = work unit in our queue.
  MAX_TASKS_PER_BATCH: 100,

  PRIORITY_MIN: 1,
  PRIORITY_MAX: 2,

  TASK_STATUS: {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    SUCCESS: 'success',
    FAILED: 'failed',
  },

  SORTABLE_FIELDS: [
    'created_at',
    'keyword',
    'language_code',
    'location_code',
    'priority',
    'status',
    'cost',
    'task_id',
  ],

  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};
