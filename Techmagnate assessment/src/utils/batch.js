const { MAX_TASKS_PER_BATCH } = require('../config/constants');

/**
 * Split an array into chunks of `size` (default 100).
 * e.g. 250 → [100, 100, 50]
 */
function chunkArray(items, size = MAX_TASKS_PER_BATCH) {
  if (!Array.isArray(items)) {
    throw new TypeError('chunkArray expects an array');
  }
  if (size < 1) {
    throw new RangeError('chunk size must be >= 1');
  }

  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

module.exports = { chunkArray };
