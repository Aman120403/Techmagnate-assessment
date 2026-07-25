const mongoose = require('mongoose');
const { TASK_STATUS, PRIORITY_MIN, PRIORITY_MAX } = require('../config/constants');

/**
 * Tech Magnate Assessment — Task model.
 * Mirrors DataForSEO live response fields we care about,
 * plus our own lifecycle status for the dashboard/queue.
 */
const taskSchema = new mongoose.Schema(
  {
    task_id: {
      type: String,
      default: null,
      index: true,
    },
    status_code: {
      type: Number,
      default: null,
    },
    status_message: {
      type: String,
      default: null,
    },
    cost: {
      type: Number,
      default: null,
    },
    time: {
      type: String,
      default: null,
    },
    keyword: {
      type: String,
      required: true,
      trim: true,
      maxlength: 700,
    },
    location_code: {
      type: Number,
      required: true,
    },
    language_code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    priority: {
      type: Number,
      required: true,
      min: PRIORITY_MIN,
      max: PRIORITY_MAX,
    },
    // Our internal pipeline status (queued → processing → success|failed)
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.QUEUED,
      index: true,
    },
    created_by: {
      type: String,
      default: 'system',
      trim: true,
    },
    // Link rows that came from the same CSV / bulk job
    batch_id: {
      type: String,
      default: null,
      index: true,
    },
    error_detail: {
      type: String,
      default: null,
    },
    // Optional: stash raw SERP payload if you need it later
    raw_response: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Dashboard filters hit these together often
taskSchema.index({ keyword: 'text' });
taskSchema.index({ created_at: -1 });
taskSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
